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
    "#92400e", // Castanho
    "#f97316", // Laranja
    "#fb7185", // Rosa
    "#facc15", // Amarelo
    "#34d399", // Verde
    "#38bdf8", // Azul
    "#a78bfa"  // Lilás
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
    selectionOverlaps: false,
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
            <div class="bible-selection-toolbar-colors">
                ${HIGHLIGHT_COLORS.map(color => `
                    <button type="button" class="bible-selection-color" data-color="${color}" style="--swatch:${color};" aria-label="Aplicar cor ${color}"></button>
                `).join('')}
                <button type="button" class="bible-selection-remove hidden" aria-label="Remover sublinhado">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <div class="bible-selection-attach-actions hidden" style="display:flex; justify-content:center; gap:7px; margin-top:8px;">
                <button type="button" class="bible-selection-attach" data-attach="left" aria-label="Anexar ao sublinhado da esquerda" title="Anexar à esquerda" style="width:32px; height:30px; border:1px solid rgba(56,189,248,0.35); border-radius:7px; background:rgba(56,189,248,0.14); color:#7dd3fc; cursor:pointer;"><i class="fa-solid fa-arrow-left"></i></button>
                <button type="button" class="bible-selection-attach" data-attach="both" aria-label="Anexar aos dois lados" title="Anexar aos dois lados" style="width:32px; height:30px; border:1px solid rgba(167,139,250,0.4); border-radius:7px; background:rgba(167,139,250,0.16); color:#c4b5fd; cursor:pointer;"><i class="fa-solid fa-link"></i></button>
                <button type="button" class="bible-selection-attach" data-attach="right" aria-label="Anexar ao sublinhado da direita" title="Anexar à direita" style="width:32px; height:30px; border:1px solid rgba(56,189,248,0.35); border-radius:7px; background:rgba(56,189,248,0.14); color:#7dd3fc; cursor:pointer;"><i class="fa-solid fa-arrow-right"></i></button>
            </div>
            <div class="bible-selection-toolbar-actions hidden" style="display:flex; justify-content:center; gap:10px; margin-top:8px;">
                <button type="button" class="bible-selection-action" data-action="simples" aria-label="Criar nota simples" style="width:32px; height:30px; border:1px solid rgba(251,191,36,0.35); border-radius:7px; background:rgba(251,191,36,0.14); color:#fbbf24; cursor:pointer;"><i class="fa-solid fa-note-sticky"></i></button>
                <button type="button" class="bible-selection-action" data-action="conectora" aria-label="Criar caixa conectora" style="width:32px; height:30px; border:1px solid rgba(234,88,12,0.45); border-radius:7px; background:rgba(234,88,12,0.16); color:#ea580c; cursor:pointer;"><i class="fa-solid fa-box"></i></button>
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

        const attach = event.target.closest('.bible-selection-attach');
        if (attach) {
            await anexarSelecaoAtual(attach.dataset.attach);
            return;
        }

        const action = event.target.closest('.bible-selection-action');
        if (action) {
            dispararAcaoSublinhado(action.dataset.action);
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
    feed.addEventListener('click', event => {
        const mark = event.target.closest('mark.bible-inline-highlight');
        const selecao = window.getSelection();
        if (mark && selecao && !selecao.isCollapsed && selecao.toString().trim()) return;
        if (mark) selecionarHighlightPorClique(mark);
    });
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
        state.selectionOverlaps = false;
        esconderToolbar();
        return;
    }

    const range = selection.getRangeAt(0);
    const fragments = construirFragmentosSelecao(range);

    if (!fragments.length) {
        state.currentSelection = [];
        state.selectedGroupIds = [];
        state.selectionOverlaps = false;
        esconderToolbar();
        return;
    }

    state.currentSelection = fragments;
    state.selectedGroupIds = encontrarGroupIdsSelecionados(fragments);
    state.selectionOverlaps = state.selectedGroupIds.length > 0;
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
    if (!fragments.length || !color || !state.livro || !state.cap || state.selectionOverlaps) return;

    const groupId = crypto.randomUUID();
    aplicarHighlightsLocais(fragments, color, groupId);
    state.onRender?.();

    for (const fragment of fragments) {
        await gravarFragmento(fragment, color, groupId);
    }

    state.currentSelection = [];
    state.selectedGroupIds = [];
    state.selectionOverlaps = false;
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

    const gruposCompletos = encontrarGruposCompletamenteSelecionados(state.currentSelection, groupIds);
    removerHighlightsLocais(groupIds, state.currentSelection, gruposCompletos);
    state.onRender?.();

    const uid = state.auth?.currentUser?.uid;
    if (!uid || !state.livro || !state.cap) return;

    const verseKeys = [...new Set(state.currentSelection.map(fragment => String(fragment.verseNum)).filter(Boolean))];
    for (const verseKey of verseKeys) {
        const docsVersiculo = await carregarDocsVersiculo(uid, verseKey);
        for (const docSnap of docsVersiculo) {
            const data = docSnap.data();
            const current = Array.isArray(data.Sublinhado) ? data.Sublinhado : [];
            const next = removerIntervalosDosHighlights(current, verseKey, groupIds, state.currentSelection, gruposCompletos);

            if (next.length !== current.length || current.some(item => groupIds.includes(item?.groupId))) {
                await updateDoc(docSnap.ref, {
                    Sublinhado: next,
                    timestamp: serverTimestamp()
                });
            }
        }
    }
    state.currentSelection = [];
    state.selectedGroupIds = [];
    state.selectionOverlaps = false;
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

