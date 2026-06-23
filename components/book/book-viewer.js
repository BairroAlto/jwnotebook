import { doc, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { MobileUI } from '../ui/mobile-manager.js';
import { BookState, setBookState } from './book-state.js';
import { renderBookFeed } from './book-renderer.js';
import { ensureBookRightPanel, refreshBookIntelligence } from './book-right-panel.js';
import { atualizarBookAIFloatingUI, resetBookAIConversation } from './book-ai.js';

export async function abrirNotaNoBook(notaId, dadosNota, db, auth, idCaixaFoco = null) {
    if (BookState.unsubscribe) {
        BookState.unsubscribe();
        BookState.unsubscribe = null;
    }

    const placeholder = document.getElementById('book-placeholder');
    const container = document.getElementById('book-container');
    const loading = document.getElementById('book-loading');
    if (placeholder) placeholder.style.display = 'none';
    if (container) container.style.display = 'none';
    if (loading) loading.style.display = 'flex';
    if (typeof MobileUI !== 'undefined') MobileUI.fecharColunaEsquerda();

    setBookState({
        db,
        auth,
        notaId,
        dadosNota: { ...dadosNota, onde: dadosNota.onde || inferCollection(dadosNota) },
        caixas: dadosNota.caixas || [],
        activeTab: 'feed',
        archiveNav: { view: 'raiz', gavetaId: null, prateleiraId: null },
        highlightNames: await carregarNomesDestaques(db, auth)
    });
    resetBookAIConversation();
    window.atualizarBookGameBadge?.();

    window.itemSelecionadoId = notaId;
    renderBookFeed();
    atualizarBookAIFloatingUI();
    window.renderBookRespondiHands?.();
    await refreshBookIntelligence({ revealPanel: window.innerWidth > 768 });

    if (container) container.style.display = 'block';
    if (loading) loading.style.display = 'none';

    iniciarSnapshotNota();

    if (idCaixaFoco) {
        setTimeout(() => {
            document.getElementById(`bloco-${idCaixaFoco}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);
    }
}

export function refreshNotaAtual() {
    renderBookFeed();
    atualizarBookAIFloatingUI();
    refreshBookIntelligence({ revealPanel: window.innerWidth > 768 });
}

export async function marcarRespondido(caixaId, value) {
    if (!BookState.db || !BookState.notaId || !BookState.dadosNota) return;
    const nextCaixas = (BookState.caixas || []).map(caixa => caixa.id === caixaId ? { ...caixa, respondi: Boolean(value) } : caixa);
    setBookState({ caixas: nextCaixas, dadosNota: { ...BookState.dadosNota, caixas: nextCaixas } });
    renderBookFeed();
    const collectionName = BookState.dadosNota.onde === "share" ? "Share" : "Local";
    await updateDoc(doc(BookState.db, collectionName, BookState.notaId), { caixas: nextCaixas });
}

async function iniciarSnapshotNota() {
    if (!BookState.db || !BookState.notaId || !BookState.dadosNota) return;
    const collectionName = BookState.dadosNota.onde === "share" ? "Share" : "Local";
    BookState.unsubscribe = onSnapshot(doc(BookState.db, collectionName, BookState.notaId), snap => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const remote = snap.data();
        setBookState({
            dadosNota: { ...BookState.dadosNota, ...remote },
            caixas: remote.caixas || []
        });
        renderBookFeed();
        atualizarBookAIFloatingUI();
        window.atualizarBookGameBadge?.();
        window.renderBookRespondiHands?.();
        refreshBookIntelligence({ revealPanel: window.innerWidth > 768 });
    });
}

function inferCollection(dadosNota) {
    return dadosNota?.aprovado || dadosNota?.convidado || dadosNota?.onde === "share" ? "share" : "local";
}

async function carregarNomesDestaques(db, auth) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return {};
    try {
        const snap = await getDoc(doc(db, "users", uid));
        return snap.exists() && snap.data().caixadestaques ? snap.data().caixadestaques : {};
    } catch (_) {
        return {};
    }
}

window.abrirNotaNoBook = abrirNotaNoBook;
window.refreshNotaAtualBook = refreshNotaAtual;
window.ensureBookRightPanel = ensureBookRightPanel;
