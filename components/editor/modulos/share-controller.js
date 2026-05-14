// components/editor/modulos/share-controller.js
import { LockManager } from './lock-manager.js';
import { LockUI } from './lock-ui.js';

let state = {
    editandoAtivo: false,
    unsubLock: null,
    timerInatividade: null,
    notaAbertaId: null,
    db: null,
    auth: null,
    callbackGravar: null,
    dadosNotaOriginal: null
};

const TEMPO_LIMITE = 30 * 60 * 1000; // 30 minutos de inatividade

/**
 * INICIALIZAÇÃO DO MOTOR DE SHARE
 */
export function iniciarShareController(db, auth, callbackGravar) {
    state.db = db;
    state.auth = auth;
    state.callbackGravar = callbackGravar;

    // Libertar nota se o utilizador fechar ou mudar de aba
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && state.editandoAtivo) {
            console.log("🚫 [SHARE-CONTROL] Utilizador saiu da aba. Finalizando edição...");
            forcarFinalizacaoEdicao();
        }
    });

    // Vigilância de atividade para resetar o timer de inatividade
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(ev => 
        window.addEventListener(ev, resetTimerInatividade)
    );
}

/**
 * GESTÃO DE SESSÃO (CHAMADA AO ABRIR UMA NOTA)
 */
export async function gerirSessaoShare(notaId, dadosNota) {
    // 1. Limpeza de estado anterior
    if (state.editandoAtivo) await forcarFinalizacaoEdicao();
    if (state.unsubLock) { 
        state.unsubLock(); 
        state.unsubLock = null; 
    }
    clearTimeout(state.timerInatividade);
    
    state.notaAbertaId = notaId;
    state.dadosNotaOriginal = dadosNota;

    const btn = document.getElementById('btn-modo-edicao-share');

    // 2. SE FOR NOTA LOCAL
    if (dadosNota.onde !== "share") {
        state.editandoAtivo = false;
        if (btn) btn.style.display = "none";
        LockUI.libertarEditor(); 
        return;
    }

    // 3. SE FOR NOTA SHARE - DETEÇÃO BLINDADA DO UTILIZADOR
    // Tenta obter o auth do estado interno, se for null tenta o global da window
    const authInstance = state.auth || window.auth;
    
    if (!authInstance || !authInstance.currentUser) {
        console.warn("⚠️ [SHARE-CONTROL] Auth ainda não está pronto. Re-tentando em breve...");
        // Se o utilizador acabou de logar, esperamos 500ms e tentamos de novo
        setTimeout(() => gerirSessaoShare(notaId, dadosNota), 500);
        return;
    }

    const meuId = authInstance.currentUser.uid;
    console.log("📂 [SHARE-CONTROL] Nota Share detetada. Iniciando vigilância para:", meuId);

    // 4. Escuta em tempo real o campo 'editando' no Firebase
    state.unsubLock = LockManager.vigiarLock(state.db, notaId, (statusLock) => {
        let editorUid = "";
        let editorNome = "";

        if (statusLock && typeof statusLock === 'object') {
            editorUid = statusLock.uid || "";
            editorNome = statusLock.nome || "";
        } else if (typeof statusLock === 'string') {
            editorUid = statusLock; 
        }

        if (editorUid !== "" && editorUid !== meuId) {
            state.editandoAtivo = false;
            if (btn) btn.style.display = "none"; 
            LockUI.mostrarAvisoBloqueio(editorNome || "Outro utilizador", true); 
        } 
        else if (editorUid === meuId && meuId !== "") {
            state.editandoAtivo = true;
            configurarBotaoUI("ativo");
            LockUI.libertarEditor();
            resetTimerInatividade();
        } 
        else {
            state.editandoAtivo = false;
            configurarBotaoUI("livre");
            LockUI.mostrarAvisoBloqueio("Sessão Protegida", false); 
        }
    });
}

/**
 * TENTAR ASSUMIR OU FINALIZAR A EDIÇÃO
 */
export async function alternarEdicaoShare() {
    if (!state.notaAbertaId) return;
    const uid = state.auth.currentUser.uid;
    const email = state.auth.currentUser.email;

    if (!state.editandoAtivo) {
        // Tentar Bloquear para mim
        try {
            const statusLock = await LockManager.verificarStatus(state.db, state.notaAbertaId);
            const sUid = (statusLock && typeof statusLock === 'object') ? statusLock.uid : statusLock;
            
            if (sUid && sUid !== "" && sUid !== uid) {
                alert("Esta nota acabou de ser assumida por outro utilizador.");
                return;
            }
            // Regista o meu UID e o meu nome (email) no Firebase
            await LockManager.bloquearParaMim(state.db, state.notaAbertaId, uid, email.split('@')[0]);
        } catch (e) { 
            console.error(e);
            alert("Erro de permissão. Verifica se tens acesso de editor.");
        }
    } else {
        // Finalizar a minha edição voluntariamente
        await forcarFinalizacaoEdicao();
    }
}

/**
 * FINALIZAÇÃO FORÇADA (INATIVIDADE, SAÍDA OU BOTÃO)
 */
async function forcarFinalizacaoEdicao() {
    if (state.editandoAtivo && state.notaAbertaId) {
        console.warn("🔐 [SHARE-CONTROL] Finalizando sessão de escrita...");
        try {
            if (state.callbackGravar) await state.callbackGravar();
            await LockManager.libertar(state.db, state.notaAbertaId);
            state.editandoAtivo = false;
            configurarBotaoUI("livre");
        } catch (e) {
            console.error("Erro ao auto-finalizar:", e);
        }
    }
}

/**
 * CONFIGURAÇÃO VISUAL DO BOTÃO DE ACÇÃO
 */
function configurarBotaoUI(modo) {
    const btn = document.getElementById('btn-modo-edicao-share');
    if (!btn) return;

    btn.style.display = "block"; // Forçar visibilidade em notas Share
    btn.onclick = alternarEdicaoShare;

    if (modo === "ativo") {
        btn.style.background = "#22c55e"; // Verde
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Finalizar Edição';
    } else {
        btn.style.background = "#ef4444"; // Vermelho
        btn.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Nota';
    }
}

function resetTimerInatividade() {
    clearTimeout(state.timerInatividade);
    if (state.editandoAtivo) {
        state.timerInatividade = setTimeout(forcarFinalizacaoEdicao, TEMPO_LIMITE);
    }
}

export const isEdicaoAtiva = () => state.editandoAtivo;
