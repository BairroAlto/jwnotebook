import { IDENTIDADE_FERRAMENTAS } from '../../constants/ferramentas.js';
const obterRegistosFundir = (caixa) => Array.isArray(caixa?.fundir)
    ? caixa.fundir.filter(registo => registo && registo.id)
    : [];

function obterMapaCaixasAtivas(caixas) {
    return new Map((caixas || [])
        .filter(caixa => caixa && caixa.estado === 'on')
        .map(caixa => [caixa.id, caixa]));
}

function obterOrdemFundida(membros) {
    const ids = new Set(membros.map(caixa => caixa.id));
    const ordens = new Map();

    membros.forEach(caixa => {
        obterRegistosFundir(caixa).forEach(registo => {
            if (!ids.has(registo.id)) return;
            const ordem = Number(registo.ordem);
            if (!Number.isFinite(ordem)) return;
            const actual = ordens.get(registo.id);
            if (actual === undefined || ordem < actual) ordens.set(registo.id, ordem);
        });
    });

    return ordens;
}

/**
 * Devolve todos os membros ligados à caixa, mesmo quando um registo antigo
 * ficou apenas num dos lados da relação.
 */
export function obterGrupoFundido(caixaAlvo, caixas) {
    if (!caixaAlvo?.id) return [];

    const mapa = obterMapaCaixasAtivas(caixas);
    if (!mapa.has(caixaAlvo.id)) mapa.set(caixaAlvo.id, caixaAlvo);

    const ligacoes = new Map([...mapa.keys()].map(id => [id, new Set()]));
    mapa.forEach(caixa => {
        obterRegistosFundir(caixa).forEach(registo => {
            if (!mapa.has(registo.id)) return;
            ligacoes.get(caixa.id).add(registo.id);
            ligacoes.get(registo.id).add(caixa.id);
        });
    });

    const encontrados = new Set([caixaAlvo.id]);
    const fila = [caixaAlvo.id];
    while (fila.length) {
        const idActual = fila.shift();
        (ligacoes.get(idActual) || []).forEach(idLigado => {
            if (encontrados.has(idLigado)) return;
            encontrados.add(idLigado);
            fila.push(idLigado);
        });
    }

    const membros = [...encontrados]
        .map(id => mapa.get(id))
        .filter(Boolean);
    const ordens = obterOrdemFundida(membros);
    const indiceFallback = new Map((caixas || []).map((caixa, indice) => [caixa.id, indice]));

    return membros.sort((a, b) => {
        const ordemA = ordens.get(a.id);
        const ordemB = ordens.get(b.id);
        if (ordemA !== undefined || ordemB !== undefined) {
            return (ordemA ?? Number.MAX_SAFE_INTEGER) - (ordemB ?? Number.MAX_SAFE_INTEGER);
        }
        return (indiceFallback.get(a.id) ?? 0) - (indiceFallback.get(b.id) ?? 0);
    });
}

/**
 * Agrupa apenas para apresentação. A ordem global das caixas continua a ser
 * a ordem normal da nota; a ordem interna da fusão vem do campo fundir.
 */
export function construirGruposFundidos(caixas) {
    const lista = (caixas || []).filter(Boolean);
    const indice = new Map(lista.map((caixa, posicao) => [caixa.id, posicao]));
    const visitados = new Set();
    const segmentos = [];

    lista.forEach(caixa => {
        if (visitados.has(caixa.id)) return;

        const grupo = obterGrupoFundido(caixa, lista);
        const grupoValido = grupo.length >= 2;
        const membros = grupoValido ? grupo : [caixa];

        membros.forEach(membro => visitados.add(membro.id));
        segmentos.push({
            id: membros.map(membro => membro.id).sort().join('|'),
            caixas: membros,
            posicao: Math.min(...membros.map(membro => indice.get(membro.id) ?? Number.MAX_SAFE_INTEGER))
        });
    });

    return segmentos.sort((a, b) => a.posicao - b.posicao);
}

