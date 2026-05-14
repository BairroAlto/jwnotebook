// components/direita/biblia-puzzle.js
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { SharedPuzzleUI } from './shared-puzzle-ui.js';


// --- ESTADO LOCAL (PARIDADE TOTAL COM COSMOS) ---
let unsubPuzzle = null;
let unsubLocal = null; 
let ferramentasMapaInterno = {}; 
let dadosEstruturaVersiculo = null; 
let estaAEscrever = false; 
let ultimoJsonRenderizado = ""; 
let infoVersiculoLocal = null; 

/**
 * LIMPEZA
 */
export function limparPuzzleBiblia() {
    if (unsubPuzzle) unsubPuzzle(); if (unsubLocal) unsubLocal();
    ferramentasMapaInterno = {}; dadosEstruturaVersiculo = null;
    estaAEscrever = false; ultimoJsonRenderizado = ""; infoVersiculoLocal = null;
}

/**
 * INICIALIZAÇÃO
 */
export async function renderizarPuzzleBiblia(info, container, db, auth) {
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    infoVersiculoLocal = info;
    const uid = auth.currentUser.uid;
    limparPuzzleBiblia();
    infoVersiculoLocal = info;

    // 1. ESCUTA: NOTAS LOCAIS (CONTEÚDO VIVO)
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", uid)), (snap) => {
        ferramentasMapaInterno = {};
        snap.forEach(nDoc => {
            const nData = nDoc.data();
            if (nData.estado !== "ativa") return;
            if(nData.caixas) nData.caixas.forEach(c => {
                if (c.estado === "ativa" && c.neuroniosBiba?.includes(nomeCompleto)) {
                    ferramentasMapaInterno[c.id] = { ...c, notaDocId: nDoc.id, notaDadosCompletos: nData };
                }
            });
        });
        rebuildPuzzleUI(container, db, auth);
    });

    // 2. ESCUTA: ESTRUTURA DO VERSÍCULO (BRAIN)
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nomeCompleto));
    unsubPuzzle = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Usa o + para anotar.</p>`;
            return;
        }

        const docSnap = snapshot.docs[0];
        const novosDados = docSnap.data();

        // BLINDAGEM DE METADADOS (SOLUÇÃO DO PISCA)
        if (docSnap.metadata.hasPendingWrites) {
            dadosEstruturaVersiculo = { ref: docSnap.ref, data: novosDados };
            return; 
        }

        // FUSÃO DE SEGURANÇA (RAM vs Firestore)
        if (estaAEscrever && dadosEstruturaVersiculo) {
            novosDados.Puzzle.quadros = novosDados.Puzzle.quadros.map(sq => {
                const itemNaRam = dadosEstruturaVersiculo.data.Puzzle.quadros.find(l => l.id === sq.id);
                return itemNaRam ? { ...sq, conteudo: itemNaRam.conteudo } : sq;
            });
        }

        const totalAnt = (dadosEstruturaVersiculo?.data?.Puzzle?.quadros?.length || 0) + (dadosEstruturaVersiculo?.data?.caixas?.length || 0);
        const totalNov = (novosDados.Puzzle?.quadros?.length || 0) + (novosDados.caixas?.length || 0);

        if (estaAEscrever && totalAnt === totalNov) {
            dadosEstruturaVersiculo = { ref: docSnap.ref, data: novosDados };
            return; 
        }

        dadosEstruturaVersiculo = { ref: docSnap.ref, data: novosDados };
        rebuildPuzzleUI(container, db, auth);
    });

    // 3. AÇÃO: BOTÃO + (ATÓMICO)
    const acaoBotaoPlusBiblia = async () => {
        if (window._puzzleTimers) {
            window._puzzleTimers.forEach(t => clearTimeout(t));
            window._puzzleTimers.clear();
        }
        
        estaAEscrever = true; ultimoJsonRenderizado = ""; 

        if (!dadosEstruturaVersiculo) return;

        const refDoc = dadosEstruturaVersiculo.ref;
        const quadrosNaRam = [...(dadosEstruturaVersiculo.data.Puzzle?.quadros || [])];

        // Sincronização forçada DOM -> RAM
        container.querySelectorAll('textarea[data-id]').forEach(ta => {
            const item = quadrosNaRam.find(q => q.id === ta.dataset.id);
            if (item) item.conteudo = ta.value;
        });

        const novo = { id: crypto.randomUUID(), userId: uid, timestamp: new Date().toISOString(), estado: "ativo", tipo: "caixatexto", conteudo: "" };
quadrosNaRam.push(novo);
        dadosEstruturaVersiculo.data.Puzzle.quadros = quadrosNaRam;
        
        rebuildPuzzleUI(container, db, auth);

        try {
             await updateDoc(refDoc, { "Puzzle.quadros": quadrosNaRam });
            setTimeout(() => {
                const tas = container.querySelectorAll('textarea');
                if(tas[0]) tas[0].focus();
                setTimeout(() => { estaAEscrever = false; }, 1000);
            }, 300);
        } catch (e) { console.error(e); estaAEscrever = false; }
    };

    // RENOVAR O OUVINTE ( bible:adicionarTexto )
    window.removeEventListener('bible:adicionarTexto', acaoBotaoPlusBiblia);
    window.addEventListener('bible:adicionarTexto', acaoBotaoPlusBiblia);
}

/**
 * RENDERIZAÇÃO
 */
function rebuildPuzzleUI(container, db, auth) {
    if (!dadosEstruturaVersiculo || !container) return;

    const { data, ref } = dadosEstruturaVersiculo;
    const caixasVinculo = data.caixas || [];
    const quadrosManuais = data.Puzzle?.quadros || [];

    const ferramentas = caixasVinculo.map(cv => {
        const id = typeof cv === 'object' ? cv.id : cv;
        const vivo = ferramentasMapaInterno[id];
        return vivo ? { ...vivo, timestamp: cv.timestamp || vivo.timestamp, _tipoItem: 'ferramenta' } : null;
    }).filter(f => f);

    const listaFinal = [...quadrosManuais.map(q => ({ ...q, _tipoItem: 'quadro' })), ...ferramentas].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
    if (assinatura === ultimoJsonRenderizado) return;
    ultimoJsonRenderizado = assinatura;

    container.innerHTML = "";
    listaFinal.forEach((item, index) => {
        if (item._tipoItem === 'quadro') {
            const el = SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, ref, {
                setEstaAEscrever: (val) => { estaAEscrever = val; },
                limparCache: () => { ultimoJsonRenderizado = ""; },
                moverItem: (idx, dir) => moverItemBiblia(idx, dir, listaFinal, ref),
                apagarItem: (id) => executarApagarManual(id, ref)
            });
            container.appendChild(el);
        } else {
            container.appendChild(renderFerramentaVinculadaUI(item, index, listaFinal, ref, db, auth));
        }
    });
}

/**
 * UI: FERRAMENTA VINCULADA
 */
function renderFerramentaVinculadaUI(c, index, todos, ref, db, auth) {
    const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const corFoco = (c.foco && FOCOS_BASE[c.foco]) ? FOCOS_BASE[c.foco].corForte : config.cor;

    const div = document.createElement('div');
    div.style.cssText = `border-left: 4px solid ${corFoco}; background: rgba(255,255,255,0.02); margin-bottom: 12px; border-radius: 4px; overflow: hidden;`;
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background: ${corFoco}15;">
            <div style="font-size:10px; font-weight:800; color:${corFoco}; text-transform:uppercase; display:flex; align-items:center; gap:6px;"><i class="${config.icon}"></i> ${c.tipo}</div>
            <div style="display:flex; gap:14px; color:rgba(255,255,255,0.25); font-size:11px; align-items:center;">
                <i class="fa-solid fa-chevron-up btn-up" style="cursor:pointer;"></i>
                <i class="fa-solid fa-chevron-down btn-down" style="cursor:pointer;"></i>
                <i class="fa-solid fa-arrow-up-right-from-square btn-viajar" style="cursor:pointer; color:#818cf8;"></i>
                <i class="fa-solid fa-trash-can btn-remove" style="color:#f87171; cursor:pointer;"></i>
            </div>
        </div>
        <div style="padding:12px; font-size:13px; color:white; line-height:1.4;">
            ${c.titulo ? `<div style="font-weight:700; margin-bottom:4px; color:${corFoco};">${c.titulo}</div>` : ''}
            <div style="opacity:0.9; white-space: pre-wrap;">${c.conteudo}</div>
        </div>`;

    div.querySelector('.btn-remove').onclick = async () => {
        if(await SharedPuzzleUI.confirmarAcao("Remover Vínculo?", "Desvincular este versículo em ambos os lados?")) {
            const nomeVersiculo = `${infoVersiculoLocal.livro} ${infoVersiculoLocal.cap}:${infoVersiculoLocal.ver}`;
            const snap = await getDoc(ref);
            const novasCaixas = (snap.data().caixas || []).filter(item => (typeof item === 'object' ? item.id : item) !== c.id);
            await updateDoc(ref, { caixas: novasCaixas });

            const colecao = (c.notaDadosCompletos.onde === "share") ? "Share" : "Local";
            const notaRef = doc(db, colecao, c.notaDocId);
            const snapNota = await getDoc(notaRef);
            if(snapNota.exists()){
                const caixasNota = snapNota.data().caixas.map(cx => {
                    if(cx.id === c.id) {
                        cx.neuroniosBiba = (cx.neuroniosBiba || []).filter(v => v !== nomeVersiculo);
                        const overlayTags = document.getElementById('popup-tags-overlay');
                        if (overlayTags && overlayTags.classList.contains('active')) {
                             import('../editor/modulos/tags/tags-ui.js').then(m => m.renderizarNeuroniosNoPopup(cx));
                        }
                    }
                    return cx;
                });
                await updateDoc(notaRef, { caixas: caixasNota });
            }
            ultimoJsonRenderizado = ""; 
        }
    };
    div.querySelector('.btn-viajar').onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, db, auth, c.id);
    return div;
}

