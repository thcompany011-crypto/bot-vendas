const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

async function iniciarAlex() {
    console.log('--- 🚀 LIGANDO O MOTOR DO SR. ALEX ---');
    
    // 1. Carregando a sessão (pode demorar alguns segundos se houver muitos arquivos)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '10.15.7'],
        printQRInTerminal: true, // VOLTEI O QR CODE PARA VOCÊ VER SE PRECISAR CONECTAR!
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) console.log('⚠️ ESCANEIE O QR CODE ABAIXO PARA CONECTAR!');

        if (connection === 'open') {
            console.log('\n✅ ALEX ONLINE E INSTANTÂNEO!');
            console.log('💰 PRONTO PARA VENDER O KIT DE R$ 297!');
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) iniciarAlex();
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // FUNÇÃO LOCAL (MUITO MAIS RÁPIDA)
        async function enviarAudio(jid, arquivo, tempo) {
            const caminho = path.resolve(__dirname, 'audios', arquivo);
            if (fs.existsSync(caminho)) {
                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempo);
                await sock.sendMessage(jid, { 
                    audio: fs.readFileSync(caminho), 
                    mimetype: 'audio/ogg; codecs=opus', 
                    ptt: true 
                });
                console.log(`🎙️ Áudio ${arquivo} enviado instantaneamente!`);
            }
        }

        if (texto === "oi vim pela vista o anúncio da aurora pink") {
            await enviarAudio(from, 'aurora-conexao.ogg', 3000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
        }
    });
}

iniciarAlex();
