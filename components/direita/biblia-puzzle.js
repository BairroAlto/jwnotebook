// components/direita/biblia-puzzle.js
import { collection, query, where, getDocs, addDoc, updateDoc, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO, abrirPaleta } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { abrirPopupPartilhar } from '../editor/modulos/partilhar.js';
import { SharedPuzzleUI } from './shared-puzzle-ui.js';
import { isMobileViewport } from '../ui/mobile-device.js';
import { subscreverCaixasPorIds, subscreverCaixasAssociadas } from './biblia-associadas-cache.js';
import { mostrarCarregamentoCaixas, mostrarErroCarregamentoCaixas } from './biblia-carregamento-ui.js';
import { abrirPopupCodexBiblia } from '../bible-portal/bible-codex.js';
import { BibleSettings } from '../bible-portal/bible-settings.js';
import { agendarGravacaoPuzzle, cancelarGravacaoPuzzle, executarGravacaoPuzzle, limparGravacoesPuzzle } from './bible-puzzle-editor.js';
import { criarEstadoCaixasSublinhado } from './bible-puzzle-highlight-status.js';
import { ajustarAlturaTextarea } from '../ui/textarea-autosize.js';

let unsubPuzzle = null;
let unsubPuzzleCapitulo = null;
let cancelLocalSub = null;
let cancelVerseSub = null;
let dadosEstruturaVersiculo = null; 
let ferramentasMapaInterno = {};
let ultimoJsonRenderizado = "";
let infoVersiculoAtivo = null;
let currentUid = null;
let currentDb = null;
let currentAuth = null;
let estruturaVersiculoPronta = false;
let caixasAssociadasProntas = false;
let caixasVersiculoProntas = false;
let caixasAssociadasVersiculo = {};
let filtroSublinhado = null;
let estruturasCapitulo = [];
let assinaturaCaixasLigadas = null;
let handlerVisibilidadeCodex = null;
const rascunhosItens = new Map();

export function limparPuzzleBiblia() {
    limparGravacoesPuzzle({ gravar: true });
    if (unsubPuzzle) { unsubPuzzle(); unsubPuzzle = null; }
    if (unsubPuzzleCapitulo) { unsubPuzzleCapitulo(); unsubPuzzleCapitulo = null; }
    if (cancelLocalSub) { cancelLocalSub(); cancelLocalSub = null; }
    if (cancelVerseSub) { cancelVerseSub(); cancelVerseSub = null; }
    if (handlerVisibilidadeCodex) {
        window.removeEventListener('bible:codex-visibility-change', handlerVisibilidadeCodex);
        handlerVisibilidadeCodex = null;
    }
    dadosEstruturaVersiculo = null;
    ultimoJsonRenderizado = "";
    ferramentasMapaInterno = {};
    estruturaVersiculoPronta = false;
    caixasAssociadasProntas = false;
    caixasVersiculoProntas = false;
    caixasAssociadasVersiculo = {};
    filtroSublinhado = null;
    estruturasCapitulo = [];
    assinaturaCaixasLigadas = null;
    rascunhosItens.clear();
}

function aplicarRascunhos(data = {}) {
    const listas = [data.Puzzle?.quadros, data.caixas].filter(Array.isArray);

    rascunhosItens.forEach((patch, id) => {
        listas.forEach(lista => {
            const item = lista.find(elemento => String(elemento?.id) === String(id));
            if (item) Object.assign(item, patch);
        });
    });

    return data;
}

function registarRascunho(id, patch) {
    const chave = String(id);
    rascunhosItens.set(chave, {
        ...(rascunhosItens.get(chave) || {}),
        ...patch
    });

    const dadosConhecidos = [
        dadosEstruturaVersiculo?.data,
        ...estruturasCapitulo.map(estrutura => estrutura.data)
    ].filter(Boolean);

    dadosConhecidos.forEach(data => {
        [data.Puzzle?.quadros, data.caixas].filter(Array.isArray).forEach(lista => {
            const item = lista.find(elemento => String(elemento?.id) === chave);
            if (item) Object.assign(item, patch);
        });
    });
}

