// components/direita/cosmos-fontes.js
import { 
    doc, updateDoc, getDoc, onSnapshot, collection, 
    query, where, getDocs, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { abrirPesquisaCodex } from '../editor/modulos/codex-browser.js';
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';

let currentTema = null;
let currentDb = null;
let currentAuth = null;
let urlsTemp = [""];
let unsubFontes = null;
let linkSendoEditado = null;
let currentRef = null; // Referência ao documento do Versículo em TextosBiblia
let currentUid = null;

export function limparFontesBiblia() {
    if (unsubFontes) { unsubFontes(); unsubFontes = null; }
}

/**
 * FUNÇÃO DE LIMPEZA DO LISTENER
 */
export function limparFontes() { 
    if (unsubFontes) {
        unsubFontes(); 
        unsubFontes = null; 
    } 
}


/**
 * RENDERIZAÇÃO DA ABA LINKS (BÍBLIA)
 */
export async function renderizarFontesBiblia(info, container, db, auth) {
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    currentUid = auth.currentUser.uid;
    limparFontesBiblia();

    const q = query(collection(db, "TextosBiblia"), where("userId", "==", currentUid), where("nome", "==", nomeCompleto));
    const snapInit = await getDocs(q);
    
    if (snapInit.empty) {
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Sem fontes vinculadas.</p>`;
        return;
    }

    currentRef = doc(db, "TextosBiblia", snapInit.docs[0].id);

    unsubFontes = onSnapshot(currentRef, async (docSnap) => {
        if (!docSnap.exists()) return;
        
        const dadosVersiculo = docSnap.data();
        const fontesInternas = dadosVersiculo.Fontes?.codex || [];
        const estudosVinculadosIds = dadosVersiculo.Biblioteca || []; // IDs de estudos de livros/revistas

        container.innerHTML = "";
        
        // --- 1. RENDERIZAR FONTES INTERNAS (Codex criado no próprio versículo) ---
        fontesInternas.filter(f => f.estado === "ativo").forEach(item => {
            container.appendChild(criarCardCodexBiblia(item, "Fontes.codex", db));
        });

        // --- 2. RENDERIZAR ESTUDOS VINCULADOS (Vêm de Lists > Livros) ---
        if (estudosVinculadosIds.length > 0) {
            // Label separadora
            const label = document.createElement('div');
            label.style.cssText = "font-size:9px; color:var(--primary); font-weight:800; margin:15px 0 8px 0; text-transform:uppercase; opacity:0.7; letter-spacing:1px;";
            label.innerHTML = `<i class="fa-solid fa-link-slash"></i> Referenciado em Estudos`;
            container.appendChild(label);

            for (const studyId of estudosVinculadosIds) {
                // Vamos buscar o dado real à coleção Biblioteca
                const studySnap = await getDoc(doc(db, "Biblioteca", studyId));
                if (studySnap.exists()) {
                    const studyData = studySnap.data();
                    // Criamos o card com uma regra de remoção diferente
                    container.appendChild(criarCardCodexBiblia({ ...studyData, id: studyId }, "Biblioteca", db));
                }
            }
        }
        
        if (container.innerHTML === "") {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; font-size:11px;">Nenhum mapeamento encontrado.</p>`;
        }
    });
}



function criarCardCodexBiblia(item, deOnde, db) {
    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.marginBottom = "10px";

    // 1. Usar o SharedUI para manter o design padrão
    div.innerHTML = SharedUI.renderCodexCard(item, "");

    // 2. Customizar Botões de Ação
    const btnGroup = div.querySelector('.codex-card-v2 > div[style*="position: absolute"]');
    if (btnGroup) {
        btnGroup.innerHTML = ""; // Limpa os botões do SharedUI (Lápis/Estrela)

        // Botão de Remover
        const btnDel = document.createElement('i');
        btnDel.className = "fa-solid fa-trash-can";
        btnDel.style.cssText = "color:#f87171; cursor:pointer; font-size:13px; opacity:0.6;";
        
        btnDel.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Remover este vínculo do versículo? (O estudo original não será apagado)")) {
                
                if (deOnde === "Biblioteca") {
                    // REGRA SOLICITADA: Apenas remove o ID do array 'Biblioteca' no documento do versículo
                    await updateDoc(currentRef, {
                        Biblioteca: arrayRemove(item.id)
                    });
                    console.log("🗑️ Vínculo de estudo removido.");
                } else {
                    // REGRA PADRÃO: Soft-delete no codex interno
                    const snap = await getDoc(currentRef);
                    const novaLista = snap.data().Fontes.codex.map(c => 
                        c.id === item.id ? { ...c, estado: "desativo" } : c
                    );
                    await updateDoc(currentRef, { "Fontes.codex": novaLista });
                }
            }
        };
        btnGroup.appendChild(btnDel);
    }
    return div;
}





