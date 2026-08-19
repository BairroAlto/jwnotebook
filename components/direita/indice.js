// components/direita/indice.js
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';

let isManualScrolling = false; 
let notaIdCacheIndice = ""; 
let frameScrollIndice = null;
let idIndiceAtivo = "";
let editorScrollIndice = null;
let handlerScrollIndice = null;

export function renderizarIndice(caixasFiltradas, isModoPost = false) {
    const container = document.getElementById('indice-nota-container');
    if (!container) return;

    if (frameScrollIndice !== null) {
        cancelAnimationFrame(frameScrollIndice);
        frameScrollIndice = null;
    }

    // Já recebemos a lista filtrada do Dispatcher, por isso só precisamos de ordenar
    const ativas = [...caixasFiltradas];
    
    // Ordenação visual do índice
    ativas.sort((a, b) => isModoPost ? (b.ordem - a.ordem) : (a.ordem - b.ordem));

    if (ativas.length === 0) {
        container.innerHTML = `<div data-indice-vazio style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Nenhum conteúdo visível neste modo.</div>`;
        return;
    }

    const CORES_IDENTIDADE = { webcard: "#8b5cf6", cartaovisita: "#d4af37", citacaobiblica: "#94a3b8", elevador: "#ef4444", firmamento: "#cbd5e1" };
    const idsAtivos = new Set(ativas.map(caixa => String(caixa.id)));

    // Mantém o cartão activo quando a actualização é apenas uma alteração de texto.
    // O índice é actualizado por reconciliação, em vez de apagar/recriar todos os cartões.
    if (idIndiceAtivo && !idsAtivos.has(String(idIndiceAtivo))) idIndiceAtivo = "";

    const cartoesExistentes = new Map(
        [...container.querySelectorAll('.indice-card[id^="nav-card-"]')]
            .map(card => [card.id.slice('nav-card-'.length), card])
    );

    ativas.forEach(caixa => {
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        let corFinal = config.cor;

        if (["contentor", "subnota", "questao", "raciocinio"].includes(caixa.tipo)) {
            const fKey = caixa.foco || "original";
            const mapa = (caixa.tipo === 'subnota') ? FOCOS_SUBNOTA : (caixa.tipo === 'questao') ? FOCOS_QUESTAO : (caixa.tipo === 'raciocinio') ? FOCOS_RACIOCINIO : FOCOS_BASE;
            corFinal = (mapa[fKey]?.corForte) || config.cor;
        } else {
            corFinal = CORES_IDENTIDADE[caixa.tipo] || config.cor;
        }

        let resumo = "";
        switch (caixa.tipo) {
            case "webcard": resumo = (caixa.links && caixa.links.length > 0) ? caixa.links.map(l => l.titulo || "Link").join(", ") : "WebCard"; break;
            case "citacaobiblica": resumo = (caixa.textosanexados && caixa.textosanexados.length > 0) ? caixa.textosanexados.map(v => `${v.livro} ${v.cap}:${v.ver}`).join(", ") : "Citação Bíblica"; break;
            case "elevador": resumo = (caixa.pastapai && caixa.pastapai[0]) ? caixa.pastapai[0].nome : "Elevador"; break;
            case "cartaovisita": resumo = caixa.titulo || "Cartão de Visita"; break;
            default: resumo = caixa.titulo || (caixa.conteudo ? caixa.conteudo.substring(0, 80) : `Nova ${config.nome}`);
        }

        const idCaixa = String(caixa.id);
        const card = cartoesExistentes.get(idCaixa) || criarCardIndice(caixa);
        actualizarCardIndice(card, caixa, config, corFinal, resumo, CORES_IDENTIDADE);

        // Reordena apenas quando a ordem da lista mudou; cartões já existentes
        // continuam a ser os mesmos nós DOM.
        const cartaoNaPosicao = container.children[ativas.indexOf(caixa)];
        if (cartaoNaPosicao !== card) {
            container.insertBefore(card, cartaoNaPosicao || null);
        }
        cartoesExistentes.delete(idCaixa);
    });

    // Remove cartões que deixaram de estar visíveis, sem tocar nos restantes.
    cartoesExistentes.forEach(card => card.remove());
    container.querySelector('[data-indice-vazio]')?.remove();
    
    // Reiniciar o ScrollSpy com a lista de blocos ativos atualizada
    configurarScrollSpy(ativas);
}

function criarCardIndice(caixa) {
    const card = document.createElement('div');
    card.id = `nav-card-${caixa.id}`;
    card.className = "indice-card";
    card.onclick = () => {
        const el = document.getElementById(`bloco-${caixa.id}`);
        if (el) {
            isManualScrolling = true;
            aplicarDestaqueVisual(caixa.id);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { isManualScrolling = false; }, 800);
        }
    };
    return card;
}

