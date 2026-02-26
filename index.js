const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal'); 
const fs = require('fs');

// --- 🚨 RADAR DE BUGS (NÃO DEIXA O ROBÔ MORRER EM SILÊNCIO) ---
process.on('uncaughtException', (err) => {
    console.error('\n🚨 [BUG FATAL NO TERMUX] Algo quebrou o código:');
    console.error(err.message || err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n🚨 [FALHA DE SISTEMA] Um processo em segundo plano falhou:');
    console.error(reason);
});

const IP_ORACLE = "147.15.67.87"; 
const ARQUIVO_SESSOES = './sessoes.json';

// --- CONFIGURAÇÃO DE PRODUTOS E COPY ---
const PRODUTOS = {
    hyalo: { 
        nome: "Hyalo Lift", 
        logzz: "https://entrega.logzz.com.br/pay/memg2kpd5/mbtkq-2-unidades", 
        coinzz: "https://app.coinzz.com.br/checkout/2-unidades-sv3ti-0/699cf26ee6887", 
        oferta: "2 unidades por apenas R$ 197,00",
        tecnologia: "tecnologia francesa com Nanovetores de Ácido Hialurônico, Colágeno Vegano e Água Termal",
        dores: "das manchas, melasma, rugas e do bigode chinês",
        uso: "3 a 5 gotas sobre o rosto limpo e seco, massageando suavemente de manhã e à noite",
        rmk_curto: "Sabe aquela sensação de usar biquíni ou se olhar no espelho sem se preocupar com manchas? ✨ É isso que o Hyalo tem feito por centenas de mulheres. Podemos continuar de onde paramos? 🥰",
        rmk_longo: "Oie! Tudo bem? O que acha de adquirir 1 frasco experimental para sentir na pele a eficácia do Hyalo? Libertei uma oferta de 1 frasco por apenas R$ 147! Se quiser aproveitar com frete grátis, me avisa! 🌸"
    },
    serum: { 
        nome: "Beauty Sérum", 
        logzz: "https://entrega.logzz.com.br/pay/mem3qv845/3-potes-brinde",
        coinzz: "https://app.coinzz.com.br/checkout/2-leve-4-hg1pm-0/6987e28fef63a",
        oferta: "Pague 2 e Leve 4 unidades por apenas R$ 297,00",
        tecnologia: "fórmula de ouro com Resveratrol, Vitamina E, Ácido Hialurônico e D-Panthenol",
        dores: "das linhas de expressão, flacidez e recuperar aquele brilho natural da pele de anos atrás",
        uso: "12 gotinhas mágicas à noite, espalhando com movimentos circulares",
        rmk_curto: "Oi, minha linda... Eu sei que não é fácil decidir, mas se você continuar esperando, o tempo não para e as rugas continuam aparecendo. Vamos dar esse passo por ti mesma hoje? 🥰",
        rmk_longo: "Passando rapidinho! O sistema está me pedindo a liberação da sua reserva. Como a procura pelo Sérum está altíssima, eu só consigo segurar o seu kit com frete grátis por mais 1 hora. Posso confirmar o seu pedido? ✨"
    }
};

let sessoes = {};
if (fs.existsSync(ARQUIVO_SESSOES)) { sessoes = JSON.parse(fs.readFileSync(ARQUIVO_SESSOES, 'utf-8')); }
function salvarSessoes() { fs.writeFileSync(ARQUIVO_SESSOES, JSON.stringify(sessoes, null, 2)); }

function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "bom dia ☀️";
    if (hora >= 12 && hora < 18) return "boa tarde 🌤️";
    return "boa noite 🌙";
}

