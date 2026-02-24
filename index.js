const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal'); 
const fs = require('fs');

// --- CONFIGURAÇÕES MESTRAS ---
const IP_ORACLE = "147.15.67.87"; 
const ARQUIVO_SESSOES = './sessoes.json';

const PRODUTOS = {
    hyalo: { 
        nome: "Hyalo Lift", 
        logzz: "https://entrega.logzz.com.br/pay/memg2kpd5/mbtkq-2-unidades", 
        coinzz: "https://app.coinzz.com.br/checkout/2-unidades-sv3ti-0/699cf26ee6887", 
        oferta: "2 unidades por apenas R$ 197,00",
        tecnologia: "tecnologia francesa com Nanovetores de Ácido Hialurônico e Água Termal"
    },
    serum: { 
        nome: "Beauty Sérum", 
        logzz: "https://entrega.logzz.com.br/pay/mem3qv845/3-potes-brinde",
        coinzz: "https://app.coinzz.com.br/checkout/2-leve-4-hg1pm-0/6987e28fef63a",
        oferta: "Pague 2 e Leve 4 unidades por apenas R$ 297,00",
        tecnologia: "fórmula atualizada agora em 2026 com Resveratrol e Vitamina E"
    }
};

// --- MEMÓRIA PERMANENTE ---
let sessoes = {};
if (fs.existsSync(ARQUIVO_SESSOES)) sessoes = JSON.parse(fs.readFileSync(ARQUIVO_SESSOES, 'utf-8'));
function salvarSessoes() { fs.writeFileSync(ARQUIVO_SESSOES, JSON.stringify(sessoes, null, 2)); }

function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "bom dia ☀️";
    if (hora >= 12 && hora < 18) return "boa tarde 🌤️";
    return "boa noite 🌙";
}

// --- FOLLOW-UP (REMARKETING INTELIGENTE DE 45MIN E 2H) ---
const cronometros = {};
function iniciarFollowUp(sock, to, passo) {
    if (cronometros[to]) clearTimeout(cronometros[to]); 
    cronometros[to] = setTimeout(async () => {
        if (sessoes[to] && !sessoes[to].pausado) {
            let msgFollowUp = "";
            if (passo === 1) msgFollowUp = "ooi, podemos continuar? 🥰";
            if (passo === 2) msgFollowUp = "Vi que você ainda não finalizou. Se ficou alguma dúvida sobre o produto, é só digitar o número da opção abaixo que eu te explico tudinho:\n\n1️⃣ Como devo usar?\n2️⃣ O que tem na fórmula?\n3️⃣ Como funciona a garantia?\n4️⃣ É aprovado pela Anvisa?";
            if (passo === 3 || passo === 4) msgFollowUp = "Ainda quer garantir seu kit com frete grátis? O tempo não espera e sua pele merece esse cuidado! ✨";
            
            if (msgFollowUp !== "") {
                await enviarTextoHumano(sock, to, msgFollowUp);
                sessoes[to].timer2h = setTimeout(async () => {
                    if (sessoes[to] && !sessoes[to].pausado) {
                        await enviarTextoHumano(sock, to, "Oie! Tudo bem? O que acha de adquirir seu tratamento hoje? Se quiser aproveitar o frete grátis, me avisa! 🌸");
                        sessoes[to].pausado = true; salvarSessoes();
                    }
                }, 2 * 60 * 60 * 1000); 
            }
        }
    }, 45 * 60 * 1000); 
}

// --- SIMULADOR DE DIGITAÇÃO HUMANA ---
async function enviarTextoHumano(sock, to, text) {
    await sock.presenceSubscribe(to);
    await delay(500);
    await sock.sendPresenceUpdate('composing', to); 
    const tempoDigitacao = Math.min(text.length * 40, 6000); 
    await delay(tempoDigitacao);
    await sock.sendPresenceUpdate('paused', to); 
    await sock.sendMessage(to, { text: text });
}

