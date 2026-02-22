const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configurações do Sr. Alex
const MEU_NUMERO = "5562994593862"; 
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol"; 
const GATILHO_ANUNCIO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '10.15.7'], // Simulação estável para mídias
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('\n🚀 O ALEX ESTÁ ONLINE - PRONTO PARA VENDER R$ 297!');
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

        // FUNÇÃO DE ENVIO DE ÁUDIO (M4A ORIGINAL)
        async function enviarAudioHumano(jid, nomeArquivo, tempoGravando) {
            const caminho = path.resolve(__dirname, 'audios', nomeArquivo);
            if (fs.existsSync(caminho)) {
                try {
                    await sock.sendPresenceUpdate('recording', jid);
                    await delay(tempoGravando);
                    await sock.sendMessage(jid, { 
                        audio: fs.readFileSync(caminho), 
                        mimetype: 'audio/mp4', // Mimetype correto para .m4a nativo
                        ptt: true 
                    });
                    console.log(`✅ Áudio enviado: ${nomeArquivo}`);
                } catch (e) { console.log(`❌ Erro no envio de ${nomeArquivo}:`, e); }
            } else {
                console.log(`⚠️ Ficheiro não encontrado: ${nomeArquivo}`);
            }
        }

        // FUNÇÃO DE ENVIO DE TEXTO (DIGITANDO)
        async function enviarTextoHumano(jid, mensagem, tempoDigitando) {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(tempoDigitando);
            await sock.sendMessage(jid, { text: mensagem });
        }

        // 1. GATILHO DO ANÚNCIO
        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO) return;

            console.log(`🚀 LEAD IDENTIFICADO: ${from}`);
            await enviarAudioHumano(from, 'aurora-conexao.m4a', 4000);
            await enviarTextoHumano(from, "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?* (Pode mandar foto se preferir 📸)", 2000);
            userState[from] = { step: 1 };
            return;
        }

        // 2. SOLUÇÃO E CONFIANÇA
        if (userState[from].step === 1) {
            await enviarAudioHumano(from, 'aurora-solucao.m4a', 5000);
            await delay(1500);
            await enviarAudioHumano(from, 'aurora-apresentacao.m4a', 4000);
            await enviarTextoHumano(from, "O Aurora Pink resolve isso rápido! Além da garantia de 30 dias, temos um cuidado especial com o envio para sua região. ✨", 2000);
            userState[from].step = 2;
            return;
        }

        // 3. OFERTA 5 UNIDADES (R$ 297,00)
        if (userState[from].step === 2) {
            await enviarAudioHumano(from, 'aurora-condicao.m4a', 6000);
            await enviarTextoHumano(from, "*OFERTA ESPECIAL DO DIA:*\n\n🔥 Combo 5 Unidades: *R$ 297,00*\n✨ (Tratamento completo com desconto máximo)\n\n📍 Me passa seu *CEP e endereço completo*? Vou consultar aqui no sistema agora!", 3000);
            userState[from].step = 3;
            return;
        }

        // 4. COLETA DE DADOS
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await enviarTextoHumano(from, "Perfeito! Já estou consultando aqui e reservando o seu kit no sistema.", 2000);
            await enviarTextoHumano(from, "Para finalizar o registro e gerar sua garantia, me confirme seu *Nome Completo* e *CPF*? 👇", 2000);
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
                    payment_method: 'delivery'
                });
                await enviarTextoHumano(from, "✅ Pedido Confirmado! Em breve você receberá as atualizações do envio. Valeu pela confiança! 👊", 3000);
                delete userState[from];
            } catch (e) {
                await enviarTextoHumano(from, "Dados recebidos! Minha equipe entrará em contato em instantes para confirmar seu kit. 🌸", 2000);
            }
        }
    });
}

iniciarAlex();