function ligarCaixasDoPuzzle(container, db, auth, tStart) {
    const data = dadosEstruturaVersiculo?.data || {};
    const referencias = [
        ...(Array.isArray(data.caixas) ? data.caixas : []).filter(item => {
            if (typeof item === "string") return true;
            return item && !item.tipo;
        }),
        ...(data.Puzzle?.caixas || [])
    ];
    const ids = [...new Set(referencias
        .map(item => typeof item === "string" ? item : item?.id)
        .filter(Boolean)
        .map(String))].sort();
    const assinaturaIds = JSON.stringify(ids);

    if (!ids.length) {
        cancelLocalSub?.();
        cancelLocalSub = null;
        assinaturaCaixasLigadas = assinaturaIds;
        ferramentasMapaInterno = {};
        caixasAssociadasProntas = true;
        rebuildPuzzleUI(container, db, auth, tStart);
        return;
    }

    // O documento TextosBiblia recebe snapshots em cada autosave. As caixas
    // externas só precisam de nova leitura quando os respectivos IDs mudam.
    if (assinaturaCaixasLigadas === assinaturaIds) {
        if (caixasAssociadasProntas) rebuildPuzzleUI(container, db, auth, tStart);
        return;
    }

    assinaturaCaixasLigadas = assinaturaIds;
    caixasAssociadasProntas = false;
    if (!container.contains(document.activeElement)) {
        mostrarCarregamentoCaixas(container, { area: "Puzzle", cor: "#818cf8", mensagem: "A carregar caixas associadas..." });
    }
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
export async function renderizarPuzzleBiblia(info, container, db, auth, referenciaSublinhado = null) {
    const tStart = performance.now();
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    const uid = auth.currentUser.uid;
    
    limparPuzzleBiblia();
    infoVersiculoAtivo = info;
    currentUid = uid;
    currentDb = db;
    currentAuth = auth;
    filtroSublinhado = referenciaSublinhado;
    handlerVisibilidadeCodex = () => {
        ultimoJsonRenderizado = "";
        rebuildPuzzleUI(container, db, auth, tStart);
    };
    window.addEventListener('bible:codex-visibility-change', handlerVisibilidadeCodex);

    mostrarCarregamentoCaixas(container, { area: "Puzzle", cor: "#818cf8" });

    cancelVerseSub = subscreverCaixasAssociadas(nomeCompleto, db, uid, (mapa) => {
        caixasAssociadasVersiculo = mapa || {};
        caixasVersiculoProntas = true;
        rebuildPuzzleUI(container, db, auth, tStart);
    });

    console.log(`%c📡 [BRAIN-PERF] Sintonizando versículo ${nomeCompleto}`, "color: #818cf8; font-weight: bold;");

    // O Puzzle primeiro le TextosBiblia e so depois pede os IDs das caixas associadas.

    // 3. ESCUTA 2: DOCUMENTO DO VERSICULO
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nomeCompleto));
    
    const qCapitulo = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("livro", "==", info.livro));
    unsubPuzzleCapitulo = onSnapshot(qCapitulo, { includeMetadataChanges: true }, (snapshot) => {
        estruturasCapitulo = snapshot.docs
            .filter(docSnap => Number(docSnap.data()?.capitulo) === Number(info.cap))
            .map(docSnap => ({ ref: docSnap.ref, data: aplicarRascunhos(docSnap.data()) }));
        rebuildPuzzleUI(container, db, auth, tStart);
    });
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
        const dadosServidor = aplicarRascunhos(docSnap.data());

        if (docSnap.metadata.hasPendingWrites) {
            dadosEstruturaVersiculo = { ref: docSnap.ref, data: dadosServidor, isNew: false };
            estruturaVersiculoPronta = true;
            ligarCaixasDoPuzzle(container, db, auth, tStart);
            rebuildPuzzleUI(container, db, auth, tStart);
            return;
        }

        dadosEstruturaVersiculo = { ref: docSnap.ref, data: dadosServidor, isNew: false };
        estruturaVersiculoPronta = true;
        ligarCaixasDoPuzzle(container, db, auth, tStart);
        rebuildPuzzleUI(container, db, auth, tStart);
    });

    window.removeEventListener('bible:adicionarTexto', window._activeBibliaPlusHandler);

    window._activeBibliaPlusHandler = (event) => {
        console.log("📥 [PUZZLE] Comando de nova caixa recebido!");
        const detail = event?.detail || {};
        // Aceita o formato actual e o formato directo antigo sem perder a
        // ligação entre a caixa criada e o sublinhado seleccionado.
        const referencia = detail.referenciaSublinhado || (
            Array.isArray(detail.groupIds) && detail.groupIds.length ? detail : null
        );
        acaoBotaoPlusBiblia(container, referencia, detail.tipo || null);
    };

    window.addEventListener('bible:adicionarTexto', window._activeBibliaPlusHandler);
}

async function acaoBotaoPlusBiblia(container, referenciaSublinhado = null, tipoForcado = null) {
    if (window._brainLock || !infoVersiculoAtivo || !currentDb || !currentUid) return;
    window._brainLock = true;

    try {
        const contexto = referenciaSublinhado?.groupIds?.length
            ? referenciaSublinhado
            : filtroSublinhado;
        const escolha = tipoForcado || await SharedPuzzleUI.abrirPopupTipoNota(contexto);
        if (!escolha) return;

        console.log("➕ [PUZZLE] A criar item do tipo:", escolha);
        ultimoJsonRenderizado = "";
        capturarQuadrosEmEdicao(container);

        if (escolha === "simples") {
            await adicionarNotaSimplesBiblia(container, contexto);
        } else if (escolha === "conectora") {
            await adicionarCaixaConectoraBiblia(container, contexto);
        }
    } catch (erro) {
        console.error("Erro ao adicionar item ao Puzzle:", erro);
    } finally {
        window._brainLock = false;
    }
}

function obterNeuroniosDaReferencia(referenciaSublinhado = null) {
    const versiculos = (referenciaSublinhado?.fragmentos || [])
        .map(fragmento => fragmento.versiculo)
        .filter(Boolean)
        .map(versiculo => infoVersiculoAtivo.livro + " " + infoVersiculoAtivo.cap + ":" + versiculo);
    return [...new Set(versiculos.length ? versiculos : [infoVersiculoAtivo.livro + " " + infoVersiculoAtivo.cap + ":" + infoVersiculoAtivo.ver])];
}

