import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let unsubscribe = null;
let referenciaAtual = "";
let comentarios = [];

function normalizar(valor) {
    return String(valor || "").trim().replace(/\s+/g, " ");
}

function escapeHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obterAlvoComentario(dados) {
    const tipo = String(dados.oque || "paragrafo").toLowerCase();
    const nomes = {
        paragrafo: "Parágrafo",
        "parágrafo": "Parágrafo",
        pergunta: "Pergunta",
        questao: "Questão",
        "questão": "Questão",
        subtema: "Subtema",
        discurso: "Discurso"
    };
    const nome = nomes[tipo] || "Parágrafo";
    return `${nome} ${String(dados.sequencia || "").trim()}`.trim();
}

export function iniciarPainelComentarios(db, auth) {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    comentarios = [];

    const uid = auth?.currentUser?.uid;
    if (!uid) {
        renderizarComentarios();
        return;
    }

    const consulta = query(collection(db, "Biblioteca"), where("userId", "==", uid));
    unsubscribe = onSnapshot(consulta, (snapshot) => {
        comentarios = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((dados) => dados.anotacaoEspecial?.estado !== "off" && String(dados.anotacaoEspecial?.conteudo || "").trim());
        renderizarComentarios();
    }, (erro) => {
        console.error("[OFFICE] Falha ao sincronizar comentários:", erro);
        comentarios = [];
        renderizarComentarios("Não foi possível carregar os comentários.");
    });
}

export function definirContextoComentarios(referencia) {
    referenciaAtual = normalizar(referencia);
    renderizarComentarios();
}

export function renderizarComentarios(mensagem = "") {
    const lista = document.getElementById("office-comments-list");
    const contexto = document.getElementById("office-comments-context");
    if (!lista) return;

    if (contexto) contexto.textContent = referenciaAtual || "Página atual";

    if (mensagem) {
        lista.innerHTML = `<div class="office-comments-empty">${escapeHtml(mensagem)}</div>`;
        return;
    }

    if (!referenciaAtual) {
        lista.innerHTML = '<div class="office-comments-empty">Escolhe um artigo ou capítulo para ver os comentários.</div>';
        return;
    }

    const daPagina = comentarios
        .filter((dados) => normalizar(dados.referencia) === referenciaAtual)
        .sort((a, b) => String(a.sequencia || "").localeCompare(String(b.sequencia || ""), undefined, { numeric: true }));

    if (!daPagina.length) {
        lista.innerHTML = '<div class="office-comments-empty"><i class="fa-regular fa-comment-dots"></i><span>Ainda não existem comentários nesta página.</span></div>';
        return;
    }

    lista.innerHTML = daPagina.map((dados) => {
        const anotacao = dados.anotacaoEspecial || {};
        const sequencia = String(dados.sequencia || "");
        return `
            <button class="office-comment-card" type="button" data-comment-seq="${escapeHtml(sequencia)}">
                <span class="office-comment-meta"><span>${escapeHtml(obterAlvoComentario(dados))}</span></span>
                <span class="office-comment-body">${escapeHtml(anotacao.conteudo)}</span>
            </button>
        `;
    }).join("");

    lista.querySelectorAll(".office-comment-card").forEach((card) => {
        card.onclick = (event) => {
            event.preventDefault();
            const bloco = encontrarBlocoComentario(card.dataset.commentSeq);
            if (!bloco) return;

            const leitor = document.getElementById("livros-scroll");
            if (leitor) {
                const topo = bloco.getBoundingClientRect().top - leitor.getBoundingClientRect().top + leitor.scrollTop - 24;
                leitor.scrollTo({ top: Math.max(0, topo), behavior: "smooth" });
            } else {
                bloco.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            bloco.classList.add("office-comment-target");
            setTimeout(() => bloco.classList.remove("office-comment-target"), 1300);
        };
    });
}

function encontrarBlocoComentario(sequencia) {
    const alvo = String(sequencia || "").trim();
    const blocos = Array.from(document.querySelectorAll("#office-reader [data-p]"));
    const exacto = blocos.find((item) => String(item.dataset.p).trim() === alvo);
    if (exacto) return exacto;

    return blocos.find((item) => {
        const valores = String(item.dataset.p || "")
            .split(/[\s,;-]+/)
            .map((valor) => valor.trim())
            .filter(Boolean);
        return valores.includes(alvo);
    }) || null;
}
