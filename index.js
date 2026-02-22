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
const path = require('path');
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
        browser: ['Mac OS', 'Chrome', '10.15.7'],
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log('\n🚀 ALEX ONLINE - TUDO PRONTO!');
        if (connection === 'close') iniciarAlex();
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        async function enviarAudioHumano(jid, nomeArquivo, tempoGravando) {
            const caminho = path.resolve(__dirname, 'audios', nomeArquivo);
            if (fs.existsSync(caminho)) {
                try {
                    await sock.sendPresenceUpdate('recording', jid);
                    await delay(tempoGravando);
                    await sock.sendMessage(jid, { 
                        audio: fs.readFileSync(caminho), 
                        mimetype: 'audio/ogg; codecs=opus', 
                        ptt: true 
                    });
                    console.log(`✅ Áudio enviado: ${nomeArquivo}`);
                } catch (e) { console.log(`❌ Erro no envio:`, e); }
            } else {
                console.log(`⚠️ Arquivo não encontrado: ${nomeArquivo}`);
            }
        }

        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO) return;
            console.log(`🚀 LEAD IDENTIFICADO: ${from}`);
            await enviarAudioHumano(from, 'aurora-conexao.ogg', 4000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
            userState[from] = { step: 1 };
            return;
        }

        if (userState[from].step === 1) {
            await enviarAudioHumano(from, 'aurora-solucao.ogg', 4000);
            await delay(1500);
            await enviarAudioHumano(from, 'aurora-apresentacao.ogg', 4000);
            userState[from].step = 2;
            return;
        }

        if (userState[from].step === 2) {
            await enviarAudioHumano(from, 'aurora-condicao.ogg', 6000);
            await sock.sendMessage(from, { text: "📍 Me passa seu *CEP* para eu consultar o envio?" });
            userState[from].step = 3;
            return;
        }

        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Perfeito! Me confirme seu *Nome Completo* e *CPF*? 👇" });
            userState[from].step = 'finalizar';
            return;
        }

        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | Combo 5 Unids | " + userState[from].endereco,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ Pedido Confirmado! Valeu pela confiança! 👊" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Dados recebidos! Entraremos em contato em instantes. 🌸" });
            }
        }
    });
}

iniciarAlex();