/**
 * RENDERIZAÇÃO PRINCIPAL DAS FONTES NO PAINEL BRAIN
 */
export async function renderizarFontes(tema, container, db, auth) {
    currentTema = tema; currentDb = db; currentAuth = auth;
    const temaRef = doc(db, "Cosmo", tema.docIdFirebase);

    if(unsubFontes) unsubFontes();

    unsubFontes = onSnapshot(temaRef, (docSnap) => {
        if (!docSnap.exists()) return;
        
        // Registrar no Registry Global para o Salto (Bridge) funcionar
        if (!window.__codexGlobalRegistry) window.__codexGlobalRegistry = {};

        const dados = docSnap.data();
        const fontes = dados.Fontes || { Links: [], codex: [] };
        
        container.innerHTML = "";

        // 1. RENDERIZAR LINKS (ORDENADOS POR FAVORITOS)
        const linksOrdenados = (fontes.Links || [])
            .filter(l => l.estado === "ativo")
            .sort((a, b) => (b.favorito === 'sim' ? 1 : 0) - (a.favorito === 'sim' ? 1 : 0));

        linksOrdenados.forEach(link => {
            container.appendChild(criarCardLinkCosmos(link, temaRef, fontes.Links));
        });

        // 2. RENDERIZAR CODEX (ORDENADOS POR FAVORITOS)
        const codexOrdenados = (fontes.codex || [])
            .filter(c => c.estado === "ativo")
            .sort((a, b) => (b.favorito === 'sim' ? 1 : 0) - (a.favorito === 'sim' ? 1 : 0));

        codexOrdenados.forEach(item => {
            window.__codexGlobalRegistry[item.id] = item; // Para o Bridge
            container.appendChild(criarCardCodexCosmos(item, temaRef, fontes.codex));
        });

        if(container.innerHTML === "") {
            container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:12px; opacity:0.5;">Nenhuma fonte associada.</p>`;
        }
    });
}

/**
 * FABRICA DE CARDS: HIPERLIGAÇÕES
 */
