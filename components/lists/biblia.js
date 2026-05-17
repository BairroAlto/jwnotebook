// components/lists/biblia.js
import { abrirVersiculoNoBrain } from '../direita/biblia-brain.js';

// Variáveis globais do módulo para persistência de dados do Firebase
let dbGlobal = null;
let authGlobal = null;
let estadoBiblia = { livro: null, cap: null };
let livroAtivoCache = null;



const GRUPOS = {
    PENTATEUCO: { nome: "Pentateuco", cor: "#3b3247" },
    HISTORICOS: { nome: "Históricos", cor: "#83719b" },
    POETICOS: { nome: "Poéticos", cor: "#4a5a67" },
    PROFETAS_MAIORES: { nome: "Profetas Maiores", cor: "#965434" },
    PROFETAS_MENORES: { nome: "Profetas Menores", cor: "#634b30" },
    EVANGELHOS: { nome: "Evangelhos", cor: "#965434" },
    ATOS: { nome: "Atos", cor: "#3b3247" },
    CARTAS_PAULO: { nome: "Cartas de Paulo", cor: "#83719b" },
    OUTRAS_CARTAS: { nome: "Outras Cartas", cor: "#4a5a67" },
    REVELACAO: { nome: "Apocalipse", cor: "#9d5d2f" }
};

