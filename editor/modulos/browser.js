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
const browserFoldersOpen = new Set();

export function iniciarSistemaBrowser(db, auth) {
    dbRef = db;
    authRef = auth;

    const btnFechar = document.getElementById('btn-fechar-browser');
    if (btnFechar) {
        btnFechar.onclick = () => document.getElementById('popup-browser-overlay')?.classList.remove('active');
    }

    document.querySelectorAll('.tab-browser').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-browser').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            abaBrowserAtiva = btn.dataset.origem;
            browserFoldersOpen.clear();
            carregarNotasParaBrowser();
        };
    });
}

export function abrirPopupEscolha() {
    const overlay = document.getElementById('popup-browser-overlay');
    if (!overlay) return;

    overlay.classList.add('active');
    abaBrowserAtiva = "Local";
    browserFoldersOpen.clear();
    document.querySelectorAll('.tab-browser').forEach(b => {
        b.classList.toggle('active', b.dataset.origem === "Local");
    });
    carregarNotasParaBrowser();
}

async function carregarNotasParaBrowser() {
    const container = document.getElementById('arvore-browser');
    const info = document.getElementById('browser-label-info');
    const db = dbRef || window.db;
    const auth = authRef || window.auth;

    if (!container || !db || !auth?.currentUser) return;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;
    if (info) info.textContent = `Seleciona uma nota ${abaBrowserAtiva}`;

    try {
        const uid = auth.currentUser.uid;
        let q;

        if (abaBrowserAtiva === "Local") {
            q = query(
                collection(db, "Local"),
                where("userId", "==", uid),
                where("estado", "==", "on")
            );
        } else {
            q = query(
                collection(db, "Share"),
                and(
                    where("estado", "==", "on"),
                    where("tipo", "in", ["nota", "pasta"]),
                    or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
                )
            );
        }

        const snap = await getDocs(q);
        const items = [];
        snap.forEach(docSnap => {
            if (docSnap.id === notaMaeIdLocal) return;
            items.push({ id: docSnap.id, ...docSnap.data() });
        });

        container.innerHTML = "";
        if (!items.length) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:20px; font-size:12px;">Nenhuma nota encontrada.</p>`;
            return;
        }

        const rootId = abaBrowserAtiva === "Local" ? "root" : "home";
        renderizarArvoreBrowser(container, items, rootId, 0, uid);
    } catch (_) {
        container.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px; font-size:10px;">Erro ao carregar lista.</p>`;
    }
}

function renderizarArvoreBrowser(container, items, paiId, level, uid) {
    const filhos = items
        .filter(item => obterPaiItem(item, uid) === paiId)
        .sort((a, b) => {
            if (a.tipo !== b.tipo) return a.tipo === "pasta" ? -1 : 1;
            return (obterOrdemItem(a, uid) - obterOrdemItem(b, uid)) || (a.nome || "").localeCompare(b.nome || "");
        });

    filhos.forEach(item => {
        if (item.tipo === "pasta") {
            const wrapper = document.createElement('div');
            const isOpen = browserFoldersOpen.has(item.id);
            wrapper.innerHTML = `
                <div class="tree-item tree-folder-header" style="padding-left:${8 + (level * 18)}px; text-transform:none; margin-top:0;">
                    <i class="fa-solid ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" style="width: 10px; font-size: 8px;"></i>
                    <i class="fa-solid fa-folder-tree" style="color:${abaBrowserAtiva === 'Local' ? '#eab308' : '#f87171'};"></i>
                    <span style="font-size:12px; font-weight:700; color:var(--text-muted);">${item.nome || "Pasta"}</span>
                </div>
            `;
            wrapper.firstElementChild.onclick = () => {
                if (browserFoldersOpen.has(item.id)) browserFoldersOpen.delete(item.id);
                else browserFoldersOpen.add(item.id);
                carregarNotasParaBrowser();
            };
            container.appendChild(wrapper);

            if (isOpen) {
                const subContainer = document.createElement('div');
                subContainer.className = 'tree-folder-content open';
                wrapper.appendChild(subContainer);
                renderizarArvoreBrowser(subContainer, items, item.id, level + 1, uid);
            }
            return;
        }

        const row = document.createElement('div');
        row.className = 'tree-item';
        row.style.paddingLeft = `${8 + (level * 18)}px`;
        row.innerHTML = `
            <i class="fa-solid fa-file-lines" style="color:${abaBrowserAtiva === 'Local' ? '#6366f1' : '#ef4444'};"></i>
            <span style="font-size:12px; color:#e2e8f0;">${item.nome || "Sem tÃ­tulo"}</span>
        `;

        row.onclick = async () => {
            const resMae = await buscarNotaHibrida(notaMaeIdLocal);
            const colecaoMae = resMae?.colecao || "Local";
            const db = dbRef || window.db;

            await updateDoc(doc(db, colecaoMae, notaMaeIdLocal), {
                browser: arrayUnion({ id: item.id, onde: abaBrowserAtiva.toLowerCase() })
            });

            document.getElementById('popup-browser-overlay')?.classList.remove('active');
            abrirNotaNoEditor(item.id, item, db, authRef || window.auth, null, notaMaeIdLocal);
        };

        container.appendChild(row);
    });
}

