import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const nomesComAnotacoes = new Set();
let cancelarSubscricao = null;
let callbackAtualizacao = null;

function temItensAtivos(valor) {
    if (!Array.isArray(valor)) return false;
    return valor.some(item => {
        if (typeof item === "string") return item.trim().length > 0;
        return Boolean(item && item.estado !== "off");
    });
}

function temDossieAtivo(dados) {
    const dossie = dados?.Dossie || {};
    const temReferenciasAptas = temItensAtivos(dossie.Apto);
    const temCaixasNasMicas = Object.values(dossie.mica || {}).some(mica =>
        mica?.estado !== "off" && temItensAtivos(mica?.caixas)
    );

    return temReferenciasAptas || temCaixasNasMicas ||
        temItensAtivos(dados?.Micas) || temItensAtivos(dados?.Dossies);
}

function documentoTemAnotacao(dados) {
    if (!dados || dados.estado === "off") return false;

    const temPuzzle =
        temItensAtivos(dados.Puzzle?.quadros) ||
        temItensAtivos(dados.Puzzle?.caixas) ||
        temItensAtivos(dados.Puzzle?.blocos) ||
        temItensAtivos(dados.Blocos) ||
        temItensAtivos(dados.textos) ||
        temItensAtivos(dados.caixas);

    const fontes = dados.Fontes;
    const temFontes = Array.isArray(fontes)
        ? temItensAtivos(fontes)
        : temItensAtivos(fontes?.Links) || temItensAtivos(fontes?.codex);

    return temPuzzle || temDossieAtivo(dados) || temFontes;
}

function nomeVersiculo(dados) {
    if (dados?.nome) return String(dados.nome);
    if (!dados?.livro || dados?.capitulo == null || dados?.versiculo == null) return "";
    return `${dados.livro} ${dados.capitulo}:${dados.versiculo}`;
}

export function iniciarEstadoAnotacoesBiblia(db, auth, onChange) {
    cancelarSubscricao?.();
    nomesComAnotacoes.clear();
    callbackAtualizacao = onChange;

    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return;

    const consulta = query(collection(db, "TextosBiblia"), where("userId", "==", uid));
    cancelarSubscricao = onSnapshot(consulta, snapshot => {
        nomesComAnotacoes.clear();
        snapshot.forEach(docSnap => {
            const dados = docSnap.data();
            const nome = nomeVersiculo(dados);
            if (nome && documentoTemAnotacao(dados)) nomesComAnotacoes.add(nome);
        });
        callbackAtualizacao?.();
    }, erro => {
        console.warn("[BIBLE] Não foi possível atualizar as cores das anotações.", erro);
    });
}

export function limparEstadoAnotacoesBiblia() {
    cancelarSubscricao?.();
    cancelarSubscricao = null;
    callbackAtualizacao = null;
    nomesComAnotacoes.clear();
}

export function versiculoTemAnotacao(livro, cap, versiculo) {
    return nomesComAnotacoes.has(`${livro} ${cap}:${versiculo}`);
}