const BIBLIA_METADATA = [
    { id: 1, nome: "Génesis", caps: 50, abrev: "Gén", grupo: GRUPOS.PENTATEUCO },
    { id: 2, nome: "Êxodo", caps: 40, abrev: "Êx", grupo: GRUPOS.PENTATEUCO },
    { id: 3, nome: "Levítico", caps: 27, abrev: "Lev", grupo: GRUPOS.PENTATEUCO },
    { id: 4, nome: "Números", caps: 36, abrev: "Núm", grupo: GRUPOS.PENTATEUCO },
    { id: 5, nome: "Deuteronómio", caps: 34, abrev: "Deut", grupo: GRUPOS.PENTATEUCO },
    { id: 6, nome: "Josué", caps: 24, abrev: "Jos", grupo: GRUPOS.HISTORICOS },
    { id: 7, nome: "Juízes", caps: 21, abrev: "Juí", grupo: GRUPOS.HISTORICOS },
    { id: 8, nome: "Rute", caps: 4, abrev: "Rute", grupo: GRUPOS.HISTORICOS },
    { id: 9, nome: "1 Samuel", caps: 31, abrev: "1 Sam", grupo: GRUPOS.HISTORICOS },
    { id: 10, nome: "2 Samuel", caps: 24, abrev: "2 Sam", grupo: GRUPOS.HISTORICOS },
    { id: 11, nome: "1 Reis", caps: 22, abrev: "1 Reis", grupo: GRUPOS.HISTORICOS },
    { id: 12, nome: "2 Reis", caps: 25, abrev: "2 Reis", grupo: GRUPOS.HISTORICOS },
    { id: 13, nome: "1 Crónicas", caps: 29, abrev: "1 Crón", grupo: GRUPOS.HISTORICOS },
    { id: 14, nome: "2 Crónicas", caps: 36, abrev: "2 Crón", grupo: GRUPOS.HISTORICOS },
    { id: 15, nome: "Esdras", caps: 10, abrev: "Esd", grupo: GRUPOS.HISTORICOS },
    { id: 16, nome: "Neemias", caps: 13, abrev: "Nee", grupo: GRUPOS.HISTORICOS },
    { id: 17, nome: "Ester", caps: 10, abrev: "Est", grupo: GRUPOS.HISTORICOS },
    { id: 18, nome: "Jó", caps: 42, abrev: "Jó", grupo: GRUPOS.POETICOS },
    { id: 19, nome: "Salmos", caps: 150, abrev: "Sal", grupo: GRUPOS.POETICOS },
    { id: 20, nome: "Provérbios", caps: 31, abrev: "Prov", grupo: GRUPOS.POETICOS },
    { id: 21, nome: "Eclesiastes", caps: 12, abrev: "Ecl", grupo: GRUPOS.POETICOS },
    { id: 22, nome: "Cântico de Salomão", caps: 8, abrev: "Cân", grupo: GRUPOS.POETICOS },
    { id: 23, nome: "Isaías", caps: 66, abrev: "Isa", grupo: GRUPOS.PROFETAS_MAIORES },
    { id: 24, nome: "Jeremias", caps: 52, abrev: "Jer", grupo: GRUPOS.PROFETAS_MAIORES },
    { id: 25, nome: "Lamentações", caps: 5, abrev: "Lam", grupo: GRUPOS.PROFETAS_MAIORES },
    { id: 26, nome: "Ezequiel", caps: 48, abrev: "Eze", grupo: GRUPOS.PROFETAS_MAIORES },
    { id: 27, nome: "Daniel", caps: 12, abrev: "Dan", grupo: GRUPOS.PROFETAS_MAIORES },
    { id: 28, nome: "Oseias", caps: 14, abrev: "Ose", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 29, nome: "Joel", caps: 3, abrev: "Joel", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 30, nome: "Amós", caps: 9, abrev: "Amós", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 31, nome: "Obadias", caps: 1, abrev: "Oba", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 32, nome: "Jonas", caps: 4, abrev: "Jon", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 33, nome: "Miqueias", caps: 7, abrev: "Miq", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 34, nome: "Naum", caps: 3, abrev: "Naum", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 35, nome: "Habacuque", caps: 3, abrev: "Hab", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 36, nome: "Sofonias", caps: 3, abrev: "Sof", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 37, nome: "Ageu", caps: 2, abrev: "Ageu", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 38, nome: "Zacarias", caps: 14, abrev: "Zac", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 39, nome: "Malaquias", caps: 4, abrev: "Mal", grupo: GRUPOS.PROFETAS_MENORES },
    { id: 40, nome: "Mateus", caps: 28, abrev: "Mat", grupo: GRUPOS.EVANGELHOS },
    { id: 41, nome: "Marcos", caps: 16, abrev: "Mar", grupo: GRUPOS.EVANGELHOS },
    { id: 42, nome: "Lucas", caps: 24, abrev: "Luc", grupo: GRUPOS.EVANGELHOS },
    { id: 43, nome: "João", caps: 21, abrev: "João", grupo: GRUPOS.EVANGELHOS },
    { id: 44, nome: "Atos", caps: 28, abrev: "Atos", grupo: GRUPOS.ATOS },
    { id: 45, nome: "Romanos", caps: 16, abrev: "Rom", grupo: GRUPOS.CARTAS_PAULO },
    { id: 46, nome: "1 Coríntios", caps: 16, abrev: "1 Cor", grupo: GRUPOS.CARTAS_PAULO },
    { id: 47, nome: "2 Coríntios", caps: 13, abrev: "2 Cor", grupo: GRUPOS.CARTAS_PAULO },
    { id: 48, nome: "Gálatas", caps: 6, abrev: "Gál", grupo: GRUPOS.CARTAS_PAULO },
    { id: 49, nome: "Efésios", caps: 6, abrev: "Efé", grupo: GRUPOS.CARTAS_PAULO },
    { id: 50, nome: "Filipenses", caps: 4, abrev: "Fil", grupo: GRUPOS.CARTAS_PAULO },
    { id: 51, nome: "Colossenses", caps: 4, abrev: "Col", grupo: GRUPOS.CARTAS_PAULO },
    { id: 52, nome: "1 Tessalonicenses", caps: 5, abrev: "1 Tes", grupo: GRUPOS.CARTAS_PAULO },
    { id: 53, nome: "2 Tessalonicenses", caps: 3, abrev: "2 Tes", grupo: GRUPOS.CARTAS_PAULO },
    { id: 54, nome: "1 Timóteo", caps: 6, abrev: "1 Tim", grupo: GRUPOS.CARTAS_PAULO },
    { id: 55, nome: "2 Timóteo", caps: 4, abrev: "2 Tim", grupo: GRUPOS.CARTAS_PAULO },
    { id: 56, nome: "Tito", caps: 3, abrev: "Tito", grupo: GRUPOS.CARTAS_PAULO },
    { id: 57, nome: "Filémon", caps: 1, abrev: "Flm", grupo: GRUPOS.CARTAS_PAULO },
    { id: 58, nome: "Hebreus", caps: 13, abrev: "Heb", grupo: GRUPOS.CARTAS_PAULO },
    { id: 59, nome: "Tiago", caps: 5, abrev: "Tia", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 60, nome: "1 Pedro", caps: 5, abrev: "1 Ped", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 61, nome: "2 Pedro", caps: 3, abrev: "2 Ped", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 62, nome: "1 João", caps: 5, abrev: "1 João", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 63, nome: "2 João", caps: 1, abrev: "2 João", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 64, nome: "3 João", caps: 1, abrev: "3 João", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 65, nome: "Judas", caps: 1, abrev: "Jud", grupo: GRUPOS.OUTRAS_CARTAS },
    { id: 66, nome: "Apocalipse", caps: 22, abrev: "Apo", grupo: GRUPOS.REVELACAO }
];

