const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// CONFIGURAÇÕES DO SR. ALEX
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const PRODUCT_ID = "pro8x3ol";
const GATILHO = "oi vim pela vista o anúncio da aurora pink";
const userState = {};

async function iniciarAlex() {
    console.log('--- 🚀 MOTOR PROFISSIONAL DO SR. ALEX LIGANDO ---');
    
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
        if (connection === 'open') console.log('\n✅ ALEX ONLINE - PRONTO PARA VENDER O KIT DE R$ 297!');
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

        // FUNÇÃO DE ENVIO PROFISSIONAL (COM "GRAVANDO..." E SOM GARANTIDO)
        async function enviarVozProfissional(jid, arquivo, tempoGravando) {
            const caminho = path.resolve(__dirname, 'audios', arquivo);
            if (fs.existsSync(caminho)) {
                try {
                    // 1. Mostra "gravando áudio..." para o cliente
                    await sock.sendPresenceUpdate('recording', jid);
                    await delay(tempoGravando);

                    // 2. Envia o arquivo que convertemos no Termux
                    await sock.sendMessage(jid, { 
                        audio: fs.readFileSync(caminho), 
                        mimetype: 'audio/ogg; codecs=opus', 
                        ptt: true // Faz aparecer a bolinha azul
                    });
                    
                    // 3. Para o sinal de gravando
                    await sock.sendPresenceUpdate('paused', jid);
                    console.log(`🎙️ Voz enviada: ${arquivo}`);
                } catch (e) { console.log(`❌ Erro no envio: ${e.message}`); }
            } else {
                console.log(`⚠️ Arquivo não encontrado no Termux: ${arquivo}`);
            }
        }

        // --- FLUXO DE ATENDIMENTO AUTOMÁTICO ---
        
        // PASSO 0: GATILHO INICIAL
        if (!userState[from]) {
            if (texto !== GATILHO) return;
            console.log(`🚀 NOVO LEAD: ${from}`);
            await enviarVozProfissional(from, 'conexao-final.ogg', 4000);
            await sock.sendMessage(from, { text: "Opa! Sou o Alex. Me conta aqui: o que mais te incomoda hoje? *Manchas ou foliculite?*" });
            userState[from] = { step: 1 };
            return;
        }

        // PASSO 1: SOLUÇÃO E APRESENTAÇÃO
        if (userState[from].step === 1) {
            await enviarVozProfissional(from, 'solucao-final.ogg', 5000);
            await delay(2000);
            await enviarVozProfissional(from, 'apresentacao-final.ogg', 6000);
            userState[from].step = 2;
            return;
        }

        // PASSO 2: CONDIÇÃO E PEDIDO DE CEP
        if (userState[from].step === 2) {
            await enviarVozProfissional(from, 'condicao-final.ogg', 7000);
            await sock.sendMessage(from, { text: "📍 Me passa seu *CEP* para eu consultar o envio agora e ver se consigo frete grátis?" });
            userState[from].step = 3;
            return;
        }

        // PASSO 3: COLETA DE ENDEREÇO E PEDIDO DE DADOS FINAIS
        if (userState[from].step === 3) {
            userState[from].endereco = texto;
            await sock.sendMessage(from, { text: "Perfeito! Já reservei seu kit aqui. Me confirme seu *Nome Completo* e *CPF* para finalizar o envio? 👇" });
            userState[from].step = 'finalizar';
            return;
        }

        // PASSO FINAL: ENVIO PARA A COINZZ
        if (userState[from].step === 'finalizar') {
            try {
                await axios.post('https://api.coinzz.com.br/v1/orders', {
                    api_key: API_KEY_COINZZ,
                    product_id: PRODUCT_ID,
                    customer_phone: from.split('@')[0],
                    customer_details: texto + " | Kit 5 Unids | " + userState[from].endereco,
                    payment_method: 'delivery'
                });
                await sock.sendMessage(from, { text: "✅ *Tudo pronto!* Seu pedido foi processado e você receberá o código de rastreio em breve. Valeu pela confiança! 👊" });
                delete userState[from]; // Finaliza o atendimento
            } catch (e) {
                await sock.sendMessage(from, { text: "Dados recebidos! Nossa equipe entrará em contato para confirmar o envio. 🌸" });
                delete userState[from];
            }
        }
    });
}

iniciarAlex();
