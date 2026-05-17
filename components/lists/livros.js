// components/lists/livros.js
import { SIGLAS_LIVROS } from './siglas-data.js';

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
    // 1. CONFIGURAÇÃO DO CONTENTOR
    container.innerHTML = ""; 
    container.style.display = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    
    // 2. INTERFACE DE TOPO (Botão Voltar + Título)
    container.innerHTML = `
        <div id="btn-voltar-artigos" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); position: sticky; top:0; z-index:10; text-transform:uppercase;">
            <i class="fa-solid fa-chevron-left"></i> Voltar
        </div>
        <div id="livros-scroll" style="flex: 1; overflow-y: auto; padding: 25px 20px 60px 20px; display: flex; flex-direction: column; gap: 15px;">
            <h2 style="font-size: 20px; color: var(--text-main); line-height: 1.3; margin-bottom: 15px; font-weight: 700;">
                ${obj.titulo}
            </h2>
            <div id="corpo-texto-leitura" style="display: flex; flex-direction: column; gap: 4px;"></div>
        </div>
    `;

    const scrollArea = document.getElementById('corpo-texto-leitura');

    // 3. RENDERIZAÇÃO DOS BLOCOS DE TEXTO
    obj.conteudo.forEach(bloco => {
        const p = document.createElement('div');
        
        // Estilos base e cursor de interação
        p.style.cssText = `
            font-size: var(--fs-biblia-versiculos); 
            line-height: 1.7; 
            margin-bottom: 10px; 
            color: var(--text-main); 
            transition: 0.2s; 
            cursor: pointer;
            padding: 12px;
            border-radius: 8px;
            position: relative;
        `;
        
        // Metadados para o sistema de realce e scroll
        if (bloco.numero_ref) p.setAttribute('data-p', bloco.numero_ref);
        p.setAttribute('data-tipo', bloco.tipo || 'paragrafo');

        // Efeito Visual de Seleção (Hover)
        p.onmouseenter = () => p.style.background = "rgba(99, 102, 241, 0.05)";
        p.onmouseleave = () => p.style.background = "transparent";

        // ========================================================
        // 🚀 LÓGICA DE CLIQUE: DISPARAR ESTUDO NO BRAIN
        // ========================================================
p.onclick = (e) => {
    e.stopPropagation();

    // 1. EXTRAÇÃO INTELIGENTE BASEADA NAS TUAS IMAGENS
    let refParaProcessar = "";
    let contextoReal = "";

    if (dataPai.artigos) {
        // Foto 1: Estrutura de Revista (w, mwb)
        refParaProcessar = dataPai.artigos[0].referencia; 
        contextoReal = "publicacao";
    } else if (dataPai.capitulos) {
        // Foto 2: Estrutura de Livro (bt, rr)
        // Usamos o título do livro + capítulo para o processador
        refParaProcessar = `${dataPai.titulo} cap. ${obj.capitulo}`;
        contextoReal = "livro";
    } else if (dataPai.video) {
        // Foto 3: Estrutura de Vídeo
        refParaProcessar = dataPai.video.referencia;
        contextoReal = "multimedia";
    }

    // 2. DISPARAR A PONTE
    import('../biblioteca-brain/biblio-bridge.js').then(m => {
        m.estudarReferencia({
            rawRef: refParaProcessar, // A string que os processadores codex já sabem limpar
            contexto: contextoReal,
            oque: bloco.tipo,
            sequencia: bloco.numero_ref,
            textoOriginal: bloco.texto,
            tituloConteudo: obj.titulo || dataPai.video?.titulo || ""
        });
    });
};

        // 4. TRATAMENTO VISUAL POR TIPO DE BLOCO
        if (bloco.tipo === "subtema" || bloco.tipo === "discurso") {
            p.style.color = "var(--primary)"; 
            p.style.fontWeight = "800"; 
            p.style.marginTop = "20px";
            p.style.fontSize = "1.1em";
            p.innerText = bloco.texto;
        } 
        else if (bloco.tipo === "pergunta") {
            p.style.cssText += `
                color: #fb7185; 
                font-style: italic; 
                background: rgba(251, 113, 133, 0.04); 
                border-left: 3px solid #fb7185; 
                margin: 15px 0;
            `;
            p.innerHTML = `
                <small style="display:block; opacity:0.6; margin-bottom:5px; font-weight:800; font-style:normal; text-transform:uppercase; letter-spacing:0.5px;">
                    Pergunta ${bloco.numero_ref || ''}
                </small>
                ${bloco.texto}
            `;
        } 
        else {
            // Parágrafo Padrão ou Resumo
            p.innerHTML = `
                <b style="color: var(--primary); font-size: 0.75em; margin-right: 15px; opacity: 0.4; font-weight: 900;">
                    ${bloco.numero_ref || ''}
                </b>
                <span>${bloco.texto}</span>
            `;
        }
        container.style.display = 'flex';


        scrollArea.appendChild(p);
    });

    // 5. LÓGICA DO BOTÃO VOLTAR (Mantendo o histórico de navegação)
  document.getElementById('btn-voltar-artigos').onclick = () => {
    const container = document.getElementById('lista-lists');

    // 1. REGRA DE OURO: MEMORY BRIDGE (Salto Semântico)
    // Se o utilizador saltou de um card do Brain (Bíblia ou Cosmos), 
    // restauramos o HTML que foi gravado na memória global.
    if (window.htmlListaAntiga) {
        console.log("🔙 [NAV] Restaurando vista anterior via Memory Bridge.");
        container.innerHTML = window.htmlListaAntiga;
        
        // Limpamos a memória após o uso para permitir novos saltos limpos
        window.htmlListaAntiga = null; 
        return; // Sai da função aqui
    }

    // 2. NAVEGAÇÃO HIERÁRQUICA PADRÃO
    // Se o utilizador chegou aqui navegando normalmente pelas pastas:
    console.log("🔙 [NAV] Retornando pela hierarquia de ficheiros.");

    if (pastaOrigem === 'multimedia' || (dataPai && dataPai.video)) {
        // Se for um vídeo, volta para a lista de vídeos daquele ano
        listarEdicoesPorAno('multimedia', anoOrigem, container);
    } 
    else if (pastaOrigem === "") {
        // Se for um livro (sem ano associado), volta para a estante de livros
        listarLivrosSimples(container);
    } 
    else {
        // Comportamento padrão: Volta para a lista de artigos/capítulos do ficheiro JSON atual
        carregarPublicacaoJson(caminhoOriginal, container, pastaOrigem, anoOrigem);
    }
};
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