function capturarQuadrosEmEdicao(container) {
    const quadros = dadosEstruturaVersiculo?.data?.Puzzle?.quadros;
    if (!Array.isArray(quadros)) return;

    container.querySelectorAll('textarea[data-id]').forEach(textarea => {
        const quadro = quadros.find(item => item.id === textarea.dataset.id);
        if (quadro) registarRascunho(quadro.id, { conteudo: textarea.value });
    });
}

function criarDocumentoVersiculo(quadros = [], caixas = []) {
    return {
        id: crypto.randomUUID(),
        userId: currentUid,
        nome: infoVersiculoAtivo.livro + " " + infoVersiculoAtivo.cap + ":" + infoVersiculoAtivo.ver,
        livro: infoVersiculoAtivo.livro,
        capitulo: infoVersiculoAtivo.cap,
        versiculo: infoVersiculoAtivo.ver,
        tipo: "textobiblico",
        estado: "on",
        timestamp: serverTimestamp(),
        Puzzle: { quadros, caixas: [] },
        caixas,
        Dossie: { mica: {}, Apto: [] }
    };
}

function obterVersiculosDaReferencia(referenciaSublinhado = null) {
    return [...new Set(
        (referenciaSublinhado?.fragmentos || [])
            .map(fragmento => Number(fragmento.versiculo))
            .filter(Boolean)
    )];
}

function criarDocumentoVersiculoBase(versiculo) {
    return {
        id: crypto.randomUUID(),
        userId: currentUid,
        nome: infoVersiculoAtivo.livro + " " + infoVersiculoAtivo.cap + ":" + versiculo,
        livro: infoVersiculoAtivo.livro,
        capitulo: infoVersiculoAtivo.cap,
        versiculo,
        tipo: "textobiblico",
        estado: "on",
        timestamp: serverTimestamp(),
        Puzzle: { quadros: [], caixas: [] },
        caixas: [],
        Dossie: { mica: {}, Apto: [] }
    };
}

async function obterDocumentosDosVersiculos(referenciaSublinhado) {
    const versiculos = obterVersiculosDaReferencia(referenciaSublinhado);
    if (versiculos.length <= 1) return [];

    const qCapitulo = query(
        collection(currentDb, "TextosBiblia"),
        where("userId", "==", currentUid),
        where("livro", "==", infoVersiculoAtivo.livro)
    );
    const snapshot = await getDocs(qCapitulo);
    const porVersiculo = new Map(snapshot.docs.filter(docSnap => Number(docSnap.data()?.capitulo) === Number(infoVersiculoAtivo.cap)).map(docSnap => [Number(docSnap.data()?.versiculo), docSnap]));
    const documentos = [];

    for (const versiculo of versiculos) {
        let docSnap = porVersiculo.get(versiculo);
        if (!docSnap) {
            const novoDoc = await addDoc(collection(currentDb, "TextosBiblia"), criarDocumentoVersiculoBase(versiculo));
            docSnap = await getDoc(novoDoc);
        }
        if (docSnap) documentos.push(docSnap);
    }

    return documentos;
}

async function sincronizarItemNosVersiculos(item, campo, referenciaSublinhado = item?.referenciaSublinhado) {
    const documentos = await obterDocumentosDosVersiculos(referenciaSublinhado);
    for (const docSnap of documentos) {
        const data = docSnap.data() || {};
        const listaAtual = campo === "caixas"
            ? (Array.isArray(data.caixas) ? data.caixas : [])
            : (Array.isArray(data.Puzzle?.quadros) ? data.Puzzle.quadros : []);
        const listaNova = listaAtual.some(itemAtual => itemAtual?.id === item.id)
            ? listaAtual.map(itemAtual => itemAtual?.id === item.id ? { ...itemAtual, ...item } : itemAtual)
            : [...listaAtual, item];

        await updateDoc(docSnap.ref, campo === "caixas"
            ? { caixas: listaNova }
            : { "Puzzle.quadros": listaNova });
    }
}

function obterListaItem(data, campo) {
    return campo === "caixas"
        ? (Array.isArray(data?.caixas) ? data.caixas : [])
        : (Array.isArray(data?.Puzzle?.quadros) ? data.Puzzle.quadros : []);
}