function escaparTexto(valor) {
    return String(valor || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function obterNomeCaixa(caixa, indice) {
    const titulo = caixa.titulo || caixa.conteudo || '';
    const texto = String(titulo).replace(/\s+/g, ' ').trim();
    if (texto) return texto.slice(0, 70);
    return `${caixa.tipo || 'Ferramenta'} ${indice + 1}`;
}

export function sincronizarGrupoFundido(grupo, caixasAntigas) {
    const grupoNovoIds = new Set(grupo.map(caixa => caixa.id));
    const grupoAntigoIds = new Set(caixasAntigas.map(caixa => caixa.id));
    const afectados = new Map();

    [...caixasAntigas, ...grupo].forEach(caixa => afectados.set(caixa.id, caixa));

    const timestamp = new Date().toISOString();
    const ordemPorId = new Map(grupo.map((caixa, indice) => [caixa.id, indice + 1]));

    afectados.forEach(caixa => {
        if (grupoNovoIds.has(caixa.id) && grupo.length >= 2) {
            caixa.fundir = grupo
                .filter(outro => outro.id !== caixa.id)
                .map(outro => ({
                    id: outro.id,
                    ordem: ordemPorId.get(outro.id),
                    timestamp
                }));
            return;
        }

        if (grupoAntigoIds.has(caixa.id) || !Array.isArray(caixa.fundir)) {
            caixa.fundir = [];
        }
    });
}

function normalizarTipoCaixa(tipo) {
    return String(tipo || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s_-]+/g, '');
}

function obterCorCaixa(caixa) {
    const tipo = normalizarTipoCaixa(caixa?.tipo);
    return IDENTIDADE_FERRAMENTAS[tipo]?.cor || caixa?.cor || '#64748b';
}
function criarItemLista(caixa, indice, total, onSubir, onDescer, onRemover) {
    const item = document.createElement('div');
    item.className = 'fundir-item-topo';
    item.style.setProperty('--fundir-cor', obterCorCaixa(caixa));
    item.innerHTML = `
        <div class="fundir-item-info">
            <span class="fundir-item-ordem">${indice + 1}</span>
            <div class="fundir-item-texto">
                <strong>${escaparTexto(obterNomeCaixa(caixa, indice))}</strong>
                <small>${escaparTexto(caixa.tipo || 'ferramenta')}</small>
            </div>
        </div>
        <div class="fundir-item-acoes">
            <button type="button" class="fundir-btn-ordem" title="Subir" ${indice === 0 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-up"></i>
            </button>
            <button type="button" class="fundir-btn-ordem" title="Descer" ${indice === total - 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-down"></i>
            </button>
            <button type="button" class="fundir-btn-remover" title="Remover da fusão" \${total === 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    const botoesOrdem = item.querySelectorAll('.fundir-btn-ordem');
    botoesOrdem[0]?.addEventListener('click', event => {
        event.stopPropagation();
        onSubir();
    });
    botoesOrdem[1]?.addEventListener('click', event => {
        event.stopPropagation();
        onDescer();
    });
    item.querySelector('.fundir-btn-remover')?.addEventListener('click', event => {
        event.stopPropagation();
        onRemover();
    });
    return item;
}

export const FundirManager = {
    renderizar: (caixaAlvo, container, caixas, onChange) => {
        if (!container || !caixaAlvo) return;

        const caixasAtivas = (caixas || []).filter(caixa => caixa && caixa.estado === 'on');
        let grupo = obterGrupoFundido(caixaAlvo, caixasAtivas);
        if (!grupo.length) grupo = [caixaAlvo];

        const renderizar = () => {
            container.innerHTML = `
                <div class="fundir-cabecalho-lista">
                    <span>Caixas fundidas</span>
                    <small>${grupo.length} ${grupo.length === 1 ? 'caixa' : 'caixas'}</small>
                </div>
                <div id="fundir-lista-cima" class="fundir-lista-topo"></div>
                <div class="fundir-separador-listas"></div>
                <div class="fundir-cabecalho-lista">
                    <span>Ferramentas nesta nota</span>
                    <small>Selecciona para adicionar</small>
                </div>
                <div id="fundir-lista-disponiveis" class="fundir-lista-disponiveis"></div>
                <p id="fundir-sem-disponiveis" class="fundir-sem-itens" style="display:none;">Não há outras ferramentas disponíveis.</p>
            `;

            const listaCima = container.querySelector('#fundir-lista-cima');
            grupo.forEach((caixa, indice) => {
                listaCima.appendChild(criarItemLista(
                    caixa,
                    indice,
                    grupo.length,
                    () => {
                        if (indice <= 0) return;
                        [grupo[indice - 1], grupo[indice]] = [grupo[indice], grupo[indice - 1]];
                        sincronizarGrupoFundido(grupo, obterGrupoFundido(caixaAlvo, caixasAtivas));
                        onChange?.();
                        renderizar();
                    },
                    () => {
                        if (indice >= grupo.length - 1) return;
                        [grupo[indice], grupo[indice + 1]] = [grupo[indice + 1], grupo[indice]];
                        sincronizarGrupoFundido(grupo, obterGrupoFundido(caixaAlvo, caixasAtivas));
                        onChange?.();
                        renderizar();
                    },
                    () => {
                        const grupoAntigo = [...grupo];
                        grupo = grupo.filter(item => item.id !== caixa.id);
                        sincronizarGrupoFundido(grupo, grupoAntigo);
                        onChange?.();
                        renderizar();
                    }
                ));
            });

            const idsNoTopo = new Set(grupo.map(caixa => caixa.id));
            const disponiveis = caixasAtivas.filter(caixa => !idsNoTopo.has(caixa.id));
            const listaDisponiveis = container.querySelector('#fundir-lista-disponiveis');
            const semDisponiveis = container.querySelector('#fundir-sem-disponiveis');
            semDisponiveis.style.display = disponiveis.length ? 'none' : 'block';

            disponiveis.forEach((caixa, indice) => {
                const label = document.createElement('label');
                label.className = 'fundir-item-disponivel';
                label.style.setProperty('--fundir-cor', obterCorCaixa(caixa));
                label.innerHTML = `
                    <input type="checkbox" aria-label="Adicionar ${escaparTexto(obterNomeCaixa(caixa, indice))}">
                    <span class="fundir-item-info">
                        <span class="fundir-item-ordem"><i class="fa-solid fa-plus"></i></span>
                        <span class="fundir-item-texto">
                            <strong>${escaparTexto(obterNomeCaixa(caixa, indice))}</strong>
                            <small>${escaparTexto(caixa.tipo || 'ferramenta')}</small>
                        </span>
                    </span>
                `;
                label.querySelector('input').addEventListener('change', event => {
                    if (!event.target.checked) return;
                    const grupoSelecionado = obterGrupoFundido(caixa, caixasAtivas);
                    grupoSelecionado.forEach(membro => {
                        if (!grupo.some(item => item.id === membro.id)) grupo.push(membro);
                    });
                    sincronizarGrupoFundido(grupo, obterGrupoFundido(caixaAlvo, caixasAtivas));
                    onChange?.();
                    renderizar();
                });
                listaDisponiveis.appendChild(label);
            });
        };

        renderizar();
    }
};

let cliqueFundirInicializado = false;

function garantirCliqueGlobalFundir() {
    if (cliqueFundirInicializado || typeof document === 'undefined') return;
    cliqueFundirInicializado = true;

    document.addEventListener('click', event => {
        const membroClicado = event.target.closest?.('.fundir-membro');
        const secundarioClicado = membroClicado?.classList.contains('fundir-membro-secundario');

        document.querySelectorAll('.fundir-membro-secundario').forEach(membro => {
            if (membro === membroClicado) return;
            membro.firstElementChild?.style.setProperty('display', 'none');
        });

        if (secundarioClicado) {
            membroClicado.firstElementChild?.style.setProperty('display', 'flex');
        }
    });
}
export function aplicarEstiloGrupoFundido(elemento, indice, total) {
    if (!elemento || total < 2) return;
    garantirCliqueGlobalFundir();

    const header = elemento.firstElementChild;
    elemento.classList.add('fundir-membro');
    elemento.style.marginBottom = '0';
    elemento.style.borderRadius = '0';
    elemento.style.transform = 'none';

    if (indice === 0) {
        elemento.style.borderTopLeftRadius = 'var(--radius-md)';
        elemento.style.borderTopRightRadius = 'var(--radius-md)';
    } else {
        elemento.style.borderTopColor = 'transparent';
        header?.style.setProperty('display', 'none');
    }

    if (indice === total - 1) {
        elemento.style.borderBottomLeftRadius = 'var(--radius-md)';
        elemento.style.borderBottomRightRadius = 'var(--radius-md)';
    } else {
        elemento.style.borderBottomColor = 'transparent';
    }

    if (indice > 0) {
        elemento.classList.add('fundir-membro-secundario');
    }
}
