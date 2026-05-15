// components/direita/indice.js
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';

let isManualScrolling = false; 
let notaIdCacheIndice = ""; 

/**
 * RENDERIZAR O ÍNDICE (GPS DA NOTA)
 * Lógica inteligente que distingue entre reconstrução total e atualização de texto.
 */
export function renderizarIndice(caixas, isModoPost = false) {
    const container = document.getElementById('indice-nota-container');

    const notaIdAtual = window.notaAbertaId; 
    const ativas = caixas.filter(c => c.estado === 'ativa');
    
    // 1. GERAR ASSINATURA DA ESTRUTURA
    // Identifica se a ordem ou o número de blocos mudou
    const assinaturaAtual = ativas.map(c => c.id).join('|') + (isModoPost ? '_post' : '_normal');

    // --- 🚀 DETETOR DE TROCA DE NOTA ---
    // Se o ID da nota mudou, forçamos o reset total para não mostrar dados da nota antiga
    if (notaIdAtual !== notaIdCacheIndice) {
        notaIdCacheIndice = notaIdAtual;
        container.dataset.lastSignature = ""; 
    }

    // 2. VERIFICAÇÃO DE ASSINATURA (ANTI-FLICKER)
    // Se a estrutura e a nota forem as mesmas, apenas atualizamos o texto dos cards existentes
    if (container.dataset.lastSignature === signatureSanitize(assinaturaAtual)) {
        sincronizarConteudoCards(ativas);
        return;
    }

    // 3. RECONSTRUÇÃO TOTAL (Mudar de nota, mudar ordem ou adicionar/remover blocos)
    container.innerHTML = "";
    container.dataset.lastSignature = signatureSanitize(assinaturaAtual);

    const minhaUltimaLeituraAnterior = window.sessaoUltimaLeitura ? new Date(window.sessaoUltimaLeitura).getTime() : 0;
    const isNotaShare = (window.dadosNotaOriginal && window.dadosNotaOriginal.onde === "share");

    // Ordenação Dinâmica (Respeita o Modo Post do Laboratório)
    if (isModoPost) ativas.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
    else ativas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (ativas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Nota sem blocos ativos.</div>`;
        return;
    }

    // Gerar o HTML dos Cards
    const fragmento = document.createDocumentFragment();

    ativas.forEach(caixa => {
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        
        // Mapeamento de cores baseado no FOCO
        const mapaFocos = (caixa.tipo === 'subnota') ? FOCOS_SUBNOTA : 
                         (caixa.tipo === 'questao') ? FOCOS_QUESTAO : 
                         (caixa.tipo === 'raciocinio') ? FOCOS_RACIOCINIO : FOCOS_BASE;

        const fKey = caixa.foco || "original";
        const corFinal = (mapaFocos[fKey]?.corForte) || config.cor;
        const labelParaMostrar = (fKey !== "original") ? fKey.toUpperCase().replace('_', ' ') : config.nome;

        const card = document.createElement('div');
        card.id = `nav-card-${caixa.id}`;
        card.className = "indice-card";
        card.style.borderLeftColor = corFinal;

        // Indicador de novidades (Share)
        if (isNotaShare && minhaUltimaLeituraAnterior > 0) {
            const dataCaixa = new Date(caixa.timestamp).getTime();
            if (dataCaixa > (minhaUltimaLeituraAnterior + 1000)) {
                card.classList.add('update-pendente');
            }
        }

        card.innerHTML = `
            <div class="label-tipo" style="color:${corFinal}; filter: brightness(1.2);">
                <i class="${config.icon}"></i>
                <span>${labelParaMostrar}</span>
            </div>
            <!-- ID único para atualização cirúrgica de texto -->
            <div class="resumo-texto" id="idx-txt-${caixa.id}">...</div>
        `;

        // Clique para Teleporte (Scroll suave até ao bloco)
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

        fragmento.appendChild(card);
    });

    container.appendChild(fragmento);

    // Primeira sincronização de texto
    sincronizarConteudoCards(ativas);
    configurarScrollSpy();
}

/**
 * ATUALIZAÇÃO CIRÚRGICA DE CONTEÚDO
 * Altera apenas o texto do elemento sem apagar o card ou perder o scroll do utilizador.
 */
function sincronizarConteudoCards(ativas) {
    ativas.forEach(caixa => {
        const elTexto = document.getElementById(`idx-txt-${caixa.id}`);
        if (elTexto) {
            let resumo = "";
            
            // Lógica Especial: Elevador
            if (caixa.tipo === "elevador") {
                resumo = (caixa.pastapai && caixa.pastapai[0] && caixa.pastapai[0].nome) 
                         ? caixa.pastapai[0].nome 
                         : "Elevador de Links";
            } 
            // Lógica Padrão: Título ou fallback para Conteúdo (Resolve o bug das ferramentas)
            else {
                resumo = caixa.titulo || (caixa.conteudo ? caixa.conteudo.substring(0, 80) : `Nova ${caixa.tipo}`);
            }

            // Só atualiza o DOM se o texto mudou efetivamente
            if (elTexto.innerText !== resumo) {
                elTexto.innerText = resumo;
            }
        }
    });
}

/**
 * MOTOR DE SEGUIMENTO (SCROLL-SPY)
 * Usa addEventListener para ser compatível com a aba IA.
 */
function configurarScrollSpy() {
    const editor = document.querySelector('.center-col');
    if (!editor || window._indiceScrollInited) return;

    editor.addEventListener('scroll', () => {
        if (isManualScrolling) return;

        const indiceCont = document.getElementById('indice-nota-container');
        if (!indiceCont || indiceCont.offsetParent === null) return;

        const blocos = document.querySelectorAll('[id^="bloco-"]');
        let blocoMaisProximo = null;
        let menorDistancia = Infinity;

        blocos.forEach(bloco => {
            const rect = bloco.getBoundingClientRect();
            // Ponto de mira: 40% da altura da tela
            const distancia = Math.abs(rect.top - (window.innerHeight / 2.5));
            if (distancia < menorDistancia) {
                menorDistancia = distancia;
                blocoMaisProximo = bloco.id.replace('bloco-', '');
            }
        });

        if (blocoMaisProximo) {
            atualizarDestaqueIndice(blocoMaisProximo);
        }
    });

    window._indiceScrollInited = true;
}

/**
 * APLICA O DESTAQUE VISUAL AO CARD ATIVO
 */
export function atualizarDestaqueIndice(caixaId) {
    document.querySelectorAll('.indice-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`nav-card-${caixaId}`);
    
    if (activeCard) {
        activeCard.classList.add('active');
        
        // No mobile, só faz scroll automático na lista se a aba lateral estiver visível
        const isMobile = window.innerWidth <= 768;
        const colunaDireita = document.getElementById('area-direita');
        const direitaAberta = colunaDireita && (colunaDireita.classList.contains('active') || colunaDireita.style.bottom === '0px');

        if (!isMobile || direitaAberta) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

/**
 * LIMPA O ÍNDICE E OS CACHES
 */
export function ocultarIndice() {
    const container = document.getElementById('indice-nota-container');
    if (container) {
        container.innerHTML = "";
        container.dataset.lastSignature = "";
        notaIdCacheIndice = ""; 
    }
}

// Auxiliar para limpar caracteres estranhos da assinatura
function signatureSanitize(s) { return s.replace(/\s/g, ''); }
