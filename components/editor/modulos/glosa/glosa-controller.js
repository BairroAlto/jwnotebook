// components/editor/modulos/glosa/glosa-controller.js
import { BrainBoxFactory } from '../../../ui/brain-box-component.js';
import { SharedPuzzleUI } from '../../../direita/shared-puzzle-ui.js';

const LIMITE_GLOSAS = 5;
const timers = new Map();
let obterContextoAtual = null;

function obterGlosas(caixa) {
    if (!Array.isArray(caixa.glosas)) caixa.glosas = [];
    caixa.glosas = caixa.glosas
        .filter(glosa => glosa && glosa.estado !== 'inativo')
        .map(glosa => ({ ...glosa, estado: glosa.estado || 'ativo' }));
    return caixa.glosas;
}

function obterCaixasDaNota(ctx) {
    const caixas = ctx?.caixasAtuais || window.caixasAtuais || [];
    if (ctx?.caixasAtuais && window.caixasAtuais !== ctx.caixasAtuais) {
        window.caixasAtuais = ctx.caixasAtuais;
    }
    return caixas;
}

function sincronizarMemoria(ctx) {
    const caixas = obterCaixasDaNota(ctx);
    const indice = caixas.findIndex(caixa => caixa.id === ctx.caixaAlvo.id);
    if (indice !== -1) caixas[indice].glosas = ctx.caixaAlvo.glosas;
    else caixas.push(ctx.caixaAlvo);
}

function obterCaixasParaEye(ctx) {
    const caixas = [...obterCaixasDaNota(ctx)];
    const caixaAtual = ctx?.caixaAlvo;
    if (caixaAtual?.id) {
        const indiceAtual = caixas.findIndex(caixa => caixa.id === caixaAtual.id);
        if (indiceAtual === -1) caixas.push(caixaAtual);
        else caixas[indiceAtual] = caixaAtual;
    }

    const dadosNota = window.notaAtualContext?.dadosNota || {};
    const modos = Array.isArray(dadosNota.modo) ? dadosNota.modo : [dadosNota.modo || 'normal'];
    const sentinela = modos.includes('sentinela');
    return caixas.filter(caixa => {
        if (caixa.estado !== 'on') return false;
        return sentinela ? !!caixa.referenciacodex : !caixa.referenciacodex;
    });
}

function atualizarEye(ctx) {
    const caixasParaEye = obterCaixasParaEye(ctx);
    import('../../../direita/eye-glosas.js').then(modulo => {
        modulo.carregarGlosasDaNota(caixasParaEye);
    }).catch(erro => {
        console.error('[GLOSA] NÃ£o foi possÃ­vel carregar o EYE:', erro);
    });
}

async function persistir(ctx) {
    try {
        await ctx.persistir('glosas', obterGlosas(ctx.caixaAlvo));
    } catch (erro) {
        console.error('[GLOSA] Erro ao sincronizar as glosas:', erro);
    }
}

function agendarPersistencia(ctx, glosa) {
    const timerAnterior = timers.get(glosa.id);
    if (timerAnterior) clearTimeout(timerAnterior);

    timers.set(glosa.id, setTimeout(async () => {
        await persistir(ctx);
        timers.delete(glosa.id);
    }, 900));
}

function atualizarEstadoDoLimite(total) {
    const botao = document.getElementById('btn-add-glosa');
    const mensagem = document.getElementById('glosa-limit-message');
    if (!botao || !mensagem) return;

    const atingiuLimite = total >= LIMITE_GLOSAS;
    botao.disabled = atingiuLimite;
    botao.style.opacity = atingiuLimite ? '0.35' : '1';
    botao.style.cursor = atingiuLimite ? 'not-allowed' : 'pointer';
    mensagem.textContent = atingiuLimite
        ? `Limite atingido: ${LIMITE_GLOSAS} caixas de glosa nesta caixa.`
        : `${total}/${LIMITE_GLOSAS} caixas de glosa utilizadas.`;
}

