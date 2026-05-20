// components/direita/indice.js
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';

let isManualScrolling = false; 
let notaIdCacheIndice = ""; 

export function renderizarIndice(caixasFiltradas, isModoPost = false) {
    const container = document.getElementById('indice-nota-container');
    if (!container) return;

    // Já recebemos a lista filtrada do Dispatcher, por isso só precisamos de ordenar
    const ativas = [...caixasFiltradas];
    
    // Ordenação visual do índice
    ativas.sort((a, b) => isModoPost ? (b.ordem - a.ordem) : (a.ordem - b.ordem));

    if (ativas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Nenhum conteúdo visível neste modo.</div>`;
        return;
    }

    const fragmento = document.createDocumentFragment();
    const CORES_IDENTIDADE = { webcard: "#8b5cf6", cartaovisita: "#d4af37", citacaobiblica: "#94a3b8", elevador: "#ef4444" };

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

        const card = document.createElement('div');
        card.id = `nav-card-${caixa.id}`;
        card.className = "indice-card";
        card.style.borderLeftColor = corFinal;

        const fKey = caixa.foco || "original";
        const labelParaMostrar = (fKey !== "original" && !CORES_IDENTIDADE[caixa.tipo]) ? fKey.toUpperCase().replace('_', ' ') : config.nome;

        card.innerHTML = `
            <div class="label-tipo" style="color:${corFinal}">
                <i class="${config.icon}"></i>
                <span>${labelParaMostrar}</span>
            </div>
            <div class="resumo-texto">${resumo}</div>
        `;

        card.onclick = () => {
            const el = document.getElementById(`bloco-${caixa.id}`);
            if (el) {
                isManualScrolling = true;
                aplicarDestaqueVisual(caixa.id);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { isManualScrolling = false; }, 800);
            }
        };

        fragmento.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(fragmento);
    
    // Reiniciar o ScrollSpy com a lista de blocos ativos atualizada
    configurarScrollSpy(ativas);
}

/**
 * MOTOR DE SEGUIMENTO (SCROLL-SPY) COM SENSORES DE LIMITE
 */
function configurarScrollSpy(ativas) {
    const editor = document.querySelector('.center-col');
    if (!editor || window._indiceScrollInited) return;

    editor.addEventListener('scroll', () => {
        if (isManualScrolling) return;

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
        const blocos = document.querySelectorAll('[id^="bloco-"]');
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

    window._indiceScrollInited = true;
}

/**
 * AUXILIAR: PINTA O CARD NO ÍNDICE
 */
function aplicarDestaqueVisual(id) {
    const todosCards = document.querySelectorAll('.indice-card');
    todosCards.forEach(c => c.classList.remove('active'));

    const cardAlvo = document.getElementById(`nav-card-${id}`);
    if (cardAlvo) {
        cardAlvo.classList.add('active');
        // Faz o Índice rolar automaticamente se o card selecionado estiver fora de vista
        cardAlvo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function ocultarIndice() {
    const container = document.getElementById('indice-nota-container');
    if (container) container.innerHTML = "";
}