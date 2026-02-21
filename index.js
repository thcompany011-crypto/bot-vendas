const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Mostra o QR Code no terminal
        logger: pino({ level: 'silent' }), // Remove as mensagens amarelas chatas
        browser: ['Chrome (Linux)', 'Chrome', '1.0.0'] // Identificação mais segura
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('✅ SR. ALEX, ESCANEIE O QR CODE ABAIXO:');
        }

        if (connection === 'open') {
            console.log('🚀 AURORA PINK CONECTADO COM SUCESSO!');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            // Se não foi logoff manual, tenta reconectar após 10 segundos
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⚠️ Conexão falhou. Tentando novamente em 10s...');
                setTimeout(() => conectarWhatsApp(), 10000);
            }
        }
    });
}
conectarWhatsApp();
