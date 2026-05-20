// components/editor/modulos/browser.js
import { 
    doc, getDoc, updateDoc, arrayUnion, arrayRemove, 
    collection, query, where, getDocs, or, and 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor.js';

let dbRef = null;
let authRef = null;
let notaMaeIdLocal = null;
let notaAtivaIdGlobal = null;
let abaBrowserAtiva = "Local";

/**
 * INICIALIZADOR: Configura as credenciais
 */
export function iniciarSistemaBrowser(db, auth) {
    dbRef = db; 
    authRef = auth;
    
    // Configurar o botão X do popup
    const btnFechar = document.getElementById('btn-fechar-browser');
    if (btnFechar) {
        btnFechar.onclick = () => document.getElementById('popup-browser-overlay').classList.remove('active');
    }

    // Configurar as abas Local/Share dentro do popup
    document.querySelectorAll('.tab-browser').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-browser').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            abaBrowserAtiva = btn.dataset.origem;
            carregarNotasParaBrowser();
        };
    });
}

/**
 * ABRIR POPUP (Chamada pelo Event Manager)
 */
export function abrirPopupEscolha() {
    const overlay = document.getElementById('popup-browser-overlay');
    if (!overlay) return console.error("❌ Overlay do Browser não encontrado.");

    overlay.classList.add('active');
    
    // Reset para a aba Local ao abrir
    abaBrowserAtiva = "Local";
    document.querySelectorAll('.tab-browser').forEach(b => {
        b.classList.toggle('active', b.dataset.origem === "Local");
    });

    carregarNotasParaBrowser();
}

/**
 * CARREGAR NOTAS DO FIREBASE
 */
