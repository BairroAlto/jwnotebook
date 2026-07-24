// components/lists/livros.js
import { SIGLAS_LIVROS } from './siglas-data.js';
import { renderizarPaginaLeitura } from './reader/reader-view.js';

/**
 * AUXILIAR: Formata nomes de ficheiros para meses legíveis
 */
function formatarNomeMesLists(nomeFicheiro) {
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const id = nomeFicheiro.replace('.json', '');
    if (id.includes('_')) {
        const [m, d] = id.split('_');
        return `${parseInt(d)} de ${meses[parseInt(m) - 1]}`;
    }
    const idx = parseInt(id) - 1;
    return meses[idx] || id;
}

/**
 * INICIALIZADOR DA NAVEGAÇÃO NA ABA LISTS
 */
export function iniciarNavegacaoLivros() {
    const listaLists = document.getElementById('lista-lists');
    if (!listaLists) return;
    if (!window.htmlListaAntiga) window.htmlListaAntiga = listaLists.innerHTML;

    renderizarCategorias(listaLists);
}

// --- NÍVEL 1: CATEGORIAS PRINCIPAIS ---
function renderizarCategorias(container) {
    // 1. Injetar o HTML do Menu de Categorias
    container.innerHTML = `
        <div id="btn-livros-voltar" style="padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); text-transform: uppercase;">
            <i class="fa-solid fa-arrow-left"></i> Voltar
        </div>
        <div id="livros-scroll" style="flex: 1; overflow-y: auto; padding: 10px 0;">
            <div class="menu-item-list" id="cat-livros"><i class="fa-solid fa-book"></i> Livros</div>
            <div class="menu-item-list" id="cat-sentinelas"><i class="fa-solid fa-copy"></i> A Sentinela</div>
            <div class="menu-item-list" id="cat-mwb"><i class="fa-solid fa-calendar-check"></i> Manual de Atividades</div>
            <div class="menu-item-list" id="cat-multimedia"><i class="fa-solid fa-clapperboard"></i> Multimédia</div>
        </div>
    `;

    // 2. LÓGICA DO BOTÃO VOLTAR (O "Cérebro" da Navegação)
    document.getElementById('btn-livros-voltar').onclick = () => {
        // REGRA A: Se houver um histórico de "Salto" (ex: vieste do Brain da Bíblia), volta para lá
        if (window.htmlListaAntiga) {
            console.log("🔙 [NAV] Restaurando vista anterior via Memory Bridge.");
            container.innerHTML = window.htmlListaAntiga;
            window.htmlListaAntiga = null; // Limpa para evitar loops
        } 
        // REGRA B: Se não houver histórico, volta para o menu principal de "LISTS"
        else {
            console.log("🏠 [NAV] Regressando ao Menu Principal de Lists.");
            if (typeof window.renderizarMenuPrincipalLists === 'function') {
                window.renderizarMenuPrincipalLists();
            } else {
                // Fallback de segurança caso a função global não tenha carregado
                location.reload(); 
            }
        }
    };

    // 3. ATRIBUIÇÃO DOS CLIQUES NAS CATEGORIAS
    document.getElementById('cat-livros').onclick = () => listarLivrosSimples(container);
    document.getElementById('cat-sentinelas').onclick = () => escolherAno('sentinelas', container);
    document.getElementById('cat-mwb').onclick = () => escolherAno('mwb', container);
    document.getElementById('cat-multimedia').onclick = () => escolherAno('multimedia', container);
}

// --- NÍVEL 2: SELEÇÃO DE ANO ---
function escolherAno(pasta, container) {
    const nomes = { 'sentinelas': 'A Sentinela', 'mwb': 'Manual de Atividades', 'multimedia': 'Multimédia' };
    container.innerHTML = `
        <div id="btn-voltar-cat" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--border-color);">
            <i class="fa-solid fa-chevron-left"></i> ${nomes[pasta]}
        </div>
        <div id="livros-scroll" style="flex:1; overflow-y:auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; padding: 10px;">
            ${Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i).map(ano => `
                <div class="cap-btn year-btn" data-ano="${ano}">${ano}</div>
            `).join('')}
        </div>
    `;
    document.getElementById('btn-voltar-cat').onclick = () => renderizarCategorias(container);
    container.querySelectorAll('.year-btn').forEach(btn => {
        btn.onclick = () => listarEdicoesPorAno(pasta, btn.dataset.ano, container);
    });
}

