// components/settings/recycle-manager.js
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarItensReciclagem } from './recycle-ui.js';

const TRES_MESES_MS = 3 * 30 * 24 * 60 * 60 * 1000;

export async function verificarItensExpirados(db, userId) {
    console.log("🔍 [RECYCLE] Verificação de expiração iniciada...");
    const todosItens = await varrerTodasColecoes(db, userId);
    const itensExpirados = todosItens.filter(item => item.expirado === true);

    if (itensExpirados.length > 0) {
        // 🚀 DISPARA AUTO-OPEN: Passamos 'true' para indicar que é um alerta automático
        dispararAlertaReciclagem(todosItens, true);
    }
}

function dispararAlertaReciclagem(listaCompleta, isAutoOpen) {
    const btnTab = document.getElementById('btn-tab-reciclagem');
    const overlay = document.getElementById('popup-settings-overlay');

    if (btnTab && overlay) {
        overlay.classList.add('active');
        btnTab.click();
        // Renderiza com a flag de abertura automática
        renderizarItensReciclagem(listaCompleta, isAutoOpen);
    }
}

export async function carregarTodaReciclagem(db, userId) {
    const container = document.getElementById('lista-reciclagem-expirada');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    try {
        const todosItens = await varrerTodasColecoes(db, userId);
        // 🚀 CLIQUE MANUAL: Passamos 'false'
        renderizarItensReciclagem(todosItens, false);
    } catch (e) {
        container.innerHTML = "Erro ao carregar lixeira.";
    }
}

async function varrerTodasColecoes(db, userId) {
    const agora = Date.now();
    const listaFinal = [];
    try {
        const qLocal = query(collection(db, "Local"), where("userId", "==", userId));
        const snapLocal = await getDocs(qLocal);
        snapLocal.forEach(docSnap => {
            const d = docSnap.data();
            if (d.estado === "desativa" && d.timedelete) {
                const ms = agora - new Date(d.timedelete).getTime();
                listaFinal.push({ id: docSnap.id, tipoItem: 'nota', dados: d, expirado: ms > TRES_MESES_MS });
            }
            if (d.caixas) {
                d.caixas.forEach(c => {
                    if (c.estado === "desativa" && c.timedelete) {
                        const ms = agora - new Date(c.timedelete).getTime();
                        listaFinal.push({ id: docSnap.id, idSub: c.id, tipoItem: 'caixa', dados: c, nomePai: d.nome, expirado: ms > TRES_MESES_MS });
                    }
                });
            }
        });
        const qCosmo = query(collection(db, "Cosmo"), where("userId", "==", userId));
        const snapCosmo = await getDocs(qCosmo);
        snapCosmo.forEach(docSnap => {
            const d = docSnap.data();
            if (d.estado === "desativo" && d.timedelete) {
                const ms = agora - new Date(d.timedelete).getTime();
                listaFinal.push({ id: docSnap.id, tipoItem: 'cosmos-tema', dados: d, expirado: ms > TRES_MESES_MS });
            }
            if (d.Dossie?.mica) {
                Object.values(d.Dossie.mica).forEach(m => {
                    if (m.estado === "desativo" && m.timedelete) {
                        const ms = agora - new Date(m.timedelete).getTime();
                        listaFinal.push({ id: docSnap.id, idSub: m.id, tipoItem: 'mica', dados: m, nomePai: d.nome || "Dossiê", expirado: ms > TRES_MESES_MS });
                    }
                });
            }
        });
        const qTopico = query(collection(db, "Topico"), where("userId", "==", userId));
        const snapTopico = await getDocs(qTopico);
        snapTopico.forEach(docSnap => {
            const d = docSnap.data();
            if (d.estado === "desativo" && d.timedelete) {
                const ms = agora - new Date(d.timedelete).getTime();
                listaFinal.push({ id: docSnap.id, tipoItem: 'topico', dados: d, expirado: ms > TRES_MESES_MS });
            }
        });
    } catch (e) { console.error(e); }
    return listaFinal;
}
