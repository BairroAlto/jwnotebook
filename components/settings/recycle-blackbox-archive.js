import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const LIMITE_DOCUMENTO_DIRETO = 700 * 1024;
const CARACTERES_POR_PARTE = 180_000;

function serializarDados(dados) {
    const vistos = new WeakSet();
    return JSON.stringify(dados, (_chave, valor) => {
        if (!valor || typeof valor !== "object") return valor;
        if (vistos.has(valor)) return "[Referência circular omitida]";
        vistos.add(valor);
        return valor;
    });
}

function tamanhoJson(conteudoJson) {
    return new TextEncoder().encode(conteudoJson).byteLength;
}

function dividirJson(conteudoJson) {
    const caracteres = Array.from(conteudoJson);
    const partes = [];
    for (let indice = 0; indice < caracteres.length; indice += CARACTERES_POR_PARTE) {
        partes.push(caracteres.slice(indice, indice + CARACTERES_POR_PARTE).join(""));
    }
    return partes;
}

async function guardarEmPartes({ db, arquivoId, userId, conteudoJson, camposIndice }) {
    const partes = dividirJson(conteudoJson);

    for (let indice = 0; indice < partes.length; indice += 1) {
        const sufixo = String(indice + 1).padStart(4, "0");
        await setDoc(doc(db, "Blackbox", `${arquivoId}__parte__${sufixo}`), {
            userId,
            arquivoPaiId: arquivoId,
            tipoItem: "arquivo-parte",
            formato: "json",
            indice: indice + 1,
            totalPartes: partes.length,
            conteudo: partes[indice],
            deletedAt: serverTimestamp()
        });
    }

    await setDoc(doc(db, "Blackbox", arquivoId), {
        ...camposIndice,
        userId,
        arquivoEmPartes: true,
        formatoArquivo: "json",
        totalPartes: partes.length,
        deletedAt: serverTimestamp()
    });
}

/**
 * Guarda um item de forma idempotente. Quando o conteúdo se aproxima do
 * limite de 1 MiB do Firestore, cria partes independentes e um manifesto.
 */
export async function guardarNoArquivoReciclagem({
    db,
    arquivoId,
    userId,
    dados,
    camposIndice = {}
}) {
    const arquivoRef = doc(db, "Blackbox", arquivoId);
    const existente = await getDoc(arquivoRef);
    if (existente.exists()) return { existente: true, emPartes: Boolean(existente.data()?.arquivoEmPartes) };

    const payload = { ...dados, ...camposIndice, userId };
    const conteudoJson = serializarDados(payload);
    if (tamanhoJson(conteudoJson) < LIMITE_DOCUMENTO_DIRETO) {
        try {
            await setDoc(arquivoRef, { ...payload, deletedAt: serverTimestamp() });
            return { existente: false, emPartes: false };
        } catch (erro) {
            const mensagem = String(erro?.message || "").toLowerCase();
            const excedeuLimite = mensagem.includes("maximum allowed size") ||
                mensagem.includes("exceeds the maximum") ||
                mensagem.includes("document too large");
            if (!excedeuLimite) throw erro;
        }
    }

    await guardarEmPartes({ db, arquivoId, userId, conteudoJson, camposIndice });
    return { existente: false, emPartes: true };
}
