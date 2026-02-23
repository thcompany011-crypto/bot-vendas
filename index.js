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

// --- 🌐 CONFIGURAÇÃO DO MOTOR REMOTO (ORACLE) ---
const IP_ORACLE = "147.15.67.87"; // Seu IP da Oracle Cloud

// --- 🔑 TOKENS E IDs ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

const PRODUTOS = {
    aurora: {
        nome: "Aurora Pink",
        gatilho: "aurora",
        id_coinzz: "pro8x3ol", 
        id_logzz: "pro7rqlo", 
        link_sondagem: "https://entrega.logzz.com.br/pay/memyol6v0/tkrmb-5-unidades",
        oferta: "Kit de 5 unidades por R$ 297,00"
    },
    novabeauty: {
        nome: "Sérum Novabeauty",
        gatilho: "serum",
        id_coinzz: "pro84jem", 
        id_logzz: "proz3jyq", 
        link_sondagem: "https://entrega.logzz.com.br/pay/mem3qv845/3-potes-brinde",
        oferta: "Kit Pague 2 Leve 4 por R$ 297,00"
    }
};

const userState = {};

// --- 🤖 FUNÇÃO QUE CHAMA A ORACLE PARA FAZER A SONDAGEM ---
async function consultarLogisticaNaOracle(cep, linkProduto) {
    try {
        console.log(`📡 Solicitando sondagem remota para o CEP: ${cep}`);
        const response = await axios.post(`http://${IP_ORACLE}:3000/sondagem`, {
            cep: cep,
            link: linkProduto
        }, { timeout: 25000 }); // Tempo para a Oracle abrir o navegador e testar
        
        return response.data.atende; // Retorna true ou false
    } catch (e) {
        console.error("❌ Erro na comunicação com a Oracle:", e.message);
        return false; // Se a Oracle falhar, assume que não tem cobertura por segurança
    }
}

async function iniciarAlex() {
    console.log('--- 🚀 MOTOR ALEX VENDAS ATIVADO ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Sr. Alex Vendas', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('\n✅ WHATSAPP CONECTADO E PRONTO!');
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) iniciarAlex();
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textoOriginal = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const texto = textoOriginal.toLowerCase();

        async function enviarTexto(jid, txt, tempo = 2000) {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(tempo);
            await sock.sendMessage(jid, { text: txt });
        }

        // 1. IDENTIFICAÇÃO DO PRODUTO (GATILHOS)
        if (!userState[from]) {
            if (texto.includes("aurora") || texto.includes("pink")) {
                userState[from] = { step: 1, produto: 'aurora' };
                await enviarTexto(from, "Olá! Sou o Alex, especialista da Aurora Pink. 🌸");
                await enviarTexto(from, "Para eu te indicar o kit ideal, o que mais te incomoda: manchas ou foliculite?");
            } else if (texto.includes("serum") || texto.includes("novabeauty")) {
                userState[from] = { step: 1, produto: 'novabeauty' };
                await enviarTexto(from, "Olá! Sou o Alex, consultor do Sérum Novabeauty. ✨");
                await enviarTexto(from, "Qual o seu maior incômodo hoje: rugas ou manchas?");
            }
            return;
        }

        const p = PRODUTOS[userState[from].produto];

        // 2. SOLICITAÇÃO DE CEP
        if (userState[from].step === 1) {
            await enviarTexto(from, "Entendi! Para eu verificar o prazo de entrega, me informe seu **CEP** (apenas números)?");
            userState[from].step = 2;
            return;
        }

        // 3. SONDAGEM REMOTA NA ORACLE (MUDANÇA AQUI)
        if (userState[from].step === 2) {
            const cep = texto.replace(/\D/g, '');
            if (cep.length === 8) {
                await enviarTexto(from, "🔍 Deixe-me consultar a transportadora aqui rapidinho...");
                
                // O Robô do Termux chama a Oracle para abrir o navegador
                const logzzAtende = await consultarLogisticaNaOracle(cep, p.link_sondagem);
                
                userState[from].gateway = logzzAtende ? 'logzz' : 'coinzz';
                userState[from].cep = cep;

                if (logzzAtende) {
                    await enviarTexto(from, "✅ Ótima notícia! Temos **Pagamento na Entrega** para sua rua!");
                } else {
                    await enviarTexto(from, "Sr(a), como sua região é atendida exclusivamente pelos Correios, liberamos o **Pagamento Antecipado com Desconto Extra**!");
                }
                
                await enviarTexto(from, `Nossa melhor oferta hoje é o **${p.oferta}**.`);
                await enviarTexto(from, "Pode me confirmar seu **Nome Completo** e **CPF** para eu reservar seu kit?");
                userState[from].step = 'finalizar';
            } else {
                await enviarTexto(from, "O CEP parece incorreto. Pode digitar novamente apenas os 8 números?");
            }
            return;
        }

        // 4. FINALIZAÇÃO (ENVIO PARA AS APIs)
        if (userState[from].step === 'finalizar') {
            const cpfLimpo = textoOriginal.replace(/\D/g, '').substring(0, 11);
            const telLimpo = from.split('@')[0].replace(/\D/g, '');

            try {
                if (userState[from].gateway === 'coinzz') {
                    // Envio para Coinzz (Pagamento Antecipado)
                    await axios.post('https://api.coinzz.com.br/v1/orders', {
                        api_key: API_KEY_COINZZ,
                        product_id: p.id_coinzz,
                        customer_name: textoOriginal,
                        customer_cpf: cpfLimpo,
                        customer_phone: telLimpo,
                        payment_method: 'upfront'
                    });
                } else {
                    // Envio para Logzz (Pagamento na Entrega)
                    await axios.post('https://app.logzz.com.br/api/v1/orders', {
                        token: TOKEN_LOGZZ,
                        product_id: p.id_logzz,
                        customer_name: textoOriginal,
                        customer_cpf: cpfLimpo,
                        customer_phone: telLimpo,
                        payment_method: 'cod'
                    });
                }
                await enviarTexto(from, "✅ Perfeito! Seu pedido foi pré-aprovado. Você receberá os detalhes em instantes!");
            } catch (e) {
                await enviarTexto(from, "Recebi seus dados! Em instantes nossa equipe de expedição entrará em contato para confirmar.");
            }
            delete userState[from];
        }
    });
}
iniciarAlex();