async function carregarNotasParaBrowser() {
    const container = document.getElementById('arvore-browser');
    const db = dbRef || window.db;
    const auth = authRef || window.auth;

    if (!container || !db || !auth.currentUser) return;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    try {
        const uid = auth.currentUser.uid;
        let q;

        if (abaBrowserAtiva === "Local") {
            q = query(collection(db, "Local"), where("userId", "==", uid), where("tipo", "==", "nota"), where("estado", "==", "on"));
        } else {
            q = query(collection(db, "Share"), and(where("estado", "==", "on"), where("tipo", "==", "nota"), or(where("userId", "==", uid), where("aprovado", "array-contains", uid))));
        }

        const snap = await getDocs(q);
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:20px; font-size:12px;">Nenhuma nota encontrada.</p>`;
            return;
        }

        snap.forEach(docSnap => {
            // Não mostrar a própria nota que já está aberta na aba mãe
            if (docSnap.id === notaMaeIdLocal) return;

            const div = document.createElement('div');
            div.className = "menu-item-list";
            div.style.cssText = "margin-bottom: 4px; background: rgba(255,255,255,0.02);";
            div.innerHTML = `<i class="fa-solid fa-file-lines" style="color:${abaBrowserAtiva==='Local'?'#6366f1':'#ef4444'}; margin-right:12px;"></i><span>${docSnap.data().nome}</span>`;
            
            div.onclick = async () => {
                // Adicionar a nota selecionada ao sistema de abas da nota atual
                const resMae = await buscarNotaHibrida(notaMaeIdLocal);
                const colecaoMae = resMae?.colecao || "Local";
                
                await updateDoc(doc(db, colecaoMae, notaMaeIdLocal), { 
                    browser: arrayUnion({ id: docSnap.id, onde: abaBrowserAtiva.toLowerCase() }) 
                });

                document.getElementById('popup-browser-overlay').classList.remove('active');
                // Abre a nota e recarrega as abas
                abrirNotaNoEditor(docSnap.id, docSnap.data(), db, auth, null, notaMaeIdLocal);
            };
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px; font-size:10px;">Erro ao carregar lista.</p>`;
    }
} 

// Auxiliar para as abas do editor (não o popup)
export async function carregarAbasDaNota(maeId, dadosNota, notaAtivaId) {
    notaMaeIdLocal = maeId;
    notaAtivaIdGlobal = notaAtivaId;
    const container = document.getElementById('editor-tabs-list');
    if (!container) return;
    container.innerHTML = `<div id="tab-spinner" style="display:flex; align-items:center; padding:0 15px; color:var(--primary);"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:14px;"></i></div>`;
    
    const resMae = await buscarNotaHibrida(maeId);
    if (!resMae) { container.innerHTML = ""; return; }
    
    const listaAbas = resMae.dados.browser || [];
    const fragmento = document.createDocumentFragment();
    fragmento.appendChild(criarElementoAba(maeId, resMae.dados.nome, true, false, resMae.dados.onde || "local", (maeId === notaAtivaId)));
    
    const promessas = listaAbas.map(async (item) => {
        const idAba = (typeof item === 'string') ? item : item.id;
        const res = await buscarNotaHibrida(idAba);
        return res ? { id: idAba, data: res.dados, onde: res.dados.onde || "local" } : null;
    });

    const resultados = await Promise.all(promessas);
    resultados.forEach(item => { if (item) fragmento.appendChild(criarElementoAba(item.id, item.data.nome, false, true, item.onde, (item.id === notaAtivaId))); });
    container.innerHTML = "";
    container.appendChild(fragmento);
}

function criarElementoAba(id, nome, isMae, canClose, onde, isActive) {
    const aba = document.createElement('div');
    const corDestaque = (onde === "share") ? "#ef4444" : "#6366f1";
    aba.style.cssText = `padding: 6px 15px; background: rgba(255,255,255,0.08); border-radius: 4px; font-size: 12px; color: ${isActive ? '#fff' : '#94a3b8'}; cursor: pointer; display: flex; align-items: center; gap: 10px; border-top: 2px solid ${isActive ? corDestaque : 'transparent'}; white-space: nowrap; margin-right: 4px;`;
    aba.innerHTML = `<span style="${isActive ? 'font-weight:700;' : 'font-weight:400;'}">${nome}</span>`;
    if (canClose) {
        const btnX = document.createElement('i'); btnX.className = "fa-solid fa-xmark"; btnX.style.cssText = "font-size: 10px; opacity: 0.4;";
        btnX.onclick = (e) => { e.stopPropagation(); fecharAba(id, onde); };
        aba.appendChild(btnX);
    }
    aba.onclick = () => { if (id !== notaAtivaIdGlobal) { buscarNotaHibrida(id).then(res => { if (res) abrirNotaNoEditor(id, res.dados, dbRef || window.db, authRef || window.auth, null, notaMaeIdLocal); }); } };
    return aba;
}

async function fecharAba(idAlvo, ondeAba) {
    const db = dbRef || window.db;
    const resMae = await buscarNotaHibrida(notaMaeIdLocal);
    if (!resMae || !db) return;
    await updateDoc(doc(db, resMae.colecao, notaMaeIdLocal), { browser: arrayRemove({ id: idAlvo, onde: ondeAba }) });
    if (idAlvo === notaAtivaIdGlobal) { buscarNotaHibrida(notaMaeIdLocal).then(r => abrirNotaNoEditor(notaMaeIdLocal, r.dados, db, authRef || window.auth, null, null)); }
    else { buscarNotaHibrida(notaMaeIdLocal).then(r => carregarAbasDaNota(notaMaeIdLocal, r.dados, notaAtivaIdGlobal)); }
}

async function buscarNotaHibrida(id) {
    const db = dbRef || window.db;
    try {
        const sLocal = await getDoc(doc(db, "Local", id));
        if (sLocal.exists()) return { dados: sLocal.data(), colecao: "Local" };
        const sShare = await getDoc(doc(db, "Share", id));
        if (sShare.exists()) return { dados: sShare.data(), colecao: "Share" };
    } catch (e) {}
    return null;
}