function criarCardLinkCosmos(link, ref, listaOriginal) {
    const div = document.createElement('div');
    const isFav = link.favorito === "sim";
    
    div.style.cssText = `background: rgba(255,255,255,0.03); border: 1px solid ${isFav ? '#fbbf24' : 'var(--border-color)'}; border-radius: 8px; padding: 12px; margin-bottom: 10px; position:relative; transition: 0.2s;`;
    
    div.innerHTML = `
        <div style="position:absolute; top:8px; right:8px; display:flex; gap:12px; color:var(--text-muted); font-size:14px; align-items:center;">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star btn-fav" style="cursor:pointer; color: ${isFav ? '#fbbf24' : 'inherit'};"></i>
            <i class="fa-solid fa-pen-to-square btn-edit" style="cursor:pointer; opacity:0.7; font-size:12px;"></i>
            <i class="fa-solid fa-trash btn-del" style="cursor:pointer; color:#f87171; opacity:0.7; font-size:12px;"></i>
        </div>
        <p style="font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase; margin-bottom:8px; padding-right:65px;">${link.titulo}</p>
        <div style="display:flex; flex-direction:column; gap:5px;">
            ${link.hiperlinks.map(url => `<a href="${url}" target="_blank" style="color:white; font-size:12px; text-decoration:none; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${url}</a>`).join('')}
        </div>
    `;

    // Toggle Favorito
    div.querySelector('.btn-fav').onclick = async () => {
        const novaLista = listaOriginal.map(l => l.timestamp === link.timestamp ? { ...l, favorito: isFav ? "nao" : "sim" } : l);
        await updateDoc(ref, { "Fontes.Links": novaLista });
    };

    // Editar
    div.querySelector('.btn-edit').onclick = () => abrirPopupFontes(link);

    // Ocultar (Popup)
    div.querySelector('.btn-del').onclick = async () => {
    const confirmou = await confirmarFonteAcao("Ocultar Link?", "Deseja mover este link para a reciclagem?");
    if(confirmou) {
        const timestamp = new Date().toISOString();
        const novaLista = listaOriginal.map(l => 
            l.timestamp === link.timestamp 
            ? {...l, estado: "desativo", timedelete: timestamp} // 🚀 Adiciona timedelete
            : l
        );
        await updateDoc(ref, { "Fontes.Links": novaLista });
    }
};
    return div;
}

/**
 * FABRICA DE CARDS: CODEX
 */
function criarCardCodexCosmos(item, ref, listaOriginal) {
    const div = document.createElement('div');
    const isFav = item.favorito === "sim";
    div.style.cssText = `position:relative; margin-bottom:10px;`;
    
    // 1. Gerar o HTML base do SharedUI
    div.innerHTML = SharedUI.renderCodexCard(item, ""); 

    // 2. REMOVER OS BOTÕES PADRÃO (Estrela e Lápis) que o SharedUI injeta automaticamente
    // Procuramos o container de botões que tem posição absoluta e removemo-lo
    const botoesPadrao = div.querySelector('.codex-card-v2 > div[style*="position: absolute"]');
    if (botoesPadrao) botoesPadrao.remove();

    // 3. CRIAR OS NOSSOS PRÓPRIOS BOTÕES (Estrela e Lixeira)
    const actions = document.createElement('div');
    actions.style.cssText = "position:absolute; top:12px; right:12px; display:flex; gap:12px; color:var(--text-muted); z-index:10; font-size:14px; align-items:center;";
    actions.innerHTML = `
        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star btn-fav" 
           style="cursor:pointer; color: ${isFav ? '#fbbf24' : 'inherit'};" 
           title="Favoritar"></i>
        <i class="fa-solid fa-trash-can btn-del" 
           style="color:#f87171; cursor:pointer; font-size:12px;" 
           title="Remover"></i>
    `;
    
    // Evento: Toggle Favorito Codex
    actions.querySelector('.btn-fav').onclick = async (e) => {
        e.stopPropagation();
        const novaLista = listaOriginal.map(c => {
            if (c.id === item.id) {
                return { ...c, favorito: item.favorito === "sim" ? "nao" : "sim" };
            }
            return c;
        });
        await updateDoc(ref, { "Fontes.codex": novaLista });
    };

    // Evento: Remover Codex (Popup + Limpeza Biblioteca)
   actions.querySelector('.btn-del').onclick = async (e) => {
    e.stopPropagation();
    const confirmou = await confirmarFonteAcao("Remover Codex?", "Mover este mapeamento para a reciclagem?");
    if(confirmou) {
        const timestamp = new Date().toISOString();
        const novaLista = listaOriginal.map(c => 
            c.id === item.id 
            ? {...c, estado: "desativo", timedelete: timestamp} // 🚀 Adiciona timedelete
            : c
        );
        await updateDoc(ref, { "Fontes.codex": novaLista });
        // Mantém a limpeza da biblioteca global
        await limparVincúloBibliotecaGlobal(item.id, item.referencia);
    }
};

    div.appendChild(actions);
    return div;
}

/**
 * LOGICA DO POPUP ADICIONAR/EDITAR
 */
export function abrirPopupFontes(dadosEdicao = null) {
    const overlay = document.getElementById('popup-cosmos-fontes-overlay');
    if(!overlay) return;

    linkSendoEditado = dadosEdicao;
    overlay.classList.add('active');

    const inputTitulo = document.getElementById('f-link-titulo');
    const btnGravar = document.getElementById('btn-gravar-f-cosmos');
    const tabCodex = overlay.querySelector('[data-target="tab-f-codex"]');
    
    if (dadosEdicao) {
        inputTitulo.value = dadosEdicao.titulo;
        urlsTemp = [...dadosEdicao.hiperlinks];
        btnGravar.innerText = "Atualizar Fonte";
        document.getElementById('titulo-fontes-cosmos').innerText = "Editar Fonte";
        if (tabCodex) tabCodex.style.display = 'none';
    } else {
        inputTitulo.value = "";
        urlsTemp = [""];
        btnGravar.innerText = "Gravar Fonte";
        document.getElementById('titulo-fontes-cosmos').innerText = "Adicionar Fontes";
        if (tabCodex) tabCodex.style.display = 'inline-flex';
    }
    
    overlay.querySelector('[data-target="tab-f-links"]').click();

    const tabs = overlay.querySelectorAll('.tab-f-cosmos');
    tabs.forEach(t => {
        t.onclick = () => {
            const target = t.dataset.target;
            if (target === 'tab-f-codex') { abrirCodex(); return; }
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            overlay.querySelectorAll('.tab-f-content').forEach(c => c.style.display = 'none');
            document.getElementById(target).style.display = 'block';
        };
    });

    renderizarInputsUrls();
    document.getElementById('btn-mais-url').onclick = () => { urlsTemp.push(""); renderizarInputsUrls(); };
    document.getElementById('btn-fechar-fontes-cosmos').onclick = () => overlay.classList.remove('active');
    document.getElementById('btn-cancelar-f-cosmos').onclick = () => overlay.classList.remove('active');
    btnGravar.onclick = gravarLinks;
}

function renderizarInputsUrls() {
    const cont = document.getElementById('container-inputs-urls');
    cont.innerHTML = urlsTemp.map((val, i) => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <input type="text" class="input-url-f" data-idx="${i}" value="${val}" placeholder="https://..." 
                   style="flex:1; padding:10px; background:var(--bg-panel); border:1px solid var(--border-color); color:white; border-radius:6px;">
            ${urlsTemp.length > 1 ? `<i class="fa-solid fa-xmark btn-remove-url" data-idx="${i}" style="color:#f87171; cursor:pointer;"></i>` : ''}
        </div>`).join('');
    
    cont.querySelectorAll('.input-url-f').forEach(input => {
        input.oninput = (e) => { urlsTemp[e.target.dataset.idx] = e.target.value; };
    });
    cont.querySelectorAll('.btn-remove-url').forEach(btn => {
        btn.onclick = (e) => { urlsTemp.splice(btn.dataset.idx, 1); renderizarInputsUrls(); };
    });
}