// --- NÍVEL 3: SELEÇÃO DE MÊS / EDIÇÃO ---
export async function listarEdicoesPorAno(pasta, ano, container) {
    container.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    
    const scroll = document.createElement('div');
    scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 5px;";
    
    // LISTA CORRIGIDA: Apenas meses Reais (01 a 12) e edições especiais (01_01, etc)
    const possiveis = ["01","02","03","04","05","06","07","08","09","10","11","12","01_01","01_15","02_01","02_15"];
    const pastaReal = (pasta === 'sentinelas') ? 'w' : pasta;

    const fragmento = document.createDocumentFragment();
    let encontrouAlgum = false;

    // Criamos uma lista de promessas para carregar apenas o que faz sentido
    const verificacoes = possiveis.map(async (f) => {
        const caminho = (pasta === 'sentinelas' || pasta === 'mwb') 
            ? `data/publicacoes/${pastaReal}/${ano}/${f}.json` 
            : `data/${pastaReal}/${ano}/${f}.json`;

        const response = await fetch(caminho, { method: 'HEAD' });
        if (response.ok) {
            encontrouAlgum = true;
            const div = document.createElement('div');
            div.className = "menu-item-list";
            div.innerHTML = `<i class="fa-solid fa-calendar-day" style="margin-right:12px; opacity:0.5;"></i> ${f}`;
            div.onclick = () => carregarPublicacaoJson(caminho, container, pasta, ano);
            return div;
        }
        return null;
    });

    const resultados = await Promise.all(verificacoes);
    resultados.forEach(el => { if(el) fragmento.appendChild(el); });

    container.innerHTML = `<div id="btn-voltar-ano" style="padding:12px; cursor:pointer; color:var(--primary); font-size:13px; font-weight:600; border-bottom:1px solid var(--border-color);"><i class="fa-solid fa-chevron-left"></i> ${ano}</div>`;
    
    if (!encontrouAlgum) scroll.innerHTML = `<p style="text-align:center; color:gray; padding:30px; font-size:11px;">Sem edições para este ano.</p>`;
    else scroll.appendChild(fragmento);
    
    container.appendChild(scroll);
    document.getElementById('btn-voltar-ano').onclick = () => escolherAno(pasta, container);
}

// --- NÍVEL 4: SELEÇÃO DE ARTIGO ---
export async function carregarPublicacaoJson(caminho, container, pastaOrigem, anoOrigem) {
    container.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    try {
        const response = await fetch(caminho);
        const data = await response.json();
        
        if (data.video) {
            renderizarConteudo(data.video, container, data, caminho, pastaOrigem, anoOrigem);
            return;
        }

        container.innerHTML = `
            <div id="btn-voltar-edicao" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); position:sticky; top:0; z-index:10;">
                <i class="fa-solid fa-chevron-left"></i> ${data.titulo || 'Voltar'}
            </div>
            <div id="livros-scroll" style="flex: 1; overflow-y: auto; padding: 5px;"></div>
        `;

        const scroll = document.getElementById('livros-scroll');
        (data.artigos || data.capitulos || []).forEach((item, index) => {
            const cap = Array.isArray(item) ? item[0] : item;
            const div = document.createElement('div');
            div.className = "menu-item-list";
            div.style.flexDirection = "column"; div.style.alignItems = "flex-start"; 
            
            const label = data.artigos ? `ARTIGO ${index + 1}` : `CAPÍTULO ${cap.capitulo || index + 1}`;
            div.innerHTML = `<span style="font-size: 9px; text-transform: uppercase; font-weight: 800; color: var(--text-muted);">${label}</span>
                             <div style="font-size: 13px; color: var(--text-main); font-weight: 500;">${cap.titulo}</div>`;
            
            div.onclick = () => renderizarConteudo(cap, container, data, caminho, pastaOrigem, anoOrigem);
            scroll.appendChild(div);
        });

        document.getElementById('btn-voltar-edicao').onclick = () => listarEdicoesPorAno(pastaOrigem, anoOrigem, container);
    } catch (e) { renderizarCategorias(container); }
}

