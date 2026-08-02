// components/direita/biblia-puzzle.js
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { abrirPopupPartilhar } from '../editor/modulos/partilhar.js';
import { SharedPuzzleUI } from './shared-puzzle-ui.js';
import { isMobileViewport } from '../ui/mobile-device.js';
import { subscreverCaixasPorIds } from './biblia-associadas-cache.js';
import { mostrarCarregamentoCaixas, mostrarErroCarregamentoCaixas } from './biblia-carregamento-ui.js';

let unsubPuzzle = null;
let cancelLocalSub = null;
let dadosEstruturaVersiculo = null; 
let estaAEscrever = false;
let ferramentasMapaInterno = {};
let ultimoJsonRenderizado = "";
let infoVersiculoAtivo = null;
let currentUid = null;
let currentDb = null;
let currentAuth = null;
let estruturaVersiculoPronta = false;
let caixasAssociadasProntas = false;

export function limparPuzzleBiblia() {
    if (unsubPuzzle) unsubPuzzle();
    if (cancelLocalSub) { cancelLocalSub(); cancelLocalSub = null; }
    dadosEstruturaVersiculo = null;
    ultimoJsonRenderizado = "";
    estaAEscrever = false;
    ferramentasMapaInterno = {};
    estruturaVersiculoPronta = false;
    caixasAssociadasProntas = false;
}

function ligarCaixasDoPuzzle(container, db, auth, tStart) {
    const data = dadosEstruturaVersiculo?.data || {};
    const referencias = [
        ...(data.caixas || []),
        ...(data.Puzzle?.caixas || [])
    ];
    const ids = referencias.map(item => typeof item === "string" ? item : item?.id).filter(Boolean);

    if (!ids.length) {
        ferramentasMapaInterno = {};
        caixasAssociadasProntas = true;
        rebuildPuzzleUI(container, db, auth, tStart);
        return;
    }

    caixasAssociadasProntas = false;
    mostrarCarregamentoCaixas(container, { area: "Puzzle", cor: "#818cf8", mensagem: "A carregar caixas associadas..." });
    cancelLocalSub?.();
    cancelLocalSub = subscreverCaixasPorIds(ids, db, currentUid, (mapa, meta) => {
        if (meta?.erro) {
            caixasAssociadasProntas = true;
            mostrarErroCarregamentoCaixas(container, { area: "Puzzle", cor: "#fb7185", mensagem: "Não foi possível carregar as caixas do Puzzle." });
            return;
        }
        console.log("[BIBLE-BOX-PERF] Puzzle | caixas por IDs recebidas em " + (performance.now() - tStart).toFixed(1) + "ms | caixas: " + Object.keys(mapa).length);
        ferramentasMapaInterno = mapa;
        caixasAssociadasProntas = true;
        rebuildPuzzleUI(container, db, auth, tStart);
    });
}
export async function renderizarPuzzleBiblia(info, container, db, auth) {
    const tStart = performance.now();
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    const uid = auth.currentUser.uid;
    
    limparPuzzleBiblia();
    infoVersiculoAtivo = info;
    currentUid = uid;
    currentDb = db;
    currentAuth = auth;

    mostrarCarregamentoCaixas(container, { area: "Puzzle", cor: "#818cf8" });

    console.log(`%c📡 [BRAIN-PERF] Sintonizando versículo ${nomeCompleto}`, "color: #818cf8; font-weight: bold;");

    // O Puzzle primeiro le TextosBiblia e so depois pede os IDs das caixas associadas.

    // 3. ESCUTA 2: DOCUMENTO DO VERSICULO
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nomeCompleto));
    
    unsubPuzzle = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        const tSnapPuzzle = performance.now();
        console.log(`⏱️ [BRAIN-PERF] 'TextosBiblia' snapshot recebido em ${(tSnapPuzzle - tStart).toFixed(1)}ms`);
        if (snapshot.empty) {
            console.log("[BRAIN-PERF] Versículo pronto para a primeira anotação.");
            dadosEstruturaVersiculo = { isNew: true, nome: nomeCompleto };
            estruturaVersiculoPronta = true;
            ligarCaixasDoPuzzle(container, db, auth, tStart);
            rebuildPuzzleUI(container, db, auth, tStart);
            return;
        }

        const docSnap = snapshot.docs[0];
        const dadosServidor = docSnap.data();

        if (docSnap.metadata.hasPendingWrites) {
            dadosEstruturaVersiculo = { ref: docSnap.ref, data: dadosServidor, isNew: false };
            estruturaVersiculoPronta = true;
            ligarCaixasDoPuzzle(container, db, auth, tStart);
            rebuildPuzzleUI(container, db, auth, tStart);
            return;
        }

        if (estaAEscrever && dadosEstruturaVersiculo) {
            dadosServidor.Puzzle.quadros = dadosServidor.Puzzle.quadros.map(sq => {
                const itemNaRam = dadosEstruturaVersiculo.data.Puzzle.quadros.find(l => l.id === sq.id);
                return itemNaRam ? { ...sq, conteudo: itemNaRam.conteudo } : sq;
            });
        }

        dadosEstruturaVersiculo = { ref: docSnap.ref, data: dadosServidor, isNew: false };
        estruturaVersiculoPronta = true;
        ligarCaixasDoPuzzle(container, db, auth, tStart);
        rebuildPuzzleUI(container, db, auth, tStart);
    });

    window.removeEventListener('bible:adicionarTexto', window._activeBibliaPlusHandler);

    window._activeBibliaPlusHandler = () => {
        console.log("📥 [PUZZLE] Comando de nova caixa recebido!");
        acaoBotaoPlusBiblia(container);
    };

    window.addEventListener('bible:adicionarTexto', window._activeBibliaPlusHandler);
}

