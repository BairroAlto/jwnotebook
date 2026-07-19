// components/topico-brain/topico-manager.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { abrirReferenciaDireta } from '../lists/bridge-main.js';

// Importação dos Handlers Modulares
import { HandlerLinks } from './topico-fontes-links.js';
import { HandlerCodex } from './topico-fontes-codex.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Estado local do subtópico ativo para este módulo
let subtopicoAtual = null;
let abaInternaFontes = "links"; // "links" ou "codex"
let subAbaCitaAtiva = "caixas"; // "caixas" ou "notas"

/**
 * 1. INICIALIZAÇÃO (Chamado ao clicar no subtópico na lista lateral esquerda)
 */
export async function prepararSubtopicoNoBrain(subtopico) {
    console.log("🧠 [BRAIN-MANAGER] A preparar subtópico:", subtopico.nome);

    // Normalização do ID do Firebase
    if (!subtopico.docIdFirebase && subtopico.docId) {
        subtopico.docIdFirebase = subtopico.docId;
    }
    
    subtopicoAtual = subtopico;
    
    // Abrir o painel BRAIN na direita
    if (window.switchPanel) window.switchPanel('brain');

    // Configurar as abas que devem estar visíveis no BRAIN para Tópicos
    const abas = ["btn-brain-puzzle", "btn-brain-dossie", "btn-brain-fontes", "btn-brain-cita"];
    abas.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            // Apenas mostramos Fontes e Cita neste modo
            el.style.display = (id === "btn-brain-fontes" || id === "btn-brain-cita") ? "flex" : "none";
            el.classList.remove('active');
        }
    });

    // Ativar a aba "Cita" por defeito ao abrir
    const btnCita = document.getElementById('btn-brain-cita');
    if (btnCita) btnCita.classList.add('active');
    
    window.trocarAbaSubtopico('cita');
}

/**
 * 2. NAVEGAÇÃO DE ABAS PRINCIPAIS (Fontes vs Cita)
 */
window.trocarAbaSubtopico = (tipo) => {
    const container = document.getElementById('brain-resultado-pesquisa');
    if (!container) return;

    document.getElementById('btn-brain-fontes').classList.toggle('active', tipo === 'fontes');
    document.getElementById('btn-brain-cita').classList.toggle('active', tipo === 'cita');

    if (tipo === 'cita') renderizarAbaCita(container);
    else renderizarAbaFontes(container);
};

/**
 * 3. ABA FONTES (Utiliza os Handlers Modulares de Links e Codex)
 */
