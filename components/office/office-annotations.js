import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let unsubscribe = null;
let contextoAtual = { referencia: "" };
let chavesComAnotacao = new Set();

function normalizar(valor) {
    return String(valor || "").trim().replace(/\s+/g, " ");
}

function criarChave(referencia, sequencia, tipo) {
    return normalizar(referencia) + "|" + String(sequencia || "") + "|" + String(tipo || "paragrafo");
}

function temConteudoEscrito(anotacao) {
    return anotacao &&
        anotacao.estado !== "off" &&
        String(anotacao.conteudo || "").trim().length > 0;
}

export function iniciarIndicadoresAnotacoes(db, auth) {
    pararIndicadoresAnotacoes();

    const uid = auth?.currentUser?.uid;
    if (!uid) return;

    const consulta = query(collection(db, "Biblioteca"), where("userId", "==", uid));
    unsubscribe = onSnapshot(consulta, (snapshot) => {
        chavesComAnotacao = new Set();

        snapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            if (!temConteudoEscrito(dados.anotacaoEspecial)) return;

            chavesComAnotacao.add(
                criarChave(dados.referencia, dados.sequencia, dados.oque)
            );
        });

        atualizarIndicadoresAnotacoes();
    }, (erro) => {
        console.error("[OFFICE] Falha ao sincronizar indicadores de anotação:", erro);
    });
}

export function pararIndicadoresAnotacoes() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    chavesComAnotacao.clear();
    atualizarIndicadoresAnotacoes();
}

export function definirContextoAnotacoes(contexto = {}) {
    contextoAtual = {
        referencia: normalizar(contexto.referencia)
    };
    atualizarIndicadoresAnotacoes();
}

export function atualizarIndicadoresAnotacoes() {
    const blocos = document.querySelectorAll("#office-reader [data-p]");

    blocos.forEach((bloco) => {
        const chave = criarChave(
            contextoAtual.referencia,
            bloco.dataset.p,
            bloco.dataset.tipo
        );
        const ativo = chavesComAnotacao.has(chave);

        bloco.classList.toggle("office-has-annotation", ativo);

        const numero = bloco.querySelector(".num-ref-trigger");
        if (numero) numero.classList.toggle("office-has-annotation", ativo);
    });
}