import {
    addDoc,
    collection,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const HIGHLIGHT_COLORS = [
    "#818cf8",
    "#facc15",
    "#34d399",
    "#fb7185",
    "#38bdf8",
    "#f97316"
];

const state = {
    db: null,
    auth: null,
    livro: null,
    cap: null,
    verses: {},
    highlights: new Map(),
    currentSelection: [],
    selectedGroupIds: [],
    unsub: null,
    onRender: null,
    toolbarReady: false,
    eventsBound: false,
    selectionTimer: null,
    selectionRetryTimers: [],
    feedBound: false,
    mobileWatchTimer: null
};

export const BibleHighlights = {
    iniciar: ({ db, auth, onRender }) => {
        state.db = db;
        state.auth = auth;
        state.onRender = onRender;
        garantirToolbar();
        ligarEventosSelecao();
    },

    definirCapitulo: ({ livro, cap, verses }) => {
        state.livro = livro;
        state.cap = Number(cap);
        state.verses = verses || {};
        esconderToolbar();
        limparSelecaoDom();
        ligarEventosFeed();
        return subscreverHighlightsCapitulo();
    },

    limparCapitulo: () => {
        state.livro = null;
        state.cap = null;
        state.verses = {};
        state.highlights = new Map();
        if (state.unsub) {
            state.unsub();
            state.unsub = null;
        }
        esconderToolbar();
        limparSelecaoDom();
    },

    renderizarTextoVersiculo: (verseNum, texto) => {
        const highlights = state.highlights.get(String(verseNum)) || [];
        return montarHtmlComHighlights(String(texto || ""), highlights);
    }
};

function garantirToolbar() {
    if (state.toolbarReady) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'bible-selection-toolbar';
    toolbar.className = 'bible-selection-toolbar hidden';
    toolbar.innerHTML = `
        <div class="bible-selection-toolbar-shell">
            <div class="bible-selection-toolbar-top">
                <div class="bible-selection-toolbar-label">Sublinhado</div>
            </div>
            <div class="bible-selection-toolbar-colors">
                ${HIGHLIGHT_COLORS.map(color => `
                    <button type="button" class="bible-selection-color" data-color="${color}" style="--swatch:${color};" aria-label="Aplicar cor ${color}"></button>
                `).join('')}
                <button type="button" class="bible-selection-remove hidden" aria-label="Remover sublinhado">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `;

    toolbar.addEventListener('mousedown', event => event.preventDefault());
    toolbar.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
    toolbar.addEventListener('touchend', event => event.stopPropagation());
    toolbar.addEventListener('pointerdown', event => event.stopPropagation());
    toolbar.addEventListener('click', async event => {
        const removeBtn = event.target.closest('.bible-selection-remove');
        if (removeBtn) {
            await removerSelecaoAtual();
            return;
        }

        const btn = event.target.closest('.bible-selection-color');
        if (!btn) return;
        await gravarSelecaoAtual(btn.dataset.color);
    });

    document.body.appendChild(toolbar);
    state.toolbarReady = true;
}

function ligarEventosSelecao() {
    if (state.eventsBound) return;
    state.eventsBound = true;

    const reagendar = (burst = false) => {
        agendarVerificacaoSelecao(burst ? [20, 90, 180, 320, 520, 760] : [20, 100, 220]);
    };

    const observarJanelaMobile = () => {
        clearTimeout(state.mobileWatchTimer);
        let tentativas = 0;
        const tick = () => {
            atualizarSelecaoAtual();
            tentativas += 1;
            if (state.currentSelection.length || tentativas >= 12) {
                state.mobileWatchTimer = null;
                return;
            }
            state.mobileWatchTimer = setTimeout(tick, 120);
        };
        state.mobileWatchTimer = setTimeout(tick, 80);
    };

    document.addEventListener('selectionchange', () => reagendar(true));
    document.addEventListener('mouseup', () => reagendar(false));
    document.addEventListener('pointerup', () => reagendar(true));
    document.addEventListener('keyup', () => reagendar(false));
    document.addEventListener('touchend', () => reagendar(true));
    document.addEventListener('contextmenu', () => reagendar(true));
    document.addEventListener('touchstart', observarJanelaMobile, { passive: true });
    document.addEventListener('touchend', observarJanelaMobile, { passive: true });
    window.addEventListener('resize', () => {
        if (state.currentSelection.length) mostrarToolbar();
    });
}

function ligarEventosFeed() {
    const feed = document.getElementById('bible-feed');
    if (!feed || feed.dataset.highlightSelectionBound === 'true') return;

    feed.dataset.highlightSelectionBound = 'true';

    const reagendar = (burst = false) => agendarVerificacaoSelecao(burst ? [20, 90, 180, 320, 520] : [20, 100, 220]);

    feed.addEventListener('mouseup', () => reagendar(false));
    feed.addEventListener('touchend', () => reagendar(true));
    feed.addEventListener('pointerup', () => reagendar(true));
    feed.addEventListener('touchstart', () => reagendar(true), { passive: true });
}

function agendarVerificacaoSelecao(delays = [20, 100, 220]) {
    clearTimeout(state.selectionTimer);
    state.selectionRetryTimers.forEach(timerId => clearTimeout(timerId));
    state.selectionRetryTimers = [];

    state.selectionTimer = setTimeout(atualizarSelecaoAtual, delays[0] ?? 20);
    delays.slice(1).forEach(delay => {
        const timerId = setTimeout(atualizarSelecaoAtual, delay);
        state.selectionRetryTimers.push(timerId);
    });
}

function subscreverHighlightsCapitulo() {
    if (state.unsub) {
        state.unsub();
        state.unsub = null;
    }

    state.highlights = new Map();

    const uid = state.auth?.currentUser?.uid;
    if (!uid || !state.livro || !state.cap) {
        state.onRender?.();
        return Promise.resolve();
    }

    const highlightsQuery = query(
        collection(state.db, "TextosBiblia"),
        where("userId", "==", uid),
        where("livro", "==", state.livro)
    );

    return new Promise(resolve => {
        let firstLoadResolved = false;

        state.unsub = onSnapshot(highlightsQuery, snapshot => {
            const next = new Map();

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (Number(data.capitulo) !== Number(state.cap)) return;

                const verseNum = String(data.versiculo ?? "");
                const verseText = String(state.verses?.[verseNum] || "");
                const normalized = normalizarHighlights(data.Sublinhado, verseText);
                if (!verseNum || !normalized.length) return;

                const existing = next.get(verseNum) || [];
                next.set(verseNum, normalizarHighlights([...existing, ...normalized], verseText));
            });

            state.highlights = next;

            if (!firstLoadResolved) {
                firstLoadResolved = true;
                resolve();
                return;
            }

            state.onRender?.();
        }, () => {
            if (!firstLoadResolved) {
                firstLoadResolved = true;
                resolve();
            }
        });
    });
}

