import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const DEFAULT_LIST_FUSEIS = {
    topicos: true,
    destaques: true,
    biblia: true,
    textosBiblicos: true,
    marcadores: true,
    livros: true,
    cosmos: true,
    palco: true
};

export const DEFAULT_NOTE_CONFIG = {
    textSize: null,
    collapseToolTitles: false,
    collapseNoteTitle: false,
    diarioLines: false,
    defaultFocos: {
        contentor: "original",
        subnota: "original",
        questao: "original",
        raciocinio: "original"
    }
};

function extrairFuseisLegados(raw = {}) {
    const legado = {};
    Object.keys(DEFAULT_LIST_FUSEIS).forEach(key => {
        if (typeof raw?.[key] === "boolean") legado[key] = raw[key];
    });
    return legado;
}

export function normalizarFuseis(raw = {}) {
    return {
        ...DEFAULT_LIST_FUSEIS,
        ...extrairFuseisLegados(raw),
        ...((raw && raw.listsFuseis) || {})
    };
}

export function normalizarNoteConfig(raw = {}) {
    const defaultFocos = {
        ...DEFAULT_NOTE_CONFIG.defaultFocos,
        ...((raw && raw.defaultFocos) || {})
    };
    return {
        ...DEFAULT_NOTE_CONFIG,
        ...(raw || {}),
        defaultFocos
    };
}

export async function carregarPreferenciasUtilizador(db, uid) {
    if (!db || !uid) {
        return {
            listsFuseis: normalizarFuseis(),
            noteTitleCollapse: false,
            colapsoTitulosMobile: false,
            noteTitleCollapseMobile: false,
            barraSuperiorDesktop: true,
            barraSuperiorMobileNota: true,
            barraSuperiorMobilePrincipal: true,
            mobileBibleHelperBar: true,
            leftColumnCollapseButton: false
        };
    }

    try {
        const snap = await getDoc(doc(db, "users", uid));
        const dados = snap.exists() ? snap.data() : {};
        return {
            ...dados,
            listsFuseis: normalizarFuseis(dados),
            noteTitleCollapse: Boolean(dados.noteTitleCollapse),
            colapsoTitulosMobile: Boolean(dados.colapsoTitulosMobile),
            noteTitleCollapseMobile: Boolean(dados.noteTitleCollapseMobile),
            barraSuperiorDesktop: dados.barraSuperiorDesktop !== false,
            barraSuperiorMobileNota: dados.barraSuperiorMobileNota !== false,
            barraSuperiorMobilePrincipal: dados.barraSuperiorMobilePrincipal !== false,
            mobileBibleHelperBar: dados.mobileBibleHelperBar !== false,
            leftColumnCollapseButton: Boolean(dados.leftColumnCollapseButton)
        };
    } catch (_) {
        return {
            listsFuseis: normalizarFuseis(),
            noteTitleCollapse: false,
            colapsoTitulosMobile: false,
            noteTitleCollapseMobile: false,
            barraSuperiorDesktop: true,
            barraSuperiorMobileNota: true,
            barraSuperiorMobilePrincipal: true,
            mobileBibleHelperBar: true,
            leftColumnCollapseButton: false
        };
    }
}

export async function guardarPreferenciasUtilizador(db, uid, partial) {
    if (!db || !uid) return;
    await setDoc(doc(db, "users", uid), partial, { merge: true });
}

export function obterConfigNota(dadosNota, uid) {
    if (!dadosNota) return normalizarNoteConfig();
    if (dadosNota.onde === "share") {
        return normalizarNoteConfig(dadosNota?.[uid]?.notaConfig);
    }
    return normalizarNoteConfig(dadosNota.notaConfig);
}

export async function guardarConfigNota(db, notaId, dadosNota, uid, partial) {
    if (!db || !notaId || !dadosNota || !uid) return null;
    const colecao = dadosNota.onde === "share" ? "Share" : "Local";
    const atual = obterConfigNota(dadosNota, uid);
    const merged = normalizarNoteConfig({
        ...atual,
        ...partial,
        defaultFocos: {
            ...atual.defaultFocos,
            ...((partial && partial.defaultFocos) || {})
        }
    });

    if (dadosNota.onde === "share") {
        await updateDoc(doc(db, colecao, notaId), {
            [`${uid}.notaConfig`]: merged
        });
    } else {
        await updateDoc(doc(db, colecao, notaId), {
            notaConfig: merged
        });
    }

    return merged;
}

export function aplicarPreferenciasDeNota(config) {
    const noteConfig = normalizarNoteConfig(config);
    document.body.classList.toggle('modo-colapso-titulos-nota', Boolean(noteConfig.collapseNoteTitle));
    document.body.classList.toggle('modo-colapso-titulos-local', Boolean(noteConfig.collapseToolTitles));
    document.body.classList.toggle('modo-diario-linhas', Boolean(noteConfig.diarioLines));

    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        if (noteConfig.textSize) {
            editorContainer.style.setProperty('--fs-note-texto', `${noteConfig.textSize}px`);
        } else {
            editorContainer.style.removeProperty('--fs-note-texto');
        }
    }
}

export function obterConfigNotaEfetiva(dadosNota, uid, userPrefs = {}) {
    const base = obterConfigNota(dadosNota, uid);
    return {
        ...base,
        collapseNoteTitle: Boolean(base.collapseNoteTitle ?? userPrefs?.noteTitleCollapse),
        collapseToolTitles: Boolean(base.collapseToolTitles ?? userPrefs?.colapsoTitulos)
    };
}

export function podeMostrarListItem(fuseis, key, contexto = "default") {
    const mapa = normalizarFuseis(fuseis);
    if (contexto === "office" && key === "livros") return false;
    return Boolean(mapa[key]);
}
