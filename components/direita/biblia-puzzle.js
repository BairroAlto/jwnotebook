// components/direita/biblia-puzzle.js
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { SharedPuzzleUI } from './shared-puzzle-ui.js';

// --- ESTADO GLOBAL DO MÓDULO (Persiste entre aberturas de versículos) ---
let unsubPuzzle = null;
let unsubLocal = null;
let dadosEstruturaVersiculo = null; 
let estaAEscrever = false;
let ferramentasMapaInterno = {};
let ultimoJsonRenderizado = "";
let infoVersiculoAtivo = null;
let currentUid = null;
let currentDb = null;
let currentAuth = null;

/**
 * LIMPEZA DE MEMÓRIA
 */
export function limparPuzzleBiblia() {
    if (unsubPuzzle) unsubPuzzle();
    if (unsubLocal) unsubLocal();
    dadosEstruturaVersiculo = null;
    ultimoJsonRenderizado = "";
    estaAEscrever = false;
}

/**
 * INICIALIZAÇÃO PRINCIPAL (Chamada ao abrir um versículo no Brain)
 */
export async function renderizarPuzzleBiblia(info, container, db, auth) {
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    currentUid = auth.currentUser.uid;
    currentDb = db;
    currentAuth = auth;
    infoVersiculoAtivo = info;

    limparPuzzleBiblia();

    console.log(`%c📡 [BRAIN-PUZZLE] Sintonizando: ${nomeCompleto}`, "color: #818cf8; font-weight: bold;");

    // 1. ESCUTA: FERRAMENTAS NAS NOTAS (Espelhamento In Live)
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", currentUid)), (snap) => {
        ferramentasMapaInterno = {};
        snap.forEach(docN => {
            const nData = docN.data();
            if (nData.estado === "ativa" && nData.caixas) {
                nData.caixas.forEach(c => {
                    if (c.estado === "ativa" && c.neuroniosBiba?.includes(nomeCompleto)) {
                        ferramentasMapaInterno[c.id] = { ...c, notaDocId: docN.id, notaDadosCompletos: nData };
                    }
                });
            }
        });
        rebuildPuzzleUI(container, db, auth);
    });

    // 2. ESCUTA: DOCUMENTO DO VERSÍCULO (Anotações do Brain)
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", currentUid), where("nome", "==", nomeCompleto));
    unsubPuzzle = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        
        if (snapshot.empty) {
            container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Usa o + para anotar este versículo.</p>`;
            dadosEstruturaVersiculo = { isNew: true, nome: nomeCompleto };
            return;
        }

        const docSnap = snapshot.docs[0];
        const dadosServidor = docSnap.data();

        // BLINDAGEM: Se o Firebase ainda está a processar a nossa escrita, ignoramos o sinal de volta
        if (docSnap.metadata.hasPendingWrites) {
            dadosEstruturaVersiculo = { ref: docSnap.ref, data: dadosServidor, isNew: false };
            return; 
        }

        // FUSÃO DE SEGURANÇA: Se estivermos a escrever, não deixamos o servidor apagar o texto local
        if (estaAEscrever && dadosEstruturaVersiculo) {
            dadosServidor.Puzzle.quadros = dadosServidor.Puzzle.quadros.map(sq => {
                const itemNaRam = dadosEstruturaVersiculo.data.Puzzle.quadros.find(l => l.id === sq.id);
                return itemNaRam ? { ...sq, conteudo: itemNaRam.conteudo } : sq;
            });
        }

        dadosEstruturaVersiculo = { ref: docSnap.ref, data: dadosServidor, isNew: false };
        rebuildPuzzleUI(container, db, auth);
    });

    // 3. REGISTO DO EVENTO PLUS (Disparado pelo index.html)
    window.removeEventListener('bible:adicionarTexto', window._bibliaHandlerPlus);
    window._bibliaHandlerPlus = acaoBotaoPlusBiblia;
    window.addEventListener('bible:adicionarTexto', (e) => {
        // Passamos as referências do container para a função conseguir agir
        window._bibliaHandlerPlus(container);
    });
}

/**
 * LÓGICA DE ADIÇÃO (UI OTIMISTA)
 */
async function acaoBotaoPlusBiblia(container) {
    if (window._brainLock) return; // Trava contra cliques triplos
    window._brainLock = true;
    setTimeout(() => { window._brainLock = false; }, 500);

    console.log("➕ [PUZZLE] Criando nova caixa...");

    estaAEscrever = true;
    ultimoJsonRenderizado = ""; // Força o refresh visual

    const novoId = crypto.randomUUID();
    const novoObjeto = { 
        id: novoId, userId: currentUid, timestamp: new Date().toISOString(), 
        estado: "ativo", tipo: "caixatexto", conteudo: "" 
    };

    try {
        if (!dadosEstruturaVersiculo || dadosEstruturaVersiculo.isNew) {
            // CRIAR PRIMEIRO REGISTO
            const novoDocData = {
                id: crypto.randomUUID(), userId: currentUid, nome: infoVersiculoAtivo.livro + " " + infoVersiculoAtivo.cap + ":" + infoVersiculoAtivo.ver,
                livro: infoVersiculoAtivo.livro, capitulo: infoVersiculoAtivo.cap, versiculo: infoVersiculoAtivo.ver,
                tipo: "textobiblico", estado: "ativo", timestamp: serverTimestamp(),
                Puzzle: { quadros: [novoObjeto] }, caixas: [], Dossie: { mica: {}, Apto: [] }
            };

            // Atualização Local (RAM)
            dadosEstruturaVersiculo = { data: novoDocData, isNew: false };
            rebuildPuzzleUI(container, currentDb, currentAuth);

            // Gravar no Firebase
            const docRef = await addDoc(collection(currentDb, "TextosBiblia"), novoDocData);
            dadosEstruturaVersiculo.ref = docRef;
        } else {
            // ATUALIZAR EXISTENTE
            const listaAtual = [...(dadosEstruturaVersiculo.data.Puzzle?.quadros || [])];
            listaAtual.push(novoObjeto);
            
            dadosEstruturaVersiculo.data.Puzzle.quadros = listaAtual;
            rebuildPuzzleUI(container, currentDb, currentAuth);

            await updateDoc(dadosEstruturaVersiculo.ref, { "Puzzle.quadros": listaAtual });
        }

        // Foco e Scroll
        setTimeout(() => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
            const ta = container.querySelector(`textarea[data-id="${novoId}"]`);
            if (ta) ta.focus();
            estaAEscrever = false;
        }, 150);

    } catch (e) {
        console.error("Erro no motor:", e);
        estaAEscrever = false;
    }
}

/**
 * MOTOR DE RENDERIZAÇÃO (ORDENAÇÃO PELO TOPO)
 */
function rebuildPuzzleUI(container, db, auth) {
    if (!dadosEstruturaVersiculo || !container || !dadosEstruturaVersiculo.data) return;

    const data = dadosEstruturaVersiculo.data;
    const caixasVinculo = data.caixas || [];
    const quadrosManuais = data.Puzzle?.quadros || [];

    const ferramentas = caixasVinculo.map(cv => {
        const id = typeof cv === 'object' ? cv.id : cv;
        const vivo = ferramentasMapaInterno[id];
        return vivo ? { ...vivo, timestamp: cv.timestamp || vivo.timestamp, _tipoItem: 'ferramenta' } : null;
    }).filter(f => f);

    // ORDENAÇÃO: Mais recente no TOPO (b - a)
    const listaFinal = [
        ...quadrosManuais.map(q => ({ ...q, _tipoItem: 'quadro' })), 
        ...ferramentas
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
    if (assinatura === ultimoJsonRenderizado) return;
    ultimoJsonRenderizado = assinatura;

    container.innerHTML = "";
    listaFinal.forEach((item, index) => {
        if (item._tipoItem === 'quadro') {
            const el = SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, dadosEstruturaVersiculo.ref, {
                setEstaAEscrever: (val) => { estaAEscrever = val; },
                moverItem: (idx, dir) => moverItemBiblia(idx, dir, listaFinal, dadosEstruturaVersiculo.ref),
                apagarItem: (id) => executarApagarManual(id, dadosEstruturaVersiculo.ref)
            });
            container.appendChild(el);
        } else {
            container.appendChild(renderFerramentaVinculadaUI(item, index, listaFinal, dadosEstruturaVersiculo.ref, db, auth));
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
                <i class="fa-solid fa-arrow-up-right-from-square btn-viajar" style="cursor:pointer; color:#818cf8;"></i>
                <i class="fa-solid fa-trash-can btn-remove" style="color:#f87171; cursor:pointer;"></i>
            </div>
        </div>
        <div style="padding:12px; font-size:13px; color:white; line-height:1.4;">
            ${c.titulo ? `<div style="font-weight:700; margin-bottom:4px; color:${corFoco};">${c.titulo}</div>` : ''}
            <div style="opacity:0.9; white-space: pre-wrap;">${c.conteudo}</div>
        </div>`;

    div.querySelector('.btn-viajar').onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, db, auth, c.id);
    return div;
}

// --- AUXILIARES ---
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

