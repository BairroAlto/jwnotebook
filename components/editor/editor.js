// components/editor/editor.js
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { NotaManager } from './modulos/nota-manager.js';
import { ToolManager } from './modulos/tool-manager.js';
import { SyncManager } from './modulos/sync-manager.js';
import { PersistenceManager } from './modulos/persistence-manager.js';
import { BootManager } from './modulos/boot-manager.js';
import { isEdicaoAtiva } from './modulos/share-controller.js';
import { despacharInteligenciaEye } from './modulos/intelligence/dispatcher.js';
import { hidratarNotaComCaixas } from '../local/caixas-repository.js';
import { hidratarNotaShareComCaixas } from '../share/share-caixas-repository.js';
import { criarFilaPersistencia } from './modulos/persistence-queue.js';

let state = {
    notaAbertaId: null,
    caixasAtuais: [],
    dadosNotaOriginal: null,
    notaMaeAtualId: null,
    dbRef: null,
    authRef: null,
    aCriarCaixa: false,
    notaComAlteracoes: false,
    caixaEditadaId: null,
    caixasEditadas: {},
    revisaoAlteracoes: 0,
    revisaoEstrutural: 0,
    sincronizacaoCompletaPendente: false,
    timerGravacao: null
};

let unsubscribeNotaAberta = null;
const filaPersistencia = criarFilaPersistencia(() => PersistenceManager.guardar(state));

// 1. ABRIR NOTA
export async function abrirNotaNoEditor(notaId, dadosNota, db, auth, idCaixaFoco = null, maeIdOverride = null) {
    await forcarGravacaoImediata();
    pararEscutaNotaAberta();

    await NotaManager.abrir(
        { notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride },
        { 
       setEstadoGlobal: (novosDados) => { 
        Object.assign(state, novosDados, {
            notaComAlteracoes: false,
            caixaEditadaId: null,
            caixasEditadas: {},
            revisaoAlteracoes: 0,
            revisaoEstrutural: 0,
            sincronizacaoCompletaPendente: false,
            timerGravacao: null
        }); 
        window.caixasAtuais = state.caixasAtuais; 

        // 🚀 REMOVEMOS A TRAVA: Agora reiniciamos os motores sempre para atualizar as pontes
        BootManager.motores(state, { 
            guardarNotaNoFirebase, 
            atualizarFeedEGravar, 
            acionarGravacao,
            inserirFerramentaNoEditor,
            gravarImediatamente
        });
    },
            atualizarFeedEGravar,
            forcarGravacaoImediata
        }
    );

    iniciarEscutaNotaAberta();
}

// 2. INSERIR FERRAMENTA
export function inserirFerramentaNoEditor(tipo) {
    ToolManager.inserir(tipo, state, { 
        setACriarCaixa: (val) => state.aCriarCaixa = val, 
        atualizarFeedEGravar 
    });
}

// 3. SINCRONIZADOR
export async function atualizarFeedEGravar(disparar = true) {
    await SyncManager.atualizar(state, acionarGravacao, disparar);
}

window.atualizarFeedEGravarGlobal = atualizarFeedEGravar;

// 4. ACIONAR GRAVAÇÃO
function acionarGravacao(caixa = null, evento = null) {
    if (!state.dadosNotaOriginal) return;
    state.notaComAlteracoes = true;
    state.revisaoAlteracoes += 1;
    
    // Se a gravação veio de uma caixa específica, guardamos o ID dela
    if (caixa && typeof caixa === 'object') {
        caixa.timestamp = new Date().toISOString();
        state.caixaEditadaId = caixa.id; // 🎯 Marca o alvo
        const alteracaoAnterior = state.caixasEditadas[caixa.id];
        state.caixasEditadas[caixa.id] = {
            tipo: evento?.tipo || alteracaoAnterior?.tipo || "editado",
            timestamp: caixa.timestamp
        };
    } else if (evento?.tipo !== "metadados") {
        // Chamadas sem uma caixa concreta correspondem a alterações de
        // estrutura (criar, mover, ocultar ou importar). Nesses casos fazemos
        // uma sincronização completa, que continua a ser o caminho seguro.
        state.sincronizacaoCompletaPendente = true;
        state.revisaoEstrutural = state.revisaoAlteracoes;
    }

    // Actualiza o EYE em live sem redesenhar o editor.
    // O dispatcher aplica o seu próprio debounce para não processar cada tecla.
    despacharInteligenciaEye(
        state.caixasAtuais,
        state.dadosNotaOriginal,
        state.dbRef,
        state.authRef
    );
    const isLocal = (state.dadosNotaOriginal.onde !== "share");
    const podeGravar = (state.dadosNotaOriginal.onde === "share" && isEdicaoAtiva());

    if (isLocal || podeGravar) {
        const info = document.getElementById('editor-info-text');
        if (info) info.innerText = "A guardar...";
        clearTimeout(state.timerGravacao);
        state.timerGravacao = setTimeout(async () => {
            state.timerGravacao = null;
            try {
                await guardarNotaNoFirebase();
            } catch (erro) {
                console.error('[EDITOR] O autosave esgotou as tentativas:', erro);
            }
        }, 1500);
    }
}

