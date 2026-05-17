// components/direita/shared-puzzle-ui.js
import { updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { BrainBoxFactory } from '../ui/brain-box-component.js';

window._puzzleTimers = window._puzzleTimers || new Map();

export const SharedPuzzleUI = {
    /**
     * RENDERIZA O QUADRO MANUAL USANDO A FÁBRICA PADRONIZADA
     */
    renderQuadroManual: (q, index, listaCompleta, refDoc, callbacks) => {
        const { setEstaAEscrever, moverItem, apagarItem } = callbacks;

        return BrainBoxFactory.criar(q, index, {
            onUpdate: (novoTexto) => {
                setEstaAEscrever(true);
                q.conteudo = novoTexto;

                if (window._puzzleTimers.has(q.id)) clearTimeout(window._puzzleTimers.get(q.id));

                const timer = setTimeout(async () => {
                    try {
                        const snap = await getDoc(refDoc);
                        const novosQuadros = snap.data().Puzzle.quadros.map(item => 
                            item.id === q.id ? { ...item, conteudo: novoTexto } : item
                        );
                        await updateDoc(refDoc, { "Puzzle.quadros": novosQuadros });
                        setEstaAEscrever(false);
                    } catch (err) { console.error(err); }
                }, 1200);

                window._puzzleTimers.set(q.id, timer);
            },
            onMove: moverItem,
            onDelete: async (id) => {
                const confirmou = await SharedPuzzleUI.confirmarAcao(
                    "Apagar Anotação?", 
                    "Tens a certeza que desejas eliminar este quadro permanentemente?"
                );
                if (confirmou) apagarItem(id);
            }
        });
    },

    /**
     * POPUP DE CONFIRMAÇÃO (PROMISE)
     */
    confirmarAcao: (t, m) => new Promise(res => { 
        const overlay = document.getElementById('popup-confirmar-puzzle-overlay');
        if(!overlay) return res(confirm(m));
        document.getElementById('puzzle-confirm-titulo').innerText = t;
        document.getElementById('puzzle-confirm-msg').innerText = m;
        overlay.classList.add('active');
        document.getElementById('btn-puzzle-confirm-sim').onclick = () => { overlay.classList.remove('active'); res(true); };
        document.getElementById('btn-puzzle-confirm-cancelar').onclick = () => { overlay.classList.remove('active'); res(false); };
    })
};