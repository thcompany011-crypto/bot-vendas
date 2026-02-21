const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'error' }), // Silencia as mensagens chatas
        browser: ['Chrome (Linux)', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear(); // Limpa a tela para o QR Code aparecer sozinho
            console.log('✅ SR. ALEX, ESCANEIE O QR CODE ABAIXO:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('🚀 AURORA PINK CONECTADO! VENDAS LIBERADAS.');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⚠️ Reconectando em 10 segundos...');
                setTimeout(() => conectarWhatsApp(), 10000);
            }
        }
    });
}
conectarWhatsApp();

