import {
    cabecalhosComPrevisualizacao,
    definirPlanoPrevisualizacao,
    limparPlanoPrevisualizacao
} from './plan-preview.js';

const BILLING_API_URL = 'https://storage.notabook.site';

function obterUtilizador() {
    const utilizador = window.auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para escolher um plano.');
    return utilizador;
}

function comPrazo(promise, milissegundos, mensagem) {
    let temporizador;
    const limite = new Promise((_, rejeitar) => {
        temporizador = window.setTimeout(() => rejeitar(new Error(mensagem)), milissegundos);
    });
    return Promise.race([promise, limite]).finally(() => window.clearTimeout(temporizador));
}

async function pedidoComSessao(caminho, opcoes = {}) {
    const token = await comPrazo(
        obterUtilizador().getIdToken(),
        15000,
        'A sessão demorou demasiado tempo a responder. Atualiza a página e tenta novamente.'
    );
    const metodo = String(opcoes.method || 'GET').toUpperCase();
    const url = metodo === 'GET'
        ? `${BILLING_API_URL}${caminho}${caminho.includes('?') ? '&' : '?'}_=${Date.now()}`
        : `${BILLING_API_URL}${caminho}`;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), 15000);
    let resposta;
    console.info('[BILLING][request]', { method: metodo, path: caminho });
    try {
        resposta = await fetch(url, {
            ...opcoes,
            cache: 'no-store',
            signal: controlador.signal,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...cabecalhosComPrevisualizacao(),
                ...(opcoes.headers || {})
            }
        });
    } catch (erro) {
        if (erro.name === 'AbortError') {
            throw new Error('O servidor demorou demasiado tempo a responder. Tenta novamente.');
        }
        throw erro;
    } finally {
        window.clearTimeout(temporizador);
    }
    const dados = await resposta.json().catch(() => ({}));
    console.info('[BILLING][response]', {
        method: metodo,
        path: caminho,
        status: resposta.status,
        ok: resposta.ok
    });
    if (!resposta.ok) throw new Error(dados.error || 'Não foi possível comunicar com os pagamentos.');
    return dados;
}

async function iniciarCheckout(plano) {
    const dados = await pedidoComSessao('/billing/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ plan: plano })
    });
    if (!dados.url) throw new Error('A Stripe não devolveu o endereço do Checkout.');
    window.location.assign(dados.url);
}

export async function obterPlanoAtual() {
    return pedidoComSessao('/billing/plan');
}

async function alterarCancelamento(caminho) {
    return pedidoComSessao(caminho, {
        method: 'POST',
        body: JSON.stringify({})
    });
}

export function cancelarPlano() {
    return alterarCancelamento('/billing/cancel');
}

export function retomarPlano() {
    return alterarCancelamento('/billing/resume');
}

async function obterEstadoVendas() {
    return pedidoComSessao('/admin/billing');
}

async function definirEstadoVendas(salesEnabled) {
    return pedidoComSessao('/admin/billing', {
        method: 'PUT',
        body: JSON.stringify({ salesEnabled })
    });
}

