const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        printQRInTerminal: false // Desligamos o QR Code
    });

    // PARTE DO CÓDIGO DE PAREAMENTO
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log("🌸 --- CONEXÃO AURORA PINK --- 🌸");
        const numero = await question('Digite o número do seu WhatsApp de vendas (ex: 5562999999999): ');
        const code = await sock.requestPairingCode(numero.trim());
        console.log(`\n✅ SEU CÓDIGO DE ACESSO É: ${code}\n`);
        console.log("1. Abra o WhatsApp no seu celular.");
        console.log("2. Vá em Aparelhos Conectados > Conectar um Aparelho.");
        console.log("3. Clique em 'Conectar com número de telefone'.");
        console.log(`4. Digite o código ${code} no seu celular.`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('🚀 BOT AURORA CONECTADO E PRONTO PARA VENDER!');
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) conectarWhatsApp();
        }
    });

    // O restante do seu código de vendas (mensagens da Sarah) continua aqui abaixo...
}
conectarWhatsApp();
