// components/bible-portal/bible-engine.js
import { BIBLIA_METADATA } from '../lists/biblia.js';
import { BibleUI } from './bible-ui-controller.js';
import { BibleSettings } from './bible-settings.js';
import { abrirVersiculoNoBrain } from '../direita/biblia-brain.js';

/**
 * MOTOR LÓGICO DO PORTAL BÍBLIA
 * Trata do processamento de dados, navegação e integração com o ecossistema Brain.
 */
export const BibleEngine = {
    
    /**
     * 1. VISTA INICIAL: MOSAICO DE LIVROS (OT / NT)
     */
    renderizarMosaico: () => {
        console.log("%c🏠 [ENGINE] Gerando Mosaico de Livros.", "color: #8b5cf6; font-weight: bold;");
        window.livroAtivo = null;
        window.capAtivo = null;

        const feed = document.getElementById('bible-feed');
        if (!feed) return;

        feed.className = "bible-mosaico-view"; 
        
        // Separação por Testamentos
        const antigoT = BIBLIA_METADATA.filter(l => l.id <= 39);
        const novoT = BIBLIA_METADATA.filter(l => l.id > 39);

        const htmlGrid = (lista) => lista.map(l => `
            <div class="mosaico-book-card" style="background:${l.grupo.cor}" 
                 onclick="window.mostrarCapitulosDoLivro('${l.nome}')">
                ${l.abrev}
            </div>
        `).join('');

        feed.innerHTML = `
            <div class="testamento-section">
                <h4 class="testamento-title">Escrituras Hebraico-Aramaicas</h4>
                <div class="books-horizontal-grid">${htmlGrid(antigoT)}</div>
            </div>
            <div class="testamento-section" style="margin-top:50px;">
                <h4 class="testamento-title">Escrituras Gregas Cristãs</h4>
                <div class="books-horizontal-grid">${htmlGrid(novoT)}</div>
            </div>`;

        // Reset da interface para estado de "escolha"
        BibleUI.ativarModoLeitura(false, "ESCOLHER LIVRO");
        BibleUI.fecharPainelLateral();
    },

    /**
     * 2. VISTA INTERMÉDIA: SELEÇÃO DE CAPÍTULOS
     */
    mostrarCapitulos: (livroNome) => {
        console.log(`%c🔢 [ENGINE] Seleção de capítulos: ${livroNome}`, "color: #fbbf24; font-weight: bold;");
        const livro = BIBLIA_METADATA.find(l => l.nome === livroNome);
        if (!livro) return;

        window.livroAtivo = livroNome;
        const feed = document.getElementById('bible-feed');
        feed.className = "bible-mosaico-view"; 
        
        // Gerar quadrados para cada capítulo
        let htmlCaps = "";
        for (let i = 1; i <= livro.caps; i++) {
            htmlCaps += `<div class="nav-cap-btn" onclick="window.carregarCapituloNoPortal('${livroNome}', ${i})">${i}</div>`;
        }

        feed.innerHTML = `
            <div class="testamento-section">
                <button onclick="window.renderizarMosaicoPrincipal()" class="btn-amt" style="width:auto; padding:0 15px; height:32px; margin-bottom:30px; background:rgba(255,255,255,0.05); color:white;">
                    <i class="fa-solid fa-arrow-left"></i> VOLTAR AOS LIVROS
                </button>
                <h4 class="testamento-title" style="color:white; opacity:1; font-size:18px;">${livroNome.toUpperCase()}</h4>
                <div class="bible-nav-grid-caps">
                    ${htmlCaps}
                </div>
            </div>
        `;
        
        BibleUI.ativarModoLeitura(false, livroNome.toUpperCase());
    },

    /**
     * 3. VISTA FINAL: O READER (TEXTO INTEGRAL)
     */
    carregarCapitulo: async (livro, cap, verAlvo = null) => {
        console.group(`%c📖 [ENGINE] Sintonizando: ${livro} ${cap}`, "color: #3b82f6; font-weight: bold;");
        
        window.livroAtivo = livro;
        window.capAtivo = parseInt(cap);
        window.referenciaAtiva = `${livro} ${cap}`;

        BibleUI.mostrarLoadingLeitura(true);

        try {
            const slug = livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
            const res = await fetch(`data/biblia/${slug}.json`);
            const data = await res.json();
            const versiculos = data[livro][cap];

            // Detetar preferência de visualização do utilizador
            const modoAtual = (BibleSettings.state && BibleSettings.state.viewMode) ? BibleSettings.state.viewMode : "grid";
            
            const feed = document.getElementById('bible-feed');
            feed.className = (modoAtual === 'sequence') ? "view-sequence" : "view-grid";
            
            // Renderização dos versículos com gatilho para o Brain no número
            feed.innerHTML = Object.entries(versiculos).map(([num, texto]) => `
                <div class="bible-verse-row" data-v="${num}">
                    <sup class="v-num" onclick="window.ativarBrainBiblia('${num}', '${texto.replace(/'/g, "\\'")}')">${num}</sup>
                    <span class="v-text">${texto}</span>
                </div>
            `).join('');

            // Ativar ferramentas de investigação na barra
            BibleUI.ativarModoLeitura(true, `${livro.toUpperCase()} ${cap}`);
            
            // Lógica de posicionamento (Scroll)
            if (verAlvo) {
                setTimeout(() => BibleUI.scrollParaVersiculo(verAlvo), 500);
            } else {
                document.getElementById('bible-reader-container').scrollTop = 0;
            }

        } catch (e) {
            console.error("❌ [ENGINE-ERROR] Falha ao carregar capítulos:", e);
            BibleEngine.renderizarMosaico();
        } finally {
            BibleUI.mostrarLoadingLeitura(false);
            console.groupEnd();
        }
    },

    /**
     * NAVEGAÇÃO SEQUENCIAL (SETAS)
     */
    navegar: (direcao) => {
        if (!window.livroAtivo) return;
        
        const idx = BIBLIA_METADATA.findIndex(l => l.nome === window.livroAtivo);
        const livro = BIBLIA_METADATA[idx];
        let novoCap = window.capAtivo + direcao;

        if (novoCap < 1) {
            // Recuar para o livro anterior
            if (idx > 0) {
                const anterior = BIBLIA_METADATA[idx - 1];
                BibleEngine.carregarCapitulo(anterior.nome, anterior.caps);
            }
        } else if (novoCap > livro.caps) {
            // Avançar para o próximo livro
            if (idx < BIBLIA_METADATA.length - 1) {
                const proximo = BIBLIA_METADATA[idx + 1];
                BibleEngine.carregarCapitulo(proximo.nome, 1);
            }
        } else {
            // Mudar capítulo dentro do mesmo livro
            BibleEngine.carregarCapitulo(window.livroAtivo, novoCap);
        }
    }
};

/**
 * ============================================================
 * 🔗 PONTES DE LIGAÇÃO GLOBAIS (WINDOW)
 * ============================================================
 */
window.mostrarCapitulosDoLivro = BibleEngine.mostrarCapitulos;
window.renderizarMosaicoPrincipal = BibleEngine.renderizarMosaico;
window.carregarCapituloNoPortal = BibleEngine.carregarCapitulo;

/**
 * GATILHO DE ESTUDO: Ativa a Coluna Direita (Brain + X-SAT)
 * Remove a aba EYE para focar na inteligência do versículo.
 */
window.ativarBrainBiblia = async (ver, texto) => {
    // 1. Primeiro prepara a interface física
    await BibleUI.abrirPainelLateral();

    // 2. Depois de a barra estar aberta e as abas detetadas, injeta os dados
    // Adicionamos um pequeno delay para o Firestore não "atropelar" a UI
    setTimeout(() => {
        import('../direita/biblia-brain.js').then(m => {
            m.abrirVersiculoNoBrain(
                window.livroAtivo, 
                window.capAtivo, 
                ver, 
                texto, 
                window.db, 
                window.auth
            );
        });
    }, 150);

    BibleUI.scrollParaVersiculo(ver);
};