function getSlug(nome) {
    return nome.toLowerCase()
               .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
               .replace(/\s+/g, '_');
}

/**
 * INICIALIZAÇÃO DA BÍBLIA
 */
export function iniciarNavegacaoBiblia(db, auth) {
    dbGlobal = db;
    authGlobal = auth;

    const listaLists = document.getElementById('lista-lists');
    if (!listaLists) return;

    // Se é a primeira vez, configuramos a delegação de cliques para os botões da Bíblia
    if (!window.bibliaDelegationInited) {
        document.addEventListener('click', (e) => {
            const container = document.getElementById('lista-lists');
            
            // Botão: Voltar aos Capítulos (ex: Génesis 1)
            if (e.target.closest('#btn-voltar-caps')) {
                if (livroAtivoCache) renderizarCapitulos(livroAtivoCache, container);
            }

            // Botão: Voltar à Grelha de Livros
            if (e.target.closest('#btn-voltar-livros')) {
                renderizarLivros(container);
            }
        });
        window.bibliaDelegationInited = true;
    }

    if (!window.htmlListaAntiga) window.htmlListaAntiga = listaLists.innerHTML;
    renderizarLivros(listaLists);
}

// 1. RENDERIZAR O MOSAICO DOS LIVROS
function renderizarLivros(container) {
    // 1. Injetar a estrutura base (Botão Voltar + Contentores de Grelha)
    container.innerHTML = `
        <div id="btn-biblia-voltar" style="flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--border-color); background: var(--bg-panel);">
            <i class="fa-solid fa-arrow-left"></i> Voltar a Lists
        </div>
        <div id="biblia-scroll" style="flex-grow: 1; overflow-y: auto; padding: 15px 10px;">
            <div id="seccao-hebraicas" style="margin-bottom: 25px;">
                <h4 style="color: #60a5fa; font-size: 10px; margin-bottom: 12px; letter-spacing: 1.2px; font-weight: 700; text-transform: uppercase;">Escrituras Hebraico-Aramaicas</h4>
                <div class="biblia-grid-mosaico" id="grid-hebraicas"></div>
            </div>
            <div id="seccao-gregas">
                <h4 style="color: #60a5fa; font-size: 10px; margin-bottom: 12px; letter-spacing: 1.2px; font-weight: 700; text-transform: uppercase;">Escrituras Gregas Cristãs</h4>
                <div class="biblia-grid-mosaico" id="grid-gregas"></div>
            </div>
        </div>
    `;

    // 2. Lógica do Botão Voltar (O "Cérebro" da Navegação)
    document.getElementById('btn-biblia-voltar').onclick = () => {
        // Se houver uma vista anterior guardada (Memory Bridge), restaura
        if (window.htmlListaAntiga) {
            console.log("🔙 [BIBLIA] Restaurando vista anterior via Memory Bridge.");
            container.innerHTML = window.htmlListaAntiga;
            window.htmlListaAntiga = null; 
        } 
        // Caso contrário, volta ao menu raiz de Lists
        else {
            console.log("🏠 [BIBLIA] Regressando ao Menu Principal de Lists.");
            if (typeof window.renderizarMenuPrincipalLists === 'function') {
                window.renderizarMenuPrincipalLists();
            }
        }
    };

    const gridHebraicas = document.getElementById('grid-hebraicas');
    const gridGregas = document.getElementById('grid-gregas');

    const gridStyle = `display: grid; grid-template-columns: repeat(auto-fill, var(--fs-biblia-box, 45px)); gap: 6px; justify-content: start;`;
    gridHebraicas.style.cssText = gridStyle;
    gridGregas.style.cssText = gridStyle;

    // 3. Renderizar Mosaico de Livros com Reatribuição de Eventos
    BIBLIA_METADATA.forEach(livro => {
        const div = document.createElement('div');
        div.style.cssText = `
            width: var(--fs-biblia-box, 45px); 
            height: var(--fs-biblia-box, 45px); 
            background-color: ${livro.grupo.cor}; 
            color: white; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: calc(var(--fs-biblia-box, 45px) * 0.28); 
            font-weight: 600; 
            border-radius: 6px; 
            cursor: pointer; 
            transition: transform 0.1s;
            text-align: center;
        `;
        div.innerHTML = livro.abrev;
        
        // Reatribuir o clique para entrar na seleção de capítulos
        div.onclick = (e) => {
            e.stopPropagation();
            renderizarCapitulos(livro, container);
        };

        if (livro.id <= 39) gridHebraicas.appendChild(div);
        else gridGregas.appendChild(div);
    });
}



