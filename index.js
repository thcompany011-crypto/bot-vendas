const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const AUDIO_LINKS = {
    conexao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-conexao_x4ii21.ogg",
    solucao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-solucao_fz03yy.ogg",
    apresentacao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-apresentacao_nje9um.ogg",
    condicao: "https://res.cloudinary.com/druvgkgkm/video/upload/v1771734797/aurora-condicao_eenhxl.ogg"
};

const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol";
const GATILHO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    console.log('--- 🚀 TENTATIVA FINAL DE VOZ: SR. ALEX ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '10.15.7']
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('\n✅ ALEX ONLINE - TESTANDO TRUQUE DE ÁUDIO MP4');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        async function enviarVozMagica(jid, url, tempo) {
            try {
                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempo);

                // O TRUQUE: Enviamos a URL direta e dizemos que é audio/mp4
                // Isso resolve 99% dos problemas de áudio mudo em bots
                await sock.sendMessage(jid, { 
                    audio: { url: url }, 
                    mimetype: 'audio/mp4', 
                    ptt: true 
                });
                console.log(`🎙️ Áudio enviado via URL direta!`);
            } catch (e) { console.log(`❌ Erro: ${e.message}`); }
        }

        if (!userState[from]) {
            if (texto !== GATILHO) return;
            await enviarVozMagica(from, AUDIO_LINKS.conexao, 5000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta: o que mais te incomoda hoje?" });
            userState[from] = { step: 1 };
            return;
        }

        if (userState[from].step === 1) {
            await enviarVozMagica(from, AUDIO_LINKS.solucao, 5000);
            await delay(2000);
            await enviarVozMagica(from, AUDIO_LINKS.apresentacao, 5000);
            userState[from].step = 2;
        }
    });
}
iniciarAlex();