export async function inicializarPlanos() {
    const area = document.getElementById('set-planos');
    if (!area || area.dataset.billingReady === 'true') return;
    area.dataset.billingReady = 'true';
    const cards = area.querySelectorAll('[data-plano-card]');
    const estadoActual = area.querySelector('[data-plano-actual]');
    const painelPrevisualizacao = area.querySelector('[data-admin-plan-preview]');
    const estadoPrevisualizacao = area.querySelector('[data-admin-plan-preview-status]');
    const painelVendas = area.querySelector('[data-admin-billing]');
    const botaoVendas = area.querySelector('[data-admin-billing-toggle]');
    const estadoVendas = area.querySelector('[data-admin-billing-status]');

    const garantirAcoesDeSubscricao = (card) => {
        if (card.dataset.planoCard === 'free') return;
        const rodape = card.querySelector('.plano-card__rodape');
        if (!rodape || rodape.querySelector('[data-plano-cancelar]')) return;

        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'plano-card__cancelar';
        cancelar.dataset.planoCancelar = '';
        cancelar.textContent = 'Cancelar plano';
        cancelar.hidden = true;

        const retomar = document.createElement('button');
        retomar.type = 'button';
        retomar.className = 'plano-card__retomar';
        retomar.dataset.planoRetomar = '';
        retomar.textContent = 'Retomar plano';
        retomar.hidden = true;

        rodape.append(cancelar, retomar);
    };

    cards.forEach(garantirAcoesDeSubscricao);

    const actualizarCartoes = (dados) => {
        const plano = dados?.plan || 'free';
        const preview = Boolean(dados?.isPreview);
        const vendasAtivas = dados?.salesEnabled !== false;
        const administrador = Boolean(dados?.isAdmin) || dados?.status === 'admin';
        const nomes = {
            free: 'Plano Free',
            premium: 'Plano Premium',
            premium_plus: 'Plano Premium Plus'
        };

        cards.forEach(card => {
            const actual = card.dataset.planoCard === plano;
            card.classList.toggle('plano-card--atual', actual);
            card.classList.toggle('plano-card--cancelamento-pendente', actual && !preview && Boolean(dados?.cancelAtPeriodEnd));
            card.classList.remove('plano-card--confirmar-cancelamento');
            card.dataset.admin = String(administrador);
            const estado = card.querySelector('[data-plano-estado]');
            const botao = card.querySelector('[data-plano-checkout]');
            const cancelar = card.querySelector('[data-plano-cancelar]');
            const retomar = card.querySelector('[data-plano-retomar]');
            if (estado) {
                estado.textContent = actual
                    ? (dados?.cancelAtPeriodEnd ? 'Termina no fim do período' : 'Plano atual')
                    : '';
                if (actual && administrador && dados?.cancelAtPeriodEnd) {
                    estado.textContent = 'Acesso administrativo mantém as funcionalidades';
                }
                estado.hidden = !actual;
            }
            if (estado && preview && actual) {
                estado.textContent = `A testar como ${nomes[plano]}`;
            }
            if (botao) {
                botao.hidden = actual || preview;
                if (!botao.dataset.textoOriginal) {
                    botao.dataset.textoOriginal = botao.textContent;
                }
                botao.disabled = !vendasAtivas;
                botao.textContent = vendasAtivas
                    ? botao.dataset.textoOriginal
                    : 'Compras em preparação';
            }
            if (cancelar) cancelar.hidden = !actual || preview || plano === 'free' || Boolean(dados?.cancelAtPeriodEnd);
            if (retomar) retomar.hidden = !actual || preview || plano === 'free' || !dados?.cancelAtPeriodEnd;
        });

        if (estadoActual) estadoActual.textContent = `${nomes[plano]} · ${dados?.status || 'ativo'}`;
        if (painelPrevisualizacao) {
            painelPrevisualizacao.hidden = !administrador;
            painelPrevisualizacao.dataset.active = preview ? 'true' : 'false';
        }
        if (estadoPrevisualizacao) {
            estadoPrevisualizacao.textContent = preview
                ? `A aplicação está a ser vista como ${nomes[plano]}. O Stripe continua no plano real.`
                : 'Escolhe um plano para testar os limites sem alterar a subscrição Stripe.';
        }
        if (painelVendas) {
            painelVendas.hidden = !administrador;
            painelVendas.dataset.admin = String(administrador);
        }
    };

    area.querySelectorAll('.admin-plan-preview__actions [data-admin-plan-preview]').forEach(botao => {
        botao.addEventListener('click', async () => {
            definirPlanoPrevisualizacao(botao.dataset.adminPlanPreview);
            actualizarCartoes(await obterPlanoAtual());
        });
    });

    area.querySelector('[data-admin-plan-preview-clear]')?.addEventListener('click', async () => {
        limparPlanoPrevisualizacao();
        actualizarCartoes(await obterPlanoAtual());
    });

    const actualizarPainelVendas = (dados) => {
        if (!painelVendas || !dados?.isAdmin) return;
        painelVendas.hidden = false;
        const enabled = Boolean(dados.salesEnabled);
        // A rota /billing/plan informa apenas se as compras estão abertas.
        // Quando já estão abertas, o administrador deve poder fechá-las mesmo
        // que essa resposta não inclua o campo técnico readyForLive.
        const ready = enabled || Boolean(dados.readyForLive);
        if (botaoVendas) {
            botaoVendas.dataset.enabled = String(enabled);
            botaoVendas.disabled = !ready;
            botaoVendas.textContent = enabled ? 'Fechar compras' : 'Começa agora as compras';
        }
        if (estadoVendas) {
            estadoVendas.textContent = enabled
                ? 'Compras abertas para novos utilizadores.'
                : ready
                    ? 'Stripe Live preparada. As compras continuam fechadas até activares.'
                    : `Stripe ${dados.stripeMode || 'test'}: configura primeiro as chaves Live.`;
        }
    };

    botaoVendas?.addEventListener('click', async () => {
        const activar = botaoVendas.dataset.enabled !== 'true';
        if (activar && !window.confirm('Abrir agora as compras reais para os utilizadores?')) return;
        botaoVendas.disabled = true;
        if (estadoVendas) {
            estadoVendas.textContent = activar ? 'A abrir as compras…' : 'A fechar as compras…';
        }
        try {
            const estado = await definirEstadoVendas(activar);
            actualizarPainelVendas({ ...estado, isAdmin: true });
            try {
                actualizarCartoes(await obterPlanoAtual());
            } catch (erro) {
                console.warn('[BILLING] O estado dos planos demorou a atualizar:', erro);
            }
        } catch (erro) {
            if (estadoVendas) estadoVendas.textContent = erro.message;
        } finally {
            botaoVendas.disabled = false;
        }
    });

    const carregarPainelVendas = async () => {
        try {
            const estado = await obterEstadoVendas();
            actualizarPainelVendas({ ...estado, isAdmin: true });
        } catch (erro) {
            if (painelVendas?.dataset.admin === 'true') {
                painelVendas.hidden = false;
                if (botaoVendas) {
                    botaoVendas.disabled = true;
                    botaoVendas.textContent = 'Publicar Worker primeiro';
                }
                if (estadoVendas) {
                    estadoVendas.textContent = 'O painel de compras ainda não está disponível no servidor. Faz deploy do Worker atualizado.';
                }
            }
            if (erro.message && !/403|admin/i.test(erro.message)) {
                console.info('[BILLING] ConfiguraÃ§Ã£o das compras indisponÃ­vel:', erro.message);
            }
        }
    };

    area.querySelectorAll('[data-plano-checkout]').forEach(botao => {
        botao.addEventListener('click', async () => {
            const textoOriginal = botao.textContent;
            botao.disabled = true;
            botao.textContent = 'A abrir pagamento…';
            try {
                await iniciarCheckout(botao.dataset.planoCheckout);
            } catch (erro) {
                botao.disabled = false;
                botao.textContent = textoOriginal;
                window.alert(erro.message);
            }
        });
    });

    area.querySelectorAll('[data-plano-cancelar]').forEach(botao => {
        botao.addEventListener('click', async () => {
            const card = botao.closest('[data-plano-card]');
            const estado = card?.querySelector('[data-plano-estado]');

            if (botao.dataset.confirmarCancelamento !== 'true') {
                botao.dataset.confirmarCancelamento = 'true';
                card.classList.add('plano-card--confirmar-cancelamento');
                botao.textContent = 'Confirmar cancelamento';
                if (estado) {
                    estado.textContent = card.dataset.admin === 'true'
                        ? 'O acesso administrativo mantém as funcionalidades'
                        : 'O acesso continua até ao fim do período pago';
                }
                window.setTimeout(() => {
                    if (botao.dataset.confirmarCancelamento === 'true') {
                        delete botao.dataset.confirmarCancelamento;
                        card.classList.remove('plano-card--confirmar-cancelamento');
                        botao.textContent = 'Cancelar plano';
                        if (estado) estado.textContent = 'Plano atual';
                    }
                }, 7000);
                return;
            }

            botao.disabled = true;
            if (estado) estado.textContent = 'A cancelar…';

            try {
                await cancelarPlano();
                actualizarCartoes(await obterPlanoAtual());
            } catch (erro) {
                botao.disabled = false;
                if (estado) estado.textContent = 'Não foi possível cancelar';
                console.error('[BILLING] Cancelamento falhou:', erro);
            }
        });
    });

    area.querySelectorAll('[data-plano-retomar]').forEach(botao => {
        botao.addEventListener('click', async () => {
            const card = botao.closest('[data-plano-card]');
            const estado = card?.querySelector('[data-plano-estado]');
            botao.disabled = true;
            if (estado) estado.textContent = 'A retomar…';

            try {
                await retomarPlano();
                actualizarCartoes(await obterPlanoAtual());
            } catch (erro) {
                botao.disabled = false;
                if (estado) estado.textContent = 'Não foi possível retomar';
                console.error('[BILLING] Retoma falhou:', erro);
            }
        });
    });

    try {
        const dadosPlano = await obterPlanoAtual();
        actualizarCartoes(dadosPlano);
        actualizarPainelVendas(dadosPlano);
        await carregarPainelVendas();
    } catch (_) {
        actualizarCartoes({ plan: 'free', status: 'ativo', salesEnabled: false });
    }
}