async function atualizarItemSincronizado(id, campo, patch, docRefOrigem = null) {
    const documentos = new Map();
    const adicionarDocumento = (ref, data) => {
        if (!ref?.id || !obterListaItem(data, campo).some(item => String(item?.id) === String(id))) return;
        documentos.set(ref.id, { ref, data });
    };

    adicionarDocumento(dadosEstruturaVersiculo?.ref, dadosEstruturaVersiculo?.data);
    estruturasCapitulo.forEach(estrutura => adicionarDocumento(estrutura.ref, estrutura.data));

    if (docRefOrigem?.id && !documentos.has(docRefOrigem.id)) {
        const snap = await getDoc(docRefOrigem);
        if (snap.exists()) adicionarDocumento(docRefOrigem, snap.data());
    }

    await Promise.all([...documentos.values()].map(async ({ ref, data }) => {
        const listaNova = obterListaItem(data, campo).map(item =>
            String(item?.id) === String(id) ? { ...item, ...patch } : item
        );

        if (campo === "caixas") data.caixas = listaNova;
        else data.Puzzle = { ...(data.Puzzle || {}), quadros: listaNova };

        await updateDoc(ref, campo === "caixas"
            ? { caixas: listaNova }
            : { "Puzzle.quadros": listaNova });
    }));
}
async function adicionarNotaSimplesBiblia(container, referenciaSublinhado = null) {
    const temReferenciaSublinhado = Boolean(
        referenciaSublinhado?.groupIds?.length || referenciaSublinhado?.groupId
    );
    const novoObjeto = {
        id: crypto.randomUUID(),
        userId: currentUid,
        neuroniosBiba: obterNeuroniosDaReferencia(referenciaSublinhado),
        timestamp: new Date().toISOString(),
        estado: "on",
        tipo: "caixatexto",
        conteudo: "",
        ...(temReferenciaSublinhado ? { referenciaSublinhado } : {})
    };

    if (!dadosEstruturaVersiculo || dadosEstruturaVersiculo.isNew) {
        const novoDoc = criarDocumentoVersiculo([novoObjeto]);
        const docRef = await addDoc(collection(currentDb, "TextosBiblia"), novoDoc);
        dadosEstruturaVersiculo = { ref: docRef, data: novoDoc, isNew: false };
    } else {
        const lista = [...(dadosEstruturaVersiculo.data.Puzzle?.quadros || []), novoObjeto];
        dadosEstruturaVersiculo.data.Puzzle = {
            ...(dadosEstruturaVersiculo.data.Puzzle || {}),
            quadros: lista
        };
        await updateDoc(dadosEstruturaVersiculo.ref, { "Puzzle.quadros": lista });
    }
    await sincronizarItemNosVersiculos(novoObjeto, "Puzzle.quadros", referenciaSublinhado);

    rebuildPuzzleUI(container, currentDb, currentAuth);
    setTimeout(() => {
        container.scrollTo({ top: 0, behavior: "smooth" });
        container.querySelector('textarea[data-id="' + novoObjeto.id + '"]')?.focus();
    }, 150);
}

