import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const DEFAULT_CALENDARIOS = [
    { id: "pessoal", nome: "Pessoal", cor: "#f4b7a9", acento: "#a44f3b", visivel: true },
    { id: "trabalho", nome: "Trabalho", cor: "#cfc5ff", acento: "#594ca8", visivel: true },
    { id: "bem-estar", nome: "Bem-estar", cor: "#bfe5d5", acento: "#36745b", visivel: true }
];

export async function carregarCalendarios(db, uid) {
    const projecto = db?.app?.options?.projectId || '(desconhecido)';
    const caminho = `users/${uid || '(sem-uid)'}`;
    console.info(`[CALENDARIOS][FIREBASE] A preparar leitura: projecto=${projecto} caminho=${caminho} temDb=${Boolean(db)} temUid=${Boolean(uid)}`);
    if (!db || !uid) return { calendarios: [], necessitaInicializacao: false };

    const snapshot = await getDoc(doc(db, "users", uid));
    const dados = snapshot.exists() ? snapshot.data() : {};
    const temCalendarios = Array.isArray(dados.calendarios);
    console.info(`[CALENDARIOS][FIREBASE] Leitura concluída: projecto=${projecto} caminho=${caminho} existe=${snapshot.exists()} temCalendarios=${temCalendarios} total=${temCalendarios ? dados.calendarios.length : 0}`);

    return {
        calendarios: normalizarCalendarios(temCalendarios ? dados.calendarios : DEFAULT_CALENDARIOS),
        necessitaInicializacao: !temCalendarios
    };
}

export async function guardarCalendarios(db, uid, calendarios) {
    const projecto = db?.app?.options?.projectId || '(desconhecido)';
    const caminho = `users/${uid || '(sem-uid)'}`;
    const lista = normalizarCalendarios(calendarios);
    console.info(`[CALENDARIOS][FIREBASE] A preparar escrita: projecto=${projecto} caminho=${caminho} total=${lista.length}`);
    if (!db || !uid || !Array.isArray(calendarios)) return;
    try {
        await setDoc(doc(db, "users", uid), { calendarios: lista }, { merge: true });
        console.info(`[CALENDARIOS][FIREBASE] Escrita concluída: projecto=${projecto} caminho=${caminho} total=${lista.length}`);
    } catch (error) {
        console.error(`[CALENDARIOS][FIREBASE] Falha na escrita: projecto=${projecto} caminho=${caminho} code=${error?.code || '(sem-code)'} message=${error?.message || error}`);
        throw error;
    }
}

export function normalizarCalendarios(calendarios = []) {
    return calendarios
        .filter((calendario) => calendario?.id && calendario?.nome)
        .map((calendario) => ({
            id: String(calendario.id),
            nome: String(calendario.nome).trim(),
            cor: calendario.cor || "#d9d5cd",
            acento: calendario.acento || "#6f6a62",
            visivel: calendario.visivel !== false
        }));
}
