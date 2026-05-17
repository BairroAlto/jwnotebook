// components/direita/cosmos-puzzle.js
import { doc, updateDoc, onSnapshot, arrayUnion, collection, query, where, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { SharedPuzzleUI } from './shared-puzzle-ui.js';

// --- ESTADO LOCAL DO MÓDULO ---
let unsubTema = null;
let unsubLocal = null;
let estaAEscrever = false; 
let ultimoJsonRenderizado = ""; 
let mapaFerramentasInterno = {}; 
let dadosEstruturaTema = null; 
let logicHandlerAtivo = null; 

/**
 * LIMPEZA DE MEMÓRIA
 */
export function limparPuzzle() { 
    if (unsubTema) { unsubTema(); unsubTema = null; } 
    if (unsubLocal) { unsubLocal(); unsubLocal = null; } 
    
    // NOVO: Remover o ouvinte do botão + ao sair do Puzzle
    if (logicHandlerAtivo) {
        window.removeEventListener('cosmos:adicionarTexto', logicHandlerAtivo);
        logicHandlerAtivo = null;
    }

    estaAEscrever = false;
    ultimoJsonRenderizado = "";
    mapaFerramentasInterno = {};
    dadosEstruturaTema = null;
}

/**
 * RENDERIZAÇÃO PRINCIPAL
 */
export async function renderizarPuzzle(tema, container, db, auth) {
    if (!db || !auth || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const temaDocRef = doc(db, "Cosmo", tema.docIdFirebase);

    // --- 1. GESTÃO DE LISTENERS DO BOTÃO + ---
    if (logicHandlerAtivo) {
        window.removeEventListener('cosmos:adicionarTexto', logicHandlerAtivo);
    }

    // --- 2. ESCUTA: NOTAS LOCAIS (CONTEÚDO VIVO / FERRAMENTAS) ---
    if (unsubLocal) unsubLocal();
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", uid)), (notasSnap) => {
        mapaFerramentasInterno = {};
        notasSnap.forEach(docNota => {
            const d = docNota.data();
            if (d.estado !== "ativa") return;
            if (d.caixas) d.caixas.forEach(c => {
                if (c.estado === "ativa" && c.neuroniosCosmos?.some(n => n.id === tema.id)) {
                    mapaFerramentasInterno[c.id] = { ...c, notaDocId: docNota.id, notaDadosCompletos: d };
                }
            });
        });
        reconstruirInterface(container, temaDocRef, db, auth, tema);
    });

    // --- 3. ESCUTA: DOCUMENTO DO TEMA (ESTRUTURA / CAIXAS MANUAIS) ---
    if (unsubTema) unsubTema();
    unsubTema = onSnapshot(temaDocRef, { includeMetadataChanges: true }, (docSnap) => {
        if (!docSnap.exists()) return;

        const dadosServidor = docSnap.data();
        
        // BLINDAGEM DE METADADOS: Evita o "pisca" enquanto o user escreve
        if (docSnap.metadata.hasPendingWrites) {
            dadosEstruturaTema = dadosServidor;
            return; 
        }

        // FUSÃO DE SEGURANÇA: Se estivermos a escrever, preservamos o texto local na RAM
        if (estaAEscrever && dadosEstruturaTema) {
            dadosServidor.Puzzle.quadros = dadosServidor.Puzzle.quadros.map(sq => {
                const itemNaRam = dadosEstruturaTema.Puzzle.quadros.find(l => l.id === sq.id);
                return itemNaRam ? { ...sq, conteudo: itemNaRam.conteudo } : sq;
            });
        }

        dadosEstruturaTema = dadosServidor;
        reconstruirInterface(container, temaDocRef, db, auth, tema);
    });

    // --- 4. LÓGICA ATÓMICA DO BOTÃO + ---
    logicHandlerAtivo = async () => {
        console.log("➕ [PUZZLE] Criando nova caixa de texto...");
        
        // Cancelar auto-saves pendentes para evitar sobrescrita
        if (window._puzzleTimers) {
            window._puzzleTimers.forEach(timer => clearTimeout(timer));
            window._puzzleTimers.clear();
        }
        
        estaAEscrever = true; 
        ultimoJsonRenderizado = ""; 

        // Sincronizar DOM -> RAM antes de adicionar a nova
        const quadrosNaRam = [...(dadosEstruturaTema?.Puzzle?.quadros || [])];
        container.querySelectorAll('textarea[data-id]').forEach(ta => {
            const item = quadrosNaRam.find(q => q.id === ta.dataset.id);
            if (item) item.conteudo = ta.value;
        });

        const novo = { 
            id: crypto.randomUUID(), 
            userId: uid, 
            timestamp: new Date().toISOString(), 
            estado: "ativo", 
            tipo: "caixatexto", 
            conteudo: "" 
        };

        quadrosNaRam.push(novo);
        
        // Atualizar memória local para renderização imediata (Zero Latência)
        dadosEstruturaTema.Puzzle.quadros = quadrosNaRam;
        reconstruirInterface(container, temaDocRef, db, auth, tema);

        try {
            await updateDoc(temaDocRef, { "Puzzle.quadros": quadrosNaRam });
            
            // Focar na nova caixa criada
            setTimeout(() => {
                const tas = container.querySelectorAll('textarea');
                if(tas[0]) tas[0].focus();
                setTimeout(() => { estaAEscrever = false; }, 1000);
            }, 300);
        } catch (e) { 
            console.error(e); 
            estaAEscrever = false; 
        }
    };

    // --- 5. LIGAR OUVINTE ÚNICO ---
    window.addEventListener('cosmos:adicionarTexto', logicHandlerAtivo);
}

