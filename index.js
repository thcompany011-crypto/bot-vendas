const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

const IP_ORACLE = "147.15.67.87"; 

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

const sessoes = {}; 

async function enviarTextoHumano(sock, to, text) {
    await sock.presenceSubscribe(to);
    await delay(500);
    await sock.sendPresenceUpdate('composing', to); 
    const tempoDigitacao = Math.min(text.length * 40, 6000); 
    await delay(tempoDigitacao);
    await sock.sendPresenceUpdate('paused', to); 
    await sock.sendMessage(to, { text: text });
}

function responderFAQ(texto, produto) {
    const t = texto.toLowerCase();
    
    if (t.includes('tempo leva') || t.includes('demora') || t.includes('prazo')) return "🚚 O prazo médio é de apenas *1 dia útil*, entregamos de segunda a sábado (8h às 18h) dependendo da rota.";
    if (t.includes('forma de pagamento') || t.includes('como pagar')) return "💳 Aceitamos Pix, Dinheiro, Cartão de Crédito ou Débito. E o melhor: você pode pagar na entrega!";
    if (t.includes('grávida') || t.includes('lactante') || t.includes('amamentando')) return "🤰 Pode sim, mas como é um momento especial, o ideal é sempre confirmar com o seu médico antes, tá bem?";
    
    if (produto === 'serum') {
        if (t.includes('o que é') || t.includes('para que serve')) return "✨ É um sérum facial anti-idade com alta tecnologia. Combate rugas, linhas finas, flacidez e manchas!";
        if (t.includes('como usar') || t.includes('passar')) return "💧 *Como usar?* Aplique com a pele limpa, de preferência à noite, espalhando suavemente pelo rosto. Não precisa enxaguar!";
        if (t.includes('anvisa')) return "✅ *É aprovado pela ANVISA?* Sim! O sérum é 100% regularizado.";
        if (t.includes('funciona') || t.includes('resultado') || t.includes('quanto tempo')) return "⏳ Algumas clientes já percebem melhora em 7 a 15 dias! Mas o ideal são 30 a 60 dias para resultados profundos.";
    }
    
    if (produto === 'aurora') {
        if (t.includes('o que é') || t.includes('para que serve')) return "🌸 O Aurora Pink é um creme clareador com toque aveludado. Ele clareia manchas escuras, combate a foliculite e hidrata profundamente!";
        if (t.includes('como usar') || t.includes('passar')) return "🧴 Aplique sobre a pele limpa e seca, massageando suavemente até absorver. O ideal é usar 2 vezes ao dia (manhã e noite)!";
        if (t.includes('tem ácido') || t.includes('irrita')) return "✨ O Aurora NÃO contém ácidos agressivos. Ele pode ser usado nas áreas mais sensíveis sem irritar a pele.";
        if (t.includes('pote') || t.includes('quantidade')) return "📦 Ao contrário dos creminhos de farmácia, o nosso pote é grande e vem com 150g, então ele rende e dura muito!";
        if (t.includes('garantia')) return "💎 Sim! Temos uma Garantia de Satisfação de 30 dias. Se não notar melhora, devolvemos o seu dinheiro.";
    }
    return null;
}

