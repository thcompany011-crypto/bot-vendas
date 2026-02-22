const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// LINKS REAIS DO SR. ALEX (CLOUDINARY)
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
    console.log('--- 🚀 MOTOR DO SR. ALEX LIGADO (MODO NUVEM) ---');
    
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
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('⚠️ ESCANEIE O QR CODE ABAIXO:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') console.log('\n✅ ALEX ONLINE - VOZES DO CLOUDINARY ATIVADAS!');
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

        // FUNÇÃO DE ENVIO COM "GRAVANDO..." E VOZ DA NUVEM
        async function enviarVozCloudinary(jid, url, tempoGravando) {
            try {
                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempoGravando);

                await sock.sendMessage(jid, { 
                    audio: { url: url }, 
                    mimetype: 'audio/mp4', // Truque para o WhatsApp forçar o áudio
                    ptt: true 
                });
                console.log(`🎙️ Áudio enviado com sucesso!`);
            } catch (e) { console.log(`❌ Erro no envio: ${e.message}`); }
        }

        // --- INÍCIO DO FLUXO DE VENDAS ---
        if (!userState[from]) {
            if (texto !== GATILHO) return;
            console.log(`🚀 NOVO LEAD: ${from}`);
            await enviarVozCloudinary(from, AUDIO_LINKS.conexao, 4000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
            userState[from] = { step: 1 };
            return;
        }

        if (userState[from].step === 1) {
            await enviarVozCloudinary(from, AUDIO_LINKS.solucao, 5000);
            await delay(2000);
            await enviarVozCloudinary(from, AUDIO_LINKS.apresentacao, 6000);
            userState[from].step = 2;
            return;
        }

        if (userState[from].step === 2) {
            await enviarVozCloudinary(from, AUDIO_LINKS.condicao, 7000);
            await sock.sendMessage(from, { text: "📍 Me passa seu *CEP* para eu consultar o envio agora?" });
            userState[from].step = 3;
            return;
        }

        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Perfeito! Reservando no sistema. Me confirme seu *Nome Completo* e *CPF*? 👇" });
            userState[from].step = 'finalizar';
            return;
        }

        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | Kit 5 Unids | " + userState[from].endereco,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ *Pedido Confirmado!* Valeu pela confiança! 👊" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Dados recebidos! Entraremos em contato em breve. 🌸" });
                delete userState[from];
            }
        }
    });
}

iniciarAlex();