async function acaoBotaoPlusBiblia(container) {
    if (window._brainLock) return; 
    window._brainLock = true;
    setTimeout(() => { window._brainLock = false; }, 500);

    console.log("➕ [PUZZLE] Sincronizando e criando nova caixa...");

    estaAEscrever = true;
    ultimoJsonRenderizado = ""; 

    if (dadosEstruturaVersiculo && dadosEstruturaVersiculo.data) {
        const quadrosNaRam = dadosEstruturaVersiculo.data.Puzzle?.quadros || [];
        
        container.querySelectorAll('textarea[data-id]').forEach(ta => {
            const id = ta.dataset.id;
            const textoNoEcrã = ta.value;
            
            const quadroAlvo = quadrosNaRam.find(q => q.id === id);
            if (quadroAlvo) {
                quadroAlvo.conteudo = textoNoEcrã;
            }
        });
    }

    const novoId = crypto.randomUUID();
    const novoObjeto = { 
        id: novoId, 
        userId: currentUid, 
        timestamp: new Date().toISOString(), 
        estado: "on", 
        tipo: "caixatexto", 
        conteudo: "" 
    };

    try {
        if (!dadosEstruturaVersiculo || dadosEstruturaVersiculo.isNew) {
            const novoDoc = {
                id: crypto.randomUUID(),
                userId: currentUid,
                nome: infoVersiculoAtivo.livro + " " + infoVersiculoAtivo.cap + ":" + infoVersiculoAtivo.ver,
                livro: infoVersiculoAtivo.livro,
                capitulo: infoVersiculoAtivo.cap,
                versiculo: infoVersiculoAtivo.ver,
                tipo: "textobiblico",
                estado: "on",
                timestamp: serverTimestamp(),
                Puzzle: { quadros: [novoObjeto] },
                caixas: [],
                Dossie: { mica: {}, Apto: [] }
            };
            dadosEstruturaVersiculo = { data: novoDoc, isNew: false };
            rebuildPuzzleUI(container, currentDb, currentAuth);
            const docRef = await addDoc(collection(currentDb, "TextosBiblia"), novoDoc);
            dadosEstruturaVersiculo.ref = docRef;
        } else {
            const lista = [...(dadosEstruturaVersiculo.data.Puzzle?.quadros || []), novoObjeto];
            dadosEstruturaVersiculo.data.Puzzle.quadros = lista;
            
            rebuildPuzzleUI(container, currentDb, currentAuth);
            await updateDoc(dadosEstruturaVersiculo.ref, { "Puzzle.quadros": lista });
        }

        setTimeout(() => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
            const ta = container.querySelector(`textarea[data-id="${novoId}"]`);
            if (ta) ta.focus();
            estaAEscrever = false;
        }, 150);

    } catch (e) {
        console.error("Erro ao adicionar caixa:", e);
        estaAEscrever = false;
    }
}