function atualizarSelecaoAtual() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        state.currentSelection = [];
        state.selectedGroupIds = [];
        esconderToolbar();
        return;
    }

    const range = selection.getRangeAt(0);
    const fragments = construirFragmentosSelecao(range);

    if (!fragments.length) {
        state.currentSelection = [];
        state.selectedGroupIds = [];
        esconderToolbar();
        return;
    }

    state.currentSelection = fragments;
    state.selectedGroupIds = encontrarGroupIdsSelecionados(fragments);
    mostrarToolbar();
}

function construirFragmentosSelecao(range) {
    const verseTextNodes = Array.from(document.querySelectorAll('#bible-feed .bible-verse-row .v-text'));
    const fragments = [];

    verseTextNodes.forEach(node => {
        if (!rangeIntersectsVerseNode(range, node)) return;

        const verseRow = node.closest('.bible-verse-row');
        const verseNum = verseRow?.dataset.v;
        const verseText = node.textContent || "";
        if (!verseNum || !verseText) return;

        const verseRange = document.createRange();
        verseRange.selectNodeContents(node);

        const startsBeforeVerse = range.compareBoundaryPoints(Range.START_TO_START, verseRange) <= 0;
        const endsAfterVerse = range.compareBoundaryPoints(Range.END_TO_END, verseRange) >= 0;

        const start = startsBeforeVerse ? 0 : obterOffsetRelativo(node, range.startContainer, range.startOffset);
        const end = endsAfterVerse ? verseText.length : obterOffsetRelativo(node, range.endContainer, range.endOffset);

        const normalizedStart = Math.max(0, Math.min(start, end));
        const normalizedEnd = Math.min(verseText.length, Math.max(start, end));
        const selectedText = verseText.slice(normalizedStart, normalizedEnd);

        if (normalizedEnd <= normalizedStart || !selectedText.trim()) return;

        fragments.push({
            verseNum: String(verseNum),
            start: normalizedStart,
            end: normalizedEnd,
            texto: selectedText
        });
    });

    return fragments;
}

