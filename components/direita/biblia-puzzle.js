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
    const uid = auth.currentUser.uid;
    
    // Reset de segurança
    if (unsubPuzzle) unsubPuzzle();
    if (unsubLocal) unsubLocal();
    dadosEstruturaVersiculo = null; 
    ultimoJsonRenderizado = "";

    console.log(`%c📡 [BRAIN] Sintonizando: ${nomeCompleto}`, "color: #818cf8; font-weight: bold;");

    // --- ESCUTA 1: FERRAMENTAS NAS NOTAS ---
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", uid)), (snap) => {
        ferramentasMapaInterno = {};
        snap.forEach(docN => {
            const d = docN.data();
            if (d.estado === "ativa" && d.caixas) {
                d.caixas.forEach(c => {
                    if (c.estado === "ativa" && c.neuroniosBiba?.includes(nomeCompleto)) {
                        ferramentasMapaInterno[c.id] = { ...c, notaDocId: docN.id, notaDadosCompletos: d };
                    }
                });
            }
        });
        rebuildPuzzleUI(container, db, auth);
    });

    // --- ESCUTA 2: DOCUMENTO DO VERSÍCULO ---
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nomeCompleto));
    unsubPuzzle = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        
        if (snapshot.empty) {
            console.log("ℹ️ Versículo sem documento mestre. Pronto para criação.");
            container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Usa o + para anotar este versículo.</p>`;
            // Guardamos apenas os metadados para saber que temos de usar addDoc
            dadosEstruturaVersiculo = { isNew: true, nome: nomeCompleto, info: info };
            return;
        }

        const docSnap = snapshot.docs[0];
        if (docSnap.metadata.hasPendingWrites) return;

        dadosEstruturaVersiculo = { ref: docSnap.ref, data: docSnap.data(), isNew: false };
        rebuildPuzzleUI(container, db, auth);
    });

    // --- LÓGICA DO BOTÃO + (GIRAR A CHAVE) ---
const acaoBotaoPlusBiblia = async () => {
    console.log("➕ [PUZZLE] Clique detetado.");

    // 1. Bloqueio de segurança para não disparar 10 vezes no mesmo milissegundo
    if (estaAEscrever) {
        console.warn("⏳ Aguarda... gravação em curso.");
        return;
    }
    
    estaAEscrever = true;

    // 2. Preparar a nova caixa
    const novoId = crypto.randomUUID();
    const novoObjeto = { 
        id: novoId, 
        userId: uid, 
        timestamp: new Date().toISOString(), 
        estado: "ativo", 
        tipo: "caixatexto", 
        conteudo: "" 
    };

    try {
        // --- CENÁRIO A: VERSÍCULO NOVO ---
        if (!dadosEstruturaVersiculo || dadosEstruturaVersiculo.isNew) {
            console.log("🌟 Criando documento mestre e primeira caixa...");
            
            // UI Otimista: Forçamos a visualização imediata
            container.innerHTML = ""; // Limpa o aviso de "Vazio"
            
            const novoDocData = {
                  id: crypto.randomUUID(),
                    userId: uid,
                    nome: nomeCompleto,
                    livro: info.livro,
                    capitulo: info.cap,
                    versiculo: info.ver,
                    tipo: "textobiblico",
                    estado: "ativo",
                    timestamp: serverTimestamp(),
                    Puzzle: { quadros: [novoObjeto] },
                    caixas: [],
                    Dossie: { mica: {}, Apto: [] }
            };

            // Guardamos na memória local ANTES de enviar para o Firebase
            dadosEstruturaVersiculo = { data: novoDocData, isNew: false };
            rebuildPuzzleUI(container, db, auth);

            const docRef = await addDoc(collection(db, "TextosBiblia"), novoDocData);
            dadosEstruturaVersiculo.ref = docRef; // Atualiza a referência para o próximo clique
        } 
        // --- CENÁRIO B: ADICIONAR A DOCUMENTO EXISTENTE ---
        else {
            console.log("📝 Adicionando mais uma caixa...");
            
            const listaAtual = [...(dadosEstruturaVersiculo.data.Puzzle?.quadros || [])];
            listaAtual.push(novoObjeto);

            // Atualização Local Imediata (RAM)
            dadosEstruturaVersiculo.data.Puzzle.quadros = listaAtual;
            ultimoJsonRenderizado = ""; // Reset do cache de renderização
            rebuildPuzzleUI(container, db, auth);

            // Envia para o Firebase em background
            await updateDoc(dadosEstruturaVersiculo.ref, { "Puzzle.quadros": listaAtual });
        }

        // 3. Focar e Scroll
        setTimeout(() => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
            const ta = container.querySelector(`textarea[data-id="${novoId}"]`);
            if (ta) ta.focus();
            estaAEscrever = false; // Liberta para o próximo clique
        }, 100);

    } catch (e) {
        console.error("❌ Erro no motor do Puzzle:", e);
        estaAEscrever = false;
    }
};

    window.removeEventListener('bible:adicionarTexto', window._handlerBiblia);
    window._handlerBiblia = acaoBotaoPlusBiblia;
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

    // --- MUDANÇA AQUI: Ordenar do mais recente para o mais antigo (b - a) ---
    const listaFinal = [
        ...quadrosManuais.map(q => ({ ...q, _tipoItem: 'quadro' })), 
        ...ferramentas
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Forçar limpeza de cache visual para garantir que a nova caixa aparece
    if (estaAEscrever) {
        ultimoJsonRenderizado = ""; 
    }

    const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
    if (assinatura === ultimoJsonRenderizado) return;
    ultimoJsonRenderizado = assinatura;

    container.innerHTML = "";
    
    listaFinal.forEach((item, index) => {
        if (item._tipoItem === 'quadro') {
            const el = SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, ref, {
                setEstaAEscrever: (val) => { estaAEscrever = val; },
                moverItem: (idx, dir) => moverItemBiblia(idx, dir, listaFinal, ref),
                apagarItem: (id) => executarApagarManual(id, ref)
            });
            container.appendChild(el);
        } else {
            container.appendChild(renderFerramentaVinculadaUI(item, index, listaFinal, ref, db, auth));
        }
    });

    // UX Mobile: Se acabámos de criar uma caixa, garantir que o scroll vai para o topo
    if (estaAEscrever) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