/**
 * MOTOR DE RECONSTRUÇÃO DA INTERFACE
 */
function reconstruirInterface(container, temaRef, db, auth, temaOriginal) {
    if (!dadosEstruturaTema || !container) return;

    const quadrosManual = dadosEstruturaTema.Puzzle?.quadros || [];
    const caixasVinculo = dadosEstruturaTema.Puzzle?.caixas || [];

    // Mapear ferramentas das notas locais que pertencem a este tema
    const ferramentasParaRenderizar = caixasVinculo.map(conf => {
        const idAlvo = typeof conf === 'object' ? conf.id : conf;
        const dadosVivos = mapaFerramentasInterno[idAlvo];
        return dadosVivos ? { ...dadosVivos, timestamp: conf.timestamp || dadosVivos.timestamp, _tipoItem: 'ferramenta' } : null;
    }).filter(f => f !== null);

    // Unificar e Ordenar por data
    const listaFinal = [
        ...quadrosManual.map(q => ({ ...q, _tipoItem: 'quadro' })), 
        ...ferramentasParaRenderizar
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Evitar repintura desnecessária do DOM
    const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
    if (assinatura === ultimoJsonRenderizado) return;
    ultimoJsonRenderizado = assinatura;

    container.innerHTML = "";
    
    listaFinal.forEach((item, index) => {
        if (item._tipoItem === 'quadro') {
            const el = SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, temaRef, {
                setEstaAEscrever: (val) => { estaAEscrever = val; },
                moverItem: (idx, dir) => moverItemPuzzle(idx, dir, listaFinal, temaRef),
                apagarItem: (id) => executarApagarManual(id, temaRef)
            });
            container.appendChild(el);
        } else {
            // Renderização de Ferramenta Vinculada (Vem de uma nota)
            container.appendChild(renderFerramentaVinculada(item, index, listaFinal, temaRef, db, auth, temaOriginal));
        }
    });
}

/**
 * UI: FERRAMENTA VINCULADA (ESPELHO)
 */
function renderFerramentaVinculada(c, index, todos, ref, db, auth, temaOriginal) {
    const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const mapaFocos = { subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO };
    const corFoco = (mapaFocos[c.tipo] || FOCOS_BASE)[c.foco || "original"]?.corForte || config.cor;

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
        if(await SharedPuzzleUI.confirmarAcao("Remover Vínculo?", "Remover esta conexão em ambos os lados?")) {
            // 1. LIMPAR NO BRAIN
            const snap = await getDoc(ref);
            const novasCaixas = (snap.data().Puzzle?.caixas || []).filter(item => (typeof item === 'object' ? item.id : item) !== c.id);
            const novasDossie = (snap.data().Dossie?.Apto || []).filter(id => id !== c.id);
            await updateDoc(ref, { "Puzzle.caixas": novasCaixas, "Dossie.Apto": novasDossie });

            // 2. LIMPAR NA NOTA (SINCRONIZAÇÃO IN LIVE)
            const colecao = (c.notaDadosCompletos && c.notaDadosCompletos.onde === "share") ? "Share" : "Local";
            const notaRef = doc(db, colecao, c.notaDocId);
            const snapNota = await getDoc(notaRef);
            
            if(snapNota.exists()){
                const caixasNota = snapNota.data().caixas.map(cx => {
                    if(cx.id === c.id) {
                        cx.neuroniosCosmos = (cx.neuroniosCosmos || []).filter(n => n.id !== temaOriginal.id);
                        
                        // Atualizar popup de tags se estiver aberto
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

    div.querySelector('.btn-up').onclick = () => moverItemPuzzle(index, -1, todos, ref);
    div.querySelector('.btn-down').onclick = () => moverItemPuzzle(index, 1, todos, ref);
    div.querySelector('.btn-viajar').onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, db, auth, c.id);

    return div;
}

/**
 * MOTOR DE MOVIMENTAÇÃO (TROCA DE TIMESTAMPS)
 */
async function moverItemPuzzle(index, direcao, todos, refDoc) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= todos.length) return;

    estaAEscrever = false;
    ultimoJsonRenderizado = ""; 

    const tempTime = todos[index].timestamp;
    todos[index].timestamp = todos[novoIndex].timestamp;
    todos[novoIndex].timestamp = tempTime;

    const novosQuadros = todos.filter(i => i._tipoItem === 'quadro').map(({_tipoItem, ...rest}) => rest);
    const novasCaixas = todos.filter(i => i._tipoItem === 'ferramenta').map(i => ({ id: i.id, timestamp: i.timestamp }));

    await updateDoc(refDoc, { "Puzzle.quadros": novosQuadros, "Puzzle.caixas": novasCaixas });
}

/**
 * APAGAR CAIXA MANUAL
 */
async function executarApagarManual(id, refDoc) {
    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;
    const novos = snap.data().Puzzle.quadros.filter(item => item.id !== id);
    await updateDoc(refDoc, { "Puzzle.quadros": novos });
}