function obterPaiItem(item, uid) {
    if (abaBrowserAtiva === "Local") return item.pastapai || "root";
    return item?.[uid]?.pastapai || "home";
}

function obterOrdemItem(item, uid) {
    if (abaBrowserAtiva === "Local") return item.ordem || 999999;
    return item?.[uid]?.ordem || 999999;
}

export async function carregarAbasDaNota(maeId, dadosNota, notaAtivaId) {
    notaMaeIdLocal = maeId;
    notaAtivaIdGlobal = notaAtivaId;
    const container = document.getElementById('editor-tabs-list');
    if (!container) return;
    container.innerHTML = `<div id="tab-spinner" style="display:flex; align-items:center; padding:0 15px; color:var(--primary);"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:14px;"></i></div>`;

    const resMae = await buscarNotaHibrida(maeId);
    if (!resMae) {
        container.innerHTML = "";
        return;
    }

    const listaAbas = resMae.dados.browser || [];
    const fragmento = document.createDocumentFragment();
    fragmento.appendChild(criarElementoAba(maeId, resMae.dados.nome, true, false, resMae.dados.onde || "local", (maeId === notaAtivaId)));

    const promessas = listaAbas.map(async (item) => {
        const idAba = (typeof item === 'string') ? item : item.id;
        const res = await buscarNotaHibrida(idAba);
        return res ? { id: idAba, data: res.dados, onde: res.dados.onde || "local" } : null;
    });

    const resultados = await Promise.all(promessas);
    resultados.forEach(item => {
        if (item) fragmento.appendChild(criarElementoAba(item.id, item.data.nome, false, true, item.onde, (item.id === notaAtivaId)));
    });
    container.innerHTML = "";
    container.appendChild(fragmento);
}

function criarElementoAba(id, nome, isMae, canClose, onde, isActive) {
    const LIMITE_CARATERES = 18;
    const nomeFormatado = nome.length > LIMITE_CARATERES
        ? nome.substring(0, LIMITE_CARATERES).trim() + "..."
        : nome;

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
        border-top: 2px solid ${isActive ? corDestaque : 'transparent'};
        white-space: nowrap;
        margin-right: 4px;
        transition: 0.2s;
    `;

    aba.innerHTML = `
        <span title="${nome}" style="${isActive ? 'font-weight:700;' : 'font-weight:400;'}">
            ${nomeFormatado}
        </span>
    `;

    if (canClose) {
        const btnX = document.createElement('i');
        btnX.className = "fa-solid fa-xmark";
        btnX.style.cssText = "font-size: 10px; opacity: 0.4; padding: 2px;";
        btnX.onmouseenter = () => btnX.style.opacity = "1";
        btnX.onmouseleave = () => btnX.style.opacity = "0.4";
        btnX.onclick = (e) => {
            e.stopPropagation();
            fecharAba(id, onde);
        };
        aba.appendChild(btnX);
    }

    aba.onclick = () => {
        if (id !== notaAtivaIdGlobal) {
            buscarNotaHibrida(id).then(res => {
                if (res) abrirNotaNoEditor(id, res.dados, dbRef || window.db, authRef || window.auth, null, notaMaeIdLocal);
            });
        }
    };

    return aba;
}

async function fecharAba(idAlvo, ondeAba) {
    const db = dbRef || window.db;
    const resMae = await buscarNotaHibrida(notaMaeIdLocal);
    if (!resMae || !db) return;
    await updateDoc(doc(db, resMae.colecao, notaMaeIdLocal), { browser: arrayRemove({ id: idAlvo, onde: ondeAba }) });
    if (idAlvo === notaAtivaIdGlobal) {
        buscarNotaHibrida(notaMaeIdLocal).then(r => abrirNotaNoEditor(notaMaeIdLocal, r.dados, db, authRef || window.auth, null, null));
    } else {
        buscarNotaHibrida(notaMaeIdLocal).then(r => carregarAbasDaNota(notaMaeIdLocal, r.dados, notaAtivaIdGlobal));
    }
}

export async function buscarNotaHibrida(id) {
    const db = dbRef || window.db;
    try {
        const sLocal = await getDoc(doc(db, "Local", id));
        if (sLocal.exists()) return { dados: sLocal.data(), colecao: "Local" };
        const sShare = await getDoc(doc(db, "Share", id));
        if (sShare.exists()) return { dados: sShare.data(), colecao: "Share" };
    } catch (_) {}
    return null;
}
