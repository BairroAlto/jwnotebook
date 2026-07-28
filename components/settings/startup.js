import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { isMobileViewport } from '../ui/mobile-device.js';
import {
    atualizarEntradaArranque,
    guardarPreferenciasUtilizador,
    normalizarArranque
} from "./preferences.js";

const DISPOSITIVOS = ["pcTablet", "mobile"];

const ARRANQUE_HINT_PREFIX = "notabook:arranque:";

function chavePistaArranque(uid) {
    return `${ARRANQUE_HINT_PREFIX}${uid}`;
}

function lerPistaArranque(uid, dispositivo) {
    try {
        const pistas = JSON.parse(localStorage.getItem(chavePistaArranque(uid)) || "{}");
        return typeof pistas?.[dispositivo] === "string" ? pistas[dispositivo] : null;
    } catch (_) {
        return null;
    }
}

function guardarPistasArranque(uid, arranque) {
    if (!uid) return;
    try {
        const pistas = normalizarArranque({ arranque }).reduce((resultado, entrada) => {
            if (entrada.arraque === "on" && entrada.arrancarem) {
                resultado[entrada.dispositivo] = entrada.arrancarem;
            }
            return resultado;
        }, {});
        localStorage.setItem(chavePistaArranque(uid), JSON.stringify(pistas));
    } catch (_) {}
}


const estado = {
    db: null,
    auth: null,
    userPrefs: null,
    notas: new Map(),
    carregado: new Set(),
    inicializado: false,
    uidArranqueExecutado: null,
    limparToggleNota: null
};

function obterDispositivoAtual() {
    return isMobileViewport() ? "mobile" : "pcTablet";
}

function obterEntrada(dispositivo) {
    return normalizarArranque(estado.userPrefs || {}).find(
        (entrada) => entrada.dispositivo === dispositivo
    );
}

function obterElemento(dispositivo, sufixo) {
    return document.getElementById(`arranque-${sufixo}-${dispositivo}`);
}