async function iniciar() {
    console.log('--- 🚀 LIGANDO A MÁQUINA DE VENDAS DO SR. ALEX ---');
    const { state, saveCreds } = await useMultiFileAuthState('auth_alex');
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
    
    sock.ev.on('creds.update', saveCreds);

    // 🔥 O MOTOR DE ARRANQUE (MANTÉM O ROBÔ VIVO)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n⚠️ ATENÇÃO: O WhatsApp desconectou! Você precisará ler o QR Code de novo se instalou a biblioteca do QR.');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            console.log('🔄 Conexão caiu. Tentando reconectar...');
            if(shouldReconnect) {
                iniciar();
            } else {
                console.log('❌ Sessão inválida. Apague a pasta auth_alex e rode novamente.');
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado com SUCESSO! Robô pronto para vender.');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const textoLow = texto.toLowerCase();
        
        if (!sessoes[from]) sessoes[from] = { passo: 0 };
        const cliente = sessoes[from];

        if (!cliente.produtoKey) {
            if (textoLow.includes("aurora") || textoLow.includes("pink")) {
                cliente.produtoKey = 'aurora';
            } else if (textoLow.includes("serum") || textoLow.includes("nova") || textoLow.includes("beauty")) {
                cliente.produtoKey = 'serum';
            } else {
                cliente.produtoKey = 'serum'; 
            }
        }
        const produtoEscolhido = PRODUTOS[cliente.produtoKey];

        const respostaFAQ = responderFAQ(texto, cliente.produtoKey);
        if (respostaFAQ) {
            await enviarTextoHumano(sock, from, respostaFAQ);
            if (cliente.passo === 2) await enviarTextoHumano(sock, from, "Para eu verificar se a oferta está disponível com Frete Grátis, me informe o seu CEP (apenas números), por favor?");
            if (cliente.passo === 4) await enviarTextoHumano(sock, from, "Para finalizar sua reserva, me mande numa única mensagem: Nome, CPF e Número da casa.");
            return;
        }

        if (cliente.passo === 0) {
            if (cliente.produtoKey === 'serum') {
                await enviarTextoHumano(sock, from, "Olá, bom dia! ☀️\n\nSou o Alex, já vou te explicar tudo sobre o nosso segredinho do rejuvenescimento. Pode me dizer o seu nome?");
            } else {
                await enviarTextoHumano(sock, from, "Olá! Aqui é o Alex, especialista no clareamento e uniformização da pele com o Aurora Pink 🌸. Pode me dizer o seu nome?");
            }
            cliente.passo = 1;
            return;
        }

        if (cliente.passo === 1) {
            cliente.nomeCliente = texto.split(' ')[0]; 
            if (cliente.produtoKey === 'serum') {
                await enviarTextoHumano(sock, from, `Oi ${cliente.nomeCliente}, tudo bem? Antes de explicar o tratamento, deixa eu te falar algo importante...\n\nA maioria das mulheres que me chamam tá cansada de usar um monte de produto e não ver diferença, sabe?\n\nMe diz: *qual sua idade e o que mais tá te incomodando hoje?* Rugas, manchas, flacidez... ou tudo junto?`);
            } else {
                await enviarTextoHumano(sock, from, `Oi ${cliente.nomeCliente}! Pra eu te indicar o tratamento ideal, me conta: O que mais te incomoda hoje? Manchas na virilha, axilas ou foliculite?`);
            }
            cliente.passo = 2;
            return;
        }

        if (cliente.passo === 2) {
            if (cliente.produtoKey === 'serum') {
                await enviarTextoHumano(sock, from, `Entendo perfeitamente, ${cliente.nomeCliente}. É por isso que o Sérum Nova Beauty é diferente. Ele tem 5 ativos poderosos: Ácido hialurônico, Vitamina E, Óleo de semente de uva, Aloe vera e D-Pantenol.\n\nEle apaga o "bigodinho chinês", clareia manchas e tem aprovação da Anvisa!\n\nHoje estamos com a promoção especial: *Pague 2 leve 3 por apenas R$ 297,00*.\n\nPara eu verificar se essa oferta está disponível com **Frete Grátis** para a sua cidade, me informe o seu *CEP* (apenas números), por favor?`);
            } else {
                await enviarTextoHumano(sock, from, `Entendo perfeitamente, ${cliente.nomeCliente}. Isso é super comum, principalmente por causa do atrito ou da depilação. O Aurora Pink foi feito justamente pra isso!\n\nDiferente dos cremes pequenos de farmácia, ele vem com 150g (dura muito!) e não contém ácidos agressivos, podendo ser usado nas áreas mais sensíveis.\n\nHoje estamos com o nosso kit promocional de 5 unidades por apenas R$ 297,00.\n\n📍 Me conta, qual o seu **CEP** (apenas números) pra eu verificar o prazo e se temos Frete Grátis pra sua casa?`);
            }
            cliente.passo = 3;
            return;
        }

        if (cliente.passo === 3 && texto.match(/\d{5}-?\d{3}/)) {
            cliente.cep = texto.replace(/\D/g, '');
            cliente.whatsapp = from.split('@')[0]; 
            await enviarTextoHumano(sock, from, `🔍 Verificando logística do ${produtoEscolhido.nome} na sua região...`);

            try {
                const res = await axios.post(`http://${IP_ORACLE}:3000/sondagem`, { cep: cliente.cep, link: produtoEscolhido.logzz });
                
                if (res.data.atende) {
                    cliente.tipo = 'LOGZZ';
                    if (cliente.produtoKey === 'aurora') {
                        await enviarTextoHumano(sock, from, `Maravilha! Hoje mesmo fiz um envio para sua cidade, fico feliz que as meninas aí estão gostando! Temos **entregador próprio** pra sua região, então o envio é imediato e você só paga os R$ 297,00 quando o produto chegar na sua casa!`);
                    } else {
                        await enviarTextoHumano(sock, from, "✅ Excelente! Temos **entregador próprio** para sua rua. Você só paga R$ 297,00 quando receber em mãos!");
                    }
                } else {
                    cliente.tipo = 'COINZZ';
                    if (cliente.produtoKey === 'aurora') {
                        await enviarTextoHumano(sock, from, `Ooi ${cliente.nomeCliente}, acabei de confirmar e a sua região é atendida exclusivamente pelos Correios (pagamento antecipado de R$ 297,00).\n\nMas olha, pra fidelizar você como minha cliente, se você fechar hoje eu vou te dar **50% de desconto na sua próxima compra** por confiar em mim! O que acha?`);
                    } else {
                        await enviarTextoHumano(sock, from, "⚠️ Sr(a), sua região é exclusiva dos Correios. O pagamento de R$ 297,00 é Antecipado com Frete Grátis!");
                    }
                }
                
                await enviarTextoHumano(sock, from, "Para eu registrar o seu pedido agora, por favor, me envie em **UMA ÚNICA MENSAGEM**:\n\n👤 Nome Completo\n💳 CPF (apenas números)\n🏠 Número da casa (e complemento)");
                cliente.passo = 4; 
            } catch (e) { 
                await enviarTextoHumano(sock, from, "Ocorreu um erro na verificação do CEP. Pode enviar novamente?"); 
            }
            return;
        }

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

            await enviarTextoHumano(sock, from, "⏳ Perfeito! Processando o seu pedido oficial no sistema... Só um instante.");

            if (cliente.tipo === 'LOGZZ') {
                try {
                    await axios.post(`http://${IP_ORACLE}:3000/agendar-logzz`, { cliente, link: produtoEscolhido.logzz });
                    await enviarTextoHumano(sock, from, "🎉 **PEDIDO AGENDADO COM SUCESSO!**\nSua entrega foi confirmada. Lembre-se, você só pagará R$ 297,00 ao entregador.");
                } catch (e) { await enviarTextoHumano(sock, from, "Acesse o link oficial para concluir: " + produtoEscolhido.logzz); }
            } else {
                try {
                    const res = await axios.post(`http://${IP_ORACLE}:3000/gerar-pix-coinzz`, { cliente, link: produtoEscolhido.coinzz }, { timeout: 45000 });
                    if (res.data.pix) {
                        await enviarTextoHumano(sock, from, "✅ **RESERVA CONCLUÍDA!**\nCopie o código PIX abaixo para garantir a sua oferta:");
                        await sock.sendMessage(from, { text: res.data.pix });
                    } else { throw new Error('Pix não extraído'); }
                } catch (e) { await enviarTextoHumano(sock, from, "Aqui está o link oficial da sua reserva: " + produtoEscolhido.coinzz); }
            }
            delete sessoes[from];
        }
    });
}
iniciar();
