import {
    collection,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { normalizarCaixas } from './calendario-anotacoes.js';

export const COLECAO_TAREFAS = "tarefas";
const CHAVE_TAREFAS_LOCAIS = "notebook:calendario:tarefas:v1";

export function carregarTarefasLocais() {
    return lerTarefasLocais().map((tarefa) => ({
        ...normalizarTarefa(tarefa),
        data: tarefa.data || tarefa.date || ""
    }));
}

export function guardarTarefaLocal(task, dateKey) {
    if (!task?.id || !dateKey) return;
    const tarefas = lerTarefasLocais().filter((item) => (
        item.id !== task.id && (item.serieId || item.id) !== task.id
    ));
    tarefas.push({ ...task, date: dateKey });
    escreverTarefasLocais(tarefas);
    console.log('[REPOSITORY][LOCAL] Tarefa guardada:', { taskId: task.id, dateKey, caixas: task.caixas });
}

export function apagarTarefaLocal(taskId) {
    if (!taskId) return;
    escreverTarefasLocais(lerTarefasLocais().filter((item) => item.id !== taskId));
    console.log('[REPOSITORY][LOCAL] Tarefa eliminada:', taskId);
}

function lerTarefasLocais() {
    try {
        const valor = localStorage.getItem(CHAVE_TAREFAS_LOCAIS);
        const tarefas = valor ? JSON.parse(valor) : [];
        return Array.isArray(tarefas) ? tarefas : [];
    } catch (error) {
        console.warn('[REPOSITORY][LOCAL] Não foi possível ler as tarefas locais:', error);
        return [];
    }
}

function escreverTarefasLocais(tarefas) {
    try {
        localStorage.setItem(CHAVE_TAREFAS_LOCAIS, JSON.stringify(tarefas));
    } catch (error) {
        console.error('[REPOSITORY][LOCAL] Não foi possível guardar as tarefas locais:', error);
    }
}

/**
 * Mantém a subscrição das tarefas do utilizador autenticado.
 * A página continua a funcionar com o cache local quando não existe sessão.
 */
export function observarTarefas({ db, auth, aoMudar, aoMudarUtilizador, aoErro }) {
    let pararColecao = () => {};

    const pararAuth = onAuthStateChanged(auth, (user) => {
        pararColecao();
        pararColecao = () => {};
        aoMudarUtilizador?.(user);

        const projecto = db?.app?.options?.projectId || '(desconhecido)';
        console.info(`[TAREFAS][FIREBASE] Estado de autenticação: projecto=${projecto} userId=${user?.uid || '(sem-utilizador)'}`);
        if (!user) return;

        const consulta = query(
            collection(db, COLECAO_TAREFAS),
            where("userId", "==", user.uid)
        );
        console.info(`[TAREFAS][FIREBASE] Subscrição preparada: projecto=${projecto} colecao=${COLECAO_TAREFAS} filtro=userId:${user.uid}`);

        pararColecao = onSnapshot(
            consulta,
            (snapshot) => {
                const tarefas = snapshot.docs.map((item) => ({
                    ...normalizarTarefa(item.data()),
                    id: item.id
                }));
                console.info(`[TAREFAS][FIREBASE] Snapshot concluído: projecto=${projecto} colecao=${COLECAO_TAREFAS} total=${tarefas.length} tarefasMeuBairro=${tarefas.filter(tarefa => tarefa.origemBairro).length}`);
                aoMudar(tarefas);
            },
            (erro) => {
                console.error(`[TAREFAS][FIREBASE] Falha na subscrição: projecto=${projecto} colecao=${COLECAO_TAREFAS} code=${erro?.code || '(sem-code)'} message=${erro?.message || erro}`);
                aoErro?.(erro);
            }
        );
    });

    return () => {
        pararColecao();
        pararAuth();
    };
}

export async function guardarTarefas(db, userId, tarefas = []) {
    if (!db || !userId || !tarefas.length) return;

    console.log('[REPOSITORY][FIREBASE] A gravar tarefas:', tarefas.map(({ task, dateKey }) => ({
        taskId: task?.id,
        dateKey,
        caixas: task?.caixas
    })));

    const batch = writeBatch(db);
    tarefas.filter(({ task, dateKey }) => task?.id && dateKey).forEach(({ task, dateKey }) => {
        batch.set(doc(db, COLECAO_TAREFAS, String(task.id)), {
            ...serializarTarefa(task, dateKey),
            userId,
            estado: "on",
            actualizadoEm: serverTimestamp()
        }, { merge: true });
    });
    await batch.commit();
    console.log('[REPOSITORY][FIREBASE] Commit concluído.');
}

export async function apagarTarefas(db, userId, taskIds = []) {
    if (!db || !userId || !taskIds.length) return;

    const batch = writeBatch(db);
    [...new Set(taskIds.filter(Boolean))].forEach((taskId) => {
        // A regra do Firestore confirma que o documento pertence ao utilizador.
        batch.delete(doc(db, COLECAO_TAREFAS, String(taskId)));
    });
    await batch.commit();
}

function serializarTarefa(task, dateKey) {
    return {
        id: String(task.id),
        tipo: "tarefa",
        origem: "notaday",
        versao: 1,
        data: dateKey,
        serieId: task.serieId || null,
        ocorrenciaData: task.ocorrenciaData || dateKey,
        ocorrenciaPrincipal: Boolean(task.ocorrenciaPrincipal ?? !task.serieId),
        calendarioId: task.calendarId || task.category || null,
        titulo: String(task.title || "").trim(),
        hora: task.noTime ? "" : String(task.time || ""),
        semHora: Boolean(task.noTime || !task.time),
        duracao: Number(task.duration) || 0,
        repeticao: String(task.repeat || "sem-repeticao"),
        intervaloRepeticao: Number(task.repeatInterval) || 1,
        unidadeRepeticao: String(task.repeatUnit || "dias"),
        categoria: String(task.category || "nenhuma"),
        nota: String(task.note || "").trim(),
        caixas: normalizarCaixas(task.caixas, task.note),
        icone: String(task.icon || "fa-solid fa-calendar-check"),
        concluida: Boolean(task.completed),
        origemBairro: Boolean(task.origemBairro),
        bairroNotaId: task.bairroNotaId || null,
        bairroCaixaId: task.bairroCaixaId || null,
        bairroNome: task.bairroNome || '',
        bairroModelo: task.bairroModelo || '',
        bairroData: task.bairroData || dateKey,
        bairroCampos: Array.isArray(task.bairroCampos) ? task.bairroCampos : [],
        bairroRegistoId: task.bairroRegistoId || task.id,
        bairroTipo: task.bairroTipo || ''
    };
}

function normalizarTarefa(data = {}) {
    const noTime = Boolean(data.noTime ?? data.semHora ?? (!data.time && !data.hora));

    return {
        id: data.id || "",
        date: data.date || data.data || "",
        serieId: data.serieId || null,
        ocorrenciaData: data.ocorrenciaData || data.data || data.date || "",
        ocorrenciaPrincipal: Boolean(data.ocorrenciaPrincipal),
        calendarId: data.calendarId || data.calendarioId || data.category || data.categoria || "",
        title: data.title || data.titulo || "",
        time: data.time ?? data.hora ?? "",
        noTime,
        duration: Number(data.duration ?? data.duracao) || 0,
        repeat: data.repeat || data.repeticao || "sem-repeticao",
        repeatInterval: Number(data.repeatInterval ?? data.intervaloRepeticao) || 1,
        repeatUnit: data.repeatUnit || data.unidadeRepeticao || "dias",
        category: data.category || data.categoria || "nenhuma",
        note: data.note || data.nota || "",
        caixas: normalizarCaixas(data.caixas, data.note || data.nota || ""),
        icon: data.icon || data.icone || "fa-solid fa-calendar-check",
        completed: Boolean(data.completed ?? data.concluida),
        origemBairro: Boolean(data.origemBairro || data.origem === 'bairro'),
        bairroNotaId: data.bairroNotaId || null,
        bairroCaixaId: data.bairroCaixaId || null,
        bairroNome: data.bairroNome || '',
        bairroModelo: data.bairroModelo || '',
        bairroData: data.bairroData || data.data || data.date || '',
        bairroCampos: Array.isArray(data.bairroCampos) ? data.bairroCampos : [],
        bairroRegistoId: data.bairroRegistoId || data.id || '',
        bairroTipo: data.bairroTipo || ''
    };
}
