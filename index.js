console.log('--- 🚀 INICIANDO O ROBÔ DO SR. ALEX ---');

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');

// LINKS OFICIAIS (COM O PONTO FINAL QUE VOCÊ TESTOU)
const AUDIO_LINKS = {
    conexao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-conexao.ogg",
    solucao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-solucao.ogg",
    apresentacao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-apresentacao.ogg",
    condicao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-condicao.ogg"
};

const GATILHO = "oi vim pela vista o anúncio da aurora pink";

async function iniciarAlex() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['Mac OS', 'Chrome', '10.15.7'],
            printQRInTerminal: false,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log('\n✅ ALEX ONLINE E PRONTO PARA VENDER R$ 297!');
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) iniciarAlex();
            }
        });

        sock.ev.on('messages.upsert', async m => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

            async function enviarAudioRemoto(jid, url, tempo) {
                try {
                    console.log(`📡 Baixando áudio: ${url}`);
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    await sock.sendPresenceUpdate('recording', jid);
                    await delay(tempo);
                    await sock.sendMessage(jid, { 
                        audio: Buffer.from(response.data), 
                        mimetype: 'audio/ogg; codecs=opus', 
                        ptt: true 
                    });
                    console.log(`🎙️ Áudio enviado com som!`);
                } catch (e) { console.log(`❌ Erro no áudio: ${e.message}`); }
            }

            if (texto === GATILHO) {
                console.log(`🚀 Novo Lead: ${from}`);
                await enviarAudioRemoto(from, AUDIO_LINKS.conexao, 4000);
                await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
            }
        });

    } catch (error) {
        console.log('❌ Erro crítico na inicialização:', error);
    }
}

iniciarAlex();
