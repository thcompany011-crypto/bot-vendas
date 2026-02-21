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

// Configurações do Sr. Alex
const MEU_NUMERO = "5562994593862"; 
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol"; // ⚠️ Verifique se este ID corresponde ao kit de 5 unidades na Coinzz
const GATILHO_ANUNCIO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        printQRInTerminal: false,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 30000
    });

    // SISTEMA DE CONEXÃO
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log("🌸 --- SISTEMA AURORA PINK: ALEX --- 🌸");
        await delay(10000);
        try {
            const code = await sock.requestPairingCode(MEU_NUMERO);
            console.log(`\n✅ SEU CÓDIGO DE ACESSO: ${code}\n`);
        } catch (err) {
            console.log("❌ Erro ao gerar código.");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') console.log('\n🚀 O ALEX ESTÁ ONLINE - OFERTA R$ 297 ATIVA!');
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

        // 1. FILTRO DE GATILHO (SÓ RESPONDE AO ANÚNCIO)
        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO.toLowerCase()) return;

            console.log(`🚀 NOVO LEAD IDENTIFICADO: ${from}`);
            
            try {
                await sock.sendMessage(from, { audio: { url: "./audios/aurora-conexao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            } catch (e) { console.log("Erro áudio conexao"); }
            
            await delay(2000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?* (Pode mandar foto se preferir 📸)" });
            userState[from] = { step: 1 };
            return;
        }

        // 2. SOLUÇÃO E APRESENTAÇÃO
        if (userState[from].step === 1) {
            try {
                await sock.sendMessage(from, { audio: { url: "./audios/aurora-solucao.mp3" }, mimetype: 'audio/mp4', ptt: true });
                await delay(3000);
                await sock.sendMessage(from, { audio: { url: "./audios/aurora-apresentacao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            } catch (e) { console.log("Erro áudios solução"); }
            
            await delay(2000);
            await sock.sendMessage(from, { text: "O Aurora Pink resolve isso rápido! Além da garantia de 30 dias, temos um cuidado especial com o envio para sua região. ✨" });
            userState[from].step = 2;
            return;
        }

        // 3. OFERTA DAS 5 UNIDADES (R$ 297,00)
        if (userState[from].step === 2) {
            try {
                await sock.sendMessage(from, { audio: { url: "./audios/aurora-condicao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            } catch (e) { console.log("Erro áudio condição"); }
            
            await delay(2000);
            await sock.sendMessage(from, { text: "*OFERTA ESPECIAL DO DIA:*\n\n🔥 Combo 5 Unidades: *R$ 297,00*\n✨ (Tratamento completo com desconto máximo)\n\n📍 Me passa seu *CEP e endereço completo*? Vou consultar aqui no sistema o prazo e as melhores formas de envio para você agora!" });
            userState[from].step = 3;
            return;
        }

        // 4. COLETA DE DADOS FINAIS
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Perfeito! Já estou consultando aqui e reservando seu kit." });
            await sock.sendMessage(from, { text: "Para finalizar o registro e gerar sua garantia, me confirme seu *Nome Completo* e *CPF*? 👇" });
            userState[from].step = 'finalizar';
            return;
        }

        // 5. REGISTRO NA COINZZ
        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | Combo 5 Unids | " + userState[from].endereco,
                    payment_method: 'delivery' // O sistema tentará registrar como entrega
                });
                await sock.sendMessage(from, { text: "✅ Pedido Confirmado! Em breve você receberá as atualizações do envio. Valeu pela confiança! 👊" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Dados recebidos! Minha equipe vai te chamar em instantes para confirmar os detalhes do envio do seu kit. 🌸" });
            }
        }
    });
}

iniciarAlex();