function rangeIntersectsVerseNode(range, node) {
    if (typeof range.intersectsNode === 'function') {
        try {
            return range.intersectsNode(node);
        } catch {
            return false;
        }
    }

    const verseRange = document.createRange();
    verseRange.selectNodeContents(node);
    return !(
        range.compareBoundaryPoints(Range.END_TO_START, verseRange) <= 0 ||
        range.compareBoundaryPoints(Range.START_TO_END, verseRange) >= 0
    );
}

function obterOffsetRelativo(container, targetNode, targetOffset) {
    let total = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();

    while (current) {
        if (current === targetNode) {
            return total + targetOffset;
        }
        total += current.textContent?.length || 0;
        current = walker.nextNode();
    }

    if (container === targetNode) return targetOffset;
    return total;
}

async function gravarSelecaoAtual(color) {
    const fragments = [...state.currentSelection];
    if (!fragments.length || !color || !state.livro || !state.cap) return;

    const groupId = crypto.randomUUID();
    aplicarHighlightsLocais(fragments, color, groupId);
    state.onRender?.();

    for (const fragment of fragments) {
        await gravarFragmento(fragment, color, groupId);
    }

    state.currentSelection = [];
    state.selectedGroupIds = [];
    esconderToolbar();
    limparSelecaoDom();
}

async function gravarFragmento(fragment, color, groupId) {
    const uid = state.auth?.currentUser?.uid;
    if (!uid) return;

    const verseKey = String(fragment.verseNum);
    const nomeRef = `${state.livro} ${state.cap}:${verseKey}`;
    const docsVersiculo = await carregarDocsVersiculo(uid, verseKey);
    const current = obterHighlightsDoEstado(verseKey, [{
        id: crypto.randomUUID(),
        groupId,
        cor: color,
        start: fragment.start,
        end: fragment.end,
        texto: fragment.texto,
        versiculo: Number(verseKey),
        createdAt: Date.now()
    }]);

    if (docsVersiculo.length) {
        for (const docSnap of docsVersiculo) {
            await updateDoc(docSnap.ref, {
                Sublinhado: current,
                timestamp: serverTimestamp()
            });
        }
        return;
    }

    await addDoc(collection(state.db, "TextosBiblia"), {
        id: crypto.randomUUID(),
        userId: uid,
        nome: nomeRef,
        livro: state.livro,
        capitulo: state.cap,
        versiculo: Number(verseKey),
        tipo: "textobiblico",
        estado: "on",
        timestamp: serverTimestamp(),
        Dossie: { mica: {}, Apto: [] },
        Puzzle: { quadros: [] },
        Sublinhado: current
    });
}

function aplicarHighlightsLocais(fragments, color, groupId) {
    fragments.forEach(fragment => {
        const verseKey = String(fragment.verseNum);
        const current = state.highlights.get(verseKey) || [];
        const next = normalizarHighlights([
            ...current,
            {
                id: crypto.randomUUID(),
                groupId,
                cor: color,
                start: fragment.start,
                end: fragment.end,
                texto: fragment.texto,
                versiculo: Number(fragment.verseNum),
                createdAt: Date.now()
            }
        ], String(state.verses?.[verseKey] || ""));

        state.highlights.set(verseKey, next);
    });
}

async function removerSelecaoAtual() {
    const groupIds = [...state.selectedGroupIds];
    if (!groupIds.length) return;

    removerHighlightsLocais(groupIds);
    state.onRender?.();

    const uid = state.auth?.currentUser?.uid;
    if (!uid || !state.livro || !state.cap) return;

    const docsCapitulo = await carregarDocsCapitulo(uid);
    for (const docSnap of docsCapitulo) {
        const data = docSnap.data();
        const verseKey = String(data.versiculo ?? "");
        const current = Array.isArray(data.Sublinhado) ? data.Sublinhado : [];
        const next = obterHighlightsDoEstado(verseKey);

        if (next.length !== current.length || current.some(item => groupIds.includes(item?.groupId))) {
            await updateDoc(docSnap.ref, {
                Sublinhado: next,
                timestamp: serverTimestamp()
            });
        }
    }

    state.currentSelection = [];
    state.selectedGroupIds = [];
    esconderToolbar();
    limparSelecaoDom();
}

