const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal'); 
const fs = require('fs');

const IP_ORACLE = "147.15.67.87"; 
const ARQUIVO_SESSOES = './sessoes.json';

// --- CONFIGURAÇÃO DE PRODUTOS E OFERTAS ÚNICAS ---
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
if (fs.existsSync(ARQUIVO_SESSOES)) {
    sessoes = JSON.parse(fs.readFileSync(ARQUIVO_SESSOES, 'utf-8'));
}
function salvarSessoes() {
    fs.writeFileSync(ARQUIVO_SESSOES, JSON.stringify(sessoes, null, 2));
}

// --- RELÓGIO INTELIGENTE ---
function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "bom dia ☀️";
    if (hora >= 12 && hora < 18) return "boa tarde 🌤️";
    return "boa noite 🌙";
}

// --- FOLLOW-UP (REMARKETING INTELIGENTE) ---
const cronometros = {};

function iniciarFollowUp(sock, to, passo, produtoKey) {
    if (cronometros[to]) clearTimeout(cronometros[to]); 
    
    // Disparo em 45 minutos
    cronometros[to] = setTimeout(async () => {
        if (sessoes[to] && !sessoes[to].pausado) {
            let msgFollowUp = "";
            if (passo === 1) msgFollowUp = "ooi, podemos continuar? 🥰";
            if (passo === 2) msgFollowUp = "Vi que você ainda não finalizou. Se ficou alguma dúvida sobre o produto, é só digitar o número da opção abaixo que eu te explico tudinho:\n\n1️⃣ Como devo usar?\n2️⃣ O que tem na fórmula?\n3️⃣ Como funciona a garantia?\n4️⃣ É aprovado pela Anvisa?";
            if (passo === 3 || passo === 4) msgFollowUp = "Ainda quer garantir seu kit com frete grátis? O tempo não espera e sua pele merece esse cuidado! ✨";
            
            if (msgFollowUp !== "") {
                await enviarTextoHumano(sock, to, msgFollowUp);
                
                // Gatilho cascata de 2 horas
                sessoes[to].timer2h = setTimeout(async () => {
                    if (sessoes[to] && !sessoes[to].pausado) {
                        await enviarTextoHumano(sock, to, "Oie! Tudo bem? O que acha de adquirir seu tratamento hoje para sentir na pele a eficácia? Se quiser aproveitar o frete grátis, me avisa! 🌸");
                        sessoes[to].pausado = true; // Trava após o remarketing longo para não virar spam
                        salvarSessoes();
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

async function iniciar() {
    console.log('--- 🚀 MÁQUINA DE VENDAS DO SR. ALEX LIGADA ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_alex');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'), 
        syncFullHistory: false
    });
    
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            setTimeout(iniciar, 5000); 
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;
        
        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        
        // CORREÇÃO DOS ACENTOS: Remove acentuação e transforma em minúsculas
        const textoLow = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // --- MODO HUMANO (SENSOR DO CHEFE) ---
        if (msg.key.fromMe) {
            if (texto.trim() === '#robo') {
                if (sessoes[from]) {
                    sessoes[from].pausado = false;
                    salvarSessoes();
                    await sock.sendMessage(from, { text: "🤖 *Robô reativado para este cliente.*" });
                }
            } else {
                if (sessoes[from] && !sessoes[from].pausado) {
                    sessoes[from].pausado = true; 
                    if (cronometros[from]) clearTimeout(cronometros[from]); 
                    salvarSessoes();
                }
            }
            return;
        }

        if (!sessoes[from]) sessoes[from] = { passo: 0, pausado: false };
        const cliente = sessoes[from];

        if (cliente.pausado) return;
        if (cronometros[from]) clearTimeout(cronometros[from]);

        // --- FILTRO DE ENTRADA (IDENTIFICAÇÃO DO PRODUTO) ---
        if (!cliente.produtoKey) {
            if (textoLow.includes("hyalo") || textoLow.includes("lift")) {
                cliente.produtoKey = 'hyalo';
            } else if (textoLow.includes("serum") || textoLow.includes("beauty") || textoLow.includes("nova") || textoLow.includes("ja tenho")) {
                cliente.produtoKey = 'serum';
            } else {
                cliente.passo = -1; 
                await enviarTextoHumano(sock, from, `Olá, ${getSaudacao()}! Sou o Alex. Vi que veio do nosso anúncio.\n\nPara eu te passar as informações corretas, você gostaria de saber sobre o *Hyalo Lift* ou sobre o *Beauty Sérum*?`);
                salvarSessoes();
                return;
            }
        }

        if (cliente.passo === -1) {
            if (textoLow.includes("hyalo") || textoLow.includes("lift")) {
                cliente.produtoKey = 'hyalo'; cliente.passo = 0;
            } else if (textoLow.includes("serum") || textoLow.includes("beauty")) {
                cliente.produtoKey = 'serum'; cliente.passo = 0;
            } else {
                await enviarTextoHumano(sock, from, "Por favor, digite *'Hyalo'* ou *'Sérum'* para eu te passar as informações corretas! 👇");
                return;
            }
        }

        const produtoEscolhido = PRODUTOS[cliente.produtoKey];

        // --- PASSO 0: SAUDAÇÃO E AUTORIDADE ---
        if (cliente.passo === 0) {
            await enviarTextoHumano(sock, from, `Olá sou o Alex especialista do ${produtoEscolhido.nome}! 😍\n\nComprando hoje, você recebe em casa e o melhor: só paga direto para o entregador quando receber, tudo bem?\n\nPara eu te indicar o melhor tratamento, me conta rapidinho: qual o seu nome e o que mais te incomoda na sua pele hoje?`);
            cliente.passo = 1;
            salvarSessoes();
            iniciarFollowUp(sock, from, 1, cliente.produtoKey);
            return;
        }

        // --- PASSO 1: DORES, OBJEÇÃO E OFERTA ÚNICA ---
        if (cliente.passo === 1) {
            cliente.nomeCliente = texto.split(' ')[0] || "Linda"; 
            
            let prefixo = `Prazer, ${cliente.nomeCliente}! Entendo perfeitamente o que você está passando. `;
            
            // Gatilho de Objeção: "Já uso outro produto" ou Pergunta Direta de Valor
            if (textoLow.includes("uso") || textoLow.includes("usei") || textoLow.includes("outro") || textoLow.includes("ja tenho")) {
                prefixo = `Que maravilha que você já tem o hábito de se cuidar, ${cliente.nomeCliente}! Isso é meio caminho andado.\n\nMas o ${produtoEscolhido.nome} é um verdadeiro upgrade tecnológico. Ele age onde os cremes comuns não chegam. `;
            }

            await enviarTextoHumano(sock, from, `${prefixo}Nossa ${produtoEscolhido.tecnologia} está sendo um sucesso absoluto pela velocidade dos resultados.\n\nPara você não ter desculpa de não cuidar da sua pele hoje, a promoção é única:\n🎁 *${produtoEscolhido.oferta}*!\n\nE lembrando: o risco é todo meu, você tem 90 dias de garantia total.\n\nMe manda seu *CEP* (só números) aqui embaixo? Vou ver agora no sistema se temos entregador disponível para a sua rua e se libero o Frete Grátis para você!`);
            
            cliente.passo = 2;
            salvarSessoes();
            iniciarFollowUp(sock, from, 2, cliente.produtoKey);
            return;
        }

        // --- PASSO 2: MENU DE DÚVIDAS E CONSULTA CEP ---
        if (cliente.passo === 2) {
            // FAQ Automático
            if (texto.trim() === '1') {
                const uso = cliente.produtoKey === 'serum' ? '12 gotas diariamente, preferencialmente à noite' : '3 a 5 gotas no rosto limpo e seco, de manhã e à noite';
                await enviarTextoHumano(sock, from, `É super simples! Aplique ${uso}. Massageie até a pele absorver bem. 🥰\n\nMe manda seu *CEP* (só números) para eu ver se temos entregador pra você?`);
                return;
            }
            if (texto.trim() === '2') {
                await enviarTextoHumano(sock, from, `A nossa tecnologia é de ponta! O ${produtoEscolhido.nome} conta com ${produtoEscolhido.tecnologia} que penetra profundamente. 🧬\n\nMe manda seu *CEP* (só números) para eu verificar o seu frete grátis?`);
                return;
            }
            if (texto.trim() === '3') {
                await enviarTextoHumano(sock, from, `Garantia incondicional de 90 dias! Se não notar melhora, devolvemos seu dinheiro sem burocracia. 🤝\n\nMe manda seu *CEP*?`);
                return;
            }
            if (texto.trim() === '4') {
                await enviarTextoHumano(sock, from, `Com certeza! Produto dermatologicamente testado e 100% aprovado pela Anvisa. É segurança total. 🛡️\n\nMe manda seu *CEP*?`);
                return;
            }

            // Tratativa de CEP e Chamada Oracle
            const cepMatch = texto.match(/\d{5}-?\d{3}/);
            if (cepMatch) {
                cliente.cep = cepMatch[0].replace(/\D/g, '');
                cliente.whatsapp = from.split('@')[0]; // Captura oculta do número
                await enviarTextoHumano(sock, from, `🔍 Verificando a melhor rota de entrega no sistema, só um instante...`);

                try {
                    const res = await axios.post(`http://${IP_ORACLE}:3000/sondagem`, { cep: cliente.cep, link: produtoEscolhido.logzz });
                    
                    if (res.data.atende) {
                        cliente.tipo = 'LOGZZ';
                        await enviarTextoHumano(sock, from, `Maravilha! Hoje mesmo fiz um envio para sua cidade. 🥰\n\nVocê acabou de dar um passo incrível para uma pele linda e saudável! Vou precisar dos seus dados para separar o seu kit promocional.\n\nMe envia aqui numa **ÚNICA MENSAGEM**, por favor:\n\n👤 Nome completo\n💳 CPF\n🏠 Endereço com número`);
                    } else {
                        cliente.tipo = 'COINZZ';
                        await enviarTextoHumano(sock, from, `Ooi! Verifiquei aqui e infelizmente não temos entregador particular disponível na sua região hoje. Mas consigo enviar pelos Correios! 📦\n\nComo vai por Correios com frete grátis, preciso que o pagamento seja feito agora para liberar a etiqueta. Prefere *Pix ou Cartão*?\n\nMe mande sua resposta junto com seus dados numa **ÚNICA MENSAGEM** para eu gerar seu pedido:\n\n👤 Nome completo\n💳 CPF\n🏠 Endereço com número`);
                    }
                    
                    cliente.passo = 3; 
                    salvarSessoes();
                    iniciarFollowUp(sock, from, 3, cliente.produtoKey);
                } catch (e) { 
                    await enviarTextoHumano(sock, from, "Ops, ocorreu um erro de conexão com o painel de rotas. Pode enviar seu CEP novamente?"); 
                }
                return;
            }
        }

        // --- PASSO 3: COLETA DE DADOS -> BIFURCAÇÃO LOGZZ/COINZZ ---
        if (cliente.passo === 3) {
            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/) || texto.match(/\d{11}/);
            if (!cpfMatch) {
                await enviarTextoHumano(sock, from, "Não consegui identificar o seu CPF na mensagem. Por favor, digite novamente Nome, CPF e Endereço com número num único texto:");
                return;
            }

            cliente.cpf = cpfMatch[0].replace(/\D/g, ''); 
            const partes = texto.split(cpfMatch[0]);
            cliente.nome = partes[0].replace(/nome:|1\.|👤/gi, '').trim() || "Cliente";
            cliente.numero = partes[1] ? partes[1].replace(/n[úu]mero:|casa|complemento:|endere[çc]o|3\.|🏠/gi, '').trim() : "SN";

            if (cliente.tipo === 'LOGZZ') {
                // Nova Pergunta de Agendamento da Logzz
                await enviarTextoHumano(sock, from, `Recebi aqui! 🚚\n\nNós fazemos entregas de *segunda a sábado, das 08h às 18h*. Para facilitar para o nosso motorista, **qual o melhor dia e período (manhã ou tarde)** para você receber o seu kit e fazer o pagamento?`);
                cliente.passo = 4;
                salvarSessoes();
                iniciarFollowUp(sock, from, 4, cliente.produtoKey);
                return;
            } else {
                // Fluxo Coinzz Direto
                await enviarTextoHumano(sock, from, "Recebido com sucesso! 🎯\nEstou gerando seu pedido e seu código Pix seguro agora mesmo no sistema. Só um instante...");
                try {
                    // CORREÇÃO DO E-MAIL: Enviando o e-mail oculto e camuflado para a Oracle processar na Coinzz
                    const res = await axios.post(`http://${IP_ORACLE}:3000/gerar-pix-coinzz`, { 
                        cliente: { ...cliente, email: "coringavps157@gmail.com" }, 
                        link: produtoEscolhido.coinzz 
                    }, { timeout: 45000 });
                    
                    if (res.data.pix) {
                        await enviarTextoHumano(sock, from, "✅ **RESERVA CONCLUÍDA!**\nCopie o código PIX abaixo para garantir a sua promoção:");
                        await sock.sendMessage(from, { text: res.data.pix });
                    } else { throw new Error('Pix não extraído'); }
                } catch (e) { 
                    await enviarTextoHumano(sock, from, "Aqui está o link oficial da sua reserva para finalizar com segurança: " + produtoEscolhido.coinzz); 
                }
                
                cliente.pausado = true; // Finaliza o robô
                salvarSessoes();
                return;
            }
        }

        // --- PASSO 4: FINALIZAÇÃO LOGZZ (CONFIRMAÇÃO DO DIA) ---
        if (cliente.passo === 4 && cliente.tipo === 'LOGZZ') {
            cliente.diaEntrega = texto; 
            await enviarTextoHumano(sock, from, `Perfeito! Já deixei anotado aqui no sistema: **Entrega agendada para ${texto}**. 🗓️\n\nO entregador vai te avisar quando estiver a caminho. Muito obrigado pela confiança, você vai amar o resultado! ❤️`);
            
            try {
                await axios.post(`http://${IP_ORACLE}:3000/agendar-logzz`, { cliente, link: produtoEscolhido.logzz });
            } catch (e) { 
                console.log("Erro logzz silencioso"); 
            }

            cliente.pausado = true; // Desliga o robô após agendar
            salvarSessoes();
            return;
        }
    });
}
iniciar();