async function renderizarAbaFontes(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; padding: 5px;">
            <!-- Barra de Navegação que serve de Botão de Adição -->
            <div style="display:flex; gap:8px; background: rgba(0,0,0,0.15); padding: 5px; border-radius: 10px;">
                
                <!-- Botão Links -->
                <button id="btn-f-links-brain" class="btn-amt ${abaInternaFontes === 'links' ? 'active' : ''}" 
                        style="flex:1; height: 34px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    ${abaInternaFontes === 'links' ? '<i class="fa-solid fa-plus" style="font-size:10px;"></i> LINK' : 'Links'}
                </button>

                <!-- Botão Codex -->
                <button id="btn-f-codex-brain" class="btn-amt ${abaInternaFontes === 'codex' ? 'active' : ''}" 
                        style="flex:1; height: 34px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    ${abaInternaFontes === 'codex' ? '<i class="fa-solid fa-plus" style="font-size:10px;"></i> CODEX' : 'Codex'}
                </button>

            </div>

            <!-- Lista de Cards (Ocupa o espaço que sobrou) -->
            <div id="sub-fontes-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
    `;

    const btnLinks = document.getElementById('btn-f-links-brain');
    const btnCodex = document.getElementById('btn-f-codex-brain');

    // LÓGICA DO BOTÃO LINKS
    btnLinks.onclick = () => {
        if (abaInternaFontes === "links") {
            // Se já está na aba, funciona como ADICIONAR
            HandlerLinks.adicionar(subtopicoAtual, gravarEAtualizar);
        } else {
            // Se está noutra aba, apenas TROCA
            abaInternaFontes = "links";
            renderizarAbaFontes(container);
        }
    };

    // LÓGICA DO BOTÃO CODEX
    btnCodex.onclick = () => {
        if (abaInternaFontes === "codex") {
            // Se já está na aba, funciona como ADICIONAR
            HandlerCodex.adicionar(subtopicoAtual, gravarEAtualizar);
        } else {
            // Se está noutra aba, apenas TROCA
            abaInternaFontes = "codex";
            renderizarAbaFontes(container);
        }
    };

    // Renderizar a lista correta no contentor
    const listContId = 'sub-fontes-list';
    if (abaInternaFontes === "links") {
        HandlerLinks.render(subtopicoAtual, listContId, gravarEAtualizar);
    } else {
        HandlerCodex.render(subtopicoAtual, listContId, gravarEAtualizar);
    }
}

/**
 * 4. PERSISTÊNCIA NO FIREBASE
 */
async function gravarEAtualizar() {
    if (!subtopicoAtual || !subtopicoAtual.docIdFirebase) return;
    
    try {
        console.log("💾 [BRAIN-MANAGER] Sincronizando com Firebase...");
        await updateDoc(doc(db, "Topico", subtopicoAtual.docIdFirebase), {
            referencias: subtopicoAtual.referencias || [],
            codex: subtopicoAtual.codex || []
        });
        
        // Refrescar a UI do painel BRAIN
        const container = document.getElementById('brain-resultado-pesquisa');
        if (container) renderizarAbaFontes(container);
        
        console.log("✅ [BRAIN-MANAGER] Firebase atualizado.");
    } catch (e) {
        console.error("❌ [BRAIN-MANAGER] Erro ao gravar:", e);
    }
}

/**
 * 5. ABA CITA (Visualização de Caixas e Notas vinculadas)
 */
async function renderizarAbaCita(container) {
    // Garantir que por defeito entramos em caixas se não houver estado anterior
    if (!subAbaCitaAtiva) subAbaCitaAtiva = "caixas";

    container.innerHTML = `
        <div style="display:flex; gap:8px; margin-bottom:15px; padding: 5px;">
            <button id="btn-sub-caixas" class="btn-amt ${subAbaCitaAtiva === 'caixas' ? 'active' : ''}" 
                    style="flex:1; height:34px; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-box-archive"></i> Caixas
            </button>
            <button id="btn-sub-notas" class="btn-amt ${subAbaCitaAtiva === 'notas' ? 'active' : ''}" 
                    style="flex:1; height:34px; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-file-lines"></i> Notas
            </button>
        </div>
        <div id="sub-cita-display" style="display: flex; flex-direction: column; gap: 10px; padding: 0 5px;"></div>
    `;

    const display = document.getElementById('sub-cita-display');

    // --- LÓGICA DE CARREGAMENTO DE CAIXAS ---
    const carregarCaixas = async () => {
        subAbaCitaAtiva = "caixas";
        document.getElementById('btn-sub-caixas').classList.add('active');
        document.getElementById('btn-sub-notas').classList.remove('active');
        display.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.5;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
        
        const ids = subtopicoAtual.caixas || [];
        const favs = subtopicoAtual.caixasfavoritos || [];

        if(ids.length === 0) {
            display.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:11px; padding:40px; opacity:0.6;">Nenhuma caixa vinculada.</p>`;
            return;
        }

        const q = query(collection(db, "Local"), where("userId", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        let caixasEncontradas = [];

        snap.forEach(docNota => {
            const nota = docNota.data();
            if (nota.estado !== "on") return; // 🛡️ Filtro Nota

            (nota.caixas || []).forEach(c => {
                if (c.estado !== "on") return; // 🛡️ Filtro Caixa
                if(ids.includes(c.id)) {
                    caixasEncontradas.push({ ...c, notaNome: nota.nome, notaId: docNota.id });
                }
            });
        });

        // Ordenar: Favoritos primeiro
        caixasEncontradas.sort((a, b) => (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0));

        display.innerHTML = caixasEncontradas.map(c => {
            const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            const isFav = favs.includes(c.id);
            return `
                <div class="indice-card" style="border-left-color:${isFav ? '#fbbf24' : config.cor}; position:relative;">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star" 
                       onclick="event.stopPropagation(); window.toggleFavoritoCita('caixas', '${c.id}')"
                       style="position:absolute; top:12px; right:12px; color:${isFav ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; cursor:pointer; z-index:10; font-size:14px;"></i>
                    
                    <div onclick="window.irParaNotaECaixa('${c.notaId}', '${c.id}')">
                        <div class="label-tipo" style="color:${config.cor}; margin-bottom:8px;">
                            <i class="${config.icon}"></i> ${config.nome}
                        </div>
                        <div class="resumo-texto" style="padding-right:25px; opacity:0.9;">
                            ${c.titulo ? `<b>${c.titulo}</b><br>` : ''}${c.conteudo || 'Sem conteúdo'}
                        </div>
                        <div style="font-size:8px; opacity:0.3; text-align:right; margin-top:8px; font-weight:800; text-transform:uppercase;">
                            <i class="fa-solid fa-file-lines"></i> ${c.notaNome}
                        </div>
                    </div>
                </div>`;
        }).join('') || `<p style="text-align:center; color:gray; font-size:11px; padding:20px;">Conteúdo não disponível.</p>`;
    };

    // --- LÓGICA DE CARREGAMENTO DE NOTAS ---
    const carregarNotas = async () => {
        subAbaCitaAtiva = "notas";
        document.getElementById('btn-sub-notas').classList.add('active');
        document.getElementById('btn-sub-caixas').classList.remove('active');
        display.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.5;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
        
        const ids = [...(subtopicoAtual.notas || [])];
        const favs = subtopicoAtual.notasfavoritos || [];

        if(ids.length === 0) {
            display.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:11px; padding:40px; opacity:0.6;">Nenhuma nota vinculada.</p>`;
            return;
        }

        ids.sort((a, b) => (favs.includes(b) ? 1 : 0) - (favs.includes(a) ? 1 : 0));

        let html = "";
        for(const notaId of ids) {
            const docSnap = await getDoc(doc(db, "Local", notaId));
            if(docSnap.exists()) {
                const d = docSnap.data();
                if (d.estado !== "on") continue; // 🛡️ Filtro Nota

                const isFav = favs.includes(notaId);
                html += `
                <div class="menu-item-list" style="background:rgba(255,255,255,0.03); border:1px solid ${isFav ? '#fbbf24' : 'rgba(255,255,255,0.08)'}; justify-content:space-between; padding:12px 15px;">
                    <div onclick="window.abrirNotaPeloBrain('${docSnap.id}')" style="display:flex; align-items:center; gap:12px; flex:1; overflow:hidden;">
                        <i class="fa-solid fa-file-lines" style="color:var(--primary); font-size:16px;"></i>
                        <span style="font-size:13.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.nome}</span>
                    </div>
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star" 
                       onclick="window.toggleFavoritoCita('notas', '${notaId}')"
                       style="color:${isFav ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; cursor:pointer; padding:5px; font-size:14px;"></i>
                </div>`;
            }
        }
        display.innerHTML = html || `<p style="text-align:center; color:gray; font-size:11px; padding:20px;">Notas ocultas.</p>`;
    };

    // Vincular cliques
    document.getElementById('btn-sub-caixas').onclick = carregarCaixas;
    document.getElementById('btn-sub-notas').onclick = carregarNotas;

    // Inicialização da sub-aba correta
    if (subAbaCitaAtiva === "notas") carregarNotas();
    else carregarCaixas();
}