function rebuildPuzzleUI(container, db, auth, tStart = performance.now()) {
    if (!container) {
        console.warn("⚠️ [BRAIN-PERF] rebuildPuzzleUI cancelado: container ausente");
        return;
    }

    if (!estruturaVersiculoPronta || !caixasAssociadasProntas) {
        const mensagem = estruturaVersiculoPronta
            ? "A carregar caixas associadas..."
            : "A preparar o Puzzle...";
        mostrarCarregamentoCaixas(container, { area: "Puzzle", cor: "#818cf8", mensagem });
        return;
    }

    const tRenderStart = performance.now();
    const data = dadosEstruturaVersiculo?.data;
    const caixasVinculo = data?.caixas || [];
    const quadrosManuais = data?.Puzzle?.quadros || [];

    let ferramentas = [];
    if (caixasVinculo.length > 0) {
        ferramentas = caixasVinculo.map(cv => {
            const id = typeof cv === 'object' ? cv.id : cv;
            const vivo = ferramentasMapaInterno[id];
            return vivo ? { ...vivo, timestamp: cv.timestamp || vivo.timestamp, _tipoItem: 'ferramenta' } : null;
        }).filter(f => f);
    } else {
        ferramentas = Object.values(ferramentasMapaInterno).map(vivo => ({
            ...vivo,
            _tipoItem: 'ferramenta'
        }));
    }

    const listaFinal = [
        ...quadrosManuais.map(q => ({ ...q, _tipoItem: 'quadro' })), 
        ...ferramentas
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const temSkeleton = container.querySelector('.brain-loading-skeleton') !== null;
    console.log(`⏱️ [BRAIN-PERF] rebuildPuzzleUI executado. Total itens: ${listaFinal.length} (Manuais: ${quadrosManuais.length}, RAM: ${ferramentas.length}). Skeleton visível: ${temSkeleton}`);

    if (listaFinal.length > 0) {
        const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
        if (!temSkeleton && assinatura === ultimoJsonRenderizado) {
            console.log("⏱️ [BRAIN-PERF] Ignorado render: conteúdo idêntico já no DOM.");
            return;
        }
        ultimoJsonRenderizado = assinatura;

        container.innerHTML = "";
        listaFinal.forEach((item, index) => {
            if (item._tipoItem === 'quadro') {
                const el = SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, dadosEstruturaVersiculo?.ref, {
                    setEstaAEscrever: (val) => { estaAEscrever = val; },
                    moverItem: (idx, dir) => moverItemBiblia(idx, dir, listaFinal, dadosEstruturaVersiculo?.ref),
                    apagarItem: (id) => executarApagarManual(id, dadosEstruturaVersiculo?.ref),
                    enviarItem: (item) => abrirPopupPartilhar(item, "__PUZZLE__", () => {})
                });
                container.appendChild(el);
            } else {
                container.appendChild(renderFerramentaVinculadaUI(item, index, listaFinal, dadosEstruturaVersiculo?.ref, db, auth));
            }
        });
        console.log(`%c⚡ [BRAIN-PERF] UI Renderizada com sucesso! Total: ${(performance.now() - tStart).toFixed(1)}ms (DOM: ${(performance.now() - tRenderStart).toFixed(1)}ms)`, "color: #34d399; font-weight: bold;");
        console.log("[BIBLE-BOX-PERF] Puzzle | caixas visíveis no DOM em " + (performance.now() - tStart).toFixed(1) + "ms | total: " + ferramentas.length);
        return;
    }

    if (dadosEstruturaVersiculo) {
        console.log("ℹ️ [BRAIN-PERF] Lista de caixas vazia. Exibindo estado inicial.");
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Usa o + para anotar este versículo.</p>`;
        ultimoJsonRenderizado = "empty";
    } else {
        console.log("⏳ [BRAIN-PERF] Lista vazia e dadosEstruturaVersiculo pendente. Skeleton mantido.");
    }
}

function renderFerramentaVinculadaUI(item, index, listaCompleta, docRef, db, auth) {
    const config = IDENTIDADE_FERRAMENTAS[item.tipo] || IDENTIDADE_FERRAMENTAS.contentor || { icon: 'fa-solid fa-box', cor: '#ea580c', nome: 'Contentor' };
    const mapaFocos = { subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO };
    const corFoco = item.corFocus || (mapaFocos[item.tipo] || FOCOS_BASE)[item.foco || "original"]?.corForte || config.cor || '#ea580c';
    const nomeNota = item.notaDadosCompletos?.titulo || item.notaDadosCompletos?.nome || "Nota sem título";
    const tipoNome = config.nome || item.tipo || "Ferramenta";

    const card = document.createElement('div');
    card.style.cssText = `border-left: 4px solid ${corFoco}; background: rgba(255,255,255,0.03); margin-bottom: 12px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);`;

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background: ${corFoco}18; border-bottom: 1px solid rgba(255,255,255,0.04);">
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden; max-width:75%;">
                <span style="font-size:10px; font-weight:800; color:${corFoco}; text-transform:uppercase; display:flex; align-items:center; gap:5px; flex-shrink:0;">
                    <i class="${config.icon}"></i> ${tipoNome}
                </span>
                <span style="font-size:11px; font-weight:600; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <i class="fa-regular fa-file-lines" style="margin-left:4px; margin-right:2px; opacity:0.6;"></i> ${nomeNota}
                </span>
            </div>
            <div style="display:flex; gap:12px; align-items:center; flex-shrink:0;">
                <button class="btn-viajar" title="Ir para a nota" style="background:none; border:none; color:#818cf8; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                <button class="btn-enviar" title="Enviar para uma nota" style="background:none; border:none; color:#a5b4fc; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-paper-plane"></i></button>
                <button class="btn-desvincular" title="Desvincular" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
        <div style="padding:12px; font-size:13px; color:#e2e8f0; line-height:1.5;">
            ${item.titulo ? `<div style="font-weight:700; margin-bottom:6px; color:${corFoco}; font-size:13px;">${item.titulo}</div>` : ''}
            <p style="margin:0; white-space: pre-wrap; font-size:13.5px; color:#cbd5e1;">${item.conteudo || "Caixa vazia"}</p>
        </div>
    `;

    card.querySelector('.btn-enviar').onclick = (e) => {
        e.stopPropagation();
        abrirPopupPartilhar(item, "__PUZZLE__", () => {});
    };
    card.querySelector('.btn-viajar').onclick = (e) => {
        e.stopPropagation();
        if (window.location.pathname.includes('biblia.html') && !isMobileViewport()) {
            const origem = item.onde === "share" ? "&onde=share" : "";
            window.open(`index.html?nota=${item.notaDocId}&caixa=${item.id}${origem}`, '_blank');
        } else {
            abrirNotaNoEditor(
                item.notaDocId,
                { ...item.notaDadosCompletos, onde: item.onde || "local" },
                db,
                auth,
                item.id
            );
        }
    };

    card.querySelector('.btn-desvincular').onclick = async (e) => {
        e.stopPropagation();
        if (confirm("Desvincular esta caixa do versículo?")) {
            const novasCaixas = listaCompleta.filter(i => i.id !== item.id && i._tipoItem === 'ferramenta').map(i => i.id);
            await updateDoc(docRef, { caixas: novasCaixas });
        }
    };

    return card;
}

async function moverItemBiblia(index, direcao, listaCompleta, docRef) {
    const targetIdx = index + direcao;
    if (targetIdx < 0 || targetIdx >= listaCompleta.length) return;
    const temp = listaCompleta[index];
    listaCompleta[index] = listaCompleta[targetIdx];
    listaCompleta[targetIdx] = temp;

    const quadros = listaCompleta.filter(i => i._tipoItem === 'quadro');
    await updateDoc(docRef, { "Puzzle.quadros": quadros });
}

async function executarApagarManual(id, docRef) {
    if (!dadosEstruturaVersiculo?.data) return;
    const quadros = dadosEstruturaVersiculo.data.Puzzle.quadros.filter(q => q.id !== id);
    dadosEstruturaVersiculo.data.Puzzle.quadros = quadros;
    await updateDoc(docRef, { "Puzzle.quadros": quadros });
}
