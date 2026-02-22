const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// LINKS QUE O SENHOR TESTOU E FUNCIONARAM (COM O PONTO FINAL)
const AUDIO_LINKS = {
    conexao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-conexao.ogg",
    solucao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-solucao.ogg",
    apresentacao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-apresentacao.ogg",
    condicao: "https://raw.githubusercontent.com/thcompany011-crypto/bot-aurora-coinzz./main/audios/aurora-condicao.ogg"
};

const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol";
const GATILHO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '10.15.7'],
        printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') console.log('\n🚀 ALEX ONLINE - ÁUDIOS CONFIGURADOS COM SUCESSO!');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();

        async function enviarAudioRemoto(jid, url, tempoGravando) {
            try {
                // Baixa o áudio do link que você testou
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);

                await sock.sendPresenceUpdate('recording', jid);
                await delay(tempoGravando);

                await sock.sendMessage(jid, { 
                    audio: buffer, 
                    mimetype: 'audio/ogg; codecs=opus', 
                    ptt: true 
                });
                console.log(`✅ Áudio enviado com sucesso!`);
            } catch (e) {
                console.log(`❌ Erro ao baixar áudio: ${e.message}`);
            }
        }

        // FLUXO DE VENDAS
        if (!userState[from]) {
            if (texto !== GATILHO) return;
            await enviarAudioRemoto(from, AUDIO_LINKS.conexao, 4000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
            userState[from] = { step: 1 };
            return;
        }

        if (userState[from].step === 1) {
            await enviarAudioRemoto(from, AUDIO_LINKS.solucao, 4000);
            await delay(1500);
            await enviarAudioRemoto(from, AUDIO_LINKS.apresentacao, 4000);
            userState[from].step = 2;
            return;
        }

        if (userState[from].step === 2) {
            await enviarAudioRemoto(from, AUDIO_LINKS.condicao, 5000);
            await sock.sendMessage(from, { text: "📍 Me passa seu *CEP* para eu consultar o envio agora?" });
            userState[from].step = 3;
            return;
        }
        // ... (resto do fluxo de CPF e Coinzz)
    });
}
iniciarAlex();
