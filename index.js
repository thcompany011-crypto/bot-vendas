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

// --- TOKENS E CONFIGURAÇÕES DO SR. ALEX ---
const API_KEY_COINZZ = "15393|IRslmQle1IaeXVRsJG3t65dlCQWsPCVJFW8abeWj77859d31";
const TOKEN_LOGZZ = "206959|VJHi9yVe5bYQ7h67niYgjfHtm3VyFsBQ62imOTTmde13fd8f";

// Cidades com entrega própria (Pagamento na Entrega via Logzz)
const CIDADES_COBERTURA = ["anápolis", "anapolis", "goiânia", "goiania", "aparecida de goiânia", "brasília", "são paulo"];

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

// Função para remover acentos para facilitar a comparação das cidades
const normalizar = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// FUNÇÃO PARA CONSULTAR COBERTURA NA LOGZZ (API OFICIAL)
async function consultarCoberturaLogzz(cep, idProduto) {
    try {
        const response = await axios.get(`https://app.logzz.com.br/api/v1/shipping/calculate`, {
            params: { token: TOKEN_LOGZZ, cep: cep, product_id: idProduto },
            timeout: 8000
        });
        const metodos = response.data.shipping_methods || [];
        return metodos.some(m => m.cod === true || m.name.toLowerCase().includes("local"));
    } catch (e) {
        return false; 
    }
}