function escaparHtml(valor = "") {
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function atualizarSeletorDeArranque(dispositivo) {
    const selecionada = Boolean(obterEntrada(dispositivo)?.arrancarem);
    const pesquisa = obterElemento(dispositivo, "pesquisa");
    const resultados = obterElemento(dispositivo, "resultados");

    if (pesquisa) pesquisa.hidden = selecionada;
    if (resultados) resultados.hidden = selecionada;
}

function renderizarSelecao(dispositivo) {
    const entrada = obterEntrada(dispositivo);
    const nota = entrada?.arrancarem ? estado.notas.get(dispositivo)?.find(
        (item) => item.id === entrada.arrancarem
    ) : null;
    const area = obterElemento(dispositivo, "selecionada");
    if (!area) return;

    if (!entrada?.arrancarem) {
        area.innerHTML = '<span class="arranque-empty">Nenhuma nota escolhida.</span>';
        atualizarSeletorDeArranque(dispositivo);
        return;
    }

    area.innerHTML = `
        <i class="fa-solid fa-thumbtack"></i>
        <span>Nota de arranque: <strong>${escaparHtml(nota?.nome || entrada.arrancarem)}</strong></span>
        <button type="button" class="arranque-clear" aria-label="Remover nota de arranque">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    area.querySelector(".arranque-clear")?.addEventListener("click", () => {
        const pesquisa = obterElemento(dispositivo, "pesquisa");
        if (pesquisa) pesquisa.value = "";
        guardarNota(dispositivo, { arrancarem: null });
    });
    atualizarSeletorDeArranque(dispositivo);
}

function renderizarResultados(dispositivo, termo = "") {
    const lista = obterElemento(dispositivo, "resultados");
    if (!lista) return;
    if (obterEntrada(dispositivo)?.arrancarem) {
        atualizarSeletorDeArranque(dispositivo);
        return;
    }

    atualizarSeletorDeArranque(dispositivo);
    const normalizado = termo.trim().toLocaleLowerCase("pt-PT");
    const notas = (estado.notas.get(dispositivo) || []).filter((nota) =>
        !normalizado || nota.nome.toLocaleLowerCase("pt-PT").includes(normalizado)
    );

    if (!notas.length) {
        lista.innerHTML = '<span class="arranque-empty">Nenhuma nota local encontrada.</span>';
        return;
    }

    lista.innerHTML = notas.map((nota) => `
        <button type="button" class="arranque-note-option" data-note-id="${escaparHtml(nota.id)}">
            <i class="fa-solid fa-file-lines"></i>
            <span>${escaparHtml(nota.nome || "Nota sem título")}</span>
        </button>
    `).join("");

    lista.querySelectorAll("[data-note-id]").forEach((botao) => {
        botao.addEventListener("click", () => {
            guardarNota(dispositivo, { arraque: "on", arrancarem: botao.dataset.noteId });
        });
    });
}

async function carregarNotasLocais(dispositivo) {
    if (estado.carregado.has(dispositivo)) {
        renderizarResultados(dispositivo, obterElemento(dispositivo, "pesquisa")?.value || "");
        return;
    }

    const lista = obterElemento(dispositivo, "resultados");
    if (lista) lista.innerHTML = '<span class="arranque-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> A carregar notas...</span>';

    const uid = estado.auth?.currentUser?.uid;
    if (!uid || !estado.db) return;

    try {
        const consulta = query(
            collection(estado.db, "Local"),
            where("userId", "==", uid)
        );
        const snapshot = await getDocs(consulta);
        const notas = [];
        snapshot.forEach((notaSnap) => {
            const dados = notaSnap.data();
            if (dados.estado === "on" && dados.tipo !== "pasta") {
                notas.push({ id: notaSnap.id, nome: String(dados.nome || "Nota sem título") });
            }
        });
        notas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));
        estado.notas.set(dispositivo, notas);
        estado.carregado.add(dispositivo);
        renderizarResultados(dispositivo, obterElemento(dispositivo, "pesquisa")?.value || "");
        renderizarSelecao(dispositivo);
    } catch (erro) {
        console.error("[ARRANQUE] Não foi possível carregar as notas locais:", erro);
        if (lista) lista.innerHTML = '<span class="arranque-error">Não foi possível carregar as notas locais.</span>';
    }
}

async function guardarNota(dispositivo, alteracoes) {
    const uid = estado.auth?.currentUser?.uid;
    if (!uid) return;

    const arranque = atualizarEntradaArranque(estado.userPrefs, dispositivo, alteracoes);
    estado.userPrefs.arranque = arranque;
    estado.userPrefs.Arraque = arranque;
    window.NotaBookUserPrefs = estado.userPrefs;
    await guardarPreferenciasUtilizador(estado.db, uid, { arranque, Arraque: arranque });
    guardarPistasArranque(uid, arranque);
    renderizarSelecao(dispositivo);
    renderizarResultados(dispositivo, obterElemento(dispositivo, "pesquisa")?.value || "");
    window.dispatchEvent(new CustomEvent("arranque:alterado", { detail: { dispositivo, arranque } }));
}

async function obterNomeNotaLocal(db, notaId) {
    if (!db || !notaId) return notaId || "nota atual";
    try {
        const snap = await getDoc(doc(db, "Local", notaId));
        return snap.exists() ? String(snap.data()?.nome || notaId) : notaId;
    } catch (_) {
        return notaId;
    }
}

function confirmarSubstituicaoArranque(nomeAtual) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("popup-confirmar-arranque-overlay");
        const mensagem = document.getElementById("msg-confirmar-arranque");
        const btnSim = document.getElementById("btn-confirmar-arranque");
        const btnNao = document.getElementById("btn-cancelar-arranque");

        if (!overlay || !mensagem || !btnSim || !btnNao) {
            resolve(false);
            return;
        }

        mensagem.innerHTML = 'Vai desvincular a atual página de arranque: <b>"' +
            escaparHtml(nomeAtual) + '"</b>. Tem a certeza?';
        overlay.classList.add("active");

        const fechar = (resposta) => {
            overlay.classList.remove("active");
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

export function configurarToggleArranqueDaNota(notaId, dadosNota = {}) {
    const wrapper = document.getElementById("arranque-nota-toggle-wrap");
    const toggle = document.getElementById("check-arranque-nota");
    if (!wrapper || !toggle) return;

    estado.limparToggleNota?.();
    const dispositivo = obterDispositivoAtual();
    const sincronizar = () => {
        const entrada = obterEntrada(dispositivo);
        const visivel = dadosNota.onde !== "share" && entrada?.arraque === "on";
        wrapper.hidden = !visivel;
        toggle.checked = visivel && entrada?.arrancarem === notaId;
    };

    const aoAlterar = async () => {
        if (toggle.disabled) return;
        toggle.disabled = true;
        try {
            const entrada = obterEntrada(dispositivo);
            if (toggle.checked) {
                if (entrada?.arrancarem && entrada.arrancarem !== notaId) {
                    const nomeAtual = await obterNomeNotaLocal(estado.db, entrada.arrancarem);
                    if (!await confirmarSubstituicaoArranque(nomeAtual)) {
                        toggle.checked = false;
                        return;
                    }
                }
                await guardarNota(dispositivo, { arraque: "on", arrancarem: notaId });
            } else if (entrada?.arrancarem === notaId) {
                await guardarNota(dispositivo, { arrancarem: null });
            }
            sincronizar();
        } finally {
            toggle.disabled = false;
        }
    };

    toggle.onchange = aoAlterar;
    const evento = () => sincronizar();
    window.addEventListener("arranque:alterado", evento);
    estado.limparToggleNota = () => window.removeEventListener("arranque:alterado", evento);
    sincronizar();
}

function atualizarVisibilidade(dispositivo) {

    const entrada = obterEntrada(dispositivo);
    const configuracao = obterElemento(dispositivo, "configuracao");
    const toggle = obterElemento(dispositivo, "toggle");
    if (toggle) toggle.checked = entrada?.arraque === "on";
    if (configuracao) configuracao.hidden = entrada?.arraque !== "on";
    renderizarSelecao(dispositivo);
}

function ligarDispositivo(dispositivo) {
    const toggle = obterElemento(dispositivo, "toggle");
    const pesquisa = obterElemento(dispositivo, "pesquisa");
    if (!toggle || !pesquisa) return;

    toggle.addEventListener("change", async () => {
        await guardarNota(dispositivo, { arraque: toggle.checked ? "on" : "off" });
        atualizarVisibilidade(dispositivo);
        if (toggle.checked) await carregarNotasLocais(dispositivo);
    });

    pesquisa.addEventListener("input", () => {
        renderizarResultados(dispositivo, pesquisa.value);
    });

    atualizarVisibilidade(dispositivo);
    if (toggle.checked) carregarNotasLocais(dispositivo);
}

export function inicializarArranque(db, auth, userPrefs) {
    if (estado.inicializado) return;
    estado.db = db;
    estado.auth = auth;
    estado.userPrefs = userPrefs;
    estado.userPrefs.arranque = normalizarArranque(userPrefs);
    estado.userPrefs.Arraque = estado.userPrefs.arranque;
    guardarPistasArranque(auth.currentUser?.uid, estado.userPrefs.arranque);
    estado.inicializado = true;
    DISPOSITIVOS.forEach(ligarDispositivo);
}

export async function precarregarNotaArranque(db, auth) {
    const uid = auth?.currentUser?.uid;
    const notaId = lerPistaArranque(uid, obterDispositivoAtual());
    if (!notaId) return null;

    try {
        const snapshot = await getDoc(doc(db, "Local", notaId));
        return { notaId, snapshot };
    } catch (_) {
        return null;
    }
}

function esperar(tempo) {
    return new Promise((resolve) => setTimeout(resolve, tempo));
}

async function aguardarNotaArranquePintada() {
    const limite = Date.now() + 2000;
    const editor = document.getElementById("editor-container");
    const loadingEditor = document.getElementById("editor-loading");

    while (Date.now() < limite) {
        const editorVisivel = editor
            && getComputedStyle(editor).display !== "none"
            && getComputedStyle(editor).visibility !== "hidden";
        const editorSemLoading = !loadingEditor || getComputedStyle(loadingEditor).display === "none";

        if (editorVisivel && editorSemLoading) break;
        await esperar(40);
    }

    if (isMobileViewport()) {
        await esperar(340);
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
export async function abrirNotaDeArranque(db, auth, userPrefs, preCarga = null) {
    const uid = auth?.currentUser?.uid;
    if (!uid || estado.uidArranqueExecutado === uid) return;
    estado.uidArranqueExecutado = uid;

    const dispositivo = obterDispositivoAtual();
    const entrada = normalizarArranque(userPrefs).find(
        (item) => item.dispositivo === dispositivo
    );
    if (entrada?.arraque !== "on" || !entrada.arrancarem) return;

    try {
        const notaSnap = preCarga?.notaId === entrada.arrancarem
            ? preCarga.snapshot
            : await getDoc(doc(db, "Local", entrada.arrancarem));
        if (!notaSnap.exists()) return;
        const dados = notaSnap.data();
        if (dados.userId !== uid || dados.estado !== "on" || dados.tipo === "pasta") return;

        const { abrirNotaNoEditor } = await import("../editor/editor.js");
        await abrirNotaNoEditor(notaSnap.id, { ...dados, onde: "local" }, db, auth);
        await aguardarNotaArranquePintada();
        return true;
    } catch (erro) {
        console.error("[ARRANQUE] Não foi possível abrir a nota definida:", erro);
    }
}
