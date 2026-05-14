// components/direita/indice.js
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';

let isManualScrolling = false; // Trava para evitar conflito ao clicar

/**
 * RENDERIZAR O ÍNDICE (GPS)
 */
// Localiza a função renderizarIndice em components/direita/indice.js e atualiza-a:

export function renderizarIndice(caixas, isModoPost = false) {
    const container = document.getElementById('indice-nota-container');
    if (!container) return;

    const minhaUltimaLeituraAnterior = window.sessaoUltimaLeitura ? new Date(window.sessaoUltimaLeitura).getTime() : 0;
    const isNotaShare = (window.dadosNotaOriginal && window.dadosNotaOriginal.onde === "share");

    const ativas = caixas.filter(c => c.estado === 'ativa');
    
    if (isModoPost) {
        ativas.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
    } else {
        // Ordenação normal: a-b ou b-a conforme o teu padrão atual
        // Mantendo b-a para consistência com o teu feed
        caixas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
    
    if (ativas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Nota sem blocos de conteúdo.</div>`;
        return;
    }

    container.innerHTML = "";

    for (const caixa of ativas) {
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        
        const mapaFocos = 
            (caixa.tipo === 'subnota') ? FOCOS_SUBNOTA : 
            (caixa.tipo === 'questao') ? FOCOS_QUESTAO : 
            (caixa.tipo === 'raciocinio') ? FOCOS_RACIOCINIO : FOCOS_BASE;

        const fKey = caixa.foco || "original";

        let labelParaMostrar = config.nome;
        let corFinal = config.cor;

        if (fKey !== "original" && mapaFocos[fKey]) {
            labelParaMostrar = fKey.toUpperCase().replace('_', ' ');
            corFinal = mapaFocos[fKey].corForte;
        }

        let resumo = "";
        if (caixa.tipo === "contentor") {
            resumo = caixa.conteudo || "Escrita livre...";
        } else if (caixa.tipo === "elevador") {
            resumo = (caixa.pastapai && caixa.pastapai[0]) ? caixa.pastapai[0].nome : "Elevador de Links";
        } else {
            resumo = caixa.titulo || `Nova ${config.nome}`;
        }

        const card = document.createElement('div');
        card.id = `nav-card-${caixa.id}`;
        card.className = "indice-card";
        card.style.borderLeftColor = corFinal;

        if (isNotaShare && minhaUltimaLeituraAnterior > 0) {
            const dataCaixa = new Date(caixa.timestamp).getTime();
            if (dataCaixa > (minhaUltimaLeituraAnterior + 1000)) {
                card.classList.add('update-pendente');
            }
        }

        card.innerHTML = `
            <div class="label-tipo" style="color:${corFinal}; filter: brightness(1.3);">
                <i class="${config.icon}"></i>
                <span>${labelParaMostrar}</span>
            </div>
            <div class="resumo-texto">
                ${resumo}
            </div>
        `;

        card.onclick = (e) => {
            e.stopPropagation();
            const el = document.getElementById(`bloco-${caixa.id}`);
            if (el) {
                isManualScrolling = true;
                atualizarDestaqueIndice(caixa.id);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { isManualScrolling = false; }, 800);
            }
        };

        container.appendChild(card);
    }

    configurarScrollSpy();
}


/**
 * CONFIGURAR O SEGUIMENTO DE SCROLL
 */
function configurarScrollSpy() {
    const editor = document.querySelector('.center-col');
    if (!editor) return;

    editor.onscroll = () => {
        if (isManualScrolling) return;
        const blocos = document.querySelectorAll('[id^="bloco-"]');
        let blocoMaisProximo = null;
        let menorDistancia = Infinity;

        blocos.forEach(bloco => {
            const rect = bloco.getBoundingClientRect();
            const distancia = Math.abs(rect.top - (window.innerHeight / 2.5));
            if (distancia < menorDistancia) {
                menorDistancia = distancia;
                blocoMaisProximo = bloco.id.replace('bloco-', '');
            }
        });

        if (blocoMaisProximo) {
            atualizarDestaqueIndice(blocoMaisProximo);
        }
    };
}


/**
 * ATUALIZAR O DESTAQUE VISUAL NO ÍNDICE
 */
function atualizarDestaqueIndice(caixaId) {
    document.querySelectorAll('.indice-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`nav-card-${caixaId}`);
    
    if (activeCard) {
        // 1. Destacar visualmente o card
        activeCard.classList.add('active');
        
        // --- 2. CORREÇÃO DO BUG MOBILE ---
        // Verifica se é mobile (largura <= 768px)
        const isMobile = window.innerWidth <= 768;
        
        // Verifica se a coluna da direita está atualmente visível (com a classe 'active')
        const colunaDireita = document.getElementById('area-direita');
        const direitaAberta = colunaDireita && colunaDireita.classList.contains('active');

        // Só executa o scroll automático se estivermos no Desktop 
        // OU se estivermos no Mobile mas com a aba da direita fisicamente aberta.
        if (!isMobile || direitaAberta) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}


export function ocultarIndice() {
    const container = document.getElementById('indice-nota-container');
    if (container) {
        container.innerHTML = "";
        container.style.display = 'none';
    }
}