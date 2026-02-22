const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const AUDIO_LINKS = {
    conexao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-conexao.ogg",
    solucao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-solucao.ogg",
    apresentacao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-apresentacao.ogg",
    condicao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-condicao.ogg"
};

const GATILHO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    console.log('--- 🚀 MOTOR DO SR. ALEX: TESTE DE SOM FINAL ---');
    
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
        if (qr) {
            console.log('⚠️ ESCANEIE O QR CODE:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') console.log('\n✅ ALEX ONLINE - AGUARDANDO GATILHO PARA TESTE DE VOZ!');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        async function enviarVozDireta(jid, url, tempo) {
            try {
                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempo);

                // O SEGREDO: Usar a URL diretamente e mudar o mimetype para audio/mp4
                // Mesmo sendo .ogg, o WhatsApp processa melhor assim como nota de voz.
                await sock.sendMessage(jid, { 
                    audio: { url: url }, 
                    mimetype: 'audio/mp4', 
                    ptt: true 
                });
                
                console.log(`🎙️ Áudio enviado via URL direta!`);
            } catch (e) {
                console.log(`❌ Erro no envio: ${e.message}`);
            }
        }

        if (texto === GATILHO) {
            console.log(`🚀 Testando voz para: ${from}`);
            await enviarVozDireta(from, AUDIO_LINKS.conexao, 4000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje?" });
        }
    });
}

iniciarAlex();
