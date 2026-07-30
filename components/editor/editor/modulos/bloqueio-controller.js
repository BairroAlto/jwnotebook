// components/editor/modulos/bloqueio-controller.js
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * APLICA O ESCUDO VISUAL E LÓGICA DE TRANCA
 * Esta função é chamada pelas fábricas (contentor, subnota, etc.)
 */
window.aplicarEscudoBloqueio = (caixa, elementoInput, containerFisico) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const bloqueio = caixa.bloqueio;

    // 1. VERIFICAR SE ESTÁ BLOQUEADO POR OUTREM
    if (bloqueio && bloqueio.userId !== user.uid) {
        // Bloquear UI
        elementoInput.disabled = true;
        elementoInput.style.cursor = "not-allowed";
        elementoInput.title = `Bloqueado por ${bloqueio.userName}`;
        containerFisico.style.opacity = "0.7";
        containerFisico.style.borderStyle = "dashed";
        
        // Adicionar um pequeno aviso visual se não existir
        if (!containerFisico.querySelector('.lock-indicator')) {
            const lock = document.createElement('div');
            lock.className = 'lock-indicator';
            lock.innerHTML = `<i class="fa-solid fa-lock"></i> <small>${bloqueio.userName} está a escrever...</small>`;
            lock.style.cssText = "position:absolute; top:5px; right:100px; color:#ef4444; font-size:10px; font-weight:800; text-transform:uppercase;";
            containerFisico.style.position = "relative";
            containerFisico.appendChild(lock);
        }
    } else {
        // 2. ESTÁ LIVRE OU É MEU - ATIVAR EVENTOS DE SESSÃO
        elementoInput.disabled = false;
        elementoInput.style.cursor = "text";
        
        elementoInput.onfocus = () => {
            window.caixaEmEdicaoId = caixa.id; // Bloqueia o renderizador do Watcher
            window.definirBloqueioCaixa(caixa.id, true);
        };

        elementoInput.onblur = () => {
            window.caixaEmEdicaoId = null; // Liberta o renderizador do Watcher
            window.definirBloqueioCaixa(caixa.id, false);
        };
    }
};

/**
 * GESTÃO DE BLOQUEIO NO FIRESTORE (Tranca o documento para outros)
 */
window.definirBloqueioCaixa = async (caixaId, status) => {
    const db = getFirestore();
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user || !window.notaAbertaId) return;

    const notaId = window.notaAbertaId;
    const colecao = (window.dadosNotaOriginal?.onde === "share") ? "Share" : "Local";
    const notaRef = doc(db, colecao, notaId);

    try {
        const snap = await getDoc(notaRef);
        if (!snap.exists()) return;

        const caixas = snap.data().caixas || [];
        const novasCaixas = caixas.map(c => {
            if (c.id === caixaId) {
                return {
                    ...c,
                    bloqueio: status ? {
                        userId: user.uid,
                        userName: user.email.split('@')[0],
                        timestamp: new Date().toISOString()
                    } : null
                };
            }
            return c;
        });

        await updateDoc(notaRef, { caixas: novasCaixas });
    } catch (e) {
        console.error("Erro ao gerir bloqueio:", e);
    }
};