// components/editor/editor.js
import { NotaManager } from './modulos/nota-manager.js';
import { ToolManager } from './modulos/tool-manager.js';
import { SyncManager } from './modulos/sync-manager.js';
import { PersistenceManager } from './modulos/persistence-manager.js';
import { BootManager } from './modulos/boot-manager.js';
import { isEdicaoAtiva } from './modulos/share-controller.js';

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
    timerGravacao: null
};

// 1. ABRIR NOTA
export async function abrirNotaNoEditor(notaId, dadosNota, db, auth, idCaixaFoco = null, maeIdOverride = null) {
    await forcarGravacaoImediata();

    await NotaManager.abrir(
        { notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride },
        { 
       setEstadoGlobal: (novosDados) => { 
        Object.assign(state, novosDados); 
        window.caixasAtuais = state.caixasAtuais; 

        // 🚀 REMOVEMOS A TRAVA: Agora reiniciamos os motores sempre para atualizar as pontes
        BootManager.motores(state, { 
            guardarNotaNoFirebase, 
            atualizarFeedEGravar, 
            acionarGravacao,
            inserirFerramentaNoEditor 
        });
    },
            atualizarFeedEGravar,
            forcarGravacaoImediata
        }
    );
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

// 4. ACIONAR GRAVAÇÃO
function acionarGravacao(caixa = null) {
    if (!state.dadosNotaOriginal) return;
    state.notaComAlteracoes = true;
    
    // Se a gravação veio de uma caixa específica, guardamos o ID dela
    if (caixa && typeof caixa === 'object') {
        caixa.timestamp = new Date().toISOString();
        state.caixaEditadaId = caixa.id; // 🎯 Marca o alvo
    } else {
        state.caixaEditadaId = null; // Gravação global (ex: título)
    }

    const isLocal = (state.dadosNotaOriginal.onde !== "share");
    const podeGravar = (state.dadosNotaOriginal.onde === "share" && isEdicaoAtiva());

    if (isLocal || podeGravar) {
        const info = document.getElementById('editor-info-text');
        if (info) info.innerText = "A guardar...";
        clearTimeout(state.timerGravacao);
        state.timerGravacao = setTimeout(() => { guardarNotaNoFirebase(); }, 1500);
    }
}

// 5. GUARDAR NO FIREBASE
async function guardarNotaNoFirebase() {
    await PersistenceManager.guardar(state);
}

// 6. FORÇAR GRAVAÇÃO
export async function forcarGravacaoImediata() {
    if (state.timerGravacao) {
        clearTimeout(state.timerGravacao);
        await guardarNotaNoFirebase();
    }
}