export const officeState = {
    activeTab: "atril",
    currentData: null,
    currentItems: [],
    currentIndex: -1,
    currentPath: "",
    currentKind: "",
    currentParent: null,
    scriptureView: "text",
    scriptureRef: null,
    searchIndex: null
};

export const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_LABEL = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function $(id) {
    return document.getElementById(id);
}

export async function carregarJsonSilencioso(path) {
    if (!path) return null;
    try {
        const res = await fetch(path);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

export async function existe(path) {
    return fetch(path, { method: 'HEAD' }).then(res => res.ok).catch(() => false);
}

export function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function escapeRegExp(texto) {
    return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function slugLivro(nome) {
    return nome.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '_');
}