// --- INICIALIZAÇÃO DO ROBÔ ---
async function iniciar() {
    console.log('--- 🚀 MÁQUINA DE VENDAS DO SR. ALEX LIGADA ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_alex');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ 
        version, auth: state, 
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'), 
        syncFullHistory: false
    });
    
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrcode.generate(u.qr, { small: true });
        if (u.connection === 'close') setTimeout(iniciar, 5000);
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const textoLow = texto.toLowerCase();

        // MODO HUMANO (#ROBO)
        if (msg.key.fromMe) {
            if (texto.trim() === '#robo' && sessoes[from]) {
                sessoes[from].pausado = false; salvarSessoes();
                await sock.sendMessage(from, { text: "🤖 *Reativado!*" });
            } else if (sessoes[from] && !sessoes[from].pausado) {
                sessoes[from].pausado = true; if (cronometros[from]) clearTimeout(cronometros[from]); 
                salvarSessoes();
            }
            return;
        }

        if (!sessoes[from]) sessoes[from] = { passo: 0, pausado: false };
        const cliente = sessoes[from];
        if (cliente.pausado) return;
        if (cronometros[from]) clearTimeout(cronometros[from]);

        // FILTRO DE ENTRADA (PRODUTO)
        if (!cliente.produtoKey) {
            if (textoLow.includes("hyalo") || textoLow.includes("lift")) cliente.produtoKey = 'hyalo';
            else if (textoLow.includes("serum") || textoLow.includes("beauty") || textoLow.includes("nova")) cliente.produtoKey = 'serum';
            else {
                cliente.passo = -1;
                await enviarTextoHumano(sock, from, `Olá, ${getSaudacao()}! Sou o Alex. Vi que veio do anúncio. Qual produto você deseja saber mais: o *Hyalo Lift* ou o *Beauty Sérum*?`);
                salvarSessoes(); return;
            }
        }
        if (cliente.passo === -1) {
            if (textoLow.includes("hyalo")) { cliente.produtoKey = 'hyalo'; cliente.passo = 0; }
            else if (textoLow.includes("serum")) { cliente.produtoKey = 'serum'; cliente.passo = 0; }
            else { await enviarTextoHumano(sock, from, "Por favor, digite *'Hyalo'* ou *'Sérum'*!"); return; }
        }

        const produtoEscolhido = PRODUTOS[cliente.produtoKey];

        // PASSO 0: SAUDAÇÃO E DORES
        if (cliente.passo === 0) {
            await enviarTextoHumano(sock, from, `Olá sou o Alex especialista do ${produtoEscolhido.nome}! 😍\n\nComprando hoje, você recebe em casa e o melhor: só paga direto para o entregador quando receber, tudo bem?\n\nPara eu te indicar o melhor tratamento, me conta rapidinho: qual o seu nome e o que mais te incomoda na sua pele hoje?`);
            cliente.passo = 1; salvarSessoes(); iniciarFollowUp(sock, from, 1); return;
        }

        // PASSO 1: EMPATIA E OFERTA
        if (cliente.passo === 1) {
            cliente.nomeCliente = texto.split(' ')[0] || "Linda"; 
            let prefixo = `Prazer, ${cliente.nomeCliente}! Entendo o que você está passando. `;
            if (textoLow.includes("uso") || textoLow.includes("outro")) prefixo = `Que bom que você já se cuida! Mas o ${produtoEscolhido.nome} é um upgrade tecnológico. `;
            await enviarTextoHumano(sock, from, `${prefixo}Nossa ${produtoEscolhido.tecnologia} é um sucesso!\n\nPromoção única: 🎁 *${produtoEscolhido.oferta}*!\n\nMe manda seu *CEP* (só números)? Vou ver agora no sistema se temos entregador disponível e se libero o Frete Grátis!`);
            cliente.passo = 2; salvarSessoes(); iniciarFollowUp(sock, from, 2); return;
        }

        // PASSO 2: MENU DE DÚVIDAS E TESTE FUMAÇA ORACLE
        if (cliente.passo === 2) {
            if (texto.trim() === '1') { await enviarTextoHumano(sock, from, `Aplique 12 gotas (Sérum) ou 3-5 gotas (Hyalo) diariamente. 🥰\n\nMe manda seu *CEP* para eu ver se temos entregador?`); return; }
            if (texto.trim() === '2') { await enviarTextoHumano(sock, from, `Contamos com ${produtoEscolhido.tecnologia}. 🧬\n\nMe manda seu *CEP*?`); return; }
            if (texto.trim() === '3') { await enviarTextoHumano(sock, from, `Garantia de 90 dias incondicional! 🤝\n\nMe manda seu *CEP*?`); return; }
            if (texto.trim() === '4') { await enviarTextoHumano(sock, from, `Produto 100% aprovado pela Anvisa. 🛡️\n\nMe manda seu *CEP*?`); return; }

            const cepMatch = texto.match(/\d{5}-?\d{3}/) || texto.match(/\d{8}/);
            if (cepMatch) {
                cliente.cep = cepMatch[0].replace(/\D/g, '');
                cliente.whatsapp = from.split('@')[0];
                await enviarTextoHumano(sock, from, `🔍 Verificando disponibilidade de entrega no sistema, só um instante...`);
                try {
                    const res = await axios.post(`http://${IP_ORACLE}:3000/sondagem`, { cep: cliente.cep, link: produtoEscolhido.logzz });
                    if (res.data.atende) {
                        cliente.tipo = 'LOGZZ';
                        await enviarTextoHumano(sock, from, `✅ **BOA NOTÍCIA!** Temos entregador disponível com **PAGAMENTO NA ENTREGA**! 😍\n\nMe envie agora numa **ÚNICA MENSAGEM**:\n\n👤 Nome completo\n💳 CPF\n🏠 Endereço com número`);
                    } else {
                        cliente.tipo = 'COINZZ';
                        await enviarTextoHumano(sock, from, `📦 Para sua região o envio é via Correios com **Frete Grátis**!\n\nMe envie numa **ÚNICA MENSAGEM** para gerar seu pedido:\n\n👤 Nome completo\n📧 E-mail\n💳 CPF\n🏠 Endereço com número\n\n💰 Você prefere **Pix ou Cartão**?`);
                    }
                    cliente.passo = 3; salvarSessoes(); iniciarFollowUp(sock, from, 3);
                } catch (e) { await enviarTextoHumano(sock, from, "Erro de conexão. Mande o CEP novamente?"); }
                return;
            }
        }

        // PASSO 3: COLETA DE DADOS E BIFURCAÇÃO
        if (cliente.passo === 3) {
            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/) || texto.match(/\d{11}/);
            if (!cpfMatch) { await enviarTextoHumano(sock, from, "Por favor, envie Nome, CPF e Endereço numa única mensagem."); return; }
            cliente.cpf = cpfMatch[0].replace(/\D/g, ''); 
            cliente.nome = texto.split('\n')[0].trim();
            cliente.numero = texto.match(/\d+/g)?.pop() || "SN";
            cliente.email = texto.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "venda@alex.com";

            if (cliente.tipo === 'LOGZZ') {
                await enviarTextoHumano(sock, from, `Recebi! 🚚\n\nQual o melhor dia e período (manhã ou tarde) para nosso entregador te visitar?`);
                cliente.passo = 4; salvarSessoes(); iniciarFollowUp(sock, from, 4);
            } else {
                if (textoLow.includes("cartão") || textoLow.includes("cartao")) {
                    await enviarTextoHumano(sock, from, "Link para cartão: " + produtoEscolhido.coinzz);
                } else {
                    await enviarTextoHumano(sock, from, "Gerando seu Pix agora... Só um momento.");
                    try {
                        const resPix = await axios.post(`http://${IP_ORACLE}:3000/gerar-pix-coinzz`, { cliente, link: produtoEscolhido.coinzz });
                        if (resPix.data.pix) await sock.sendMessage(from, { text: resPix.data.pix });
                        else throw new Error();
                    } catch (e) { await enviarTextoHumano(sock, from, "Finalize por aqui: " + produtoEscolhido.coinzz); }
                }
                cliente.pausado = true; salvarSessoes();
            }
            return;
        }

        // PASSO 4: FINALIZAÇÃO LOGZZ
        if (cliente.passo === 4) {
            cliente.diaEntrega = texto;
            await enviarTextoHumano(sock, from, `Tudo pronto! Agendado para **${texto}**. ❤️`);
            try { await axios.post(`http://${IP_ORACLE}:3000/agendar-logzz`, { cliente, link: produtoEscolhido.logzz }); } 
            catch (e) { console.log("Erro agendamento"); }
            cliente.pausado = true; salvarSessoes(); return;
        }
    });
}
iniciar();
