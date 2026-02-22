const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// LINKS COM O PONTO FINAL QUE O SENHOR TESTOU E FUNCIONARAM
const AUDIO_LINKS = {
    conexao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-conexao.ogg",
    solucao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-solucao.ogg",
    apresentacao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-apresentacao.ogg",
    condicao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-condicao.ogg"
};

const GATILHO = "oi vim pela vista o anúncio da aurora pink";

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '10.15.7'],
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => { if (u.connection === 'open') console.log('\n🚀 ALEX ONLINE - ÁUDIOS .OGG ATIVADOS!'); });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        async function enviarAudioRemoto(jid, url, tempo) {
            try {
                console.log(`📡 Baixando áudio de: ${url}`);
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);

                console.log(`✅ Download ok! Tamanho: ${buffer.length} bytes`);

                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempo);

                await sock.sendMessage(jid, { 
                    audio: buffer, 
                    mimetype: 'audio/ogg; codecs=opus', 
                    ptt: true 
                });
                console.log(`🎙️ Áudio enviado com som para ${jid}`);
            } catch (e) { console.log(`❌ Erro no link: ${e.message}`); }
        }

        if (texto === GATILHO) {
            // AQUI ESTAVA O ERRO: ANTES BUSCAVA .M4A, AGORA BUSCA .OGG
            await enviarAudioRemoto(from, AUDIO_LINKS.conexao, 4000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
        }
    });
}
iniciarAlex();
