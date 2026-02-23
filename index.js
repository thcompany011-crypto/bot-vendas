const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal'); 
const fs = require('fs');

const IP_ORACLE = "147.15.67.87"; 
const ARQUIVO_SESSOES = './sessoes.json';

const PRODUTOS = {
    aurora: { 
        nome: "Aurora Pink", 
        logzz: "https://entrega.logzz.com.br/pay/memyol6v0/tkrmb-5-unidades",
        coinzz: "https://app.coinzz.com.br/checkout/5-unidades-0knar-0/69976ac1ae74d"
    },
    serum: { 
        nome: "Sérum Novabeauty", 
        logzz: "https://entrega.logzz.com.br/pay/mem3qv845/3-potes-brinde",
        coinzz: "https://app.coinzz.com.br/checkout/2-leve-4-hg1pm-0/6987e28fef63a"
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

// --- FOLLOW-UP (DESPERTADORES) ---
const cronometros = {};

function iniciarFollowUp(sock, to, passo, produtoKey) {
    if (cronometros[to]) clearTimeout(cronometros[to]); // Limpa o antigo
    
    // Configurado para 30 minutos (30 * 60 * 1000)
    cronometros[to] = setTimeout(async () => {
        if (sessoes[to] && !sessoes[to].pausado) {
            let msgFollowUp = "";
            if (passo === 1) msgFollowUp = "Oi! Conseguiu ver minha mensagem acima? Me conta rapidinho, o que mais está te incomodando hoje para eu conseguir te ajudar? 🥰";
            if (passo === 2) msgFollowUp = "Oi! Estou fechando a rota de entregas do motoboy para hoje. Me manda seu *CEP* (só números) pra eu ver se consigo colocar o seu na rota de Frete Grátis?";
            if (passo === 3) msgFollowUp = "Seu pedido já está quase pré-aprovado aqui com Frete Grátis! Só falta me confirmar o seu *CPF* e o *Número da casa* para eu liberar sua reserva. Consegue me mandar agora?";
            
            if (msgFollowUp !== "") {
                await enviarTextoHumano(sock, to, msgFollowUp);
                sessoes[to].pausado = true; // Trava Anti-Spam (só cobra 1 vez)
                salvarSessoes();
            }
        }
    }, 30 * 60 * 1000); // 30 Minutos
}

// --- RELÓGIO INTELIGENTE ---
function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "bom dia ☀️";
    if (hora >= 12 && hora < 18) return "boa tarde 🌤️";
    return "boa noite 🌙";
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
        const textoLow = texto.toLowerCase();

        // --- MODO HUMANO (SENSOR DO CHEFE) ---
        if (msg.key.fromMe) {
            if (texto.trim() === '#robo') {
                if (sessoes[from]) {
                    sessoes[from].pausado = false;
                    salvarSessoes();
                    await sock.sendMessage(from, { text: "🤖 *Robô reativado para este cliente. Aguardando a próxima mensagem dela...*" });
                }
            } else {
                if (sessoes[from] && !sessoes[from].pausado) {
                    sessoes[from].pausado = true; // Desliga o robô se o Alex falar
                    if (cronometros[from]) clearTimeout(cronometros[from]); // Cancela o follow-up
                    salvarSessoes();
                }
            }
            return;
        }

        // Se o cliente mandar algo, cria a ficha
        if (!sessoes[from]) sessoes[from] = { passo: 0, pausado: false };
        const cliente = sessoes[from];

        // Ignora mensagens se o robô estiver pausado (Modo Humano ativado)
        if (cliente.pausado) return;

        // Limpa o despertador se o cliente respondeu
        if (cronometros[from]) clearTimeout(cronometros[from]);

        // --- FILTRO DE CURIOSOS (MENSAGEM GENÉRICA DO FB) ---
        if (!cliente.produtoKey) {
            if (textoLow.includes("aurora") || textoLow.includes("pink") || textoLow.includes("mancha") || textoLow.includes("pele de seda")) {
                cliente.produtoKey = 'aurora';
            } else if (textoLow.includes("serum") || textoLow.includes("nova") || textoLow.includes("beauty") || textoLow.includes("rejuvenesce")) {
                cliente.produtoKey = 'serum';
            } else {
                // Mensagem não tem o produto (Passo -1)
                cliente.passo = -1; 
                await enviarTextoHumano(sock, from, `Olá, ${getSaudacao()}! Sou o Alex. Vi que veio do nosso anúncio.\n\nPara eu te passar as informações corretas, você gostaria de saber sobre o clareador *Aurora Pink* ou sobre o *Sérum Nova Beauty*?`);
                salvarSessoes();
                return;
            }
        }

        // Cliente respondeu ao filtro genérico
        if (cliente.passo === -1) {
            if (textoLow.includes("aurora") || textoLow.includes("pink") || textoLow.includes("clareador")) {
                cliente.produtoKey = 'aurora';
                cliente.passo = 0;
            } else if (textoLow.includes("serum") || textoLow.includes("nova") || textoLow.includes("beauty")) {
                cliente.produtoKey = 'serum';
                cliente.passo = 0;
            } else {
                await enviarTextoHumano(sock, from, "Por favor, digite *'Aurora'* ou *'Sérum'* para eu te passar as informações corretas! 👇");
                return;
            }
        }

        const produtoEscolhido = PRODUTOS[cliente.produtoKey];

        // --- PASSO 0: SAUDAÇÃO INTELIGENTE + FOTO ---
        if (cliente.passo === 0) {
            await sock.presenceSubscribe(from);
            await sock.sendPresenceUpdate('composing', from);
            await delay(1500);
            await sock.sendPresenceUpdate('paused', from);

            const saudacaoTempo = getSaudacao();

            if (cliente.produtoKey === 'serum') {
                const textoSerum = `Olá, ${saudacaoTempo}!\nSou o Alex. Vou te mostrar como o *Sérum Nova Beauty* vai transformar seu rosto e devolver aquele brilho de juventude.\n\nComo você se chama?`;
                if (fs.existsSync('./foto_serum.jpg')) await sock.sendMessage(from, { image: { url: './foto_serum.jpg' }, caption: textoSerum });
                else await enviarTextoHumano(sock, from, textoSerum);
            } else {
                const textoAurora = `Olá, ${saudacaoTempo}! ✨\nSou o Alex. Já vou te explicar como a *Aurora Pink* vai deixar sua pele impecável e livre de manchas.\n\nComo você se chama?`;
                if (fs.existsSync('./foto_aurora.jpg')) await sock.sendMessage(from, { image: { url: './foto_aurora.jpg' }, caption: textoAurora });
                else await enviarTextoHumano(sock, from, textoAurora);
            }
            
            cliente.passo = 1;
            salvarSessoes();
            iniciarFollowUp(sock, from, 1, cliente.produtoKey);
            return;
        }

        // --- PASSO 1: DORES E IDADE ---
        if (cliente.passo === 1) {
            cliente.nomeCliente = texto.split(' ')[0]; 
            if (cliente.produtoKey === 'serum') {
                await enviarTextoHumano(sock, from, `Prazer, *${cliente.nomeCliente}*! 😊\n\nA maioria das mulheres que me chamam tá cansada de usar um monte de produto e não ver diferença, sabe?\n\nMe diz: *qual sua idade e o que mais tá te incomodando hoje?* Rugas, manchas, flacidez... ou tudo junto?`);
            } else {
                await enviarTextoHumano(sock, from, `Que nome lindo, *${cliente.nomeCliente}*! 😍\n\nPra eu te indicar o tratamento ideal, me conta: O que mais te incomoda hoje? Manchas na virilha, axilas ou foliculite?`);
            }
            cliente.passo = 2;
            salvarSessoes();
            iniciarFollowUp(sock, from, 2, cliente.produtoKey);
            return;
        }

        // --- PASSO 2: OFERTA E CEP ---
        if (cliente.passo === 2) {
            cliente.idade = texto;
            if (cliente.produtoKey === 'serum') {
                await enviarTextoHumano(sock, from, `Entendo perfeitamente, ${cliente.nomeCliente}. É por isso que o Sérum Nova Beauty é diferente. Ele apaga o "bigodinho chinês", clareia manchas e tem aprovação da Anvisa!\n\nHoje estamos com a promoção especial de 3 potes por apenas R$ 297,00.\n\nAgora me informe seu *CEP* (apenas números) para eu verificar se temos entrega rápida com motoboy na sua rua?`);
            } else {
                await enviarTextoHumano(sock, from, `Entendo perfeitamente, ${cliente.nomeCliente}. Isso é super comum por causa do atrito ou da depilação. O Aurora Pink foi feito justamente pra isso e não contém ácidos!\n\nHoje estamos com o kit promocional de 5 unidades por apenas R$ 297,00.\n\n📍 Me conta, qual o seu *CEP* (apenas números) pra eu verificar o prazo e se temos Frete Grátis pra sua casa?`);
            }
            cliente.passo = 3;
            salvarSessoes();
            iniciarFollowUp(sock, from, 3, cliente.produtoKey);
            return;
        }

        // --- PASSO 3: CONSULTA NA ORACLE ---
        if (cliente.passo === 3 && texto.match(/\d{5}-?\d{3}/)) {
            cliente.cep = texto.replace(/\D/g, '');
            cliente.whatsapp = from.split('@')[0]; 
            await enviarTextoHumano(sock, from, `🔍 Verificando a logística na sua região, só um instante...`);

            try {
                const res = await axios.post(`http://${IP_ORACLE}:3000/sondagem`, { cep: cliente.cep, link: produtoEscolhido.logzz });
                
                if (res.data.atende) {
                    cliente.tipo = 'LOGZZ';
                    await enviarTextoHumano(sock, from, `✅ *Ótima notícia!*\nTemos pronta entrega para sua região com frete grátis e você paga os R$ 297,00 apenas no ato da entrega!`);
                } else {
                    cliente.tipo = 'COINZZ';
                    await enviarTextoHumano(sock, from, `📦 *Atenção:*\nPara sua região, o envio é feito via Correios. O pagamento de R$ 297,00 é antecipado (Pix ou Cartão) e o frete também é grátis!`);
                }
                
                await enviarTextoHumano(sock, from, "Para eu gerar o seu pedido agora mesmo no sistema, me mande numa **ÚNICA MENSAGEM**:\n\n👤 Nome Completo\n💳 CPF (apenas números)\n🏠 Número da casa");
                cliente.passo = 4; 
                salvarSessoes();
            } catch (e) { 
                await enviarTextoHumano(sock, from, "Ops, ocorreu um erro na verificação do CEP. Pode enviar novamente?"); 
            }
            return;
        }

        // --- PASSO 4: FINALIZAR VENDA ---
        if (cliente.passo === 4) {
            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/) || texto.match(/\d{11}/);
            if (!cpfMatch) {
                await enviarTextoHumano(sock, from, "Não consegui identificar o seu CPF na mensagem. Por favor, digite novamente Nome, CPF e Número da casa num único texto:");
                return;
            }

            cliente.cpf = cpfMatch[0].replace(/\D/g, ''); 
            const partes = texto.split(cpfMatch[0]);
            cliente.nome = partes[0].replace(/nome:|1\.|👤/gi, '').trim() || "Cliente";
            cliente.numero = partes[1] ? partes[1].replace(/n[úu]mero:|casa|complemento:|3\.|🏠/gi, '').trim() : "SN";

            await enviarTextoHumano(sock, from, "Recebido com sucesso! 🎯\nEstou gerando seu pedido agora mesmo no sistema. Em instantes você receberá a confirmação.");

            if (cliente.tipo === 'LOGZZ') {
                try {
                    await axios.post(`http://${IP_ORACLE}:3000/agendar-logzz`, { cliente, link: produtoEscolhido.logzz });
                    await enviarTextoHumano(sock, from, "🎉 **PEDIDO AGENDADO COM SUCESSO!**\nSua entrega foi confirmada. O entregador entrará em contato quando estiver a caminho.");
                } catch (e) { await enviarTextoHumano(sock, from, "Acesse o link oficial para concluir: " + produtoEscolhido.logzz); }
            } else {
                try {
                    const res = await axios.post(`http://${IP_ORACLE}:3000/gerar-pix-coinzz`, { cliente, link: produtoEscolhido.coinzz }, { timeout: 45000 });
                    if (res.data.pix) {
                        await enviarTextoHumano(sock, from, "✅ **RESERVA CONCLUÍDA!**\nCopie o código PIX abaixo para garantir a sua promoção:");
                        await sock.sendMessage(from, { text: res.data.pix });
                    } else { throw new Error('Pix não extraído'); }
                } catch (e) { await enviarTextoHumano(sock, from, "Aqui está o link oficial da sua reserva: " + produtoEscolhido.coinzz); }
            }
            cliente.pausado = true; // Desliga o robô após a venda ser concluída
            salvarSessoes();
        }
    });
}
iniciar();
