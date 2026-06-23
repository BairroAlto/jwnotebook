// components/lists/cosmos.js
import { 
    collection, addDoc, doc, getDoc, updateDoc, query, where, 
    onSnapshot, serverTimestamp, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirTemaNoBrain } from '../direita/cosmos-brain.js';

let dbRef, authRef;
let simboloSelecionado = "dragon";
let modoEdicaoAtivo = false;
let modoPesquisaAtivo = false;
let filtroPesquisa = "";
let temaSendoEditadoId = null;
let temaSelecionadoId = null;
let cacheTemasCosmos = [];
let unsubCosmos = null; 

const ICON_LIST = {
    "Animais": ["dragon", "cat", "dog", "fish", "crow", "hippo", "horse", "frog", "spider"],
    "Silhuetas": ["user", "child", "baby", "face-smile", "face-frown", "face-meh", "person-praying"],
    "Profissões": ["user-graduate", "user-tie", "user-nurse", "user-ninja", "person-military-pointing"],
    "Desporto": ["futbol", "baseball", "basketball", "bicycle", "dumbbell", "volleyball", "person-skiing-nordic", "person-snowboarding", "person-swimming", "person-skiing"],
    "Natureza": ["tree", "mountain-sun", "cloud-sun", "volcano", "water", "wind", "temperature-full"],
    "Comida": ["apple-whole", "egg", "burger", "carrot", "cheese", "cookie-bite", "drumstick-bite", "pizza-slice", "shrimp", "bowl-rice", "lemon"],
    "Cozinha": ["martini-glass-empty", "mug-hot", "mug-saucer", "bowl-food", "blender", "wine-glass", "spoon"],
    "Outros": ["briefcase", "calendar-days", "phone", "scale-balanced", "gavel", "hat-cowboy", "socks", "car", "taxi", "motorcycle", "bus", "gauge", "skull"]
};

export function iniciarCosmos(db, auth) {
    dbRef = db; 
    authRef = auth;
    configurarEventosPopups();
}

/**
 * RENDERIZA A INTERFACE NA BARRA LATERAL (LISTS)
 */
