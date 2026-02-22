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

// --- CREDENCIAIS ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

const PRODUTOS = {
    aurora: {
        gatilho: "oi vim pela vista o anúncio da aurora pink",
        id_coinzz: "pro8x3ol",
        id_logzz: "pro7rqlo",
        nome: "Aurora Pink",
        oferta: "Kit de 5 unidades por R$ 297,00"
    },
    novabeauty: {
        gatilho: "oi vim pelo anúncio do sérum novabeauty",
        id_coinzz: "pro84jem",
        id_logzz: "proz3jyq",
        nome: "Sérum Novabeauty",
        oferta: "Kit Pague 2 Leve 4 por R$ 297,00"
    }
};

const userState = {};

// FUNÇÃO PARA CONSULTAR COBERTURA NA LOGZZ VIA API
async function consultarCoberturaLogzz(cep, idProduto) {
    try {
        const response = await axios.get(`https://api.logzz.com.br/v1/shipping/calculate`, {
            params: {
                token: TOKEN_LOGZZ,
                cep: cep,
                product_id: idProduto
            }
        });

        // Verifica se entre as opções de entrega retornadas existe "Pagamento na Entrega" (COD)
        const metodos = response.data.shipping_methods || [];
        return metodos.some(m => m.name.toLowerCase().includes("entrega local") || m.cod === true);
    } catch (e) {
        console.error("Erro ao consultar API Logzz:", e.message);
        return false; // Por segurança, se a API falhar, assume que não tem cobertura
    }
}

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '10.15.7']
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrcode.generate(u.qr, { small: true });
        if (u.connection === 'open') console.log('\n✅ ALEX ONLINE - CONSULTA API LOGZZ ATIVA!');
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
                await enviarTexto(from, "Olá! Sou o Alex da Aurora Pink. 🌸", 2000);
                await enviarTexto(from, "O que mais te incomoda hoje: manchas ou foliculite?", 3000);
            } else if (texto === PRODUTOS.novabeauty.gatilho) {
                userState[from] = { step: 1, produto: 'novabeauty' };
                await enviarTexto(from, "Olá! Sou o Alex, consultor do Sérum Novabeauty. ✨", 2000);
                await enviarTexto(from, "O que mais te incomoda hoje: rugas ou manchas?", 3000);
            }
            return;
        }

        const p = PRODUTOS[userState[from].produto];

        // 2. PEDIDO DE CEP
        if (userState[from].step === 1) {
            await enviarTexto(from, "Para eu verificar a entrega para você, me informe o seu **CEP** (apenas números)?", 2000);
            userState[from].step = 2;
            return;
        }

        // 3. CONSULTA VIACEP + API LOGZZ (DIFERENCIAL)
        if (userState[from].step === 2) {
            const cep = texto.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    // Consulta o endereço para mostrar ao cliente
                    const resViaCep = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
                    if (resViaCep.data.erro) throw new Error();

                    const d = resViaCep.data;
                    userState[from].enderecoParcial = `${d.logradouro}, ${d.bairro}, ${d.localidade}-${d.uf}`;

                    // CONSULTA A LOGZZ EM TEMPO REAL
                    const temCobertura = await consultarCoberturaLogzz(cep, p.id_logzz);
                    userState[from].gateway = temCobertura ? 'logzz' : 'coinzz';

                    await enviarTexto(from, `Localizei! 📍\n${userState[from].enderecoParcial}`, 1500);
                    await enviarTexto(from, "Está correto? Me confirme o **número da casa** e uma **referência**?", 2000);
                    userState[from].step = 3;
                } catch (e) {
                    await enviarTexto(from, "CEP inválido. Pode digitar o endereço completo?", 2000);
                }
            }
            return;
        }

        // 4. OFERTA E PAGAMENTO
        if (userState[from].step === 3) {
            userState[from].complemento = textoOriginal;
            await enviarTexto(from, `Nossa oferta hoje é o **${p.oferta}**.`, 3000);

            if (userState[from].gateway === 'logzz') {
                await enviarTexto(from, "Verifiquei aqui e temos entregador próprio para você! **Você só paga quando receber.** 🚚💨", 3500);
            } else {
                await enviarTexto(from, "Para sua região, o envio é via Correios. O pagamento é **antecipado** para garantir o frete grátis. Tudo bem?", 3500);
            }
            
            await enviarTexto(from, "Para reservar seu kit, me confirme seu **Nome Completo** e **CPF**?", 2500);
            userState[from].step = 'finalizar';
            return;
        }

        // 5. REGISTRO FINAL
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
                await enviarTexto(from, "✅ Pedido gerado! Você receberá os detalhes em instantes. Obrigado!", 2000);
                delete userState[from];
            } catch (e) {
                await enviarTexto(from, "Dados anotados! Entraremos em contato em breve para finalizar. 🌸", 2000);
                delete userState[from];
            }
        }
    });
}
iniciarAlex();