function encontrarGruposCompletamenteSelecionados(fragments, groupIds) {
    const completos = new Set();
    groupIds.forEach(groupId => {
        const itensGrupo = [];
        state.highlights.forEach(items => items.forEach(item => {
            if (item.groupId === groupId) itensGrupo.push(item);
        }));
        if (itensGrupo.length && itensGrupo.every(item => fragments.some(fragment =>
            String(fragment.verseNum) === String(item.versiculo) && fragment.start <= item.start && fragment.end >= item.end
        ))) completos.add(groupId);
    });
    return [...completos];
}

function removerIntervalosDosHighlights(items, verseKey, groupIds, fragments = [], gruposCompletos = []) {
    const ranges = fragments
        .filter(fragment => String(fragment.verseNum) === String(verseKey))
        .map(fragment => ({ start: fragment.start, end: fragment.end }))
        .filter(range => range.end > range.start);

    return items.flatMap(item => {
        if (!groupIds.includes(item?.groupId)) return [item];
        if (gruposCompletos.includes(item?.groupId)) return [];
        if (!ranges.length) return [item];

        let segmentos = [item];
        ranges.forEach(range => {
            segmentos = segmentos.flatMap(segmento => {
                if (!intervalosSobrepoem(range.start, range.end, segmento.start, segmento.end)) {
                    return [segmento];
                }

                const partes = [];
                if (segmento.start < range.start) {
                    partes.push({
                        ...segmento,
                        id: crypto.randomUUID(),
                        end: range.start,
                        texto: String(state.verses?.[verseKey] || "").slice(segmento.start, range.start)
                    });
                }
                if (segmento.end > range.end) {
                    partes.push({
                        ...segmento,
                        id: crypto.randomUUID(),
                        start: range.end,
                        texto: String(state.verses?.[verseKey] || "").slice(range.end, segmento.end)
                    });
                }
                return partes;
            });
        });
        return segmentos;
    });
}

