import {
    addDoc,
    collection,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let dbAtual = null;
let authAtual = null;
let referenciaAtual = null;
let contextoAtual = null;
let exploradorCodexPromise = null;

function escaparHtml(valor = "") {
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function obterContextoVersiculo() {
    const contexto = window.bibleVersiculoAtivo;
    if (!contexto?.livro || !contexto?.cap || !contexto?.ver) return null;
    return {
        livro: contexto.livro,
        cap: Number(contexto.cap),
        ver: String(contexto.ver),
        texto: contexto.texto || ""
    };
}

async function garantirExploradorCodex() {
    if (!exploradorCodexPromise) {
        exploradorCodexPromise = (async () => {
            if (!document.getElementById("popup-codex-browser-overlay")) {
                const resposta = await fetch("components/popup/popup-codex-browser.html");
                if (!resposta.ok) throw new Error("Não foi possível carregar o Explorador Codex.");
                document.body.insertAdjacentHTML("beforeend", await resposta.text());
            }

            const modulo = await import("../editor/modulos/codex-browser.js");
            modulo.iniciarCodexBrowser();
            return modulo;
        })().catch(erro => {
            exploradorCodexPromise = null;
            throw erro;
        });
    }
    return exploradorCodexPromise;
}

async function obterOuCriarDocumentoVersiculo(contexto) {
    if (contexto.docRef) return contexto.docRef;

    const uid = authAtual?.currentUser?.uid;
    if (!uid) throw new Error("Utilizador não autenticado.");

    const nome = `${contexto.livro} ${contexto.cap}:${contexto.ver}`;
    const consulta = query(
        collection(dbAtual, "TextosBiblia"),
        where("userId", "==", uid),
        where("nome", "==", nome)
    );
    const resultado = await getDocs(consulta);
    if (!resultado.empty) return resultado.docs[0].ref;

    const novoDocumento = {
        id: crypto.randomUUID(),
        userId: uid,
        nome,
        livro: contexto.livro,
        capitulo: contexto.cap,
        versiculo: contexto.ver,
        tipo: "textobiblico",
        Puzzle: { quadros: [], caixas: [] },
        caixas: [],
        Fontes: { Links: [], codex: [] },
        timestamp: serverTimestamp()
    };

    const criado = await addDoc(collection(dbAtual, "TextosBiblia"), novoDocumento);
    return criado;
}

function renderizarListaCodex(lista = []) {
    const container = document.getElementById("bible-codex-list");
    if (!container) return;

    const ativos = lista.filter(item => item && item.estado !== "off");
    if (!ativos.length) {
        container.innerHTML = `
            <div style="padding:35px 15px; text-align:center; color:var(--text-muted); opacity:.65; font-size:12px;">
                <i class="fa-solid fa-book-open" style="display:block; font-size:26px; margin-bottom:10px;"></i>
                Ainda não existem mapeamentos Codex neste versículo.
            </div>`;
        return;
    }

    container.innerHTML = ativos.map(item => {
        const sequencia = Array.isArray(item.sequencia) ? item.sequencia.join(", ") : (item.sequencia || "—");
        const detalhe = [
            item.oque ? `Tipo: ${item.oque}` : "",
            `Seq.: ${sequencia}`,
            item.paginas?.length ? `Pág.: ${item.paginas.join(", ")}` : "",
            item.tempo ? `Tempo: ${item.tempo}` : "",
            item.ano ? `Ano: ${item.ano}` : ""
        ].filter(Boolean).join(" · ");

        return `
            <article class="bible-codex-card" data-codex-id="${escaparHtml(item.id)}" style="position:relative; padding:13px 40px 13px 13px; border:1px solid var(--border-color); border-left:3px solid #a78bfa; border-radius:8px; background:rgba(255,255,255,.03);">
                <button type="button" class="bible-codex-remove" data-codex-id="${escaparHtml(item.id)}" title="Remover mapeamento" aria-label="Remover mapeamento" style="position:absolute; top:11px; right:11px; border:0; background:transparent; color:#f87171; cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <div style="font-size:10px; color:#a78bfa; text-transform:uppercase; font-weight:800; letter-spacing:.6px;">${escaparHtml(item.contexto || "Codex")}</div>
                <div style="margin-top:4px; color:#f8fafc; font-size:13px; font-weight:700;">${escaparHtml(item.referencia || item.titulo || "Referência Codex")}</div>
                ${item.titulo || item.artigo ? `<div style="margin-top:6px; color:var(--text-muted); font-size:11px; line-height:1.4;">${escaparHtml(item.titulo || item.artigo)}</div>` : ""}
                <div style="margin-top:9px; color:var(--text-muted); font-size:10px; line-height:1.4;">${escaparHtml(detalhe)}</div>
            </article>`;
    }).join("");

    container.querySelectorAll(".bible-codex-remove").forEach(botao => {
        botao.onclick = () => removerCodex(botao.dataset.codexId);
    });
}

async function lerListaCodex() {
    if (!referenciaAtual) return [];
    const snap = await getDoc(referenciaAtual);
    if (!snap.exists()) return [];
    const dados = snap.data();
    return Array.isArray(dados.Fontes?.codex) ? dados.Fontes.codex : [];
}

async function removerCodex(id) {
    if (!referenciaAtual || !id) return;
    const lista = await lerListaCodex();
    await updateDoc(referenciaAtual, {
        "Fontes.codex": lista.filter(item => item.id !== id)
    });
    renderizarListaCodex(lista.filter(item => item.id !== id));
}

async function adicionarCodex() {
    if (!referenciaAtual || !contextoAtual) return;

    const popup = document.getElementById("popup-codex-biblia-overlay");
    popup?.classList.remove("active");

    try {
        const explorador = await garantirExploradorCodex();
        explorador.abrirPesquisaCodex(async dadosCodex => {
            if (!dadosCodex) return;

            const item = {
                ...dadosCodex,
                id: crypto.randomUUID(),
                userId: authAtual.currentUser.uid,
                timestamp: new Date().toISOString(),
                estado: "on",
                favorito: "nao",
                partilha: "off"
            };
            const lista = await lerListaCodex();
            await updateDoc(referenciaAtual, { "Fontes.codex": [...lista, item] });
            renderizarListaCodex([...lista, item]);
            popup?.classList.add("active");
        });
    } catch (erro) {
        console.error("[BIBLE-CODEX] Falha ao abrir o explorador:", erro);
        alert("Não foi possível abrir o Explorador Codex.");
        popup?.classList.add("active");
    }
}

export async function abrirPopupCodexBiblia(contexto = obterContextoVersiculo()) {
    if (!dbAtual || !authAtual?.currentUser) return;
    if (!contexto) {
        alert("Selecciona primeiro um versículo para abrir o Codex.");
        return;
    }

    contextoAtual = contexto;
    const popup = document.getElementById("popup-codex-biblia-overlay");
    const contextoEl = document.getElementById("bible-codex-context");
    if (!popup || !contextoEl) return;

    contextoEl.textContent = `${contexto.livro} ${contexto.cap}:${contexto.ver}`;
    referenciaAtual = await obterOuCriarDocumentoVersiculo(contexto);
    renderizarListaCodex(await lerListaCodex());
    popup.classList.add("active");
}

export function iniciarCodexBiblia({ db, auth }) {
    dbAtual = db;
    authAtual = auth;

    document.getElementById("btn-fechar-codex-biblia")?.addEventListener("click", () => {
        document.getElementById("popup-codex-biblia-overlay")?.classList.remove("active");
    });
    document.getElementById("btn-adicionar-codex-biblia")?.addEventListener("click", adicionarCodex);
}