/**
 * AUXILIARES
 */
async function moverItemBiblia(index, direcao, todos, ref) {
    const novoIdx = index + direcao;
    if (novoIdx < 0 || novoIdx >= todos.length) return;
    estaAEscrever = false; ultimoJsonRenderizado = ""; 
    const tempTime = todos[index].timestamp;
    todos[index].timestamp = todos[novoIdx].timestamp;
    todos[novoIdx].timestamp = tempTime;
    const quadros = todos.filter(i => i._tipoItem === 'quadro').map(({ _tipoItem, ...rest }) => rest);
    const caixas = todos.filter(i => i._tipoItem === 'ferramenta').map(i => ({ id: i.id, timestamp: i.timestamp }));
    await updateDoc(ref, { "Puzzle.quadros": quadros, "caixas": caixas });
}

async function executarApagarManual(id, refDoc) {
    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;
    const novos = snap.data().Puzzle.quadros.filter(item => item.id !== id);
    await updateDoc(refDoc, { "Puzzle.quadros": novos });
}

// Mantido para compatibilidade com o botão do cabeçalho original
export async function acaoBotaoTextoBiblia(info, db, auth) {
    // Dispara o evento específico da Bíblia
    window.dispatchEvent(new CustomEvent('bible:adicionarTexto'));
}