/**
 * 6. NAVEGAÇÃO GLOBAL
 */

window.toggleFavoritoCita = async (tipo, idAlvo) => {
    if (!subtopicoAtual || !subtopicoAtual.docIdFirebase) return;

    const campoFav = (tipo === 'caixas') ? 'caixasfavoritos' : 'notasfavoritos';
    if (!subtopicoAtual[campoFav]) subtopicoAtual[campoFav] = [];

    const index = subtopicoAtual[campoFav].indexOf(idAlvo);
    if (index > -1) subtopicoAtual[campoFav].splice(index, 1);
    else subtopicoAtual[campoFav].push(idAlvo);

    try {
        await updateDoc(doc(db, "Topico", subtopicoAtual.docIdFirebase), {
            [campoFav]: subtopicoAtual[campoFav]
        });

        // Redesenha a interface
        const container = document.getElementById('brain-resultado-pesquisa');
        
        // O renderizarAbaCita agora vai ler a variável "subAbaCitaAtiva" 
        // e voltará exatamente para onde o utilizador estava.
        renderizarAbaCita(container);
        
    } catch (e) {
        console.error("Erro ao favoritar:", e);
    }
};

window.irParaNotaECaixa = async (notaId, caixaId) => {
    const docSnap = await getDoc(doc(db, "Local", notaId));
    if (docSnap.exists()) {
        if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
            window.abrirNotaNoBook(notaId, { ...docSnap.data(), onde: "local" }, db, auth, caixaId);
        } else {
            abrirNotaNoEditor(notaId, docSnap.data(), db, auth, caixaId);
        }
    }
};