// 2. RENDERIZAR GRELHA DE CAPÍTULOS
function renderizarCapitulos(livro, container) {
    livroAtivoCache = livro; // <--- Guarda o livro para o botão "Voltar" funcionar sempre
    
    container.innerHTML = `
        <div id="btn-voltar-livros" style="flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; color: var(--primary); font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--border-color); background: var(--bg-panel);">
            <i class="fa-solid fa-chevron-left"></i> ${livro.nome}
        </div>
        <div id="biblia-scroll" style="flex-grow: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; padding: 10px; align-content: start;">
            ${Array.from({ length: livro.caps }, (_, i) => i + 1).map(n => `
                <div class="cap-btn" data-cap="${n}" style="padding: 12px 5px; background: rgba(255,255,255,0.05); text-align: center; border-radius: 4px; cursor: pointer; font-size: 13px;">${n}</div>
            `).join('')}
        </div>
    `;

    // Cliques nos números dos capítulos
    container.querySelectorAll('.cap-btn').forEach(btn => {
        btn.onclick = () => carregarVersiculos(livro, btn.dataset.cap, container);
    });
}

// 3. RENDERIZAR VERSÍCULOS
async function carregarVersiculos(livro, capNum, container) {
    const slug = getSlug(livro.nome);
    container.innerHTML = `<div style="padding:40px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
        const response = await fetch(`data/biblia/${slug}.json`);
        const data = await response.json();
        const versiculosObj = data[livro.nome][capNum];

        // Nota: O clique do #btn-voltar-caps agora é gerido pelo document.addEventListener acima
        container.innerHTML = `
            <div id="btn-voltar-caps" style="flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; color: var(--primary); font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--border-color); background: var(--bg-panel);">
                <i class="fa-solid fa-chevron-left"></i> ${livro.nome} ${capNum}
            </div>
            <div id="biblia-scroll" style="flex-grow: 1; overflow-y: auto; padding: 15px 12px; display: flex; flex-direction: column; gap: 12px;">
                <!-- Versículos aqui -->
            </div>
        `;

        const scrollArea = document.getElementById('biblia-scroll');
        Object.keys(versiculosObj).forEach(vNum => {
            const item = document.createElement('div');
            item.style.cssText = `font-size: var(--fs-biblia-versiculos, 14px); line-height: 1.6; color: var(--text-main); cursor: pointer;`;
            item.innerHTML = `<b style="color: var(--primary); font-size: 0.7em; margin-right: 8px;">${vNum}</b> ${versiculosObj[vNum]}`;
            item.onclick = () => abrirVersiculoNoBrain(livro.nome, capNum, vNum, versiculosObj[vNum], dbGlobal, authGlobal);
            scrollArea.appendChild(item);
        });

    } catch (e) {
        renderizarCapitulos(livro, container);
    }
}

/**
 * FUNÇÃO DE TELEPORTE: Abre a Bíblia diretamente num versículo específico
 */
export function viajarParaVersiculoBiblico(livroNome, capNum, verNum) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // Localizar metadados do livro
    const livro = BIBLIA_METADATA.find(l => l.nome === livroNome);
    if (livro) {
        // Chamamos a função de carregar versículos que já existe no ficheiro
        // Nota: Garante que carregarVersiculos está exportada ou acessível
        carregarVersiculos(livro, capNum, container);
        
        // Opcional: Highlight no versículo específico após carregar
        setTimeout(() => {
            const lista = document.querySelectorAll('#biblia-scroll div');
            lista.forEach(item => {
                if (item.innerText.startsWith(verNum + " ")) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    item.style.backgroundColor = "rgba(139, 92, 246, 0.2)";
                    setTimeout(() => item.style.backgroundColor = "transparent", 3000);
                }
            });
        }, 800);
    }
}