export function renderizarNavegacaoCosmos() {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // Guardar estado para o Memory Bridge
    if (!window.htmlListaAntiga) window.htmlListaAntiga = container.innerHTML;

    // 1. DESENHAR A ESTRUTURA BASE (Uma única vez)
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); position: sticky; top: 0; z-index: 5;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px;">
                <div id="btn-cosmos-voltar" style="cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i> COSMOS
                </div>
                <div style="display: flex; gap: 6px;">
                    <button id="btn-search-cosmos" title="Pesquisar" style="background: ${modoPesquisaAtivo ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}; border: 1px solid var(--border-color); color: white; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;">
                        <i class="fa-solid fa-magnifying-glass" style="font-size: 11px;"></i>
                    </button>
                    <button id="btn-edit-mode-cosmos" title="Modo Edição" style="background: ${modoEdicaoAtivo ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}; border: 1px solid var(--border-color); color: white; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;">
                        <i class="fa-solid fa-pen" style="font-size: 11px;"></i>
                    </button>
                    <button id="btn-add-cosmos-tema" style="background: var(--primary); border: none; color: white; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
            
            <!-- A BARRA DE PESQUISA (O display depende da variável) -->
            <div id="search-bar-container" style="display: ${modoPesquisaAtivo ? 'block' : 'none'}; padding: 0 12px 12px 12px;">
                <input type="text" id="input-search-cosmos" placeholder="Procurar tema..." value="${filtroPesquisa}" style="width: 100%; padding: 8px; font-size: 12px; background: var(--bg-body); border: 1px solid var(--primary); border-radius: 4px; color: white; outline: none;">
            </div>
        </div>
        <div id="cosmos-items-list" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 15px;"></div>
    `;

    // 2. ATRIBUIR EVENTOS AOS BOTÕES
    
    // Botão Voltar
    document.getElementById('btn-cosmos-voltar').onclick = () => {
        container.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };

    // --- LÓGICA DA LUPA (CORRIGIDA) ---
    const btnSearch = document.getElementById('btn-search-cosmos');
    const searchBar = document.getElementById('search-bar-container');
    const inputSearch = document.getElementById('input-search-cosmos');

    btnSearch.onclick = (e) => {
        e.stopPropagation();
        // Inverte o estado
        modoPesquisaAtivo = !modoPesquisaAtivo;

        if (modoPesquisaAtivo) {
            searchBar.style.display = 'block';
            btnSearch.style.background = 'var(--primary)';
            setTimeout(() => inputSearch.focus(), 50); // Foco imediato
        } else {
            searchBar.style.display = 'none';
            btnSearch.style.background = 'rgba(255,255,255,0.05)';
            filtroPesquisa = ""; // Limpa a busca ao fechar
            inputSearch.value = "";
            renderizarListaFiltrada(); // Volta a mostrar todos os itens
        }
    };

    // Evento de escrita na pesquisa
    inputSearch.oninput = (e) => {
        filtroPesquisa = e.target.value.toLowerCase();
        renderizarListaFiltrada(); // Filtra a cache local
    };

    // Outros botões (+ e Lápis)
    document.getElementById('btn-add-cosmos-tema').onclick = () => abrirPopupNovoTema();
    
    document.getElementById('btn-edit-mode-cosmos').onclick = () => {
        modoEdicaoAtivo = !modoEdicaoAtivo;
        renderizarNavegacaoCosmos(); // Este redesenha para mostrar/esconder os ícones de edição
    };

    // 3. INICIAR ESCUTA DO FIREBASE (Carrega a cache e desenha a lista)
    escutarTemasCosmos();
}

 

function escutarTemasCosmos() {
    if (!authRef.currentUser) return;

    // 1. Limpar ouvinte anterior para evitar fugas de memória
    if (unsubCosmos) unsubCosmos();

    const q = query(
        collection(dbRef, "Cosmo"), 
        where("userId", "==", authRef.currentUser.uid),
        where("tipo", "==", "cosmos"),
        where("estado", "==", "on")
    );

    // 2. Abrir o Snapshot (Escuta Ativa)
    unsubCosmos = onSnapshot(q, (snapshot) => {
        console.log("📡 [COSMOS] Sincronizando cache com Firebase...");
        
        cacheTemasCosmos = [];
        snapshot.forEach(docSnap => {
            cacheTemasCosmos.push({ 
                docIdFirebase: docSnap.id, 
                ...docSnap.data() 
            });
        });

        // 3. Sempre que os dados mudam no servidor, redesenhamos a lista
        renderizarListaFiltrada();
        
    }, (error) => {
        console.error("❌ Erro na escuta do Cosmos:", error);
    });
}

// --- FUNÇÕES DE SUPORTE (POPUPS) ---

function abrirPopupEdicao(docId, data) {
    temaSendoEditadoId = docId;
    simboloSelecionado = data.simbolo || "dragon";
    document.querySelector('#popup-tema-cosmos-overlay h3').innerText = "Editar Tema";
    const btnGravar = document.getElementById('btn-gravar-cosmos');
    btnGravar.innerText = "Atualizar Tema";
    const btnOcultar = document.getElementById('btn-ocultar-cosmos');
    if (btnOcultar) btnOcultar.style.display = "block";
    document.getElementById('cosmos-tema-nome').value = data.nome || "";
    document.getElementById('cosmos-tema-desc').value = data.descricao || "";
    renderizarIconesSeletor(); 
    carregarCategoriasDropdown(data.categoria);
    document.getElementById('popup-tema-cosmos-overlay').classList.add('active');
}

function abrirPopupNovoTema() {
    temaSendoEditadoId = null;
    simboloSelecionado = "dragon";
    document.querySelector('#popup-tema-cosmos-overlay h3').innerText = "Novo Tema Cosmos";
    const btnGravar = document.getElementById('btn-gravar-cosmos');
    btnGravar.innerText = "Criar Tema";
    const btnOcultar = document.getElementById('btn-ocultar-cosmos');
    if (btnOcultar) btnOcultar.style.display = "none";
    document.getElementById('cosmos-tema-nome').value = "";
    document.getElementById('cosmos-tema-desc').value = "";
    renderizarIconesSeletor();
    carregarCategoriasDropdown(); // Sem passar argumento para não selecionar nenhuma
    const overlay = document.getElementById('popup-tema-cosmos-overlay');
    overlay.classList.add('active');
    setTimeout(() => {
        document.getElementById('cosmos-tema-nome').focus();
    }, 100);
}

function configurarEventosPopups() {
    if (!document.getElementById('popup-tema-cosmos-overlay')) return;

    // 1. EVENTOS DE FECHO / CANCELAR
    const btnFecharCosmos = document.getElementById('btn-fechar-cosmos');
    const btnCancelarCat = document.getElementById('btn-cancelar-cat-x');
    const btnAbrirCategoria = document.getElementById('btn-abrir-criar-categoria');

    if (btnFecharCosmos) btnFecharCosmos.onclick = () => document.getElementById('popup-tema-cosmos-overlay').classList.remove('active');
    if (btnCancelarCat) btnCancelarCat.onclick = () => document.getElementById('popup-categoria-cosmos-overlay').classList.remove('active');
    
    // Botão para abrir o sub-popup de criação de categoria
    if (btnAbrirCategoria) btnAbrirCategoria.onclick = () => document.getElementById('popup-categoria-cosmos-overlay').classList.add('active');

    // 2. LÓGICA DE OCULTAR TEMA (Lixeira / Reciclagem)
   const btnOcultar = document.getElementById('btn-ocultar-cosmos');
if (btnOcultar) {
    btnOcultar.onclick = async () => {
        if (!temaSendoEditadoId) return;

        // --- SUBSTITUÍDO: Agora usa o Popup customizado ---
        const confirmou = await perguntarConfirmacaoOcultar();
        
        if (confirmou) {
            try {
                const temaRef = doc(dbRef, "Cosmo", temaSendoEditadoId);
                
                await updateDoc(temaRef, { 
                    estado: "off",
                    timedelete: new Date().toISOString() 
                });

                console.log("✅ [COSMOS] Tema ocultado visualmente.");
                
                // Fecha o popup principal de edição
                document.getElementById('popup-tema-cosmos-overlay').classList.remove('active');
                
            } catch (error) {
                console.error("Erro ao ocultar:", error);
                alert("Erro de permissão.");
            }
        }
    };
}

    // 3. LÓGICA DE GRAVAR / ATUALIZAR TEMA
    const btnGravarCosmos = document.getElementById('btn-gravar-cosmos');
    if (!btnGravarCosmos) return;

    btnGravarCosmos.onclick = async () => {
        const btn = document.getElementById('btn-gravar-cosmos');
        const nome = document.getElementById('cosmos-tema-nome').value.trim();
        const desc = document.getElementById('cosmos-tema-desc').value.trim();
        const cat = document.getElementById('cosmos-tema-categoria').value;

        if (!nome) {
            alert("O nome do tema é obrigatório.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            const dadosBase = { 
                nome, 
                descricao: desc, 
                categoria: cat, 
                simbolo: simboloSelecionado, 
                timestampUpdate: serverTimestamp() 
            };

            if (temaSendoEditadoId) {
                // --- MODO EDIÇÃO (updateDoc) ---
                const temaRef = doc(dbRef, "Cosmo", temaSendoEditadoId);
                const snapAtual = await getDoc(temaRef);
                const idInternoUUID = snapAtual.data().id;

                await updateDoc(temaRef, dadosBase);
                
                // Disparar sincronização em cascata (atualiza nomes nas notas que usam este tema)
                if (typeof sincronizarNomeCosmosEmCascata === 'function') {
                    sincronizarNomeCosmosEmCascata(idInternoUUID, nome);
                }
                console.log("✅ [COSMOS] Tema atualizado.");

            } else {
                // --- MODO CRIAÇÃO (addDoc) ---
                await addDoc(collection(dbRef, "Cosmo"), { 
                    ...dadosBase, 
                    id: crypto.randomUUID(), 
                    userId: authRef.currentUser.uid, 
                    tipo: "cosmos", 
                    estado: "on", 
                    timestamp: serverTimestamp(),
                    caixas: [],
                    Puzzle: { quadros: [] },
                    Dossie: { mica: {}, Apto: [] }
                });
                console.log("🌟 [COSMOS] Novo tema criado.");
            }

            document.getElementById('popup-tema-cosmos-overlay').classList.remove('active');

        } catch (err) {
            console.error("Erro ao gravar no Cosmos:", err);
            alert("Erro ao salvar dados. Verifica a tua ligação.");
        } finally {
            btn.disabled = false;
            btn.innerText = temaSendoEditadoId ? "Atualizar Tema" : "Criar Tema";
        }
    };

    // 4. LÓGICA DE CRIAR NOVA CATEGORIA
    document.getElementById('btn-confirmar-categoria').onclick = async () => {
        const input = document.getElementById('cosmos-cat-nome');
        const nome = input.value.trim();

        if (!nome) return;

        try {
            await addDoc(collection(dbRef, "Cosmo"), { 
                id: crypto.randomUUID(), 
                userId: authRef.currentUser.uid, 
                nome, 
                tipo: "categoria", 
                estado: "on", 
                timestamp: serverTimestamp() 
            });
            
            document.getElementById('popup-categoria-cosmos-overlay').classList.remove('active');
            input.value = "";
            
            // Recarregar a lista de categorias no dropdown do tema
            carregarCategoriasDropdown(nome);

        } catch (e) {
            console.error("Erro ao criar categoria:", e);
        }
    };
}

async function carregarCategoriasDropdown(categoriaSelecionada = "") {
    const select = document.getElementById('cosmos-tema-categoria');
    const q = query(collection(dbRef, "Cosmo"), where("userId", "==", authRef.currentUser.uid), where("tipo", "==", "categoria"), where("estado", "==", "on"));
    const snapshot = await getDocs(q);
    select.innerHTML = '<option value="">Nenhuma Categoria</option>';
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const selected = data.nome === categoriaSelecionada ? 'selected' : '';
        select.innerHTML += `<option value="${data.nome}" ${selected}>${data.nome}</option>`;
    });
}

function renderizarIconesSeletor() {
    const container = document.getElementById('cosmos-icon-selector');
    container.innerHTML = "";
    for (const [cat, icons] of Object.entries(ICON_LIST)) {
        const section = document.createElement('div');
        section.innerHTML = `<p style="font-size:10px; color:var(--text-muted); margin-bottom:8px; font-weight:700;">${cat.toUpperCase()}</p>`;
        const grid = document.createElement('div');
        grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 8px; margin-bottom: 15px;";
        icons.forEach(iconName => {
            const box = document.createElement('div');
            const isSelected = simboloSelecionado === iconName;
            box.style.cssText = `cursor: pointer; padding: 10px; border-radius: 6px; text-align: center; background: ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; transition: 0.2s;`;
            box.innerHTML = `<i class="fa-solid fa-${iconName}" style="font-size: 16px; color: ${isSelected ? 'white' : 'var(--text-muted)'};"></i>`;
            box.onclick = () => { simboloSelecionado = iconName; renderizarIconesSeletor(); };
            grid.appendChild(box);
        });
        section.appendChild(grid);
        container.appendChild(section);
    }
}

/**
 * Procura em todas as notas do utilizador (Local e Share) por vínculos
 * a este tema e atualiza o nome exibido nas pills (Picards).
 */
async function sincronizarNomeCosmosEmCascata(temaIdInterno, novoNome) {
    console.log(`🔄 [CASCATA] A iniciar sincronização global para o tema ID: ${temaIdInterno}`);
    const uid = authRef.currentUser.uid;
    const colecoes = ["Local", "Share"];

    for (const col of colecoes) {
        try {
            // Procurar todas as notas que possam conter o tema
            const q = query(collection(dbRef, col), where("userId", "==", uid));
            const snap = await getDocs(q);

            for (const docNota of snap.docs) {
                const dadosNota = docNota.data();
                let houveAlteracao = false;

                if (dadosNota.caixas) {
                    // Percorrer todas as caixas da nota
                    const novasCaixas = dadosNota.caixas.map(caixa => {
                        if (caixa.neuroniosCosmos) {
                            // Se a caixa tem o tema, atualiza o nome
                            caixa.neuroniosCosmos = caixa.neuroniosCosmos.map(vinc => {
                                if (vinc.id === temaIdInterno) {
                                    if (vinc.nome !== novoNome) {
                                        console.log(`✅ [CASCATA] Nome atualizado na nota: ${dadosNota.nome}`);
                                        houveAlteracao = true;
                                        return { ...vinc, nome: novoNome };
                                    }
                                }
                                return vinc;
                            });
                        }
                        return caixa;
                    });

                    // Se mudámos algo, gravamos a nota no Firebase
                    if (houveAlteracao) {
                        await updateDoc(doc(dbRef, col, docNota.id), { caixas: novasCaixas });
                    }
                }
            }
        } catch (e) {
            console.error(`❌ [CASCATA] Erro na coleção ${col}:`, e);
        }
    }
    console.log("🏁 [CASCATA] Sincronização concluída.");
}

/**
 * PROMISE: Abre o popup de confirmação e aguarda a escolha do utilizador
 */
function perguntarConfirmacaoOcultar() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-ocultar-cosmos');
        const btnSim = document.getElementById('btn-confirmar-ocultar-cosmos-final');
        const btnNao = document.getElementById('btn-cancelar-ocultar-cosmos');

        if (!overlay) return resolve(false);

        overlay.classList.add('active');

        // Função para limpar eventos e fechar
        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

function renderizarListaFiltrada() {
    const listDiv = document.getElementById('cosmos-items-list');
    if (!listDiv) return;

    listDiv.innerHTML = "";
    const grupos = {};

    // 1. FILTRAGEM NA MEMÓRIA (INSTANTÂNEA)
    const itensFiltrados = cacheTemasCosmos.filter(item => {
        if (!filtroPesquisa) return true;
        const busca = filtroPesquisa.toLowerCase();
        return item.nome.toLowerCase().includes(busca) || 
               (item.categoria && item.categoria.toLowerCase().includes(busca));
    });

    // 2. AGRUPAMENTO POR CATEGORIAS
    itensFiltrados.forEach(item => {
        const cat = item.categoria || "SEM CATEGORIA";
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(item);
    });

    // 3. CONSTRUÇÃO DO HTML
    const nomesCategorias = Object.keys(grupos).sort((a, b) => {
        if (a === "SEM CATEGORIA") return 1;
        if (b === "SEM CATEGORIA") return -1;
        return a.localeCompare(b);
    });

    nomesCategorias.forEach(catNome => {
        const seccao = document.createElement('div');
        seccao.style.marginBottom = "15px";
        seccao.innerHTML = `<p style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; margin-bottom: 8px; padding-left: 5px; opacity: 0.7;">${catNome}</p>`;
        
        const containerItens = document.createElement('div');
        containerItens.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

        grupos[catNome].forEach(itemData => {
            const isAtivo = itemData.id === temaSelecionadoId;
            const item = document.createElement('div');
            item.className = `menu-item-list ${isAtivo ? 'active' : ''}`;
            
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; overflow: hidden; pointer-events: none; flex: 1;">
                    <i class="fa-solid fa-${itemData.simbolo}" style="color: ${isAtivo ? 'white' : 'var(--text-main)'}; font-size: 14px; width: 20px; text-align: center;"></i>
                    <span style="font-size: 13.5px; font-weight: ${isAtivo ? '700' : '500'}; color: ${isAtivo ? 'white' : 'inherit'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${itemData.nome}
                    </span>
                </div>
                ${modoEdicaoAtivo ? `<i class="fa-solid fa-pen-to-square btn-edit-trigger" style="font-size: 12px; color: var(--primary); cursor: pointer; padding: 5px;"></i>` : ''}
            `;

            item.onclick = async (e) => {
                if (e.target.classList.contains('btn-edit-trigger')) {
                    abrirPopupEdicao(itemData.docIdFirebase, itemData);
                } else {
                    temaSelecionadoId = itemData.id;
                    renderizarListaFiltrada(); // Destaque visual imediato
                    if (typeof window.ensureOfficeRightPanel === 'function') await window.ensureOfficeRightPanel();
                    abrirTemaNoBrain(itemData, dbRef, authRef);
                }
            };

            containerItens.appendChild(item);
        });

        seccao.appendChild(containerItens);
        listDiv.appendChild(seccao);
    });

    // Estado Vazio
    if (itensFiltrados.length === 0) {
        listDiv.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:40px; opacity:0.5;">Nenhum tema encontrado para "${filtroPesquisa}".</p>`;
    }
}

