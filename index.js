const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
require('dotenv').config();

// Configurações Fixas do Sr. Alex
const MEU_NUMERO = "5562994593862"; 
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol";
const userState = {};

async function iniciarSarah() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'], // Identidade estável
        printQRInTerminal: false,
        connectTimeoutMs: 120000, // 2 minutos para não cair
        keepAliveIntervalMs: 30000, // Mantém o sinal ativo
        defaultQueryTimeoutMs: 0
    });

    // SISTEMA DE PAREAMENTO POR NÚMERO
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log("🌸 --- SISTEMA AURORA PINK: CONEXÃO --- 🌸");
        console.log("⏳ Estabilizando conexão com o WhatsApp...");
        
        await delay(10000); // 10 segundos para garantir que o socket está pronto

        try {
            const code = await sock.requestPairingCode(MEU_NUMERO);
            console.log("\n==========================================");
            console.log(`✅ SEU CÓDIGO DE ACESSO: ${code}`);
            console.log("==========================================\n");
            console.log("👉 Digite esse código no seu WhatsApp agora!");
            console.log("O Termux vai aguardar até você conectar...");
        } catch (err) {
            console.log("❌ Erro. Aguarde 1 minuto e tente de novo.");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('\n🚀 SUCESSO! A SARAH ESTÁ ONLINE E VENDENDO.');
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⚠️ Conexão oscilou. Tentando manter ativa...');
                setTimeout(() => iniciarSarah(), 5000);
            }
        }
    });

    // FLUXO DE VENDAS (SARAH)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        // ETAPA 1 - CONEXÃO
        if (!userState[from]) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-conexao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "Caso se sinta à vontade, pode mandar uma foto da área, assim te ajudo melhor! 🌸" });
            userState[from] = { step: 1 };
            return;
        }

        // ETAPA 2 - SOLUÇÃO (R$ 129,00)
        if (userState[from].step === 1) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-solucao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "O tratamento para manchas e foliculite sai por apenas R$ 129,00. E o melhor: você só paga quando o produto chegar na sua casa! 🚛" });
            await sock.sendMessage(from, { text: "📍 Qual seu CEP e endereço para eu ver o prazo?" });
            userState[from].step = 2;
            return;
        }

        // ETAPA 3 - FECHAMENTO COINZZ
        if (userState[from].step === 2) {
            userState[from].dados = texto;
            await sock.sendMessage(from, { text: "Perfeito! Me confirme seu Nome e CPF para gerar sua nota e garantia de satisfação?" });
            userState[from].step = 'finalizar';
            return;
        }

        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | " + userState[from].dados,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ Pedido Confirmado! Em breve o entregador entrará em contato. Obrigado pela confiança! ✨" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Recebi seus dados! Nossa equipe vai te chamar para confirmar o envio. 🌸" });
            }
        }
    });
}

iniciarSarah();
