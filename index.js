const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Força o QR Code a aparecer no terminal
        logger: pino({ level: 'silent' }), // Esconde as linhas de código amarelas/brancas
        browser: ['Aurora Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('✅ TUDO PRONTO! ESCANEIE O QR CODE ABAIXO:');
        }

        if (connection === 'open') {
            console.log('🚀 AURORA PINK CONECTADA COM SUCESSO!');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⚠️ Tentando reconectar...');
                setTimeout(() => conectarWhatsApp(), 5000);
            }
        }
    });
}
conectarWhatsApp();