async function gravarLinks() {
    const titulo = document.getElementById('f-link-titulo').value.trim();
    const urls = urlsTemp.filter(v => v.trim() !== "");
    if(!titulo || urls.length === 0) return alert("Preencha título e pelo menos um link.");

    if (!currentAuth) currentAuth = getAuth();
    if (!currentDb) currentDb = getFirestore();

    const colecaoReal = window.colecaoAlvoFontes || "Cosmo";
    const idReal = window.idAlvoFontes || (currentTema ? currentTema.docIdFirebase : null);

    const docRef = doc(currentDb, colecaoReal, idReal);
    
    try {
        const snap = await getDoc(docRef);
        let listaLinks = snap.data().Fontes?.Links || [];

        if (linkSendoEditado) {
            listaLinks = listaLinks.map(l => l.timestamp === linkSendoEditado.timestamp ? { ...l, titulo, hiperlinks: urls } : l);
        } else {
            listaLinks.push({ 
                timestamp: new Date().toISOString(), 
                titulo, 
                hiperlinks: urls, 
                estado: "ativo", 
                favorito: "nao" 
            });
        }

        await updateDoc(docRef, { "Fontes.Links": listaLinks });
        document.getElementById('popup-cosmos-fontes-overlay').classList.remove('active');
        
        window.colecaoAlvoFontes = null;
        window.idAlvoFontes = null;
    } catch (e) {
        console.error("❌ [LINKS] Erro ao gravar:", e);
    }
}

