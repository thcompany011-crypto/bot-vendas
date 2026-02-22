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

// --- CONFIGURAÇÕES DO SR. ALEX ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

// Lista de Segurança: Cidades que o senhor SABE que a Logzz atende aí

const PRODUTOS = {
    aurora: {
        gatilho: "oi vim pela vista o anúncio da aurora pink",
        id_coinzz: "pro8x3ol",
        id_logzz: "pro7rqlo",
        nome: "Aurora Pink",
        oferta: "Kit de 5 unidades por R$ 297,00"
    },
    novabeauty: {
        gatilho: "oi vim pelo anúncio do sérum novabeauty",
        id_coinzz: "pro84jem",
        id_logzz: "proz3jyq",
        nome: "Sérum Novabeauty",
        oferta: "Kit Pague 2 Leve 4 por R$ 297,00"
    }
};

const userState = {};

// Função para remover acentos e facilitar a comparação de cidades
const normalizar = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// FUNÇÃO PARA CONSULTAR COBERTURA NA LOGZZ (API)
async function consultarCoberturaLogzz(cep, idProduto) {
    try {
        const res = await axios.get(`https://app.logzz.com.br/v1/shipping/calculate`, {
            params: { token: TOKEN_LOGZZ, cep: cep, product_id: idProduto }
        });
        const metodos = res.data.shipping_methods || [];
        // Se retornar algum método com 'cod' ou 'local', aceita pagamento na entrega
        return metodos.some(m => m.cod === true || m.name.toLowerCase().includes("local"));
    } catch (e) {
        return false; 
    }
}

async function iniciarAlex() {
    console.log('--- 🚀 MOTOR INTELIGENTE LIGADO: LOGZZ & COINZZ ---');
    
    // O USO DA PASTA 'auth_info' GARANTE QUE O LOGIN SEJA MANTIDO
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Sr. Alex - Vendas', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('\n🌟 ROBÔ DO SR. ALEX ESTÁ ONLINE E CONECTADO!');
        if (connection === 'close') {
            const deviaReconectar = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            if (deviaReconectar) iniciarAlex();
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textoOriginal = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const texto = textoOriginal.toLowerCase();

        async function enviarTexto(jid, txt, tempo) {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(tempo);
            await sock.sendMessage(jid, { text: txt });
        }

        // 1. GATILHOS INICIAIS
        if (!userState[from]) {
            if (texto.includes("aurora pink")) {
                userState[from] = { step: 1, produto: 'aurora' };
                await enviarTexto(from, "Olá! Sou o Alex da Aurora Pink. 🌸", 2000);
                await enviarTexto(from, "Para eu te indicar o melhor kit, o que mais te incomoda: manchas ou foliculite?", 2500);
            } else if (texto.includes("sérum novabeauty")) {
                userState[from] = { step: 1, produto: 'novabeauty' };
                await enviarTexto(from, "Olá! Sou o Alex, consultor do Novabeauty. ✨", 2000);
                await enviarTexto(from, "Qual o seu foco hoje: rugas ou manchas?", 2500);
            }
            return;
        }

        const p = PRODUTOS[userState[from].produto];

        // 2. PEDIDO DE CEP
        if (userState[from].step === 1) {
            await enviarTexto(from, "Perfeito! Para eu verificar a logística e o prazo, me informe seu **CEP** (apenas números)?", 2000);
            userState[from].step = 2;
            return;
        }

        // 3. CONSULTA VIACEP + DECISÃO LOGÍSTICA
        if (userState[from].step === 2) {
            const cep = texto.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    const resVia = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
                    const d = resVia.data;
                    const cidadeAPI = d.localidade;
                    
                    userState[from].enderecoParcial = `${d.logradouro}, ${d.bairro}, ${d.localidade}-${d.uf}`;

                    // TESTE DUPLO: Lista de Cidades OU API da Logzz
                    const naLista = CIDADES_LOGZZ.some(c => normalizar(cidadeAPI).includes(normalizar(c)));
                    const naAPI = await consultarCoberturaLogzz(cep, p.id_logzz);

                    userState[from].gateway = (naLista || naAPI) ? 'logzz' : 'coinzz';
                    
                    console.log(`📍 CEP: ${cep} | Cidade: ${cidadeAPI} | Gateway: ${userState[from].gateway}`);

                    await enviarTexto(from, `Localizei seu endereço: 📍\n${userState[from].enderecoParcial}`, 1500);
                    await enviarTexto(from, "Está correto? Me informe o **número** e uma **referência**?", 2000);
                    userState[from].step = 3;
                } catch (e) { await enviarTexto(from, "CEP não encontrado. Digite o endereço completo?", 2000); }
            }
            return;
        }

        // 4. OFERTA E REGRAS DE PAGAMENTO
        if (userState[from].step === 3) {
            userState[from].complemento = textoOriginal;
            await enviarTexto(from, `Nossa melhor oferta hoje é o **${p.oferta}**.`, 3000);

            if (userState[from].gateway === 'logzz') {
                await enviarTexto(from, "Temos entregador disponível para você! **Você só paga quando o produto chegar.** 🚚💨", 3500);
            } else {
                await enviarTexto(from, "O envio para sua região é via Correios. Por isso, o pagamento é **Pix ou Cartão antecipado**. Tudo bem?", 3500);
            }
            await enviarTexto(from, "Para reservar seu kit agora, me confirme seu **Nome Completo** e **CPF**?", 2500);
            userState[from].step = 'finalizar';
            return;
        }

        // 5. CRIAÇÃO DO PEDIDO (API REAL)
        if (userState[from].step === 'finalizar') {
            const cpfLimpo = textoOriginal.replace(/\D/g, '').substring(0, 11);
            const telLimpo = from.split('@')[0].replace(/\D/g, '');

            try {
                if (userState[from].gateway === 'coinzz') {
                    // PEDIDO COINZZ
                    await axios.post('https://api.coinzz.com.br/v1/orders', {
                        api_key: API_KEY_COINZZ,
                        product_id: p.id_coinzz,
                        customer_name: textoOriginal.split('|')[0].trim(),
                        customer_cpf: cpfLimpo,
                        customer_phone: telLimpo,
                        customer_details: `Endereço: ${userState[from].enderecoParcial} | Ref: ${userState[from].complemento}`,
                        payment_method: 'upfront'
                    });
                    await enviarTexto(from, "✅ Pedido gerado com sucesso! Enviando link para o pagamento via Pix agora.", 2000);
                } else {
                    // PEDIDO LOGZZ
                    await axios.post('https://api.logzz.com.br/v1/orders', {
                        token: TOKEN_LOGZZ,
                        product_id: p.id_logzz,
                        customer_name: textoOriginal.split('|')[0].trim(),
                        customer_cpf: cpfLimpo,
                        customer_phone: telLimpo,
                        address: userState[from].enderecoParcial,
                        address_number: userState[from].complemento,
                        payment_method: 'cod'
                    });
                    await enviarTexto(from, "✅ Pedido agendado! Prepare o valor, você paga na hora de receber.", 2000);
                }
            } catch (e) {
                console.error("❌ ERRO NA API:", e.response?.data || e.message);
                await enviarTexto(from, "Dados anotados! Nossa equipe entrará em contato para finalizar sua compra. 🌸", 2000);
            }
            delete userState[from];
        }
    });
}
iniciarAlex();