async function iniciarAlex() {
    console.log('--- 🚀 MOTOR ATIVADO: FOCO EM CONVERSÃO R$ 297 ---');
    
    // Mantém a pasta 'auth_info' para não pedir QR Code toda vez
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
        if (connection === 'open') console.log('\n✅ ROBÔ DO SR. ALEX ONLINE - PRONTO PARA VENDER!');
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

        async function enviarTexto(jid, txt, tempo = 2500) {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(tempo);
            await sock.sendMessage(jid, { text: txt });
        }

        // 1. GATILHOS E INÍCIO DO FUNIL
        if (!userState[from]) {
            if (texto.includes("aurora pink") || texto.includes("anúncio da aurora")) {
                userState[from] = { step: 1, produto: 'aurora' };
                await enviarTexto(from, "Olá! Sou o Alex, especialista da Aurora Pink. 🌸");
                await enviarTexto(from, "Para eu te indicar o kit ideal, o que mais te incomoda hoje: manchas ou foliculite?");
            } else if (texto.includes("novabeauty") || texto.includes("anúncio do sérum")) {
                userState[from] = { step: 1, produto: 'novabeauty' };
                await enviarTexto(from, "Olá! Sou o Alex, consultor do Sérum Novabeauty. ✨");
                await enviarTexto(from, "Qual o seu maior incômodo hoje: rugas ou manchas?");
            }
            return;
        }

        const p = PRODUTOS[userState[from].produto];

        // 2. SOLICITAÇÃO DE CEP
        if (userState[from].step === 1) {
            await enviarTexto(from, "Entendi perfeitamente! Para eu verificar o prazo de entrega para você, me informe seu **CEP** (apenas os números)?");
            userState[from].step = 2;
            return;
        }

        // 3. CONSULTA VIACEP + DECISÃO LOGÍSTICA (Logzz ou Coinzz)
        if (userState[from].step === 2) {
            const cep = texto.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    const resVia = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 5000 });
                    if (resVia.data.erro) throw new Error();

                    const d = resVia.data;
                    const cidadeAPI = d.localidade;
                    userState[from].enderecoParcial = `${d.logradouro}, ${d.bairro}, ${d.localidade}-${d.uf}`;

                    // VERIFICAÇÃO DUPLA (LISTA + API LOGZZ)
                    const naLista = CIDADES_COBERTURA.some(c => normalizar(cidadeAPI).includes(normalizar(c)));
                    const naAPI = await consultarCoberturaLogzz(cep, p.id_logzz);

                    userState[from].gateway = (naLista || naAPI) ? 'logzz' : 'coinzz';
                    
                    console.log(`📍 CEP: ${cep} | Cidade: ${cidadeAPI} | Gateway: ${userState[from].gateway}`);

                    await enviarTexto(from, `Localizei seu endereço: 📍\n${userState[from].enderecoParcial}`);
                    await enviarTexto(from, "Está correto? Me confirme apenas o **número da casa** e um **ponto de referência**?");
                    userState[from].step = 3;
                } catch (e) {
                    await enviarTexto(from, "Não consegui localizar o CEP. Pode digitar seu endereço completo (Rua, Bairro e Cidade) para eu verificar aqui?");
                    userState[from].step = 'endereco_manual';
                }
            }
            return;
        }

        // 3.1 ENDEREÇO MANUAL (CASO O VIACEP FALHE)
        if (userState[from].step === 'endereco_manual') {
            userState[from].enderecoParcial = textoOriginal;
            const ehAnapolis = normalizar(textoOriginal).includes("anapolis");
            userState[from].gateway = ehAnapolis ? 'logzz' : 'coinzz';
            await enviarTexto(from, "Anotado! Agora me confirme o **número** e uma **referência**?");
            userState[from].step = 3;
            return;
        }

        // 4. OFERTA E DEFINIÇÃO DE PAGAMENTO
        if (userState[from].step === 3) {
            userState[from].complemento = textoOriginal;
            await enviarTexto(from, `Ótima notícia! Nossa melhor oferta hoje é o **${p.oferta}**.`);

            if (userState[from].gateway === 'logzz') {
                await enviarTexto(from, "Temos entregador próprio para sua região! **Você só paga quando o produto chegar na sua mão.** 🚚💨");
            } else {
                await enviarTexto(from, "O envio para sua região é via Correios. Trabalhamos com o **pagamento antecipado (Pix ou Cartão)** para garantir o frete grátis hoje. Tudo bem?");
            }
            
            await enviarTexto(from, "Para reservar seu kit agora, me confirme seu **Nome Completo** e **CPF**?");
            userState[from].step = 'finalizar';
            return;
        }

        // 5. ENVIO FINAL PARA API (COINZZ OU LOGZZ)
        if (userState[from].step === 'finalizar') {
            const cpfLimpo = textoOriginal.replace(/\D/g, '').substring(0, 11);
            const telLimpo = from.split('@')[0].replace(/\D/g, '');

            try {
                if (userState[from].gateway === 'coinzz') {
                    await axios.post('https://api.coinzz.com.br/v1/orders', {
                        api_key: API_KEY_COINZZ,
                        product_id: p.id_coinzz,
                        customer_name: textoOriginal.split('|')[0].trim(),
                        customer_cpf: cpfLimpo,
                        customer_phone: telLimpo,
                        customer_details: `Endereço: ${userState[from].enderecoParcial} | Ref: ${userState[from].complemento}`,
                        payment_method: 'upfront'
                    });
                } else {
                    await axios.post('https://app.logzz.com.br/api/v1/orders', {
                        token: TOKEN_LOGZZ,
                        product_id: p.id_logzz,
                        customer_name: textoOriginal.split('|')[0].trim(),
                        customer_cpf: cpfLimpo,
                        customer_phone: telLimpo,
                        address: userState[from].enderecoParcial,
                        address_number: userState[from].complemento,
                        payment_method: 'cod'
                    });
                }
                await enviarTexto(from, "✅ Pedido gerado com sucesso! Você receberá todos os detalhes em instantes no seu WhatsApp.");
            } catch (e) {
                console.error("❌ ERRO NA API:", e.response?.data || e.message);
                await enviarTexto(from, "Dados recebidos! Nossa equipe entrará em contato em breve para finalizar sua compra. 🌸");
            }
            delete userState[from];
        }
    });
}
iniciarAlex();
