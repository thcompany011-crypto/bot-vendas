const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const MEU_NUMERO = "5562994593862"; 
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol";
const GATILHO_ANUNCIO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log('\n🚀 O ALEX ESTÁ ONLINE E PARECENDO HUMANO!');
        if (connection === 'close') iniciarAlex();
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // ETAPA 1: CONEXÃO
        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO) return;

            console.log(`🚀 LEAD IDENTIFICADO: ${from}`);
            
            // Simula gravando áudio por 4 segundos
            await sock.sendPresenceUpdate('recording', from);
            await delay(4000);
            
            try {
                await sock.sendMessage(from, { 
                    audio: fs.readFileSync("./audios/aurora-conexao.mp3"), 
                    mimetype: 'audio/mpeg', 
                    ptt: true 
                });
            } catch (e) { console.log("Erro áudio"); }
            
            // Simula digitando por 2 segundos
            await sock.sendPresenceUpdate('composing', from);
            await delay(2000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?* (Pode mandar foto se preferir 📸)" });
            
            userState[from] = { step: 1 };
            return;
        }

        // ETAPA 2: SOLUÇÃO
        if (userState[from].step === 1) {
            // Primeiro áudio
            await sock.sendPresenceUpdate('recording', from);
            await delay(5000);
            try {
                await sock.sendMessage(from, { 
                    audio: fs.readFileSync("./audios/aurora-solucao.mp3"), 
                    mimetype: 'audio/mpeg', 
                    ptt: true 
                });
            } catch (e) { console.log("Erro áudio"); }

            // Segundo áudio
            await delay(1500);
            await sock.sendPresenceUpdate('recording', from);
            await delay(4000);
            try {
                await sock.sendMessage(from, { 
                    audio: fs.readFileSync("./audios/aurora-apresentacao.mp3"), 
                    mimetype: 'audio/mpeg', 
                    ptt: true 
                });
            } catch (e) { console.log("Erro áudio"); }
            
            await sock.sendPresenceUpdate('composing', from);
            await delay(2000);
            await sock.sendMessage(from, { text: "O Aurora Pink resolve isso rápido! Além da garantia de 30 dias, temos um cuidado especial com o envio para sua região. ✨" });
            userState[from].step = 2;
            return;
        }

        // ETAPA 3: OFERTA (R$ 297)
        if (userState[from].step === 2) {
            await sock.sendPresenceUpdate('recording', from);
            await delay(6000); // Áudio da oferta é mais longo
            try {
                await sock.sendMessage(from, { 
                    audio: fs.readFileSync("./audios/aurora-condicao.mp3"), 
                    mimetype: 'audio/mpeg', 
                    ptt: true 
                });
            } catch (e) { console.log("Erro áudio"); }
            
            await sock.sendPresenceUpdate('composing', from);
            await delay(3000);
            await sock.sendMessage(from, { text: "*OFERTA ESPECIAL DO DIA:*\n\n🔥 Combo 5 Unidades: *R$ 297,00*\n✨ (Tratamento completo com desconto máximo)\n\n📍 Me passa seu *CEP e endereço completo*? Vou consultar aqui o sistema agora!" });
            userState[from].step = 3;
            return;
        }

        // ETAPA 4: DADOS
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendPresenceUpdate('composing', from);
            await delay(2000);
            await sock.sendMessage(from, { text: "Perfeito! Já estou consultando aqui e reservando o seu kit no sistema." });
            await delay(1500);
            await sock.sendPresenceUpdate('composing', from);
            await delay(2000);
            await sock.sendMessage(from, { text: "Para finalizar o registro e gerar sua garantia, me confirme seu *Nome Completo* e *CPF*? 👇" });
            userState[from].step = 'finalizar';
            return;
        }

        // ETAPA 5: FINALIZAÇÃO
        if (userState[from].step === 'finalizar') {
            await sock.sendPresenceUpdate('composing', from);
            await delay(3000);
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | Combo 5 Unids | " + userState[from].endereco,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ Pedido Confirmado! Em breve receberá as atualizações do envio. Valeu pela confiança! 👊" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Dados recebidos! Minha equipe entrará em contato em instantes para confirmar seu kit. 🌸" });
            }
        }
    });
}

iniciarAlex();