/**
 * DELEGAÇÃO DE EVENTOS GLOBAL PARA O COSMOS
 * Resolve o problema dos botões que param de funcionar após o "Back" da Bridge
 */
document.addEventListener('click', (e) => {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // 1. Botão "<- COSMOS" (Voltar ao menu principal de Lists)
    if (e.target.closest('#btn-cosmos-voltar')) {
        console.log("🔙 [NAV] Voltando ao menu principal de Lists");
        if (typeof window.renderizarMenuPrincipalLists === 'function') {
            window.renderizarMenuPrincipalLists();
            window.htmlListaAntiga = null; // Limpa a memória
        }
    }

    // 2. Botão Pesquisar (Lupa)
    if (e.target.closest('#btn-search-cosmos')) {
        const input = document.getElementById('input-search-cosmos');
        const searchBar = document.getElementById('search-bar-container');
        if (searchBar) {
            const isHidden = searchBar.style.display === 'none';
            searchBar.style.display = isHidden ? 'block' : 'none';
            if (isHidden && input) input.focus();
        }
    }

    // 3. Botão Modo Edição (Lápis)
    if (e.target.closest('#btn-edit-mode-cosmos')) {
        // Como esta lógica altera variáveis internas, o ideal é chamar a função de re-render
        // mas para garantir que o clique funciona:
        renderizarNavegacaoCosmos(); 
    }

    // 4. Botão Adicionar Tema (+)
    if (e.target.closest('#btn-add-cosmos-tema')) {
        // Chama a função global que já existe no teu ficheiro
        if (typeof abrirPopupNovoTema === 'function') {
            abrirPopupNovoTema();
        }
    }
});