const cronometros = {};
function iniciarFollowUp(sock, to, passo, produtoKey) {
    if (cronometros[to]) clearTimeout(cronometros[to]); 
    const produto = PRODUTOS[produtoKey];
    cronometros[to] = setTimeout(async () => {
        if (sessoes[to] && !sessoes[to].pausado) {
            let msgFollowUp = "";
            if (passo === 1) msgFollowUp = produto.rmk_curto;
            if (passo === 2) msgFollowUp = "Vi que você ainda não finalizou. Se ficou alguma dúvida sobre o produto, é só digitar o número da opção abaixo que eu te explico tudinho:\n\n1️⃣ Como devo usar?\n2️⃣ O que tem na fórmula?\n3️⃣ Como funciona a garantia?\n4️⃣ É aprovado pela Anvisa?";
            if (passo === 3 || passo === 4) msgFollowUp = "Ainda quer garantir seu kit com frete grátis? O tempo não espera e sua pele merece esse cuidado! ✨";
            if (msgFollowUp !== "") {
                await enviarTextoHumano(sock, to, msgFollowUp);
                sessoes[to].timer2h = setTimeout(async () => {
                    if (sessoes[to] && !sessoes[to].pausado) {
                        await enviarTextoHumano(sock, to, produto.rmk_longo);
                        sessoes[to].pausado = true; salvarSessoes();
                    }
                }, 2 * 60 * 60 * 1000); 
            }
        }
    }, 45 * 60 * 1000); 
}

async function enviarTextoHumano(sock, to, text) {
    await sock.presenceSubscribe(to);
    await delay(500);
    await sock.sendPresenceUpdate('composing', to); 
    const tempoDigitacao = Math.min(text.length * 40, 6000); 
    await delay(tempoDigitacao);
    await sock.sendPresenceUpdate('paused', to); 
    await sock.sendMessage(to, { text: text });
}