// --- NÍVEL 5: LEITURA DO CONTEÚDO (EXPORTADO PARA AS BRIDGES) ---
export function renderizarConteudo(obj, container, dataPai, caminhoOriginal, pastaOrigem, anoOrigem) {
    // Definimos a lógica do botão voltar antes de passar para o módulo
    const acaoVoltar = () => {
        if (window.htmlListaAntiga) {
            container.innerHTML = window.htmlListaAntiga;
            window.htmlListaAntiga = null;
        } else if (pastaOrigem === 'multimedia') {
            listarEdicoesPorAno('multimedia', anoOrigem, container);
        } else if (pastaOrigem === "") {
            listarLivrosSimples(container);
        } else {
            carregarPublicacaoJson(caminhoOriginal, container, pastaOrigem, anoOrigem);
        }
    };

    // Chamamos o orquestrador modular
    renderizarPaginaLeitura(obj, container, dataPai, acaoVoltar);
}



export async function listarLivrosSimples(container) {
    container.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    const scroll = document.createElement('div');
    scroll.style.cssText = "flex: 1; overflow-y: auto; padding: 5px;";
    
    for (const s in SIGLAS_LIVROS) {
        const caminho = `data/livros/${s}.json`;
        try {
            const existe = await fetch(caminho, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
            if (existe) {
                const div = document.createElement('div');
                div.className = "menu-item-list";
                div.innerHTML = `<small style="opacity:0.5; width:35px; font-size:9px;">${s.toUpperCase()}</small> ${SIGLAS_LIVROS[s]}`;
                div.onclick = () => carregarPublicacaoJson(caminho, container, "", "");
                scroll.appendChild(div);
            }
        } catch(e){}
    }
    container.innerHTML = `<div id="btn-voltar-cat" style="padding:12px; cursor:pointer; color:var(--primary); font-size:13px; font-weight:600; border-bottom:1px solid var(--border-color);"><i class="fa-solid fa-chevron-left"></i> Livros</div>`;
    container.appendChild(scroll);
    document.getElementById('btn-voltar-cat').onclick = () => renderizarCategorias(container);
}

document.addEventListener('click', (e) => {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // 1. Botão Principal: Voltar ao Menu de Lists
    if (e.target.closest('#btn-livros-voltar')) {
        if (window.htmlListaAntiga) {
            container.innerHTML = window.htmlListaAntiga;
            window.htmlListaAntiga = null;
        } else if (typeof window.renderizarMenuPrincipalLists === 'function') {
            window.renderizarMenuPrincipalLists();
        }
    }

    // 2. Botões de Hierarquia (Voltar para Categorias, Ano ou Edição)
    // Se clicarmos em qualquer botão de "Voltar" dentro da navegação de livros
    // e o contexto original tiver sido perdido pelo innerHTML, resetamos para a raiz de Livros.
    const IDsDeVoltar = ['#btn-voltar-cat', '#btn-voltar-ano', '#btn-voltar-edicao', '#btn-voltar-artigos'];
    
    if (IDsDeVoltar.some(id => e.target.closest(id))) {
        console.log("🔙 [NAV] Restaurando navegação de Livros...");
        
        import('./livros.js').then(m => {
            // Re-inicializa a vista de categorias para que os cliques voltem a ser "vivos"
            m.iniciarNavegacaoLivros();
        });
    }
});