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
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log('\n🚀 O ALEX ESTÁ ONLINE - FORMATO .M4A ATIVO!');
        if (connection === 'close') iniciarAlex();
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // FUNÇÃO DE ENVIO PARA .M4A
        async function enviarAudio(jid, nomeArquivo, tempoGravando) {
            const caminho = path.resolve(__dirname, 'audios', nomeArquivo);
            if (fs.existsSync(caminho)) {
                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempoGravando);
                await sock.sendMessage(jid, { 
                    audio: fs.readFileSync(caminho), 
                    mimetype: 'audio/mp4', // Formato nativo do .m4a
                    ptt: true 
                });
            } else {
                console.log(`⚠️ Arquivo não encontrado: ${nomeArquivo}`);
            }
        }

        // ETAPA 1: CONEXÃO
        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO) return;
            console.log(`🚀 LEAD IDENTIFICADO: ${from}`);
            
            await enviarAudio(from, 'aurora-conexao.m4a', 4000);
            await sock.sendPresenceUpdate('composing', from);
            await delay(2000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?* (Pode mandar foto se preferir 📸)" });
            userState[from] = { step: 1 };
            return;
        }

        // ETAPA 2: SOLUÇÃO
        if (userState[from].step === 1) {
            await enviarAudio(from, 'aurora-solucao.m4a', 5000);
            await delay(1500);
            await enviarAudio(from, 'aurora-apresentacao.m4a', 4000);
            await sock.sendPresenceUpdate('composing', from);
            await delay(2000);
            await sock.sendMessage(from, { text: "O Aurora Pink resolve isso rápido! Além da garantia de 30 dias, temos um cuidado especial com o envio para sua região. ✨" });
            userState[from].step = 2;
            return;
        }

        // ETAPA 3: OFERTA (R$ 297)
        if (userState[from].step === 2) {
            await enviarAudio(from, 'aurora-condicao.m4a', 6000);
            await sock.sendPresenceUpdate('composing', from);
            await delay(3000);
            await sock.sendMessage(from, { text: "*OFERTA ESPECIAL DO DIA:*\n\n🔥 Combo 5 Unidades: *R$ 297,00*\n✨ (Tratamento completo com desconto máximo)\n\n📍 Me passa seu *CEP e endereço completo*? Vou consultar aqui no sistema agora!" });
            userState[from].step = 3;
            return;
        }

        // ETAPA 4 E 5 (COLETA E COINZZ)
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Perfeito! Já estou consultando aqui e reservando o seu kit no sistema." });
            await delay(1500);
            await sock.sendMessage(from, { text: "Para finalizar o registro e gerar sua garantia, me confirme seu *Nome Completo* e *CPF*? 👇" });
            userState[from].step = 'finalizar';
            return;
        }

        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | Combo 5 Unids | " + userState[from].endereco,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ Pedido Confirmado! Em breve receberá as atualizações do envio. Valeu pela confiança! 👊" });
                delete userState[from];
            } catch (e) {
                await sock.sendMessage(from, { text: "Dados recebidos! Minha equipe entrará em contato para confirmar seu kit. 🌸" });
            }
        }
    });
}

iniciarAlex();