/**
 * EXPLORADOR CODEX E SINCRONIZAÇÃO BIBLIOTECA
 */
async function abrirCodex() {
    document.getElementById('popup-cosmos-fontes-overlay').classList.remove('active');
    
    // --- SOLUÇÃO: Se as variáveis internas forem null, vamos buscá-las ao Firebase agora ---
    if (!currentAuth) currentAuth = getAuth();
    if (!currentDb) currentDb = getFirestore();

    const colecaoReal = window.colecaoAlvoFontes || "Cosmo";
    const idReal = window.idAlvoFontes || (currentTema ? currentTema.docIdFirebase : null);

    if (!currentAuth.currentUser) {
        return console.error("❌ [FONTES] Erro: Utilizador não autenticado.");
    }

    abrirPesquisaCodex(async (dadosReferencia) => {
        if (!dadosReferencia) return;

        import('../editor/modulos/tags/tags-handlers-codex.js').then(async (mHandler) => {
            
            // Passamos o UID de forma segura
            const novosItens = mHandler.prepararGrupoSemantico(dadosReferencia, { 
                uid: currentAuth.currentUser.uid 
            });

            if (novosItens.length === 0) return;

            const docRef = doc(currentDb, colecaoReal, idReal);
            
            try {
                await updateDoc(docRef, { 
                    "Fontes.codex": arrayUnion(...novosItens) 
                });

                // Chamar a sincronização global (usando as instâncias locais do ficheiro)
                for (const item of novosItens) {
                    await sincronizarComBibliotecaGlobal(item);
                }
                console.log("✅ [CODEX] Mapeamento gravado na coleção:", colecaoReal);
            } catch (e) {
                console.error("❌ [CODEX] Erro ao gravar:", e);
            }
        });
    });
}

async function sincronizarComBibliotecaGlobal(card) {
    const uid = currentAuth.currentUser.uid;
    const bibRef = collection(currentDb, "Biblioteca");

    // Mudança: Iterar sobre o array 'sequencia' em vez de 'paragrafos'
    for (const seq of card.sequencia) {
        const pLimp = parseInt(seq);
        const q = query(bibRef, 
            where("userId", "==", uid), 
            where("referencia", "==", card.referencia), 
            where("oque", "==", card.oque), // Adicionado Oque
            where("sequencia", "==", pLimp) // Adicionado Sequencia
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
            // JÁ EXISTE: Adiciona este Tema Cosmos à lista
            await updateDoc(snap.docs[0].ref, { 
                cosmo: arrayUnion(card.id), 
                timestampUpdate: serverTimestamp() 
            });
        } else {
            // NOVO: Cria o índice completo
            await addDoc(bibRef, { 
                ...card, 
                sequencia: pLimp, 
                cosmo: [card.id], 
                timestamp: serverTimestamp() 
            });
        }
    }
}

async function limparVincúloBibliotecaGlobal(idCodex, referencia) {
    const uid = currentAuth.currentUser.uid;
    const q = query(collection(currentDb, "Biblioteca"), where("userId", "==", uid), where("referencia", "==", referencia), where("cosmo", "array-contains", idCodex));
    const snap = await getDocs(q);
    const promessas = snap.docs.map(d => updateDoc(d.ref, { cosmo: arrayRemove(idCodex), timestampUpdate: serverTimestamp() }));
    await Promise.all(promessas);
}

/**
 * AUXILIAR: POPUP PERSONALIZADO
 */
function confirmarFonteAcao(titulo, mensagem, textoBotao = "Confirmar") {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-rem-fonte-overlay');
        document.getElementById('rem-fonte-titulo').innerText = titulo;
        document.getElementById('rem-fonte-msg').innerText = mensagem;
        const btnSim = document.getElementById('btn-confirmar-rem-fonte');
        btnSim.innerText = textoBotao;
        overlay.classList.add('active');
        const fechar = (r) => { overlay.classList.remove('active'); btnSim.onclick = null; resolve(r); };
        btnSim.onclick = () => fechar(true);
        document.getElementById('btn-cancelar-rem-fonte').onclick = () => fechar(false);
    });
}