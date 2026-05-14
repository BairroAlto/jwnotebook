// components/editor/modulos/browser.js
import { 
    doc, getDoc, updateDoc, arrayUnion, arrayRemove, 
    collection, query, where, getDocs, or, and 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor.js';

let dbRef, authRef;
let notaMaeIdLocal = null;
let notaAtivaIdGlobal = null;
let abaBrowserAtiva = "Local";

export function iniciarSistemaBrowser(db, auth) {
    dbRef = db; authRef = auth;
    const btnFechar = document.getElementById('btn-fechar-browser');
    const btnAbrir = document.getElementById('btn-abrir-browser');
    if (btnFechar) btnFechar.onclick = () => document.getElementById('popup-browser-overlay').classList.remove('active');
    if (btnAbrir) btnAbrir.onclick = () => abrirPopupEscolha();

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
 * FUNÇÃO DE BUSCA PROTEGIDA
 */
async function buscarNotaHibrida(id) {
    try {
        const sLocal = await getDoc(doc(dbRef, "Local", id));
        if (sLocal.exists()) return { dados: sLocal.data(), colecao: "Local" };
    } catch (e) {}
    try {
        const sShare = await getDoc(doc(dbRef, "Share", id));
        if (sShare.exists()) return { dados: sShare.data(), colecao: "Share" };
    } catch (e) {}
    return null;
}

/**
 * RENDERIZAÇÃO OTIMIZADA COM LOADING
 */
export async function carregarAbasDaNota(maeId, dadosNota, notaAtivaId) {
    notaMaeIdLocal = maeId;
    notaAtivaIdGlobal = notaAtivaId;
    const container = document.getElementById('editor-tabs-list');
    if (!container) return;

    // 1. MOSTRAR RODINHA (LOADING) IMEDIATAMENTE
    container.innerHTML = `
        <div id="tab-spinner" style="display: flex; align-items: center; padding: 0 15px; color: var(--primary);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 14px;"></i>
        </div>
    `;

    // 2. BUSCAR DADOS DA MÃE EM BACKGROUND
    const resMae = await buscarNotaHibrida(maeId);
    if (!resMae) return;

    const dadosAbasOwner = resMae.dados;
    const listaAbas = dadosAbasOwner.browser || [];
    
    // Criamos um fragmento para evitar repinturas constantes (flicker)
    const fragmento = document.createDocumentFragment();

    // 3. ADICIONAR ABA MÃE
    fragmento.appendChild(criarElementoAba(
        maeId, 
        dadosAbasOwner.nome, 
        true, 
        false, 
        dadosAbasOwner.onde || "local", 
        (maeId === notaAtivaId)
    ));

    // 4. ADICIONAR ABAS FILHAS EM PARALELO
    const promessasAbas = listaAbas.map(item => {
        const idAba = (typeof item === 'string') ? item : item.id;
        return buscarNotaHibrida(idAba).then(res => ({ id: idAba, res }));
    });

    const resultados = await Promise.all(promessasAbas);

    resultados.forEach(item => {
        if (item.res) {
            const isActive = (item.id === notaAtivaId);
            const onde = item.res.dados.onde || "local";
            fragmento.appendChild(criarElementoAba(
                item.id, 
                item.res.dados.nome, 
                false, 
                true, 
                onde, 
                isActive
            ));
        }
    });

    // 5. INJETAR TUDO DE UMA VEZ E REMOVER SPINNER
    container.innerHTML = "";
    container.appendChild(fragmento);
}

/**
 * DESIGN UNIFICADO (COM OU SEM LINHA)
 */
function criarElementoAba(id, nome, isMae, canClose, onde, isActive) {
    const aba = document.createElement('div');
    const corDestaque = (onde === "share") ? "#ef4444" : "#6366f1";
    
    aba.style.cssText = `
        padding: 6px 15px; 
        background: rgba(255,255,255,0.08); 
        border-radius: 4px; 
        font-size: 12px; 
        color: ${isActive ? '#fff' : '#94a3b8'}; 
        cursor: pointer; 
        display: flex; 
        align-items: center; 
        gap: 10px;
        border: 1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'};
        border-bottom: none; 
        /* A LINHA SÓ APARECE SE FOR ATIVA */
        border-top: 2px solid ${isActive ? corDestaque : 'transparent'};
        transition: 0.15s; 
        white-space: nowrap;
        margin-right: 4px;
    `;

    aba.innerHTML = `<span style="${isActive ? 'font-weight:700;' : 'font-weight:400;'}">${nome}</span>`;
    
    if (canClose) {
        const btnX = document.createElement('i');
        btnX.className = "fa-solid fa-xmark";
        btnX.style.cssText = "font-size: 10px; opacity: 0.4; cursor: pointer;";
        btnX.onmouseover = () => btnX.style.opacity = "1";
        btnX.onmouseout = () => btnX.style.opacity = "0.4";
        btnX.onclick = (e) => { e.stopPropagation(); fecharAba(id, onde); };
        aba.appendChild(btnX);
    }

    aba.onclick = async () => {
        if (id === notaAtivaIdGlobal) return; 
        const res = await buscarNotaHibrida(id);
        if (res) abrirNotaNoEditor(id, res.dados, dbRef, authRef, null, notaMaeIdLocal);
    };

    return aba;
}

/**
 * LÓGICA DE FECHO E POPUP (MANTIDAS COM TRY-CATCH)
 */
async function fecharAba(idAlvo, ondeAba) {
    const resMae = await buscarNotaHibrida(notaMaeIdLocal);
    if (!resMae) return;

    const docRef = doc(dbRef, resMae.colecao, notaMaeIdLocal);
    await updateDoc(docRef, { browser: arrayRemove({ id: idAlvo, onde: ondeAba }) });

    if (idAlvo === notaAtivaIdGlobal) {
        const novoResMae = await buscarNotaHibrida(notaMaeIdLocal);
        abrirNotaNoEditor(notaMaeIdLocal, novoResMae.dados, dbRef, authRef, null, null);
    } else {
        const novoResMae = await buscarNotaHibrida(notaMaeIdLocal);
        carregarAbasDaNota(notaMaeIdLocal, novoResMae.dados, notaAtivaIdGlobal);
    }
}

async function carregarNotasParaBrowser() {
    const container = document.getElementById('arvore-browser');
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    try {
        const uid = authRef.currentUser.uid;
        let q = (abaBrowserAtiva === "Local") 
            ? query(collection(dbRef, "Local"), where("userId", "==", uid), where("tipo", "==", "nota"))
            : query(collection(dbRef, "Share"), and(where("estado", "==", "ativo"), or(where("userId", "==", uid), where("aprovado", "array-contains", uid))));

        const snap = await getDocs(q);
        container.innerHTML = "";
        snap.forEach(d => {
            if (d.id === notaMaeIdLocal) return;
            const item = document.createElement('div');
            item.className = "menu-item-list";
            item.innerHTML = `<i class="fa-solid fa-file-lines" style="color:${abaBrowserAtiva === 'Local' ? '#6366f1' : '#ef4444'}; margin-right:10px;"></i><span>${d.data().nome}</span>`;
            item.onclick = () => adicionarAba(d.id, abaBrowserAtiva.toLowerCase());
            container.appendChild(item);
        });
    } catch (e) { container.innerHTML = "Erro ao carregar."; }
}

async function abrirPopupEscolha() {
    document.getElementById('popup-browser-overlay').classList.add('active');
    abaBrowserAtiva = "Local";
    carregarNotasParaBrowser();
}

async function adicionarAba(idAlvo, onde) {
    const resMae = await buscarNotaHibrida(notaMaeIdLocal);
    if (!resMae) return;
    await updateDoc(doc(dbRef, resMae.colecao, notaMaeIdLocal), { browser: arrayUnion({ id: idAlvo, onde: onde }) });
    document.getElementById('popup-browser-overlay').classList.remove('active');
    const resAlvo = await buscarNotaHibrida(idAlvo);
    abrirNotaNoEditor(idAlvo, resAlvo.dados, dbRef, authRef, null, notaMaeIdLocal);
}