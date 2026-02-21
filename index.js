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
        if (connection === 'open') console.log('\n🚀 ALEX ONLINE - PRONTO PARA VENDER COMBO R$ 297!');
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
                } catch (e) { console.log(`Erro ao enviar ${nomeArquivo}:`, e); }
            }
        }

        async function enviarTextoHumano(jid, mensagem, tempoDigitando) {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(tempoDigitando);
            await sock.sendMessage(jid, { text: mensagem });
        }

        // --- FLUXO DE ATENDIMENTO ---
        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO) return;
            await enviarAudioHumano(from, 'aurora-conexao.ogg', 4000);
            await enviarTextoHumano(from, "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*", 2000);
            userState[from] = { step: 1 };
            return;
        }

        if (userState[from].step === 1) {
            await enviarAudioHumano(from, 'aurora-solucao.ogg', 5000);
            await delay(1500);
            await enviarAudioHumano(from, 'aurora-apresentacao.ogg', 4000);
            await enviarTextoHumano(from, "O Aurora Pink resolve isso rápido! Além da garantia de 30 dias, temos um cuidado especial com o envio. ✨", 2000);
            userState[from].step = 2;
            return;
        }

        if (userState[from].step === 2) {
            await enviarAudioHumano(from, 'aurora-condicao.ogg', 6000);
            await enviarTextoHumano(from, "*OFERTA ESPECIAL DO DIA:*\n\n🔥 Combo 5 Unidades: *R$ 297,00*\n\n📍 Me passa seu *CEP e endereço completo*? Vou consultar aqui o sistema agora!", 3000);
            userState[from].step = 3;
            return;
        }
        
        // ... (resto do código de coleta e Coinzz)
    });
}
iniciarAlex();

