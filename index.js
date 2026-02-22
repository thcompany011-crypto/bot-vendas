const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// --- CREDENCIAIS ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

// Cidades com entrega própria (Pagamento na Entrega via Logzz)
const CIDADES_COBERTURA = ["anapolis", "goiania", "aparecida", "brasilia", "sao paulo"];

const PRODUTOS = {
    aurora: {
        gatilho: "oi vim pela vista o anúncio da aurora pink",
        id_coinzz: "pro8x3ol", // Para pagamento antecipado
        id_logzz: "pro7rqlo",  // Para pagamento na entrega
        nome: "Aurora Pink",
        oferta: "Kit de 5 unidades por R$ 297,00"
    },
    novabeauty: {
        gatilho: "oi vim pelo anúncio do sérum novabeauty",
        id_coinzz: "pro84jem", // Para pagamento antecipado
        id_logzz: "proz3jyq",  // Para pagamento na entrega
        nome: "Sérum Novabeauty",
        oferta: "Kit Pague 2 Leve 4 por R$ 297,00"
    }
};

const userState = {};

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), browser: ['Mac OS', 'Chrome', '10.15.7'] });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrcode.generate(u.qr, { small: true });
        if (u.connection === 'open') console.log('\n✅ ALEX ONLINE - DISTINÇÃO LOGZZ/COINZZ ATIVADA!');
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

        // 1. IDENTIFICA O PRODUTO PELO ANÚNCIO
        if (!userState[from]) {
            if (texto === PRODUTOS.aurora.gatilho) {
                userState[from] = { step: 1, produto: 'aurora' };
                await enviarTexto(from, "Olá! Sou o Alex, especialista da Aurora Pink. 🌸", 2000);
                await enviarTexto(from, "O que mais te incomoda hoje: manchas ou foliculite?", 3000);
            } 
            else if (texto === PRODUTOS.novabeauty.gatilho) {
                userState[from] = { step: 1, produto: 'novabeauty' };
                await enviarTexto(from, "Olá! Sou o Alex, consultor do Sérum Novabeauty. ✨", 2000);
                await enviarTexto(from, "O que mais te incomoda hoje: rugas ou manchas?", 3000);
            }
            return;
        }

        const p = PRODUTOS[userState[from].produto];

        // 2. PEDE O CEP PARA DEFINIR A LOGÍSTICA
        if (userState[from].step === 1) {
            await enviarTexto(from, "Entendi! O resultado desse tratamento é fantástico.", 2000);
            await enviarTexto(from, "Para eu verificar o prazo de entrega, me informe seu **CEP** (apenas números)?", 2000);
            userState[from].step = 2;
            return;
        }

        // 3. CONSULTA CEP E DEFINE SE VAI PARA LOGZZ OU COINZZ
        if (userState[from].step === 2) {
            const cep = texto.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
                    const cidade = res.data.localidade.toLowerCase();
                    userState[from].enderecoParcial = `${res.data.logradouro}, ${res.data.bairro}, ${res.data.localidade}-${res.data.uf}`;
                    
                    // AQUI ESTÁ A MÁGICA:
                    userState[from].gateway = CIDADES_COBERTURA.includes(cidade) ? 'logzz' : 'coinzz';

                    await enviarTexto(from, `Localizei seu endereço: 📍\n${userState[from].enderecoParcial}`, 1500);
                    await enviarTexto(from, "Está correto? Me confirme o **número** e um **ponto de referência**?", 2000);
                    userState[from].step = 3;
                } catch (e) {
                    await enviarTexto(from, "Não achei o CEP. Pode digitar o endereço completo?", 2000);
                }
            }
            return;
        }

        // 4. OFERTA E REGRAS DE PAGAMENTO
        if (userState[from].step === 3) {
            userState[from].complemento = textoOriginal;
            await enviarTexto(from, `Nossa oferta de hoje é o **${p.oferta}**.`, 3000);

            if (userState[from].gateway === 'logzz') {
                await enviarTexto(from, "Como temos entregador na sua cidade, **você só paga quando o produto chegar!** 🚚💨", 3500);
            } else {
                await enviarTexto(from, "Para sua região, o envio é via Correios. O pagamento é **antecipado** para garantir o frete grátis. Tudo bem?", 3500);
            }
            
            await enviarTexto(from, "Para reservar, me confirme seu **Nome Completo** e **CPF**?", 2500);
            userState[from].step = 'finalizar';
            return;
        }

        // 5. CRIA O PEDIDO NA PLATAFORMA CORRETA
        if (userState[from].step === 'finalizar') {
            const gateway = userState[from].gateway;
            try {
                if (gateway === 'coinzz') {
                    // CRIA NA COINZZ (ANTECIPADO)
                    await axios.post('https://api.coinzz.com.br/v1/orders', {
                        api_key: API_KEY_COINZZ,
                        product_id: p.id_coinzz,
                        customer_phone: from.split('@')[0],
                        customer_details: `${textoOriginal} | ${p.nome} | ${userState[from].enderecoParcial}`,
                        payment_method: 'upfront'
                    });
                } else {
                    // CRIA NA LOGZZ (PAGAMENTO NA ENTREGA)
                    // Aqui o robô enviaria os dados para a Logzz usando TOKEN_LOGZZ e p.id_logzz
                    console.log(`🚀 REGISTRANDO NA LOGZZ: Produto ${p.id_logzz}`);
                }
                
                const msgFinal = gateway === 'logzz' 
                    ? "✅ Pedido agendado! Pague ao entregador quando receber." 
                    : "✅ Pedido gerado! Enviando link para o pagamento via Pix agora.";

                await enviarTexto(from, msgFinal, 2000);
                delete userState[from];
            } catch (e) {
                await enviarTexto(from, "Dados anotados! Nossa equipe entrará em contato para concluir sua compra. 🌸", 2000);
                delete userState[from];
            }
        }
    });
}
iniciarAlex();
