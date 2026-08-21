// components/settings/recycle-manager.js
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { COLECAO_CAIXAS } from '../local/caixas-repository.js';
import { COLECAO_CAIXAS_SHARE } from '../share/share-caixas-repository.js';
import { renderizarItensReciclagem } from './recycle-ui.js';

const TRES_MESES_MS = 3 * 30 * 24 * 60 * 60 * 1000;

export async function verificarItensExpirados(db, userId) {
    console.log("[RECYCLE] Verificacao de expiracao iniciada...");
    const todosItens = await varrerTodasColecoes(db, userId);
    const itensExpirados = todosItens.filter(item => item.expirado === true);
    if (itensExpirados.length > 0) dispararAlertaReciclagem(todosItens, true);
}

function dispararAlertaReciclagem(listaCompleta, isAutoOpen) {
    const btnTab = document.getElementById('btn-tab-reciclagem');
    const overlay = document.getElementById('popup-settings-overlay');
    if (btnTab && overlay) {
        overlay.classList.add('active');
        btnTab.click();
        renderizarItensReciclagem(listaCompleta, isAutoOpen);
    }
}

export async function carregarTodaReciclagem(db, userId) {
    const container = document.getElementById('lista-reciclagem-expirada');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;
    try {
        const todosItens = await varrerTodasColecoes(db, userId);
        renderizarItensReciclagem(todosItens, false);
    } catch (_) {
        container.innerHTML = "Erro ao carregar lixeira.";
    }
}

function prepararItemReciclado(dados, agora, base) {
    if (!dados?.timedelete) return null;
    const ms = agora - new Date(dados.timedelete).getTime();
    return { ...base, dados, expirado: ms > TRES_MESES_MS };
}

async function varrerTodasColecoes(db, userId) {
    const agora = Date.now();
    const listaFinal = [];
    const idsCaixasNormalizadas = new Set();
    const idsCaixasShareNormalizadas = new Set();

    try {
        const qCaixas = query(
            collection(db, COLECAO_CAIXAS),
            where("userId", "==", userId),
            where("estado", "==", "off")
        );
        const snapCaixas = await getDocs(qCaixas);
        snapCaixas.forEach(docSnap => {
            const caixa = { ...docSnap.data(), id: docSnap.id };
            idsCaixasNormalizadas.add(caixa.id);
           const item = prepararItemReciclado(caixa, agora, {
                id: caixa.localDocId || docSnap.id,
                idSub: docSnap.id,
                tipoItem: "caixa",
                origem: COLECAO_CAIXAS,
                nomePai: caixa.localNome || "Nota Local"
            });
            if (item) listaFinal.push(item);
        });

        const qLocal = query(collection(db, "Local"), where("userId", "==", userId));
        const snapLocal = await getDocs(qLocal);
        snapLocal.forEach(docSnap => {
            const d = docSnap.data();
            const nota = prepararItemReciclado(d, agora, { id: docSnap.id, tipoItem: "nota" });
            if (nota && d.estado === "off") listaFinal.push(nota);

            (d.caixas || []).forEach(caixa => {
               // Durante a transicao, nao mostrar a copia antiga se a caixa nova ja existe.
                if (idsCaixasNormalizadas.has(caixa.id)) return;
                if (caixa.estado !== "off") return;
                const item = prepararItemReciclado(caixa, agora, {
                    id: docSnap.id,
                    idSub: caixa.id,
                    tipoItem: "caixa",
                    origem: "Local",
                    nomePai: d.nome
                });
                if (item) listaFinal.push(item);
            });
        });

        const qShareCaixas = query(collection(db, COLECAO_CAIXAS_SHARE), where("userId", "==", userId), where("estado", "==", "off"));
        const snapShareCaixas = await getDocs(qShareCaixas);
        snapShareCaixas.forEach(docSnap => {
            const caixa = { ...docSnap.data(), id: docSnap.id };
            idsCaixasShareNormalizadas.add(caixa.id);
            const item = prepararItemReciclado(caixa, agora, {
                id: caixa.shareId || docSnap.id,
                idSub: docSnap.id,
                tipoItem: "caixa",
                origem: COLECAO_CAIXAS_SHARE,
                nomePai: caixa.shareNome || "Nota Share"
            });
            if (item) listaFinal.push(item);
        });

        const qShare = query(collection(db, "Share"), where("userId", "==", userId));
        const snapShare = await getDocs(qShare);
        snapShare.forEach(docSnap => {
            const d = docSnap.data();
            const nota = prepararItemReciclado(d, agora, { id: docSnap.id, tipoItem: "share-nota" });
            if (nota && d.estado === "off") listaFinal.push(nota);
            (d.caixas || []).forEach(caixa => {
                if (idsCaixasShareNormalizadas.has(caixa.id)) return;
                if (caixa.estado !== "off") return;
                const item = prepararItemReciclado(caixa, agora, { id: docSnap.id, idSub: caixa.id, tipoItem: "caixa", origem: "Share", nomePai: d.nome });
                if (item) listaFinal.push(item);
            });
        });

        const qCosmo = query(collection(db, "Cosmo"), where("userId", "==", userId));
        const snapCosmo = await getDocs(qCosmo);
        snapCosmo.forEach(docSnap => {
            const d = docSnap.data();
            const tema = prepararItemReciclado(d, agora, { id: docSnap.id, tipoItem: "cosmos-tema" });
            if (tema && d.estado === "off") listaFinal.push(tema);
            Object.values(d.Dossie?.mica || {}).forEach(mica => {
                const item = prepararItemReciclado(mica, agora, {
                    id: docSnap.id,
                    idSub: mica.id,
                    tipoItem: "mica",
                    origem: "Cosmo",
                    nomePai: d.nome || "Dossie"
                });
                if (item && mica.estado === "off") listaFinal.push(item);
            });
        });

        const qTopico = query(collection(db, "Topico"), where("userId", "==", userId));
        const snapTopico = await getDocs(qTopico);
        snapTopico.forEach(docSnap => {
            const d = docSnap.data();
            const topico = prepararItemReciclado(d, agora, { id: docSnap.id, tipoItem: "topico" });
            if (topico && d.estado === "off") listaFinal.push(topico);
        });
    } catch (erro) {
        console.error("[RECYCLE] Falha ao varrer colecoes", erro);
    }

    return listaFinal;
}