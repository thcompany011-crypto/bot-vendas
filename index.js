const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// --- CONFIGURAÇÕES DO SR. ALEX ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

const CIDADES_COBERTURA = ["anapolis", "goiania", "aparecida", "brasilia", "sao paulo"];

const PRODUTOS = {
    aurora: {
        gatilho: "oi vim pela vista o anúncio da aurora pink",
        id_coinzz: "pro8x3ol",
        id_logzz: "pro7rqlo", // ID Logzz
        nome: "Aurora Pink",
        oferta: "Kit de 5 unidades por R$ 297,00"
    },
    novabeauty: {
        gatilho: "oi vim pelo anúncio do sérum novabeauty",
        id_coinzz: "pro84jem", // ID Coinzz
        id_logzz: "proz3jyq", // ID Logzz
        nome: "Sérum Novabeauty",
        oferta: "Kit Pague 2 Leve 4 por R$ 297,00"
    }
};

const userState = {};

async function iniciarAlex() {
    console.log('--- 🚀 INICIANDO SISTEMA DO SR. ALEX ---');
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true, // Garante que o QR apareça
            browser: ['Mac OS', 'Chrome', '10.15.7']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (u) => {
            const { connection, lastDisconnect, qr } = u;
            if (qr) {
                console.log('✅ QR CODE GERADO! ESCANEIE ABAIXO:');
                qrcode.generate(qr, { small: true });
            }
            if (connection === 'open') {
                console.log('\n🌟 SISTEMA ONLINE - PRONTO PARA VENDER R$ 297!');
            }
            if (connection === 'close') {
                const deviaReconectar = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                console.log('⚠️ Conexão fechada. Tentando reconectar...', deviaReconectar);
                if (deviaReconectar) iniciarAlex();
            }
        });

        sock.ev.on('messages.upsert', async m => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const textoOriginal = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
            const texto = textoOriginal.toLowerCase();

            async function enviarTexto(jid, txt, tempo) {
                await sock.sendPresenceUpdate('composing', jid);
                await delay(tempo);
                await sock.sendMessage(jid, { text: txt });
            }

            // --- LÓGICA DE GATILHOS E FUNIL ---
            if (!userState[from]) {
                if (texto === PRODUTOS.aurora.gatilho) {
                    userState[from] = { step: 1, produto: 'aurora' };
                    await enviarTexto(from, "Olá! Sou o Alex da Aurora Pink. 🌸 Como posso te ajudar?", 2000);
                } else if (texto === PRODUTOS.novabeauty.gatilho) {
                    userState[from] = { step: 1, produto: 'novabeauty' };
                    await enviarTexto(from, "Olá! Sou o Alex, consultor do Sérum Novabeauty. ✨ Qual o seu maior incômodo?", 2000);
                }
                return;
            }

            const p = PRODUTOS[userState[from].produto];

            // ETAPA: SOLICITAR CEP
            if (userState[from].step === 1) {
                await enviarTexto(from, "Para eu verificar o prazo e a entrega, me informe seu **CEP** (apenas números)?", 2000);
                userState[from].step = 2;
                return;
            }

            // ETAPA: CONSULTA CEP E GATEWAY
            if (userState[from].step === 2) {
                const cep = texto.replace(/\D/g, '');
                if (cep.length === 8) {
                    try {
                        const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
                        if (res.data.erro) throw new Error();
                        const cidade = res.data.localidade.toLowerCase();
                        userState[from].enderecoParcial = `${res.data.logradouro}, ${res.data.bairro}, ${res.data.localidade}-${res.data.uf}`;
                        userState[from].gateway = CIDADES_COBERTURA.includes(cidade) ? 'logzz' : 'coinzz';

                        await enviarTexto(from, `Localizei! 📍\n${userState[from].enderecoParcial}`, 1500);
                        await enviarTexto(from, "Está correto? Me confirme o **número** e um **ponto de referência**?", 2000);
                        userState[from].step = 3;
                    } catch (e) {
                        await enviarTexto(from, "Não achei o CEP. Pode digitar o endereço completo?", 2000);
                    }
                }
                return;
            }

            // ETAPA: OFERTA E FECHAMENTO
            if (userState[from].step === 3) {
                userState[from].complemento = textoOriginal;
                await enviarTexto(from, `Nossa oferta de hoje é o **${p.oferta}**.`, 3000);
                if (userState[from].gateway === 'logzz') {
                    await enviarTexto(from, "Temos entregador na sua cidade! **Você só paga quando receber.** 🚚", 3500);
                } else {
                    await enviarTexto(from, "O envio será via Correios. O pagamento é **antecipado** para garantir frete grátis. Tudo bem?", 3500);
                }
                await enviarTexto(from, "Para finalizar, me confirme seu **Nome Completo** e **CPF**?", 2500);
                userState[from].step = 'finalizar';
                return;
            }

            if (userState[from].step === 'finalizar') {
                try {
                    if (userState[from].gateway === 'coinzz') {
                        await axios.post('https://api.coinzz.com.br/v1/orders', {
                            api_key: API_KEY_COINZZ,
                            product_id: p.id_coinzz,
                            customer_phone: from.split('@')[0],
                            customer_details: `${textoOriginal} | ${p.nome} | ${userState[from].enderecoParcial}`,
                            payment_method: 'upfront'
                        });
                    }
                    await enviarTexto(from, "✅ Pedido gerado! Em instantes você receberá os detalhes. Valeu pela confiança!", 2000);
                    delete userState[from];
                } catch (e) {
                    await enviarTexto(from, "Dados anotados! Entraremos em contato em breve. 🌸", 2000);
                    delete userState[from];
                }
            }
        });

    } catch (err) {
        console.error('❌ ERRO CRÍTICO AO INICIAR:', err);
    }
}

// Inicia o processo
iniciarAlex();