function removerHighlightsLocais(groupIds, fragments = [], gruposCompletos = []) {
    for (const [verseKey, items] of state.highlights.entries()) {
        const next = removerIntervalosDosHighlights(items, verseKey, groupIds, fragments, gruposCompletos);
        if (next.length) state.highlights.set(verseKey, next);
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

function obterOpcoesAnexo(fragments = []) {
    if (fragments.length !== 1) return { left: null, right: null, both: false };

    const fragment = fragments[0];
    const items = state.highlights.get(String(fragment.verseNum)) || [];
    const left = items
        .filter(item => item.groupId && item.end === fragment.start)
        .sort((a, b) => b.end - a.end)[0] || null;
    const right = items
        .filter(item => item.groupId && item.start === fragment.end)
        .sort((a, b) => a.start - b.start)[0] || null;

    return {
        left,
        right,
        both: Boolean(left && right && left.groupId === right.groupId)
    };
}

async function anexarSelecaoAtual(lado) {
    const opcoes = obterOpcoesAnexo(state.currentSelection);
    const alvo = lado === "left" ? opcoes.left : lado === "right" ? opcoes.right : (opcoes.both ? opcoes.left : null);
    if (!alvo || !state.currentSelection.length || !state.livro || !state.cap) return;

    const fragments = [...state.currentSelection];
    const groupId = alvo.groupId;
    const color = alvo.cor || HIGHLIGHT_COLORS[0];

    aplicarHighlightsLocais(fragments, color, groupId);
    state.onRender?.();

    for (const fragment of fragments) {
        await gravarFragmento(fragment, color, groupId);
    }

    state.currentSelection = [];
    state.selectedGroupIds = [];
    state.selectionOverlaps = false;
    esconderToolbar();
    limparSelecaoDom();
}

function atualizarBotoesAnexo() {
    const wrapper = document.querySelector('.bible-selection-attach-actions');
    if (!wrapper) return;

    const opcoes = obterOpcoesAnexo(state.currentSelection);
    const disponivel = state.selectedGroupIds.length === 0 && (opcoes.left || opcoes.right);
    wrapper.classList.toggle('hidden', !disponivel);
    wrapper.querySelector('[data-attach="left"]')?.classList.toggle('hidden', !opcoes.left);
    wrapper.querySelector('[data-attach="right"]')?.classList.toggle('hidden', !opcoes.right);
    wrapper.querySelector('[data-attach="both"]')?.classList.toggle('hidden', !opcoes.both);
}
function criarContextoSublinhado(groupIds, verseNum = null) {
    const ids = [...new Set((groupIds || []).filter(Boolean))];
    const fragmentos = [];
    state.highlights.forEach((items, verseKey) => {
        items.forEach(item => {
            if (ids.includes(item.groupId)) {
                fragmentos.push({
                    id: item.id,
                    groupId: item.groupId,
                    versiculo: Number(verseKey),
                    start: item.start,
                    end: item.end,
                    texto: item.texto || String(state.verses?.[verseKey] || "").slice(item.start, item.end),
                    cor: item.cor
                });
            }
        });
    });
    fragmentos.sort((a, b) => a.versiculo - b.versiculo || a.start - b.start);
    const primeiro = fragmentos.find(item => String(item.versiculo) === String(verseNum)) || fragmentos[0];
    return {
        tipo: "biblia-sublinhado",
        livro: state.livro,
        capitulo: Number(state.cap),
        groupId: ids[0] || null,
        groupIds: ids,
        versiculo: primeiro?.versiculo || Number(verseNum) || null,
        texto: primeiro?.texto || "",
        fragmentos
    };
}

function selecionarHighlightPorClique(mark) {
    const selecao = window.getSelection();
    if (selecao && !selecao.isCollapsed && selecao.toString().trim()) return;
    const groupId = mark.dataset.highlightGroup;
    if (!groupId) return;
    const contexto = criarContextoSublinhado([groupId], mark.dataset.verse);
    state.currentSelection = [];
    state.selectedGroupIds = [];
    state.selectionOverlaps = false;
    esconderToolbar();
    limparSelecaoDom();
    window.dispatchEvent(new CustomEvent("bible:sublinhadoSelecionado", { detail: contexto }));
}

function dispararAcaoSublinhado(tipo) {
    const contexto = criarContextoSublinhado(state.selectedGroupIds);
    if (!contexto.groupIds.length) return;
    window.dispatchEvent(new CustomEvent('bible:abrirPuzzle'));
    if (!window._activeBibliaPlusHandler) {
        window._biblePendingPuzzleAction = tipo;
        window.dispatchEvent(new CustomEvent("bible:sublinhadoSelecionado", { detail: contexto }));
        return;
    }
    window.dispatchEvent(new CustomEvent("bible:adicionarTexto", {
        detail: { ...contexto, tipo }
    }));
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
        html += `<mark class="bible-inline-highlight" data-highlight-group="${escaparHtml(item.groupId || "")}" data-highlight-id="${escaparHtml(item.id || "")}" data-verse="${escaparHtml(item.versiculo || "")}" style="--highlight:${item.cor}; border-bottom-color:${item.cor}; background:${item.cor}30; cursor:pointer;">${escaparHtml(texto.slice(item.start, item.end))}</mark>`;
        cursor = item.end;
    });

    html += escaparHtml(texto.slice(cursor));
    return html;
}

function mostrarToolbar() {
    const toolbar = document.getElementById('bible-selection-toolbar');
    if (!toolbar) return;
    const temSublinhado = state.selectedGroupIds.length > 0;
    toolbar.classList.toggle('bible-selection-toolbar-actions-active', temSublinhado);
    toolbar.querySelector('.bible-selection-remove')?.classList.toggle('hidden', !temSublinhado);
    toolbar.querySelectorAll('.bible-selection-color').forEach(colorButton => colorButton.classList.toggle('hidden', temSublinhado));
    toolbar.querySelector('.bible-selection-toolbar-actions')?.classList.toggle('hidden', !temSublinhado);
    atualizarBotoesAnexo();
    toolbar.style.display = 'block';
    toolbar.classList.remove('hidden');
    toolbar.classList.add('active');
}

function esconderToolbar() {
    const toolbar = document.getElementById('bible-selection-toolbar');
    if (!toolbar) return;
    toolbar.querySelector('.bible-selection-remove')?.classList.add('hidden');
    toolbar.classList.remove('bible-selection-toolbar-actions-active');
    toolbar.querySelector('.bible-selection-toolbar-actions')?.classList.add('hidden');
    toolbar.querySelector('.bible-selection-attach-actions')?.classList.add('hidden');
    toolbar.querySelectorAll('.bible-selection-color').forEach(colorButton => colorButton.classList.remove('hidden'));
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
