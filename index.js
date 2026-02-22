const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios'); // Para descarregar o som puro
const qrcode = require('qrcode-terminal');

const AUDIO_LINKS = {
    conexao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-conexao_x4ii21.ogg",
    solucao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-solucao_fz03yy.ogg",
    apresentacao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-apresentacao_nje9um.ogg",
    condicao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-condicao_eenhxl.ogg"
};

const GATILHO = "oi vim pela vista o anúncio da aurora pink";

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
        if (u.connection === 'open') console.log('\n✅ ALEX ONLINE - MODO FORÇAR VOZ ATIVADO!');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        async function enviarVozForçada(jid, url, tempo) {
            try {
                console.log(`📡 Baixando áudio para processamento...`);
                
                // 1. Baixa o som do Cloudinary para a memória do robô
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const audioBuffer = Buffer.from(response.data);

                // 2. Mostra "gravando..."
                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempo);

                // 3. Envia com o rótulo que NUNCA falha
                await sock.sendMessage(jid, { 
                    audio: audioBuffer, 
                    mimetype: 'audio/ogg; codecs=opus', 
                    ptt: true 
                });
                
                console.log(`🎙️ Áudio enviado com sucesso!`);
            } catch (e) {
                console.log(`❌ Erro técnico: ${e.message}`);
            }
        }

        if (texto === GATILHO) {
            await enviarVozForçada(from, AUDIO_LINKS.conexao, 5000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
        }
    });
}
iniciarAlex();