async function iniciar() {
    console.log('--- 🚀 MÁQUINA DE VENDAS LIGADA (C/ RADAR DE BUGS ATIVO) ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_alex');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), browser: Browsers.macOS('Desktop'), syncFullHistory: false });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const erro = lastDisconnect?.error?.message || "Desconhecido";
            console.error(`\n⚠️ [ZAP DESCONECTADO] Motivo: ${erro}. Tentando religar em 5s...`);
            setTimeout(iniciar, 5000); 
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado com sucesso!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const textoLow = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                // --- MODO HUMANO INTELIGENTE ---
        if (msg.key.fromMe) {
            if (texto.trim() === '#robo') {
                if (sessoes[from]) { sessoes[from].pausado = false; salvarSessoes(); await sock.sendMessage(from, { text: "🤖 *Robô reativado!*" }); }
            } else if (texto.trim() === '#pausa') {
                if (sessoes[from]) { sessoes[from].pausado = true; if (cronometros[from]) clearTimeout(cronometros[from]); salvarSessoes(); await sock.sendMessage(from, { text: "⏸️ *Robô pausado pelo chefe.*" }); }
            }
            return; // Ignora as mensagens automáticas do próprio robô
        }


        if (!sessoes[from]) sessoes[from] = { passo: 0, pausado: false };
        const cliente = sessoes[from];

        if (cliente.pausado) return;
        if (cronometros[from]) clearTimeout(cronometros[from]);

        if (!cliente.produtoKey) {
            if (textoLow.includes("hyalo") || textoLow.includes("lift")) { cliente.produtoKey = 'hyalo'; } 
            else if (textoLow.includes("serum") || textoLow.includes("beauty") || textoLow.includes("nova") || textoLow.includes("ja tenho")) { cliente.produtoKey = 'serum'; } 
            else {
                cliente.passo = -1; salvarSessoes(); 
                await enviarTextoHumano(sock, from, `Olá, ${getSaudacao()}! Sou o Alex. Vi que veio do nosso anúncio.\n\nVocê gostaria de saber sobre o *Hyalo Lift* ou sobre o *Beauty Sérum*?`);
                return;
            }
        }

        if (cliente.passo === -1) {
            if (textoLow.includes("hyalo") || textoLow.includes("lift")) { cliente.produtoKey = 'hyalo'; cliente.passo = 0; } 
            else if (textoLow.includes("serum") || textoLow.includes("beauty")) { cliente.produtoKey = 'serum'; cliente.passo = 0; } 
            else { await enviarTextoHumano(sock, from, "Por favor, digite *'Hyalo'* ou *'Sérum'*! 👇"); return; }
        }

        const produtoEscolhido = PRODUTOS[cliente.produtoKey];

        // --- PASSO 0 ---
        if (cliente.passo === 0) {
            cliente.passo = 1; salvarSessoes(); iniciarFollowUp(sock, from, 1, cliente.produtoKey);
            await enviarTextoHumano(sock, from, `Olá! Tudo bem? Sou o Alex, especialista do ${produtoEscolhido.nome}. 😍\n\nComprando hoje, você recebe em casa e o melhor: só paga direto para o entregador quando receber, tudo bem?\n\nPara eu te indicar o melhor tratamento, me conta rapidinho: qual o seu nome e o que mais te incomoda na sua pele hoje?`);
            return;
        }

        // --- PASSO 1 ---
        if (cliente.passo === 1) {
            cliente.passo = 2; salvarSessoes(); iniciarFollowUp(sock, from, 2, cliente.produtoKey);
            cliente.nomeCliente = texto.split(' ')[0] || "Linda"; 
            let prefixo = `Prazer, ${cliente.nomeCliente}! Entendo perfeitamente o que você está passando. `;
            if (textoLow.includes("uso") || textoLow.includes("usei") || textoLow.includes("outro") || textoLow.includes("ja tenho")) {
                prefixo = `Que maravilha que você já tem o hábito de se cuidar, ${cliente.nomeCliente}! Mas o ${produtoEscolhido.nome} é um verdadeiro upgrade. Ele age onde os cremes comuns não chegam. `;
            }
            await enviarTextoHumano(sock, from, `${prefixo}\n\nCom ele, te dou garantia que você vai se livrar ${produtoEscolhido.dores}. A nossa ${produtoEscolhido.tecnologia} é um sucesso absoluto.\n\nPromoção única de hoje:\n🎁 *${produtoEscolhido.oferta}*!\n\nMe manda seu *CEP* (só números) aqui embaixo? Vou ver agora no sistema se libero o Frete Grátis e pagamento na entrega para você!`);
            return;
        }

        // --- PASSO 2 ---
        if (cliente.passo === 2) {
            if (texto.trim() === '1') { await enviarTextoHumano(sock, from, `É super simples! Aplique ${produtoEscolhido.uso}. 🥰\n\nMe manda seu *CEP* (só números) para eu ver se temos entregador pra você?`); return; }
            if (texto.trim() === '2') { await enviarTextoHumano(sock, from, `O ${produtoEscolhido.nome} conta com ${produtoEscolhido.tecnologia}. 🧬\n\nMe manda seu *CEP*?`); return; }
            if (texto.trim() === '3') { await enviarTextoHumano(sock, from, `Garantia incondicional de 90 dias! 🤝\n\nMe manda seu *CEP*?`); return; }
            if (texto.trim() === '4') { await enviarTextoHumano(sock, from, `100% aprovado pela Anvisa. É segurança total. 🛡️\n\nMe manda seu *CEP*?`); return; }

            const cepMatch = texto.match(/\d{5}-?\d{3}/) || texto.match(/\d{8}/);
            if (cepMatch) {
                cliente.passo = 3; salvarSessoes(); iniciarFollowUp(sock, from, 3, cliente.produtoKey);
                cliente.cep = cepMatch[0].replace(/\D/g, ''); cliente.whatsapp = from.split('@')[0];
                await enviarTextoHumano(sock, from, `🔍 Verificando a melhor rota de entrega no sistema, só um instante...`);

                try {
                    const res = await axios.post(`http://${IP_ORACLE}:3000/sondagem`, { cep: cliente.cep, link: produtoEscolhido.logzz });
                    if (res.data.atende) {
                        cliente.tipo = 'LOGZZ';
                        await enviarTextoHumano(sock, from, `Maravilha! Hoje mesmo fiz um envio para sua cidade. 🥰\n\nVocê acabou de dar um passo incrível! Me envia aqui numa **ÚNICA MENSAGEM**, por favor:\n\n👤 Nome completo\n💳 CPF\n🏠 Endereço com número`);
                    } else {
                        cliente.tipo = 'COINZZ';
                        await enviarTextoHumano(sock, from, `Ooi! Verifiquei aqui e infelizmente não temos entregador particular para sua região hoje. Mas consigo enviar pelos Correios! 📦\n\nComo vai com frete grátis, preciso gerar a etiqueta. Prefere *Pix ou Cartão*?\n\nMe mande sua resposta junto com seus dados numa **ÚNICA MENSAGEM**:\n\n👤 Nome completo\n💳 CPF\n🏠 Endereço com número`);
                    }
                } catch (e) { 
                    cliente.passo = 2; salvarSessoes();
                    const detalheErro = e.response ? e.response.data.error : e.message;
                    console.error(`\n❌ [FALHA DE COMUNICAÇÃO COM ORACLE] Passo 2 (CEP). Motivo: ${detalheErro}`);
                    await enviarTextoHumano(sock, from, "Ops, o sistema de rotas deu uma pequena oscilada. Pode enviar seu CEP novamente?"); 
                }
                return;
            }
        }

        // --- PASSO 3 ---
        if (cliente.passo === 3) {
            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/) || texto.match(/\d{11}/);
            if (!cpfMatch) { await enviarTextoHumano(sock, from, "Não consegui identificar o seu CPF. Por favor, digite novamente Nome, CPF e Endereço:"); return; }

            cliente.cpf = cpfMatch[0].replace(/\D/g, ''); 
            const partes = texto.split(cpfMatch[0]);
            cliente.nome = partes[0].replace(/nome:|1\.|👤/gi, '').trim() || "Cliente";
            cliente.numero = partes[1] ? partes[1].replace(/n[úu]mero:|casa|complemento:|endere[çc]o|3\.|🏠/gi, '').trim() : "SN";

            if (cliente.tipo === 'LOGZZ') {
                cliente.passo = 4; salvarSessoes(); iniciarFollowUp(sock, from, 4, cliente.produtoKey);
                await enviarTextoHumano(sock, from, `Recebi aqui! 🚚\n\nNós fazemos entregas de *segunda a sábado, das 08h às 18h*. **Qual o melhor dia e período (manhã ou tarde)** para você receber o seu kit e fazer o pagamento?`);
            } else {
                cliente.pausado = true; salvarSessoes();
                await enviarTextoHumano(sock, from, "Recebido! 🎯\nEstou gerando seu código Pix seguro agora mesmo no sistema. Só um instante...");
                try {
                    const res = await axios.post(`http://${IP_ORACLE}:3000/gerar-pix-coinzz`, { cliente: { ...cliente, email: "coringavps157@gmail.com" }, link: produtoEscolhido.coinzz }, { timeout: 45000 });
                    if (res.data.pix) {
                        await enviarTextoHumano(sock, from, "✅ **RESERVA CONCLUÍDA!**\nCopie o código PIX abaixo para garantir a sua promoção:");
                        await sock.sendMessage(from, { text: res.data.pix });
                    } else { throw new Error('Pix não extraído'); }
                } catch (e) { 
                    const detalheErro = e.response ? e.response.data.error : e.message;
                    console.error(`\n❌ [ERRO AO GERAR PIX - ORACLE] Motivo: ${detalheErro}`);
                    await enviarTextoHumano(sock, from, "Tivemos uma lentidão para gerar o Pix automático. Finalize com segurança pelo link oficial: " + produtoEscolhido.coinzz); 
                }
            }
            return;
        }

        // --- PASSO 4 ---
        if (cliente.passo === 4 && cliente.tipo === 'LOGZZ') {
            cliente.pausado = true; salvarSessoes(); cliente.diaEntrega = texto; 
            await enviarTextoHumano(sock, from, `Perfeito! Já deixei anotado aqui: **Entrega agendada para ${texto}**. 🗓️\n\nO entregador vai te avisar quando estiver a caminho. Muito obrigado pela confiança! ❤️`);
            try { await axios.post(`http://${IP_ORACLE}:3000/agendar-logzz`, { cliente, link: produtoEscolhido.logzz }); } 
            catch (e) { console.error(`\n❌ [ERRO NO AGENDAMENTO LOGZZ - ORACLE] Motivo: ${e.message}`); }
            return;
        }
    });
}
iniciar();