// 5. GUARDAR NO FIREBASE
async function guardarNotaNoFirebase() {
    return filaPersistencia.solicitar();
}

// 6. GRAVAÇÃO IMEDIATA
export async function gravarImediatamente({ sincronizacaoCompleta = true } = {}) {
    if (state.timerGravacao) {
        clearTimeout(state.timerGravacao);
        state.timerGravacao = null;
    }
    state.notaComAlteracoes = true;
    state.revisaoAlteracoes += 1;
    if (sincronizacaoCompleta) {
        state.sincronizacaoCompletaPendente = true;
        state.revisaoEstrutural = state.revisaoAlteracoes;
    }
    await guardarNotaNoFirebase();
}

// 7. FORÇAR GRAVAÇÃO
export async function forcarGravacaoImediata() {
    if (state.timerGravacao) {
        clearTimeout(state.timerGravacao);
        state.timerGravacao = null;
    }
    if (state.notaComAlteracoes) {
        await guardarNotaNoFirebase();
    } else {
        await filaPersistencia.aguardar();
    }
}

function iniciarEscutaNotaAberta() {
    if (!state.notaAbertaId || !state.dbRef || !state.dadosNotaOriginal) return;

    const colecao = (state.dadosNotaOriginal.onde === "share") ? "Share" : "Local";
    const notaRef = doc(state.dbRef, colecao, state.notaAbertaId);

    unsubscribeNotaAberta = onSnapshot(notaRef, async (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        if (state.notaComAlteracoes || state.timerGravacao) return;

        const dadosRemotosBase = {
            ...state.dadosNotaOriginal,
            ...snap.data(),
            onde: state.dadosNotaOriginal.onde || "local"
        };
        const dadosRemotos = colecao === "Local"
            ? await hidratarNotaComCaixas(dadosRemotosBase, state.dbRef, state.authRef, state.notaAbertaId)
            : await hidratarNotaShareComCaixas(dadosRemotosBase, state.dbRef, state.notaAbertaId);
        if (state.notaAbertaId !== notaRef.id) return;
        const caixasRemotas = dadosRemotos.caixas || [];
        if (assinaturaCaixas(caixasRemotas) === assinaturaCaixas(state.caixasAtuais)) return;

        state.dadosNotaOriginal = { ...state.dadosNotaOriginal, ...dadosRemotos };
        state.caixasAtuais = caixasRemotas;
        window.caixasAtuais = state.caixasAtuais;

        await SyncManager.atualizar(state, acionarGravacao, false);
    });
}

function pararEscutaNotaAberta() {
    if (unsubscribeNotaAberta) {
        unsubscribeNotaAberta();
        unsubscribeNotaAberta = null;
    }
}

function assinaturaCaixas(caixas) {
    return JSON.stringify((caixas || []).map(caixa => ({
        id: caixa.id,
        tipo: caixa.tipo,
        titulo: caixa.titulo || "",
        conteudo: caixa.conteudo || "",
        foco: caixa.foco || "",
        destaques: caixa.destaques || "",
        corFirmamento: caixa.corFirmamento || "",
        textoFirmamento: caixa.textoFirmamento || "",
        corBairro: caixa.corBairro || "",
        pastapai: caixa.pastapai || [],
        ligaçãoBairro: caixa.ligaçãoBairro || [],
        noticiasPreferencias: caixa.noticiasPreferencias || null,
        noticiasCache: caixa.noticiasCache || [],
        noticiasAtualizadasEm: caixa.noticiasAtualizadasEm || null,
        tempoLocalizacao: caixa.tempoLocalizacao || null,
        tempoOpcoes: caixa.tempoOpcoes || null,
        tempoDados: caixa.tempoDados || null,
        gmailPreferencias: caixa.gmailPreferencias || null,
        today: caixa.today || null,
        estado: caixa.estado || "on",
        glosas: caixa.glosas || [],
        ref: caixa.referenciacodex || null,
        timestamp: caixa.timestamp || "",
        fundir: caixa.fundir || []
    })));
}