async function adicionarCaixaConectoraBiblia(container, referenciaSublinhado = null) {
    const temReferenciaSublinhado = Boolean(
        referenciaSublinhado?.groupIds?.length || referenciaSublinhado?.groupId
    );
    const dataAtual = dadosEstruturaVersiculo?.data;
    const caixasAtuais = Array.isArray(dataAtual?.caixas) ? [...dataAtual.caixas] : [];
    const agora = new Date().toISOString();
    const novaCaixa = {
        id: crypto.randomUUID(),
        userId: currentUid,
        neuroniosBiba: obterNeuroniosDaReferencia(referenciaSublinhado),
        conteudo: "",
        estado: "on",
        foco: "original",
        ordem: caixasAtuais.length + 1,
        protecao: "fechado",
        timedelete: null,
        timestamp: agora,
        tipo: "contentor",
        titulo: "",
        codex: [],
        ...(temReferenciaSublinhado ? { referenciaSublinhado } : {})
    };

    if (!dadosEstruturaVersiculo || dadosEstruturaVersiculo.isNew) {
        const novoDoc = criarDocumentoVersiculo([], [novaCaixa]);
        const docRef = await addDoc(collection(currentDb, "TextosBiblia"), novoDoc);
        dadosEstruturaVersiculo = { ref: docRef, data: novoDoc, isNew: false };
    } else {
        const novasCaixas = [...caixasAtuais, novaCaixa];
        dadosEstruturaVersiculo.data.caixas = novasCaixas;
        await updateDoc(dadosEstruturaVersiculo.ref, { caixas: novasCaixas });
    }
    await sincronizarItemNosVersiculos(novaCaixa, "caixas", referenciaSublinhado);

    rebuildPuzzleUI(container, currentDb, currentAuth);
    setTimeout(() => container.scrollTo({ top: 0, behavior: "smooth" }), 150);
}
function rebuildPuzzleUI(container, db, auth, tStart = performance.now()) {
    if (!container) {
        console.warn("⚠️ [BRAIN-PERF] rebuildPuzzleUI cancelado: container ausente");
        return;
    }

    const editorEmFoco = () => {
        const elementoActivo = document.activeElement;
        return Boolean(
            elementoActivo &&
            container.contains(elementoActivo) &&
            elementoActivo.matches('textarea, input, [contenteditable="true"]')
        );
    };

    // Uma actualização live do Firebase não deve substituir o campo que o
    // utilizador está a editar, porque isso remove o cursor e o foco.
    if (!container.__bibliaPuzzleFocusOutHandler) {
        container.__bibliaPuzzleFocusOutHandler = () => {
            setTimeout(() => {
                if (container.__bibliaPuzzleRenderPendente && !editorEmFoco()) {
                    container.__bibliaPuzzleRenderPendente = false;
                    rebuildPuzzleUI(container, currentDb, currentAuth);
                }
            }, 0);
        };
        container.addEventListener('focusout', container.__bibliaPuzzleFocusOutHandler);
    }

    if (editorEmFoco()) {
        container.__bibliaPuzzleRenderPendente = true;
        return;
    }

    container.__bibliaPuzzleRenderPendente = false;

    if (!estruturaVersiculoPronta || !caixasAssociadasProntas || !caixasVersiculoProntas) {
        const mensagem = estruturaVersiculoPronta
            ? "A carregar caixas associadas..."
            : "A preparar o Puzzle...";
        mostrarCarregamentoCaixas(container, { area: "Puzzle", cor: "#818cf8", mensagem });
        return;
    }

    const tRenderStart = performance.now();
    const data = dadosEstruturaVersiculo?.data;
    const caixasVinculo = Array.isArray(data?.caixas) ? data.caixas : [];
    const gruposFiltro = filtroSublinhado?.groupIds || [];
    const pertenceAoSublinhado = item => {
        if (!gruposFiltro.length) return true;
        const referencia = item?.referenciaSublinhado;
        const gruposItem = referencia?.groupIds || (referencia?.groupId ? [referencia.groupId] : []);
        return gruposItem.some(groupId => gruposFiltro.includes(groupId));
    };
    const itemExtraPertenceAoVersiculo = item => {
        if (gruposFiltro.length) return pertenceAoSublinhado(item);
        return (item?.referenciaSublinhado?.fragmentos || []).some(fragmento => Number(fragmento.versiculo) === Number(infoVersiculoAtivo.ver));
    };

    const caixasDirectas = caixasVinculo
        .filter(item => item && typeof item === "object" && item.tipo && item.estado !== "off")
        .filter(pertenceAoSublinhado)
        .map(item => ({ ...item, _tipoItem: "caixa-directa" }));
    const referenciasCaixas = caixasVinculo.filter(item => {
        if (typeof item === "string") return true;
        return item && !item.tipo;
    });
    const quadrosManuais = (data?.Puzzle?.quadros || []).filter(pertenceAoSublinhado);
    const estruturasExtras = estruturasCapitulo.filter(estrutura => estrutura.ref?.id !== dadosEstruturaVersiculo?.ref?.id);
    const caixasDirectasExtras = estruturasExtras.flatMap(estrutura => (estrutura.data?.caixas || [])
        .filter(item => item && typeof item === "object" && item.tipo && item.estado !== "off" && itemExtraPertenceAoVersiculo(item))
        .map(item => ({ ...item, _tipoItem: "caixa-directa", _docRef: estrutura.ref })));
    const quadrosManuaisExtras = estruturasExtras.flatMap(estrutura => (estrutura.data?.Puzzle?.quadros || [])
        .filter(itemExtraPertenceAoVersiculo)
        .map(item => ({ ...item, _tipoItem: "quadro", _docRef: estrutura.ref })));

    let ferramentasLigadas = [];
    if (referenciasCaixas.length > 0) {
        ferramentasLigadas = referenciasCaixas.map(cv => {
            const id = typeof cv === 'object' ? cv.id : cv;
            const vivo = ferramentasMapaInterno[id];
            return vivo ? { ...vivo, timestamp: cv.timestamp || vivo.timestamp, _tipoItem: 'ferramenta' } : null;
        }).filter(f => f);
    } else {
        ferramentasLigadas = Object.values(ferramentasMapaInterno).map(vivo => ({
            ...vivo,
            _tipoItem: 'ferramenta'
        }));
    }

    const ferramentasVisiveis = [...ferramentasLigadas, ...Object.values(caixasAssociadasVersiculo)]
        .filter((item, index, lista) => item && item.estado !== "off" && pertenceAoSublinhado(item) && lista.findIndex(outro => outro.id === item.id) === index)
        .map(item => ({ ...item, _tipoItem: "ferramenta" }));
    const listaFinal = [
        ...quadrosManuais.map(q => ({ ...q, _tipoItem: 'quadro' })),
        ...quadrosManuaisExtras,
        ...caixasDirectas,
        ...caixasDirectasExtras,
        ...ferramentasVisiveis
    ].filter((item, index, lista) => item?.id && lista.findIndex(outro => outro?.id === item.id) === index)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const temSkeleton = container.querySelector('.brain-loading-skeleton') !== null;
    console.log(`⏱️ [BRAIN-PERF] rebuildPuzzleUI executado. Total itens: ${listaFinal.length} (Manuais: ${quadrosManuais.length}, RAM: ${ferramentasLigadas.length}). Skeleton visível: ${temSkeleton}`);

    if (listaFinal.length > 0) {
        const assinatura = JSON.stringify(listaFinal.map(i => ({
            id: i.id,
            txt: i.conteudo,
            codex: Array.isArray(i.codex) ? i.codex.flat() : []
        })));
        if (!temSkeleton && assinatura === ultimoJsonRenderizado) {
            console.log("⏱️ [BRAIN-PERF] Ignorado render: conteúdo idêntico já no DOM.");
            return;
        }
        ultimoJsonRenderizado = assinatura;

        container.innerHTML = "";
        if (gruposFiltro.length) {
            container.appendChild(criarEstadoCaixasSublinhado(filtroSublinhado, listaFinal.length));
        }
        listaFinal.forEach((item, index) => {
            if (item._tipoItem === 'caixa-directa') {
                container.appendChild(renderCaixaConectoraBiblia(item, index, listaFinal, item._docRef || dadosEstruturaVersiculo?.ref, container));
            } else if (item._tipoItem === 'quadro') {
                const el = SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, dadosEstruturaVersiculo?.ref, {
                    setEstaAEscrever: () => {},
                    atualizarRascunho: (quadro, conteudo) => registarRascunho(quadro.id, { conteudo }),
                    atualizarItem: (quadro, conteudo) => atualizarItemSincronizado(
                        quadro.id,
                        "Puzzle.quadros",
                        { conteudo },
                        quadro._docRef || dadosEstruturaVersiculo?.ref
                    ),
                    moverItem: (idx, dir) => moverItemBiblia(idx, dir, listaFinal, dadosEstruturaVersiculo?.ref, container),
                    apagarItem: (id, quadro) => executarApagarManual(id, quadro?._docRef || dadosEstruturaVersiculo?.ref),
                    enviarItem: (item) => abrirPopupPartilhar(item, "__PUZZLE__", () => {}, currentDb, currentAuth)
                });
                container.appendChild(el);
            } else {
                container.appendChild(renderFerramentaVinculadaUI(item, index, listaFinal, dadosEstruturaVersiculo?.ref, db, auth, container));
            }
        });
        console.log(`%c⚡ [BRAIN-PERF] UI Renderizada com sucesso! Total: ${(performance.now() - tStart).toFixed(1)}ms (DOM: ${(performance.now() - tRenderStart).toFixed(1)}ms)`, "color: #34d399; font-weight: bold;");
        console.log("[BIBLE-BOX-PERF] Puzzle | caixas visíveis no DOM em " + (performance.now() - tStart).toFixed(1) + "ms | total: " + ferramentasLigadas.length);
        return;
    }

    let faixaZero = null;
    if (gruposFiltro.length) {
        faixaZero = criarEstadoCaixasSublinhado(filtroSublinhado, 0);
        container.appendChild(faixaZero);
    }
    if (dadosEstruturaVersiculo) {
        console.log("ℹ️ [BRAIN-PERF] Lista de caixas vazia. Exibindo estado inicial.");
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Usa o + para anotar este versículo.</p>`;
        if (faixaZero) container.prepend(faixaZero);
        ultimoJsonRenderizado = "empty";
    } else {
        console.log("⏳ [BRAIN-PERF] Lista vazia e dadosEstruturaVersiculo pendente. Skeleton mantido.");
    }
}

function renderizarRodapeCodex(caixa) {
    if (!BibleSettings.state.showCodex) return null;

    const codices = (Array.isArray(caixa.codex) ? caixa.codex.flat() : [])
        .filter(item => item && item.estado !== "off");
    if (!codices.length) return null;

    const rodape = document.createElement("div");
    rodape.className = "bible-connector-codex-footer";
    rodape.setAttribute("aria-label", "Codex associado");

    const titulo = document.createElement("div");
    titulo.className = "bible-connector-codex-footer-title";
    titulo.innerHTML = '<i class="fa-solid fa-book-open" aria-hidden="true"></i><span>Codex associado</span>';
    rodape.appendChild(titulo);

    codices.forEach((item, index) => {
        const entrada = document.createElement("div");
        entrada.className = "bible-connector-codex-entry";

        const referencia = document.createElement("strong");
        referencia.textContent = item.referencia || item.titulo || item.artigo || `Referência ${index + 1}`;
        entrada.appendChild(referencia);

        const sequencia = Array.isArray(item.sequencia) ? item.sequencia.join(", ") : item.sequencia;
        const paginas = Array.isArray(item.paginas) ? item.paginas.join(", ") : item.paginas;
        const detalhes = [
            item.oque,
            sequencia ? `Seq. ${sequencia}` : "",
            paginas ? `Pág. ${paginas}` : "",
            item.tempo ? `Tempo ${item.tempo}` : "",
            item.ano ? `Ano ${item.ano}` : ""
        ].filter(Boolean);
        if (detalhes.length) {
            const detalhe = document.createElement("span");
            detalhe.textContent = detalhes.join(" · ");
            entrada.appendChild(detalhe);
        }
        rodape.appendChild(entrada);
    });

    return rodape;
}

function renderCaixaConectoraBiblia(c, index, listaCompleta, docRef, container) {
    const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const mapaFocos = c.tipo === 'subnota' ? FOCOS_SUBNOTA :
        c.tipo === 'questao' ? FOCOS_QUESTAO :
        c.tipo === 'raciocinio' ? FOCOS_RACIOCINIO : FOCOS_BASE;
    const focoAtual = mapaFocos[c.foco || "original"] || mapaFocos.original;
    const corContentor = focoAtual?.corForte || config.cor;
    const nomeVisual = c.foco && c.foco !== 'original' ? focoAtual.nome : config.nome;
    const mostrarTitulo = c.tipo !== 'contentor';
    const card = document.createElement("div");
    card.className = "brain-box-item bible-connector-box";
    card.style.cssText = `
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.1);
        border-left: 4px solid ${corContentor};
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
        position: relative;
    `;
    card.innerHTML = `
            <div style="display:flex; justify-content:space-between; padding:8px 12px; background:${corContentor}18; border-bottom:1px solid ${corContentor}30; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px; color:${corContentor}; font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase;">
                <i class="${config.icon}" title="${nomeVisual}"></i><span>${nomeVisual}</span>
            </div>
            <div style="display:flex; gap:14px; color:rgba(255,255,255,0.45); font-size:11px;">
                <i class="fa-solid fa-chevron-up btn-up" title="Subir" style="cursor:pointer; transition:0.2s;"></i>
                <i class="fa-solid fa-chevron-down btn-down" title="Descer" style="cursor:pointer; transition:0.2s;"></i>
                <i class="fa-solid fa-palette btn-palette" title="Mutar caixa" style="cursor:pointer; transition:0.2s;"></i>
                <i class="fa-brands fa-artstation btn-codex" title="Adicionar ao Codex" style="color:#a78bfa; cursor:pointer; transition:0.2s;"></i>
                <i class="fa-solid fa-paper-plane btn-send" title="Enviar para uma nota" style="cursor:pointer; transition:0.2s;"></i>
                <i class="fa-solid fa-trash-can btn-remove" title="Eliminar" style="color:#f87171; font-size:11px; cursor:pointer; opacity:0.6; transition:0.2s;"></i>
            </div>
        </div>
        <div style="padding:10px 12px;">
            <textarea class="txt-conectora" placeholder="Escreve aqui as tuas anotações..." spellcheck="false" style="width:100%; background:transparent; border:none; color:#f1f5f9; outline:none; resize:none; font-family:inherit; font-size:13.5px; line-height:1.6; white-space:pre-wrap; overflow:hidden; display:block; padding:0;"></textarea>
        </div>
    `;

    const txtArea = card.querySelector(".txt-conectora");
    if (mostrarTitulo) {
        const titulo = document.createElement('input');
        titulo.className = 'tit-conectora';
        titulo.type = 'text';
        titulo.value = c.titulo || '';
        titulo.placeholder = 'Título...';
        titulo.style.cssText = `width:100%; margin-bottom:8px; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.12); color:${corContentor}; outline:none; font-weight:700; font-size:14px; padding:3px 0;`;
        txtArea.parentNode.insertBefore(titulo, txtArea);
        titulo.oninput = () => {
            c.titulo = titulo.value;
            registarRascunho(c.id, { titulo: titulo.value });
            agendarGravacaoPuzzle(`${c.id}:titulo`, async () => {
                try {
                    await atualizarItemSincronizado(c.id, "caixas", { titulo: titulo.value }, docRef);
                } catch (erro) {
                    console.error("Erro ao guardar o título da Caixa Conectora:", erro);
                }
            }, 1000);
        };
        titulo.onblur = () => executarGravacaoPuzzle(`${c.id}:titulo`);
    }
    txtArea.value = c.conteudo || "";
    const ajustarAltura = () => ajustarAlturaTextarea(txtArea);
    const agendarSalvar = () => {
        agendarGravacaoPuzzle(c.id, async () => {
            try {
                await atualizarItemSincronizado(c.id, "caixas", { conteudo: txtArea.value }, docRef);
            } catch (erro) {
                console.error("Erro ao guardar a Caixa Conectora:", erro);
            }
        }, 1000);
    };

    txtArea.oninput = () => {
        c.conteudo = txtArea.value;
        registarRascunho(c.id, { conteudo: txtArea.value });
        ajustarAltura();
        agendarSalvar();
    };
    txtArea.onfocus = () => {
        card.style.borderColor = "var(--primary)";
        card.style.background = "rgba(255,255,255,0.05)";
    };
    txtArea.onblur = () => {
        card.style.borderColor = "rgba(255,255,255,0.1)";
        card.style.background = "rgba(255,255,255,0.03)";
        executarGravacaoPuzzle(c.id);
    };

    const btnSend = card.querySelector(".btn-send");
    const btnUp = card.querySelector(".btn-up");
    const btnDown = card.querySelector(".btn-down");
    const btnPalette = card.querySelector(".btn-palette");
    const btnCodex = card.querySelector(".btn-codex");
    const btnRemove = card.querySelector(".btn-remove");
    btnUp.onclick = event => { event.stopPropagation(); moverItemBiblia(index, -1, listaCompleta, docRef, container); };
    btnDown.onclick = event => { event.stopPropagation(); moverItemBiblia(index, 1, listaCompleta, docRef, container); };
    const guardarEstadoVisual = async () => {
        await atualizarItemSincronizado(c.id, "caixas", {
            tipo: c.tipo || "contentor",
            foco: c.foco || "original",
            destaques: c.destaques || ""
        }, docRef);
        ultimoJsonRenderizado = "";
        rebuildPuzzleUI(container, currentDb, currentAuth);
    };
    btnPalette.onmouseenter = () => { btnPalette.style.color = "#fbbf24"; };
    btnPalette.onmouseleave = () => { btnPalette.style.color = ""; };
    btnCodex.onmouseenter = () => { btnCodex.style.color = "#c4b5fd"; };
    btnCodex.onmouseleave = () => { btnCodex.style.color = "#a78bfa"; };
    btnSend.onmouseenter = () => { btnSend.style.color = "#a5b4fc"; };
    btnSend.onmouseleave = () => { btnSend.style.color = ""; };
    btnRemove.onmouseenter = () => { btnRemove.style.opacity = "1"; };
    btnRemove.onmouseleave = () => { btnRemove.style.opacity = "0.6"; };

    btnPalette.onclick = event => {
        event.stopPropagation();
        abrirPaleta(c, "tab-mutacao", guardarEstadoVisual, { apenasFocosMutacao: true });
    };

    btnCodex.onclick = event => {
        event.stopPropagation();
        abrirPopupCodexBiblia({
            livro: infoVersiculoAtivo?.livro,
            cap: infoVersiculoAtivo?.cap,
            ver: infoVersiculoAtivo?.ver,
            texto: infoVersiculoAtivo?.texto,
            docRef,
            codex: Array.isArray(c.codex) ? c.codex : [],
            contextoCaixa: nomeVisual,
            guardarCodex: async lista => {
                c.codex = lista;
                await atualizarItemSincronizado(c.id, "caixas", { codex: lista }, docRef);
                ultimoJsonRenderizado = "";
                rebuildPuzzleUI(container, currentDb, currentAuth);
            }
        });
    };

    btnSend.onclick = event => {
        event.stopPropagation();
        abrirPopupPartilhar({
            ...c
        }, "__PUZZLE__", () => {}, currentDb, currentAuth);
    };

    btnRemove.onclick = async event => {
        event.stopPropagation();
        const confirmou = await SharedPuzzleUI.confirmarAcao(
            "Apagar Caixa Conectora?",
            "Tens a certeza que desejas remover esta ferramenta?"
        );
        if (!confirmou) return;

        await atualizarItemSincronizado(
            c.id,
            "caixas",
            { estado: "off", timedelete: new Date().toISOString() },
            docRef
        );
    };

    const rodapeCodex = renderizarRodapeCodex(c);
    if (rodapeCodex) card.appendChild(rodapeCodex);

    setTimeout(ajustarAltura, 20);
    return card;
}
function renderFerramentaVinculadaUI(item, index, listaCompleta, docRef, db, auth, container) {
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
                <button class="btn-up" title="Subir" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-chevron-up"></i></button>
                <button class="btn-down" title="Descer" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-chevron-down"></i></button>
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

    card.querySelector('.btn-up').onclick = (e) => { e.stopPropagation(); moverItemBiblia(index, -1, listaCompleta, docRef, container); };
    card.querySelector('.btn-down').onclick = (e) => { e.stopPropagation(); moverItemBiblia(index, 1, listaCompleta, docRef, container); };

    card.querySelector('.btn-enviar').onclick = (e) => {
        e.stopPropagation();
        abrirPopupPartilhar({
            ...item
        }, "__PUZZLE__", () => {}, currentDb, currentAuth);
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

    const rodapeCodex = renderizarRodapeCodex(item);
    if (rodapeCodex) card.appendChild(rodapeCodex);

    return card;
}

async function moverItemBiblia(index, direcao, listaCompleta, docRef, container) {
    const targetIdx = index + direcao;
    if (targetIdx < 0 || targetIdx >= listaCompleta.length) return;
    const atual = listaCompleta[index];
    const alvo = listaCompleta[targetIdx];
    const timestampAtual = atual.timestamp;
    atual.timestamp = alvo.timestamp;
    alvo.timestamp = timestampAtual;

    const dados = dadosEstruturaVersiculo?.data || {};
    const quadros = (dados.Puzzle?.quadros || []).map(item => {
        const atualizado = listaCompleta.find(itemLista => itemLista.id === item.id);
        return atualizado ? { ...item, timestamp: atualizado.timestamp } : item;
    });
    const caixas = (dados.caixas || []).map(item => {
        const atualizado = listaCompleta.find(itemLista => itemLista.id === item.id);
        return atualizado ? { ...item, timestamp: atualizado.timestamp } : item;
    });

    if (dadosEstruturaVersiculo?.data) {
        dadosEstruturaVersiculo.data = { ...dados, Puzzle: { ...(dados.Puzzle || {}), quadros }, caixas };
    }
    await updateDoc(docRef, { "Puzzle.quadros": quadros, caixas });
    ultimoJsonRenderizado = "";
    rebuildPuzzleUI(container, currentDb, currentAuth);
}

async function executarApagarManual(id, docRef) {
    const documentos = new Map();
    const adicionarDocumento = (ref, data) => {
        if (!ref?.id || !Array.isArray(data?.Puzzle?.quadros)) return;
        if (!data.Puzzle.quadros.some(quadro => String(quadro?.id) === String(id))) return;
        documentos.set(ref.id, { ref, data });
    };

    adicionarDocumento(dadosEstruturaVersiculo?.ref, dadosEstruturaVersiculo?.data);
    estruturasCapitulo.forEach(estrutura => adicionarDocumento(estrutura.ref, estrutura.data));

    // Mantém a referência recebida como salvaguarda para caixas antigas que
    // ainda não tenham entrado no snapshot do capítulo.
    if (docRef?.id && !documentos.has(docRef.id)) {
        const snap = await getDoc(docRef);
        if (snap.exists()) adicionarDocumento(docRef, snap.data());
    }

    if (!documentos.size) return;

    cancelarGravacaoPuzzle(id);
    const temporizadorAntigo = window._puzzleTimers?.get(String(id));
    if (temporizadorAntigo) clearTimeout(temporizadorAntigo);
    window._puzzleTimers?.delete(String(id));
    rascunhosItens.delete(String(id));

    await Promise.all([...documentos.values()].map(async ({ ref, data }) => {
        const quadros = data.Puzzle.quadros.filter(quadro => String(quadro?.id) !== String(id));
        data.Puzzle = { ...(data.Puzzle || {}), quadros };
        await updateDoc(ref, { "Puzzle.quadros": quadros });
    }));

    ultimoJsonRenderizado = "";
    rebuildPuzzleUI(document.getElementById("biblia-dynamic-content"), currentDb, currentAuth);
}