function actualizarCardIndice(card, caixa, config, corFinal, resumo, coresIdentidade) {
    const fKey = caixa.foco || "original";
    const labelParaMostrar = (fKey !== "original" && !coresIdentidade[caixa.tipo])
        ? fKey.toUpperCase().replace('_', ' ')
        : config.nome;
    const assinatura = `${config.icon}|${labelParaMostrar}|${corFinal}`;

    card.style.borderLeftColor = corFinal;
    if (card.dataset.indiceCabecalho !== assinatura) {
        card.dataset.indiceCabecalho = assinatura;
        let cabecalho = card.querySelector('.label-tipo');
        if (!cabecalho) {
            cabecalho = document.createElement('div');
            cabecalho.className = 'label-tipo';
            const icon = document.createElement('i');
            const label = document.createElement('span');
            cabecalho.append(icon, label);
            card.appendChild(cabecalho);
        }
        cabecalho.style.color = corFinal;
        cabecalho.querySelector('i').className = config.icon;
        cabecalho.querySelector('span').textContent = labelParaMostrar;
    }

    // O resumo só é escrito quando os seus dados mudam. Quando o texto novo
    // já está fora das duas linhas visíveis, nem sequer há repintura do card.
    if (card.dataset.indiceResumo !== resumo) {
        card.dataset.indiceResumo = resumo;
        let resumoEl = card.querySelector('.resumo-texto');
        if (!resumoEl) {
            resumoEl = document.createElement('div');
            resumoEl.className = 'resumo-texto';
            card.appendChild(resumoEl);
        }
        resumoEl.textContent = resumo;
    }
}

/**
 * MOTOR DE SEGUIMENTO (SCROLL-SPY) COM SENSORES DE LIMITE
 */
function configurarScrollSpy(ativas) {
    const editor = document.querySelector('.center-col');
    if (!editor) return;

    // O Índice é redesenhado quando as caixas mudam. Remover o listener
    // anterior impede que o scroll fique ligado a uma lista antiga.
    if (editorScrollIndice && handlerScrollIndice) {
        editorScrollIndice.removeEventListener('scroll', handlerScrollIndice);
    }

    handlerScrollIndice = () => {
        if (isManualScrolling) return;

        if (frameScrollIndice !== null) return;
        frameScrollIndice = requestAnimationFrame(() => {
            frameScrollIndice = null;

            const scrollPos = editor.scrollTop;
            const scrollTotal = editor.scrollHeight - editor.clientHeight;

            // --- 1. SENSOR DE TOPO ABSOLUTO (PRIMEIRO ITEM) ---
            if (scrollPos < 50) {
                if (ativas[0]) aplicarDestaqueVisual(ativas[0].id);
                return;
            }

            // --- 2. SENSOR DE FUNDO ABSOLUTO (ÚLTIMO ITEM) ---
            if (scrollPos >= scrollTotal - 50) {
                if (ativas.length > 0) aplicarDestaqueVisual(ativas[ativas.length - 1].id);
                return;
            }

            // --- 3. LÓGICA DE PROXIMIDADE (ITENS INTERMÉDIOS) ---
            const blocos = ativas
                .map(caixa => document.getElementById(`bloco-${caixa.id}`))
                .filter(Boolean);
            let blocoMaisProximo = null;
            let menorDistancia = Infinity;

            blocos.forEach(bloco => {
                const rect = bloco.getBoundingClientRect();
                // Miramos a 30% da altura da tela (um pouco acima do centro)
                const distancia = Math.abs(rect.top - (window.innerHeight * 0.3));
                if (distancia < menorDistancia) {
                    menorDistancia = distancia;
                    blocoMaisProximo = bloco.id.replace('bloco-', '');
                }
            });

            if (blocoMaisProximo) {
                aplicarDestaqueVisual(blocoMaisProximo);
            }
        });
    };

    editor.addEventListener('scroll', handlerScrollIndice, { passive: true });
    editorScrollIndice = editor;
    window._indiceScrollInited = true;

    // Atualiza também ao abrir/reconstruir a aba, sem esperar pelo próximo
    // movimento manual do editor.
    handlerScrollIndice();
}

/**
 * AUXILIAR: PINTA O CARD NO ÍNDICE
 */
function aplicarDestaqueVisual(id, { deslocarIndice = true } = {}) {
    if (!id || idIndiceAtivo === id) return;

    const cardAnterior = document.querySelector('.indice-card.active');
    cardAnterior?.classList.remove('active');

    const cardAlvo = document.getElementById(`nav-card-${id}`);
    if (cardAlvo) {
        idIndiceAtivo = id;
        cardAlvo.classList.add('active');
        // Faz o Índice rolar automaticamente se o card selecionado estiver fora de vista
        if (deslocarIndice) {
            cardAlvo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

export function ocultarIndice() {
    const container = document.getElementById('indice-nota-container');
    if (container) container.innerHTML = "";
}
