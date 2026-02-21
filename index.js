const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
require('dotenv').config();

const userState = {};

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const telefone = from.split('@')[0];

        // ETAPA 1 - CONEXÃO IMEDIATA
        if (!userState[from]) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-conexao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "Caso se sinta à vontade, pode mandar uma foto também, dessa forma consigo te ajudar da melhor forma possível! 🌸" });
            userState[from] = { step: 1, telefone };
            return;
        }

        // ETAPA 2 - SOLUÇÃO + BENEFÍCIOS
        if (userState[from].step === 1) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-solucao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(3000);
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-apresentacao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "Olha só esses resultados incríveis de quem usou o nosso tratamento completo 👇" });
            await sock.sendMessage(from, { text: "Resultado visível em poucas semanas. É exatamente isso que você procura? ✨" });
            userState[from].step = 2;
            return;
        }

        // ETAPA 3 - OFERTA + GARANTIA
        if (userState[from].step === 2) {
            await sock.sendMessage(from, { audio: { url: "./audios/aurora-condicao.mp3" }, mimetype: 'audio/mp4', ptt: true });
            await delay(2000);
            await sock.sendMessage(from, { text: "A decisão é 100% sua.\n\n💫 2 potes – R$ 197 + frete grátis\n🏆 3 potes – R$ 237 + frete grátis\n\n💎 Garantia de satisfação de 30 dias 💕" });
            await sock.sendMessage(from, { text: "📍 Me conta qual o seu endereço completo (com CEP) para eu verificar o prazo de entrega?" });
            userState[from].step = 3;
            return;
        }

        // ETAPA 4 - FECHAMENTO E ENVIO COINZZ
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Maravilha! Hoje mesmo fiz um envio para sua região!" });
            await sock.sendMessage(from, { text: "Confirme quantos kits você gostaria de receber?\n\nDigite os dados para a nota:\n✅ Nome Completo:\n✅ CPF:\n✅ Endereço:" });
            userState[from].step = 'finalizar';
            return;
        }

        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: process.env.COINZZ_API_KEY,
                    product_id: process.env.ID_PRODUTO_AURORA,
                    customer_phone: userState[from].telefone,
                    customer_details: texto,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ Pedido confirmado! O entregador avisará quando estiver chegando!" });
                delete userState[from];
            } catch (e) {
                // FALLBACK SE NÃO TIVER ENTREGA
                await sock.sendMessage(from, { audio: { url: "./audios/aurora-fallback.mp3" }, mimetype: 'audio/mp4', ptt: true });
                await sock.sendMessage(from, { text: "Gostaria do desconto de 50% para pagar agora no Pix?" });
            }
        }
    });
}
conectarWhatsApp();