window.abrirNotaPeloBrain = async (notaId) => {
    const docSnap = await getDoc(doc(db, "Local", notaId));
    if (docSnap.exists()) {
        if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
            window.abrirNotaNoBook(notaId, { ...docSnap.data(), onde: "local" }, db, auth);
        } else {
            abrirNotaNoEditor(notaId, docSnap.data(), db, auth);
        }
    }
};

// No final do ficheiro topico-manager.js, adiciona esta função:

/**
 * TOGGLE FAVORITO (ESTRELA)
 */
window.toggleFavoritoFonte = async (tipo, idItem) => {
    if (!subtopicoAtual) return;

    // Localizar o item no array correto
    const arrayAlvo = (tipo === 'links') ? subtopicoAtual.referencias : subtopicoAtual.codex;
    if (!arrayAlvo) return;

    const item = arrayAlvo.find(i => i.id === idItem);

    if (item) {
        // Inverter o estado: se era sim passa a nao, e vice-versa
        item.favorito = (item.favorito === "sim") ? "nao" : "sim";
        
        console.log(`⭐ [BRAIN] Estado favorito de ${idItem}: ${item.favorito}`);
        
        // Grava no Firebase e a função de callback atualizará a lista ordenadamente
        await gravarEAtualizar();
    }
};


window.saltarParaBiblioteca = (idCard) => {
    console.log("🚀 [BRIDGE] Iniciando Salto para o card:", idCard);
    
    // 1. Puxa os dados da RAM (registados no Passo 1)
    const card = window.__codexGlobalRegistry ? window.__codexGlobalRegistry[idCard] : null;

    if (!card) {
        console.error("❌ Erro: Card não encontrado no Registo Global.");
        return;
    }

    // 2. Grava o estado atual da aba Lists para o botão "Voltar"
    const listaLists = document.getElementById('lista-lists');
    if (listaLists) {
        window.htmlListaAntiga = listaLists.innerHTML;
    }

    // 3. Força a abertura da aba LISTS na esquerda
    const btnLists = Array.from(document.querySelectorAll('#left-buttons button'))
                          .find(b => b.innerText.trim().toUpperCase() === 'LISTS');
    if (btnLists) btnLists.click();

    // 4. Puxa os motores existentes (bridge-main.js)
    setTimeout(() => {
        import('../lists/bridge-main.js').then(m => {
            // O bridge-main já sabe se deve chamar Livro ou Publicação
            m.abrirReferenciaDireta(card);
        });
    }, 200); 
};