async function carregarDocsCapitulo(uid) {
    const docsLivro = await carregarDocsLivro(uid);
    return docsLivro.filter(docSnap => Number(docSnap.data()?.capitulo) === Number(state.cap));
}

async function carregarDocsVersiculo(uid, verseKey) {
    const docsCapitulo = await carregarDocsCapitulo(uid);
    return docsCapitulo.filter(docSnap => Number(docSnap.data()?.versiculo) === Number(verseKey));
}

async function carregarDocsLivro(uid) {
    const docsQuery = query(
        collection(state.db, "TextosBiblia"),
        where("userId", "==", uid),
        where("livro", "==", state.livro)
    );
    const snap = await getDocs(docsQuery);
    return snap.docs;
}

function removerHighlightsLocais(groupIds) {
    for (const [verseKey, items] of state.highlights.entries()) {
        const filtered = items.filter(item => !groupIds.includes(item?.groupId));
        if (filtered.length) state.highlights.set(verseKey, filtered);
        else state.highlights.delete(verseKey);
    }
}

function obterHighlightsDoEstado(verseKey, fallback = []) {
    const current = state.highlights.get(String(verseKey));
    return Array.isArray(current) && current.length ? current.map(item => ({ ...item })) : fallback.map(item => ({ ...item }));
}

function encontrarGroupIdsSelecionados(fragments) {
    const groups = new Set();

    fragments.forEach(fragment => {
        const current = state.highlights.get(String(fragment.verseNum)) || [];
        current.forEach(item => {
            if (intervalosSobrepoem(fragment.start, fragment.end, item.start, item.end) && item.groupId) {
                groups.add(item.groupId);
            }
        });
    });

    return [...groups];
}

function intervalosSobrepoem(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

function normalizarHighlights(items, verseText) {
    if (!Array.isArray(items) || !verseText) return [];

    const ordered = items
        .filter(item => Number.isInteger(item?.start) && Number.isInteger(item?.end))
        .map(item => ({
            ...item,
            start: Math.max(0, item.start),
            end: Math.min(verseText.length, item.end)
        }))
        .filter(item => item.end > item.start)
        .sort((a, b) => a.start - b.start);

    const resolved = [];
    let cursor = -1;
    ordered.forEach(item => {
        if (item.start < cursor) return;
        resolved.push(item);
        cursor = item.end;
    });

    return resolved;
}

function montarHtmlComHighlights(texto, highlights) {
    if (!highlights.length) return escaparHtml(texto);

    let html = "";
    let cursor = 0;

    highlights.forEach(item => {
        if (item.start < cursor || item.end > texto.length) return;

        html += escaparHtml(texto.slice(cursor, item.start));
        html += `<mark class="bible-inline-highlight" style="--highlight:${item.cor}; border-bottom-color:${item.cor}; background:${item.cor}30;">${escaparHtml(texto.slice(item.start, item.end))}</mark>`;
        cursor = item.end;
    });

    html += escaparHtml(texto.slice(cursor));
    return html;
}

function mostrarToolbar() {
    const toolbar = document.getElementById('bible-selection-toolbar');
    if (!toolbar) return;
    toolbar.querySelector('.bible-selection-remove')?.classList.toggle('hidden', state.selectedGroupIds.length === 0);
    toolbar.style.display = 'block';
    toolbar.classList.remove('hidden');
    toolbar.classList.add('active');
}

function esconderToolbar() {
    const toolbar = document.getElementById('bible-selection-toolbar');
    if (!toolbar) return;
    toolbar.querySelector('.bible-selection-remove')?.classList.add('hidden');
    toolbar.classList.add('hidden');
    toolbar.classList.remove('active');
    toolbar.style.removeProperty('display');
}

function limparSelecaoDom() {
    const selection = window.getSelection();
    selection?.removeAllRanges();
}

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
