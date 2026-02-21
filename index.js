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
        if (connection === 'open') console.log('\n🚀 O ALEX ESTÁ ONLINE - MONITORANDO AUDIOS...');
        if (connection === 'close') iniciarAlex();
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // FUNÇÃO DE ENVIO REFORÇADA
        async function enviarAudioHumano(jid, nomeArquivo, tempoGravando) {
            const caminho = `./audios/${nomeArquivo}`;
            console.log(`🔍 Tentando enviar: ${caminho}`);

            if (fs.existsSync(caminho)) {
                try {
                    await sock.sendPresenceUpdate('recording', jid);
                    await delay(tempoGravando);
                    
                    await sock.sendMessage(jid, { 
                        audio: { url: caminho }, // Envio direto por URL/Caminho
                        mimetype: 'audio/mp4',   // Mimetype "Coringa" para PTT
                        ptt: true 
                    });
                    
                    console.log(`✅ Áudio ${nomeArquivo} enviado com sucesso!`);
                } catch (error) {
                    console.log(`❌ ERRO AO ENVIAR ${nomeArquivo}:`, error);
                }
            } else {
                console.log(`⚠️ ALERTA: O arquivo ${nomeArquivo} NÃO FOI ENCONTRADO na pasta audios!`);
            }
        }

        async function enviarTextoHumano(jid, mensagem, tempoDigitando) {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(tempoDigitando);
            await sock.sendMessage(jid, { text: mensagem });
        }

        // --- FLUXO DE ATENDIMENTO ---
        if (!userState[from]) {
            if (texto !== GATILHO_ANUNCIO) return;
            console.log(`🚀 NOVO LEAD: ${from}`);
            await enviarAudioHumano(from, 'aurora-conexao.ogg', 4000);
            await enviarTextoHumano(from, "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?* (Pode mandar foto se preferir 📸)", 2000);
            userState[from] = { step: 1 };
            return;
        }

        if (userState[from].step === 1) {
            await enviarAudioHumano(from, 'aurora-solucao.ogg', 5000);
            await delay(1500);
            await enviarAudioHumano(from, 'aurora-apresentacao.ogg', 4000);
            await enviarTextoHumano(from, "O Aurora Pink resolve isso rápido! Além da garantia de 30 dias, temos um cuidado especial com o envio para sua região. ✨", 2000);
            userState[from].step = 2;
            return;
        }

        if (userState[from].step === 2) {
            await enviarAudioHumano(from, 'aurora-condicao.ogg', 6000);
            await enviarTextoHumano(from, "*OFERTA ESPECIAL DO DIA:*\n\n🔥 Combo 5 Unidades: *R$ 297,00*\n✨ (Tratamento completo com desconto máximo)\n\n📍 Me passa seu *CEP e endereço completo*? Vou consultar aqui no sistema agora!", 3000);
            userState[from].step = 3;
            return;
        }

        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await enviarTextoHumano(from, "Perfeito! Já estou consultando aqui e reservando o seu kit no sistema.", 2000);
            await enviarTextoHumano(from, "Para finalizar o registro e gerar sua garantia, me confirme seu *Nome Completo* e *CPF*? 👇", 2000);
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
                await enviarTextoHumano(from, "✅ Pedido Confirmado! Em breve você receberá as atualizações do envio. Valeu pela confiança! 👊", 3000);
                delete userState[from];
            } catch (e) {
                await enviarTextoHumano(from, "Dados recebidos! Minha equipe entrará em contato em instantes para confirmar os detalhes do envio do seu kit. 🌸", 2000);
            }
        }
    });
}

iniciarAlex();

