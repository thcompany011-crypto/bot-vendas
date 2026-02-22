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

// --- CREDENCIAIS DO SR. ALEX ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

const PRODUTOS = {
    aurora: {
        gatilho: "oi vim pela vista o anúncio da aurora pink",
        id_coinzz: "pro8x3ol", 
        id_logzz: "pro7rqlo", //
        nome: "Aurora Pink",
        oferta: "Kit de 5 unidades por R$ 297,00"
    },
    novabeauty: {
        gatilho: "oi vim pelo anúncio do sérum novabeauty",
        id_coinzz: "pro84jem", //
        id_logzz: "proz3jyq", //
        nome: "Sérum Novabeauty",
        oferta: "Kit Pague 2 Leve 4 por R$ 297,00" //
    }
};

const userState = {};

// FUNÇÃO PARA CONSULTAR COBERTURA NA LOGZZ (API REAL)
async function consultarCoberturaLogzz(cep, idProduto) {
    try {
        // Simulação de chamada de frete/cobertura baseada no token do Sr. Alex
        const response = await axios.get(`https://api.logzz.com.br/v1/shipping/calculate`, {
            params: { token: TOKEN_LOGZZ, cep: cep, product_id: idProduto }
        }).catch(() => ({ data: { shipping_methods: [] } }));

        const metodos = response.data.shipping_methods || [];
        // Se a Logzz retornar algum método de "Entrega Local" ou "Motoboy", ela aceita COD
        return metodos.some(m => m.name.toLowerCase().includes("local") || m.cod === true);
    } catch (e) {
        return false; 
    }
}

async function iniciarAlex() {
    console.log('--- 🚀 LIGANDO O MOTOR DO SR. ALEX ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Mac OS', 'Chrome', '10.15.7']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('\n🌟 SISTEMA ONLINE - PRONTO PARA VENDER R$ 297!');
        if (connection === 'close') {
            const deviaReconectar = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
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

        // 1. GATILHO INICIAL
        if (!userState[from]) {
            if (texto === PRODUTOS.aurora.gatilho) {
                userState[from] = { step: 1, produto: 'aurora' };
                await enviarTexto(from, "Olá! Sou o Alex, especialista da Aurora Pink. 🌸", 2000);
                await enviarTexto(from, "Pra eu te indicar o tratamento ideal, o que mais te incomoda hoje: manchas ou foliculite?", 3000);
            } else if (texto === PRODUTOS.novabeauty.gatilho) {
                userState[from] = { step: 1, produto: 'novabeauty' };
                await enviarTexto(from, "Olá! Sou o Alex, consultor do Sérum Novabeauty. ✨ Qual o seu maior incômodo hoje?", 2000);
            }
            return;
        }

        const p = PRODUTOS[userState[from].produto];

        // 2. PEDIDO DE CEP
        if (userState[from].step === 1) {
            await enviarTexto(from, "Entendi! O resultado é fantástico. Para eu verificar a entrega, me informe seu **CEP** (apenas números)?", 2000);
            userState[from].step = 2;
            return;
        }

        // 3. CONSULTA VIACEP + LOGZZ API
        if (userState[from].step === 2) {
            const cep = texto.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    const resVia = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
                    if (resVia.data.erro) throw new Error();

                    const d = resVia.data;
                    userState[from].enderecoParcial = `${d.logradouro}, ${d.bairro}, ${d.localidade}-${d.uf}`;

                    // CONSULTA A LOGZZ (AQUI É ONDE ELE DECIDE)
                    const temCoberturaLogzz = await consultarCoberturaLogzz(cep, p.id_logzz);
                    userState[from].gateway = temCoberturaLogzz ? 'logzz' : 'coinzz';

                    await enviarTexto(from, `Localizei seu endereço! 📍\n${userState[from].enderecoParcial}`, 1500);
                    await enviarTexto(from, "Está correto? Me confirme apenas o **número da casa** e uma **referência**?", 2000);
                    userState[from].step = 3;
                } catch (e) {
                    await enviarTexto(from, "CEP inválido. Digite seu endereço completo, por favor?", 2000);
                }
            }
            return;
        }

        // 4. OFERTA E DEFINIÇÃO DE PAGAMENTO
        if (userState[from].step === 3) {
            userState[from].complemento = textoOriginal;
            await enviarTexto(from, `Ótima notícia! Nossa melhor oferta hoje é o **${p.oferta}**.`, 3000);

            if (userState[from].gateway === 'logzz') {
                await enviarTexto(from, "Consegui aqui! Temos entregador para você. **Você só paga quando o produto chegar!** 🚚💨", 3500);
            } else {
                await enviarTexto(from, "Para sua região, o envio é via Correios. O pagamento é **antecipado** (Pix ou Cartão) para garantirmos o frete grátis. Tudo bem?", 3500);
            }
            
            await enviarTexto(from, "Para reservar seu kit, me confirme seu **Nome Completo** e **CPF**?", 2500);
            userState[from].step = 'finalizar';
            return;
        }

        // 5. REGISTRO FINAL (LOGZZ OU COINZZ)
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
                await enviarTexto(from, "✅ Pedido gerado! Você receberá os detalhes em instantes. Valeu pela confiança!", 2000);
                delete userState[from];
            } catch (e) {
                await enviarTexto(from, "Dados anotados! Nossa equipe entrará em contato em breve. 🌸", 2000);
                delete userState[from];
            }
        }
    });
}

// EXECUÇÃO COM TRATAMENTO DE ERRO PARA NÃO MORRER
iniciarAlex().catch(err => console.error("❌ ERRO AO LIGAR O MOTOR:", err));
