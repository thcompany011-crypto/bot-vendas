const { default: makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
require('dotenv').config();

// Configurações de Estado e API
const userState = {};
const COINZZ_API_KEY = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol";
const MEU_NUMERO = "5562994593862"; // Seu número comercial

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'], // Identidade estável
        printQRInTerminal: false
    });

    // SISTEMA DE CONEXÃO POR NÚMERO (PAIRING CODE)
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log("🌸 --- SISTEMA AURORA PINK: CONEXÃO --- 🌸");
        console.log(`⏳ Aguardando 6 segundos para estabilizar com o servidor...`);
        
        await delay(6000); // Delay crucial para evitar erro 428

        try {
            const code = await sock.requestPairingCode(MEU_NUMERO);
            console.log("\n==========================================");
            console.log(`✅ SEU CÓDIGO DE ACESSO É: ${code}`);
            console.log("==========================================\n");
            console.log("1. Abra o WhatsApp no seu celular.");
            console.log("2. Vá em 'Aparelhos Conectados' > 'Conectar um aparelho'.");
            console.log("3. Clique em 'Conectar com número de telefone'.");
            console.log(`4. Digite o código ${code} no seu celular.`);
        } catch (err) {
            console.log("❌ Erro ao gerar código. Aguarde 2 minutos e tente novamente.");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('🚀 SUCESSO! A SARAH ESTÁ ONLINE E PRONTA PARA VENDER.');
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('⚠️ Conexão caiu. Tentando reconectar em 10s...');
                setTimeout(() => conectarWhatsApp(), 10000);
            }
        }
    });

    // MONITORAMENTO DE MENSAGENS (O FUNIL DE VENDAS)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const telefone = from.split('@')[0];

        // ETAPA 1 - CONEXÃO INICIAL
        if (!userState[from]) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-conexao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "Caso se sinta à vontade, pode mandar uma foto também, dessa forma consigo te ajudar da melhor forma possível! 🌸" });
            userState[from] = { step: 1, telefone };
            return;
        }

        // ETAPA 2 - SOLUÇÃO E BENEFÍCIOS
        if (userState[from].step === 1) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-solucao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(3000);
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-apresentacao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "Olha só esses resultados incríveis de quem usou o tratamento completo 👇\n\nÉ exatamente esse resultado que você busca? ✨" });
            userState[from].step = 2;
            return;
        }

        // ETAPA 3 - OFERTA R$ 129 E SEGURANÇA (COD)
        if (userState[from].step === 2) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-condicao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "A decisão é 100% sua. Nosso kit inicial está apenas R$ 129,00!\n\n💎 Garantia de satisfação de 30 dias 💕\n🚛 Pagamento apenas no ato da entrega!" });
            await sock.sendMessage(from, { text: "📍 Qual o seu endereço completo (com CEP) para eu verificar o prazo de entrega?" });
            userState[from].step = 3;
            return;
        }

        // ETAPA 4 - COLETA DE DADOS E ENVIO COINZZ
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Maravilha! Já estou reservando o seu kit." });
            await sock.sendMessage(from, { text: "Para finalizar o envio e gerar sua garantia, me confirme:\n\n✅ Nome Completo:\n✅ CPF:\n✅ E-mail:" });
            userState[from].step = 'finalizar';
            return;
        }

        if (userState[from].step === 'finalizar') {
            try {
                // Envio dos dados para a API da Coinzz
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: COINZZ_API_KEY,
                    product_id: PRODUCT_ID,
                    customer_phone: userState[from].telefone,
                    customer_details: texto + " | Endereço: " + userState[from].endereco,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ TUDO PRONTO! Seu pedido foi confirmado. O entregador avisará quando estiver chegando na sua residência! ✨" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Recebi seus dados! Nossa equipe entrará em contato em instantes para confirmar o horário da sua entrega! 🌸" });
            }
        }
    });
}

conectarWhatsApp();