function capturarTextoAtual(ctx) {
    const container = document.getElementById('container-glosas');
    if (!container) return;

    const glosas = obterGlosas(ctx.caixaAlvo);
    container.querySelectorAll('textarea[data-id]').forEach(textarea => {
        const glosa = glosas.find(item => item.id === textarea.dataset.id);
        if (glosa) glosa.conteudo = textarea.value;
    });
}

export async function limparVazias(ctx) {
    if (!ctx?.caixaAlvo) return false;

    capturarTextoAtual(ctx);
    const glosas = obterGlosas(ctx.caixaAlvo);
    const validas = [];
    let removeuVazias = false;

    glosas.forEach(glosa => {
        if (String(glosa.conteudo || '').trim()) {
            validas.push(glosa);
            return;
        }
        const timer = timers.get(glosa.id);
        if (timer) clearTimeout(timer);
        timers.delete(glosa.id);
        removeuVazias = true;
    });

    if (!removeuVazias) return false;

    ctx.caixaAlvo.glosas = validas;
    sincronizarMemoria(ctx);
    atualizarEye(ctx);
    atualizarEstadoDoLimite(validas.length);
    await persistir(ctx);
    return true;
}
export function iniciar(obterContexto) {
    obterContextoAtual = obterContexto;
    const botaoAdicionar = document.getElementById('btn-add-glosa');
    if (!botaoAdicionar) return;
    botaoAdicionar.onclick = () => {
        const ctx = obterContextoAtual?.();
        if (ctx) adicionar(ctx);
    };
}

export function renderizar(ctx) {
    const container = document.getElementById('container-glosas');
    if (!container || !ctx?.caixaAlvo) return;

    const glosas = obterGlosas(ctx.caixaAlvo);
    container.innerHTML = '';
    atualizarEstadoDoLimite(glosas.length);

    if (!glosas.length) {
        container.innerHTML = '<p class="glosa-empty-state">Ainda não existem anotações nesta caixa.</p>';
        return;
    }

    glosas.forEach((glosa, index) => {
        const elemento = BrainBoxFactory.criar(glosa, index, {
            onUpdate: novoConteudo => {
                glosa.conteudo = novoConteudo;
                sincronizarMemoria(ctx);
                atualizarEye(ctx);
                agendarPersistencia(ctx, glosa);
            },
            onMove: (indice, direcao) => mover(ctx, indice, direcao),
            onDelete: id => remover(ctx, id)
        });
        elemento.classList.add('glosa-box-item');
        container.appendChild(elemento);
    });
    atualizarEye(ctx);
}

async function adicionar(ctx) {
    capturarTextoAtual(ctx);
    const glosas = obterGlosas(ctx.caixaAlvo);
    if (glosas.length >= LIMITE_GLOSAS) {
        atualizarEstadoDoLimite(glosas.length);
        return;
    }

    glosas.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tipo: 'caixatexto',
        estado: 'ativo',
        conteudo: ''
    });
    sincronizarMemoria(ctx);
    renderizar(ctx);
    atualizarEye(ctx);
    await persistir(ctx);

    setTimeout(() => {
        const textareas = document.querySelectorAll('#container-glosas textarea[data-id]');
        textareas[textareas.length - 1]?.focus();
    }, 30);
}

async function mover(ctx, indice, direcao) {
    const glosas = obterGlosas(ctx.caixaAlvo);
    const destino = indice + direcao;
    if (destino < 0 || destino >= glosas.length) return;

    [glosas[indice], glosas[destino]] = [glosas[destino], glosas[indice]];
    sincronizarMemoria(ctx);
    renderizar(ctx);
    atualizarEye(ctx);
    await persistir(ctx);
}

async function remover(ctx, id) {
    const confirmou = await SharedPuzzleUI.confirmarAcao(
        'Apagar glosa?',
        'Tens a certeza que desejas eliminar esta caixa de glosa?'
    );
    if (!confirmou) return;

    ctx.caixaAlvo.glosas = obterGlosas(ctx.caixaAlvo).filter(glosa => glosa.id !== id);
    sincronizarMemoria(ctx);
    renderizar(ctx);
    atualizarEye(ctx);
    await persistir(ctx);
}