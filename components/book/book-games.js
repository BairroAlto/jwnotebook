import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { NexoEngine } from '../direita/ai-engine.js';
import { renderizarPaginaLeitura } from '../lists/reader/reader-view.js';
import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { marcarRespondido } from './book-viewer.js';
import { escapeHtml, textoDaCaixa, textoDaNota } from './book-utils.js';

let studyMode = null;
let sentinelMode = null;
let bookAiMode = null;
let respondiMode = false;
let lastScoreTotal = null;
let sentinelBackHandler = null;
let dragState = null;

const SCORE_LABELS = {
    tradicionalverdadeirofalso: "Verdadeiro/Falso",
    tradicionalordem: "Ordenação",
    aiperguntasrespostas: "BookAI Q/R",
    airesumorelampago: "Resumo Relâmpago",
    aititulofantasma: "Título Fantasma",
    aiintruso: "Caixa Intrusa",
    aicompletar: "Continuação Certa"
};

export function iniciarBookGames() {
    document.querySelectorAll('[data-book-game-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-book-game-tab]').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            renderGameTab(btn.dataset.bookGameTab);
        });
    });
    document.getElementById('book-game-card-close')?.addEventListener('click', closeGameCard);
    document.getElementById('book-sentinel-fab')?.addEventListener('click', toggleSentinelSheet);
    document.getElementById('book-sentinel-min')?.addEventListener('click', minimizeSentinelSheet);
    document.getElementById('book-sentinel-close')?.addEventListener('click', closeSentinelSheet);
    document.getElementById('book-sentinel-top-back')?.addEventListener('click', () => sentinelBackHandler?.());
    window.atualizarBookGameBadge = updateGameBadge;
    window.renderBookRespondiHands = renderRespondiHands;
    bindGamesDrag();
    updateGameBadge();
}

export function abrirBookGames() {
    document.getElementById('book-popup-games')?.classList.add('active');
    renderGameTab(document.querySelector('[data-book-game-tab].active')?.dataset.bookGameTab || "study");
    updateGameBadge();
}

function renderGameTab(tab) {
    const body = document.getElementById('book-games-body');
    if (!body) return;

    if (tab === "sentinel") {
        renderSentinelHome(body);
        return;
    }
    if (tab === "scores") {
        renderScoresTab(body);
        return;
    }
    if (tab === "bookai") {
        body.innerHTML = `
            <div class="book-mode-list">
                ${modeButton("bookai-qa", "fa-brands fa-mailchimp", "Perguntas e Respostas", "15 questões de verdadeiro ou falso baseadas na nota.", "#10b981")}
                ${modeButton("bookai-summary", "fa-solid fa-bolt", "Resumo Relâmpago", "Escolhe o melhor resumo entre três opções.", "#fb7185")}
                ${modeButton("bookai-title", "fa-solid fa-signature", "Título Fantasma", "Descobre o título mais fiel ao conteúdo da nota.", "#38bdf8")}
                ${modeButton("bookai-intruder", "fa-solid fa-user-secret", "Caixa Intrusa", "Encontra a opção que não bate certo com a nota.", "#f59e0b")}
                ${modeButton("bookai-complete", "fa-solid fa-wand-magic-sparkles", "Continuação Certa", "Escolhe a continuação que respeita a lógica da nota.", "#a78bfa")}
            </div>`;
        atualizarBotoesModoDaAba(tab, bookAiMode);
        body.querySelector('[data-study-mode="bookai-qa"]')?.addEventListener('click', () => ativarBookAiMode("bookai-qa", renderAiQuiz));
        body.querySelector('[data-study-mode="bookai-summary"]')?.addEventListener('click', () => ativarBookAiMode("bookai-summary", renderSummaryLightning));
        body.querySelector('[data-study-mode="bookai-title"]')?.addEventListener('click', () => ativarBookAiMode("bookai-title", renderTitleGhost));
        body.querySelector('[data-study-mode="bookai-intruder"]')?.addEventListener('click', () => ativarBookAiMode("bookai-intruder", renderIntruderAI));
        body.querySelector('[data-study-mode="bookai-complete"]')?.addEventListener('click', () => ativarBookAiMode("bookai-complete", renderCompleteAI));
        return;
    }

    body.innerHTML = `
        <div class="book-mode-list">
            ${modeButton("blur", "fa-solid fa-eye-slash", "Esconde Respostas", "Desfoca o conteúdo das questões.", "#c084fc")}
            ${modeButton("flashcards", "fa-solid fa-puzzle-piece", "Flashcards", "Estudo clássico por cartões.", "#a3e635")}
            ${modeButton("order", "fa-solid fa-arrow-down-1-9", "Ordenação", "Reconstrói a lógica da nota.", "#60a5fa")}
            ${modeButton("truth", "fa-solid fa-scale-balanced", "Verdadeiro ou Falso", "Deteta associações erradas.", "#fbbf24")}
        </div>`;
    body.querySelectorAll('[data-study-mode]').forEach(btn => {
        btn.addEventListener('click', () => ativarStudyMode(btn.dataset.studyMode));
    });
    atualizarBotoesModoDaAba(tab, studyMode);
}

function modeButton(mode, icon, title, desc, color, active = false) {
    return `<button class="book-mode-option ${active ? 'active' : ''}" data-study-mode="${mode}" style="--mode-color:${color}">
        <i class="${icon}"></i>
        <span><strong>${title}</strong><small>${desc}</small></span>
    </button>`;
}

function ativarStudyMode(mode) {
    studyMode = studyMode === mode ? null : mode;
    document.body.classList.toggle('book-blur-answers', studyMode === "blur");
    if (mode !== "respondi") {
        respondiMode = false;
        document.body.classList.remove('book-respondi-mode');
        renderRespondiHands();
    }
    atualizarBotoesModoAtivo();
    if (studyMode === "flashcards") renderFlashcards();
    else if (studyMode === "order") renderOrder();
    else if (studyMode === "truth") renderTruth();
}

function atualizarBotoesModoAtivo() {
    document.querySelectorAll('[data-study-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.studyMode === studyMode);
    });
}

function atualizarBotoesModoDaAba(tab, activeMode) {
    if (!activeMode) return;
    document.querySelectorAll('[data-study-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.studyMode === activeMode);
    });
}

function ativarBookAiMode(mode, callback) {
    bookAiMode = bookAiMode === mode ? null : mode;
    renderGameTab("bookai");
    if (bookAiMode) callback();
}

function renderRespondiHands() {
    document.querySelectorAll('.book-hand-action').forEach(el => el.remove());
    if (!respondiMode) return;
    getVisibleBookBoxes().forEach(caixa => {
        const card = document.querySelector(`[data-caixa-id="${CSS.escape(caixa.id)}"]`);
        if (!card) return;
        const btn = document.createElement('button');
        btn.className = `book-hand-action ${caixa.respondi ? 'active' : ''}`;
        btn.innerHTML = '<i class="fa-solid fa-hand"></i>';
        btn.title = "Respondi";
        btn.onclick = async () => {
            await marcarRespondido(caixa.id, !caixa.respondi);
            if (respondiMode) setTimeout(renderRespondiHands, 80);
        };
        card.appendChild(btn);
    });
}

function bindGamesDrag() {
    const modal = document.querySelector('#book-popup-games .book-games-modal');
    const header = document.querySelector('#book-popup-games .popup-header');
    if (!modal || !header) return;
    header.style.cursor = 'grab';
    header.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        dragState = {
            startX: event.clientX,
            startY: event.clientY,
            startLeft: modal.offsetLeft,
            startTop: modal.offsetTop
        };
        modal.classList.add('dragging');
        header.style.cursor = 'grabbing';
        header.setPointerCapture?.(event.pointerId);
    });
    header.addEventListener('pointermove', event => {
        if (!dragState) return;
        const nextLeft = dragState.startLeft + (event.clientX - dragState.startX);
        const nextTop = dragState.startTop + (event.clientY - dragState.startY);
        modal.style.left = `${Math.max(8, nextLeft)}px`;
        modal.style.top = `${Math.max(58, nextTop)}px`;
        modal.style.right = 'auto';
    });
    const endDrag = () => {
        dragState = null;
        modal.classList.remove('dragging');
        header.style.cursor = 'grab';
    };
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
}

function renderFlashcards() {
    const caixas = getVisibleBookBoxes().filter(c => c.titulo || c.conteudo);
    if (!caixas.length) return openGameCard("Flashcards", `<p class="book-game-hint">Não há caixas com conteúdo nesta nota.</p>`);
    const cards = caixas.map(c => ({
        title: c.titulo || "Cartão",
        body: c.conteudo || textoDaCaixa(c) || "Sem conteúdo"
    }));
    let index = 0;
    const draw = () => {
        const card = cards[index];
        openGameCard("Flashcards", `
            <div class="book-flash-single-wrap">
                <div class="book-score-strip"><span>${index + 1}/${cards.length}</span><strong>Clica no cartão para virar</strong></div>
                <button class="book-flip-card book-flip-card-large" id="book-flash-single">
                    <span class="book-flip-inner">
                        <span class="book-flip-face front"><strong>${escapeHtml(card.title)}</strong><small>Frente</small></span>
                        <span class="book-flip-face back">${escapeHtml(card.body)}</span>
                    </span>
                </button>
                <div class="book-flash-nav">
                    <button id="book-flash-prev" ${index === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                    <button id="book-flash-next" ${index === cards.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-right"></i></button>
                </div>
            </div>`);
        document.getElementById('book-flash-single')?.addEventListener('click', event => event.currentTarget.classList.toggle('flipped'));
        document.getElementById('book-flash-prev')?.addEventListener('click', () => { index = Math.max(0, index - 1); draw(); });
        document.getElementById('book-flash-next')?.addEventListener('click', () => { index = Math.min(cards.length - 1, index + 1); draw(); });
    };
    draw();
}

function renderOrder() {
    const caixas = getVisibleBookBoxes().map((c, index) => ({ ...c, originalIndex: index }));
    if (caixas.length < 2) return openGameCard("Ordenação", `<p class="book-game-hint">Preciso de pelo menos duas caixas.</p>`);
    const shuffled = shuffle(caixas);
    openGameCard("Jogo de Ordenação", `
        <p class="book-game-hint">Arrasta os títulos para repor a ordem original.</p>
        <ol class="book-order-list">
            ${shuffled.map(c => `<li draggable="true" data-original-index="${c.originalIndex}"><i class="fa-solid fa-grip-vertical"></i><span>${escapeHtml(c.titulo || textoDaCaixa(c).slice(0, 90) || c.tipo)}</span></li>`).join('')}
        </ol>
        <button class="book-submit-game" id="book-order-submit">Submeter</button>`);
    bindDragOrder();
    document.getElementById('book-order-submit')?.addEventListener('click', async () => {
        const items = Array.from(document.querySelectorAll('.book-order-list li'));
        const correctCount = items.filter((item, index) => Number(item.dataset.originalIndex) === index).length;
        const score = items.reduce((sum, item, index) => sum + (Number(item.dataset.originalIndex) === index ? 1 : -1), 0);
        await saveScore('tradicionalordem', score);
        openResult("Ordenação", score, `${correctCount} posições certas.`);
    });
}

function renderTruth() {
    const caixas = getVisibleBookBoxes().filter(c => c.titulo || c.conteudo);
    if (caixas.length < 2) return openGameCard("Verdadeiro ou Falso", `<p class="book-game-hint">Preciso de pelo menos duas caixas com conteúdo.</p>`);
    const rounds = shuffle(caixas).slice(0, Math.min(10, caixas.length)).map((c, i, arr) => {
        const truth = i % 2 === 0;
        const wrong = arr[(i + 1) % arr.length] || caixas.find(x => x.id !== c.id) || c;
        return {
            title: c.titulo || c.tipo || "Questão aleatória",
            body: truth ? textoDaCaixa(c) : textoDaCaixa(wrong),
            answer: truth
        };
    });
    startBinaryQuiz("Verdadeiro ou Falso", rounds, 'tradicionalverdadeirofalso');
}

function startBinaryQuiz(title, rounds, scoreKey) {
    let index = 0;
    let score = 0;
    const answers = [];
    const draw = () => {
        const round = rounds[index];
        openGameCard(title, `
            <div class="book-truth-shell">
                <div class="book-score-strip"><span>${index + 1}/${rounds.length}</span><strong>${score} pontos</strong></div>
                <div class="book-swipe-card" id="book-binary-card">
                    <div class="book-truth-orbit"><i class="fa-solid fa-scale-balanced"></i></div>
                    <small>Questões aleatórias</small>
                    <h4>${escapeHtml(round.title)}</h4>
                    <p>${escapeHtml(String(round.body || "").slice(0, 420))}</p>
                </div>
                <div class="book-binary-actions">
                    <button data-answer="false"><i class="fa-solid fa-arrow-left"></i> Falso</button>
                    <button data-answer="true">Verdadeiro <i class="fa-solid fa-arrow-right"></i></button>
                </div>
            </div>`);
        const card = document.getElementById('book-binary-card');
        let startX = null;
        card?.addEventListener('pointerdown', e => { startX = e.clientX; card.setPointerCapture(e.pointerId); });
        card?.addEventListener('pointerup', e => {
            if (startX === null) return;
            const delta = e.clientX - startX;
            startX = null;
            if (Math.abs(delta) > 55) submit(delta > 0);
        });
        document.querySelectorAll('.book-binary-actions button').forEach(btn => btn.addEventListener('click', () => submit(btn.dataset.answer === "true")));
    };
    const submit = async (value) => {
        const correct = value === rounds[index].answer;
        score += correct ? 3 : -2;
        answers.push(correct);
        document.getElementById('book-binary-card')?.classList.add(correct ? 'correct' : 'wrong');
        await new Promise(resolve => setTimeout(resolve, 420));
        index += 1;
        if (index >= rounds.length) {
            await saveScore(scoreKey, score);
            openResult(title, score, `${answers.filter(Boolean).length} respostas certas em ${rounds.length}.`);
        } else {
            draw();
        }
    };
    draw();
}

async function renderAiQuiz() {
    const noteText = textoDaNota(BookState.dadosNota, getVisibleBookBoxes());
    openGameCard("BookAI: Perguntas e Respostas", `<div class="book-ai-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><span>BookAI está a ler apenas esta nota...</span></div>`);
    const prompt = 'Cria exatamente 15 afirmações de verdadeiro/falso com base exclusiva na nota. Mistura afirmações verdadeiras e falsas. Responde só JSON válido no formato [{"titulo":"...","texto":"...","resposta":true}].';
    let rounds = [];
    try {
        const resposta = await NexoEngine.perguntar(prompt, "normal", `NOTA ATUAL:\n${noteText}`);
        rounds = parseAiQuestions(resposta);
    } catch (_) {}
    if (!rounds.length) rounds = fallbackQuestions();
    startBinaryQuiz("BookAI: Perguntas e Respostas", rounds.slice(0, 15), 'aiperguntasrespostas');
}

function renderSummaryLightning() {
    const note = buildNoteModel();
    if (!note.sentences.length) return openGameCard("Resumo Relâmpago", `<p class="book-game-hint">A nota não tem texto suficiente.</p>`);
    const options = shuffle([
        { label: "A", text: summarizeText(note.sentences), correct: true },
        { label: "B", text: makeDistractorSummary(note.sentences, note.title), correct: false },
        { label: "C", text: makeContrarySummary(note.sentences, note.title), correct: false }
    ]);
    openChoiceGame("Resumo Relâmpago", "Qual destes resumos está corretamente alinhado com a nota?", options, 'airesumorelampago');
}

function renderTitleGhost() {
    const note = buildNoteModel();
    const options = shuffle([
        { label: "A", text: note.title || synthTitle(note.sentences), correct: true },
        { label: "B", text: `Hipóteses dispersas sobre ${firstKeyword(note.title || note.sentences[0] || 'a nota')}`, correct: false },
        { label: "C", text: `Resumo paralelo sem foco em ${lastKeyword(note.title || note.sentences[0] || 'tema')}`, correct: false }
    ]);
    openChoiceGame("Título Fantasma", "Qual destes títulos representa melhor a nota atual?", options, 'aititulofantasma');
}

function renderIntruderAI() {
    const note = buildNoteModel();
    if (note.snippets.length < 2) return openGameCard("Caixa Intrusa", `<p class="book-game-hint">Preciso de mais conteúdo na nota para este jogo.</p>`);
    const realA = note.snippets[0];
    const realB = note.snippets[1] || note.snippets[0];
    const fake = makeIntruderSnippet(note.sentences, note.title);
    const options = shuffle([
        { label: "A", text: realA, correct: false },
        { label: "B", text: realB, correct: false },
        { label: "C", text: fake, correct: true }
    ]);
    openChoiceGame("Caixa Intrusa", "Qual destas opções não encaixa no que a nota realmente diz?", options, 'aiintruso', {
        successDetail: "Identificaste a intrusa corretamente."
    });
}

function renderCompleteAI() {
    const note = buildNoteModel();
    const seed = note.sentences.find(line => line.split(' ').length > 8) || note.sentences[0];
    if (!seed) return openGameCard("Continuação Certa", `<p class="book-game-hint">A nota não tem texto suficiente.</p>`);
    const [lead, tail] = splitSentence(seed);
    const options = shuffle([
        { label: "A", text: tail, correct: true },
        { label: "B", text: invertEnding(tail), correct: false },
        { label: "C", text: genericEnding(note.title), correct: false }
    ]);
    openChoiceGame("Continuação Certa", `Completa corretamente esta frase: "${escapeHtml(lead)}..."`, options, 'aicompletar');
}

function openChoiceGame(title, prompt, options, scoreKey, config = {}) {
    openGameCard(title, `
        <div class="book-choice-shell">
            <p class="book-game-hint">${prompt}</p>
            <div class="book-choice-list">
                ${options.map(option => `
                    <button class="book-choice-option" data-correct="${option.correct ? '1' : '0'}">
                        <strong>${option.label}</strong>
                        <span>${escapeHtml(option.text)}</span>
                    </button>`).join('')}
            </div>
        </div>`);
    document.querySelectorAll('.book-choice-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const correct = btn.dataset.correct === '1';
            document.querySelectorAll('.book-choice-option').forEach(item => {
                item.disabled = true;
                if (item.dataset.correct === '1') item.classList.add('is-correct');
            });
            if (!correct) btn.classList.add('is-wrong');
            const score = correct ? 5 : -2;
            await saveScore(scoreKey, score);
            setTimeout(() => openResult(title, score, correct ? (config.successDetail || "Escolha certa.") : "Resposta incorreta."), 280);
        });
    });
}

function parseAiQuestions(text) {
    const match = String(text || "").match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
        const data = JSON.parse(match[0]);
        return data.map(item => ({
            title: item.titulo || "Pergunta BookAI",
            body: item.texto || item.pergunta || "",
            answer: Boolean(item.resposta)
        })).filter(item => item.body);
    } catch (_) {
        return [];
    }
}

function fallbackQuestions() {
    const caixas = getVisibleBookBoxes().filter(c => c.titulo || c.conteudo);
    return shuffle(caixas).slice(0, 15).map((c, i, arr) => {
        const truth = i % 3 !== 1;
        const other = arr[(i + 1) % arr.length] || c;
        return {
            title: c.titulo || "Pergunta BookAI",
            body: truth ? `Esta caixa fala sobre: ${textoDaCaixa(c).slice(0, 240)}` : `Esta caixa está associada a: ${textoDaCaixa(other).slice(0, 240)}`,
            answer: truth
        };
    });
}

function renderSentinelHome(body) {
    body.innerHTML = `
        <div class="book-mode-list">
            ${modeButton("sentinel-read", "fa-solid fa-book-open", "Ler Sentinela", "Escolher ano, mês e artigo para acompanhar.", "#60a5fa")}
            ${modeButton("sentinel-respondi", "fa-solid fa-hand", "Modo 'Respondi?'", "Marcar caixas comentadas.", "#fbbf24")}
        </div>
        <div id="book-sentinel-browser"></div>`;
    atualizarBotoesModoDaAba("sentinel", sentinelMode);
    body.querySelector('[data-study-mode="sentinel-read"]')?.addEventListener('click', () => {
        sentinelMode = sentinelMode === "sentinel-read" ? null : "sentinel-read";
        renderGameTab("sentinel");
        if (!sentinelMode) return;
        if (window.innerWidth <= 768) {
            document.getElementById('book-popup-games')?.classList.remove('active');
            renderSentinelYears();
        } else {
            body.innerHTML = `<div id="book-sentinel-browser"></div>`;
            renderSentinelYears();
        }
    });
    body.querySelector('[data-study-mode="sentinel-respondi"]')?.addEventListener('click', () => {
        sentinelMode = sentinelMode === "sentinel-respondi" ? null : "sentinel-respondi";
        respondiMode = sentinelMode === "sentinel-respondi";
        document.body.classList.toggle('book-respondi-mode', respondiMode);
        renderRespondiHands();
        renderGameTab("sentinel");
        const target = document.getElementById('book-sentinel-browser');
        if (target) target.innerHTML = `<p class="book-game-hint">${respondiMode ? "Modo ativo. As mãos ficam visíveis até desativares." : "Modo desativado."}</p>`;
    });
}

function renderSentinelYears() {
    const years = Array.from({ length: 22 }, (_, i) => 2026 - i);
    const target = getSentinelTarget();
    setSentinelHeader();
    target.innerHTML = `
        <div class="book-sentinel-shell">
            <div class="book-sentinel-nav">
                <div class="book-sentinel-title-path">Lists &gt; Livros &gt; Sentinela</div>
            </div>
            <div class="book-sentinel-tree">
                ${years.map(year => `<button class="cap-btn year-btn" data-year="${year}" style="padding:12px; background:rgba(255,255,255,0.05); border-radius:4px; cursor:pointer;">${year}</button>`).join('')}
            </div>
        </div>`;
    target.querySelectorAll('[data-year]').forEach(btn => btn.addEventListener('click', () => renderSentinelMonths(Number(btn.dataset.year))));
    showSentinelSheetOnMobile();
}

function renderSentinelMonths(year) {
    const target = getSentinelTarget();
    const inlineBack = window.innerWidth <= 768 ? "" : `<button id="sentinel-back-years" class="book-sentinel-back"><i class="fa-solid fa-chevron-left"></i> Sentinela</button>`;
    setSentinelHeader({
        label: "Sentinela",
        onBack: renderSentinelYears
    });
    target.innerHTML = `
        <div class="book-sentinel-shell">
            <div class="book-sentinel-nav">
                ${inlineBack}
                <div class="book-sentinel-title-path">Lists &gt; Livros &gt; Sentinela &gt; ${year}</div>
            </div>
            <div class="book-sentinel-tree">
                ${Array.from({ length: 12 }, (_, i) => i + 1).map(month => `<button class="cap-btn" data-month="${month}" style="padding:12px; background:rgba(255,255,255,0.05); border-radius:4px; cursor:pointer;">${String(month).padStart(2, "0")}</button>`).join('')}
            </div>
        </div>`;
    document.getElementById('sentinel-back-years')?.addEventListener('click', renderSentinelYears);
    target.querySelectorAll('[data-month]').forEach(btn => btn.addEventListener('click', () => renderSentinelArticles(year, Number(btn.dataset.month))));
    showSentinelSheetOnMobile();
}

async function renderSentinelArticles(year, month) {
    const target = getSentinelTarget();
    const inlineBack = window.innerWidth <= 768 ? "" : `<button id="sentinel-back-months" class="book-sentinel-back"><i class="fa-solid fa-chevron-left"></i> ${year}</button>`;
    setSentinelHeader({
        label: String(year),
        onBack: () => renderSentinelMonths(year)
    });
    target.innerHTML = `<div class="book-ai-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><span>A carregar artigos...</span></div>`;
    let articles = [];
    const base = `data/publicacoes/w/${year}`;
    const files = year >= 2009
        ? [`${String(month).padStart(2, "0")}.json`]
        : [`${String(month).padStart(2, "0")}_01.json`, `${String(month).padStart(2, "0")}_15.json`];
    for (const file of files) {
        const path = `${base}/${file}`;
        try {
            const data = await fetch(path).then(r => r.ok ? r.json() : Promise.reject());
            const found = Array.isArray(data.artigos) ? data.artigos : Object.values(data).find(Array.isArray) || [];
            articles.push(...found.map((article, index) => ({ article, index, path, year, month })));
        } catch (_) {}
    }
    target.innerHTML = `
        <div class="book-sentinel-shell">
            <div class="book-sentinel-nav">
                ${inlineBack}
                <div class="book-sentinel-title-path">Lists &gt; Livros &gt; Sentinela &gt; ${year} &gt; ${String(month).padStart(2, "0")}</div>
            </div>
            <div class="book-sentinel-list">${articles.length ? articles.map(item => `
                <button class="menu-item-list book-sentinel-choice" data-path="${item.path}" data-index="${item.index}" data-year="${item.year}" data-month="${item.month}" style="width:100%; text-align:left; display:flex; flex-direction:column; align-items:flex-start;">
                    <span style="font-size:10px; color:var(--text-muted); font-weight:800;">ARTIGO ${item.index + 1}</span>
                    <strong>${escapeHtml(item.article.titulo || item.article.title || item.article.nome || `Artigo ${item.index + 1}`)}</strong>
                </button>`).join('') : `<p class="book-game-hint">Não encontrei artigos neste mês.</p>`}</div>
        </div>`;
    document.getElementById('sentinel-back-months')?.addEventListener('click', () => renderSentinelMonths(year));
    target.querySelectorAll('.book-sentinel-choice').forEach(btn => {
        btn.addEventListener('click', async () => abrirArtigoSentinela(btn.dataset.path, Number(btn.dataset.index), Number(btn.dataset.year), Number(btn.dataset.month)));
    });
    showSentinelSheetOnMobile();
}

async function abrirArtigoSentinela(path, index, year, month) {
    const data = await fetch(path).then(r => r.json());
    const artigos = Array.isArray(data.artigos) ? data.artigos : Object.values(data).find(Array.isArray) || [];
    const artigo = artigos[index] || {};
    if (window.innerWidth <= 768) {
        openSentinelInPopup(artigo, data, year, month);
    } else {
        openSentinelInLeftColumn(artigo, data, year, month);
    }
}

function openSentinelInPopup(artigo, dataPai, year, month) {
    const target = getSentinelTarget();
    if (!target) return;
    setSentinelHeader({
        label: "Voltar",
        onBack: () => renderSentinelArticles(year, month)
    });
    renderizarPaginaLeitura(normalizeArticle(artigo), target, dataPai, () => renderSentinelArticles(year, month));
    target.querySelector('#btn-voltar-artigos')?.remove();
    target.querySelector('#livros-scroll')?.classList.add('book-sentinel-reader-scroll');
    showSentinelSheetOnMobile();
}

function openSentinelInLeftColumn(artigo, dataPai, year, month) {
    const lists = document.getElementById('lista-lists');
    if (!lists) return;
    activateListsTab();
    renderizarPaginaLeitura(normalizeArticle(artigo), lists, dataPai, () => renderSentinelArticlesInLeftColumn(year, month));
}

function activateListsTab() {
    const button = Array.from(document.querySelectorAll('#left-buttons button')).find(btn => btn.textContent.trim().toLowerCase() === 'lists');
    button?.click();
    const left = document.getElementById('area-esquerda');
    if (window.innerWidth <= 768) {
        left?.classList.remove('closed');
        document.getElementById('mobile-overlay')?.classList.add('active');
    }
}

function normalizeArticle(artigo) {
    const content = Array.isArray(artigo?.conteudo)
        ? artigo.conteudo
        : Array.isArray(artigo?.paragrafos)
            ? artigo.paragrafos.map(texto => typeof texto === 'string' ? { tipo: 'p', texto } : texto)
            : Array.isArray(artigo?.secoes)
                ? artigo.secoes.map(item => item?.texto ? item : { tipo: 'p', texto: item?.titulo || JSON.stringify(item) })
                : [{ tipo: 'p', texto: 'Sem conteúdo disponível.' }];
    return {
        titulo: artigo?.titulo || artigo?.title || artigo?.nome || "Sentinela",
        conteudo: content
    };
}

async function renderSentinelArticlesInLeftColumn(year, month) {
    const lists = document.getElementById('lista-lists');
    if (!lists) return;
    activateListsTab();
    lists.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    const base = `data/publicacoes/w/${year}`;
    const files = year >= 2009
        ? [`${String(month).padStart(2, "0")}.json`]
        : [`${String(month).padStart(2, "0")}_01.json`, `${String(month).padStart(2, "0")}_15.json`];
    let articles = [];
    for (const file of files) {
        const path = `${base}/${file}`;
        try {
            const data = await fetch(path).then(r => r.ok ? r.json() : Promise.reject());
            const found = Array.isArray(data.artigos) ? data.artigos : Object.values(data).find(Array.isArray) || [];
            articles.push(...found.map((article, index) => ({ article, index, path })));
        } catch (_) {}
    }
    lists.innerHTML = `
        <div id="btn-voltar-artigos" style="padding:12px; cursor:pointer; color:var(--primary); font-size:11px; font-weight:800; border-bottom:1px solid var(--border-color); background:var(--bg-panel); position:sticky; top:0; z-index:10; text-transform:uppercase;">
            <i class="fa-solid fa-chevron-left"></i> Sentinela ${year}
        </div>
        <div style="padding:10px 12px 0; color:var(--text-muted); font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em;">
            Lists > Livros > Sentinela > ${year} > ${String(month).padStart(2, "0")}
        </div>
        <div style="flex:1; overflow-y:auto; padding:10px;">
            ${articles.length ? articles.map(item => `
                <button class="menu-item-list" data-path="${item.path}" data-index="${item.index}" style="width:100%; text-align:left; display:flex; flex-direction:column; align-items:flex-start;">
                    <span style="font-size:10px; color:var(--text-muted); font-weight:800;">ARTIGO ${item.index + 1}</span>
                    <span style="color:white;">${escapeHtml(item.article.titulo || item.article.title || item.article.nome || `Artigo ${item.index + 1}`)}</span>
                </button>`).join('') : `<p class="book-game-hint">Não encontrei artigos neste mês.</p>`}
        </div>`;
    document.querySelectorAll('#lista-lists [data-path]').forEach(btn => {
        btn.addEventListener('click', () => abrirArtigoSentinela(btn.dataset.path, Number(btn.dataset.index), year, month));
    });
    document.getElementById('btn-voltar-artigos')?.addEventListener('click', () => renderSentinelMonthsInLeftColumn(year));
}

function renderSentinelYearsInLeftColumn() {
    const lists = document.getElementById('lista-lists');
    if (!lists) return;
    const years = Array.from({ length: 22 }, (_, i) => 2026 - i);
    lists.innerHTML = `
        <div id="btn-voltar-livros-root" style="padding:12px; cursor:pointer; color:var(--primary); font-size:11px; font-weight:800; border-bottom:1px solid var(--border-color); background:var(--bg-panel); position:sticky; top:0; z-index:10; text-transform:uppercase;">
            <i class="fa-solid fa-chevron-left"></i> Lists
        </div>
        <div style="padding:10px 12px 0; color:var(--text-muted); font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em;">
            Lists > Livros > Sentinela
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; padding:12px;">
            ${years.map(year => `<button class="cap-btn year-btn" data-sentinel-left-year="${year}">${year}</button>`).join('')}
        </div>`;
    document.querySelectorAll('[data-sentinel-left-year]').forEach(btn => {
        btn.addEventListener('click', () => renderSentinelMonthsInLeftColumn(Number(btn.dataset.sentinelLeftYear)));
    });
    document.getElementById('btn-voltar-livros-root')?.addEventListener('click', () => {
        window.renderizarMenuPrincipalLists?.();
    });
}

function renderSentinelMonthsInLeftColumn(year) {
    const lists = document.getElementById('lista-lists');
    if (!lists) return;
    lists.innerHTML = `
        <div id="btn-voltar-sentinel-years" style="padding:12px; cursor:pointer; color:var(--primary); font-size:11px; font-weight:800; border-bottom:1px solid var(--border-color); background:var(--bg-panel); position:sticky; top:0; z-index:10; text-transform:uppercase;">
            <i class="fa-solid fa-chevron-left"></i> Sentinela ${year}
        </div>
        <div style="padding:10px 12px 0; color:var(--text-muted); font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em;">
            Lists > Livros > Sentinela > ${year}
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; padding:12px;">
            ${Array.from({ length: 12 }, (_, i) => i + 1).map(month => `<button class="cap-btn" data-sentinel-left-month="${month}">${String(month).padStart(2, "0")}</button>`).join('')}
        </div>`;
    document.querySelectorAll('[data-sentinel-left-month]').forEach(btn => {
        btn.addEventListener('click', () => renderSentinelArticlesInLeftColumn(year, Number(btn.dataset.sentinelLeftMonth)));
    });
    document.getElementById('btn-voltar-sentinel-years')?.addEventListener('click', () => renderSentinelYearsInLeftColumn());
}


function getSentinelTarget() {
    if (window.innerWidth <= 768) {
        showSentinelSheetOnMobile();
        return document.getElementById('book-sentinel-content') || document.getElementById('book-sentinel-browser');
    }
    return document.getElementById('book-sentinel-browser');
}

function showSentinelSheetOnMobile() {
    if (window.innerWidth > 768) return;
    const fab = document.getElementById('book-sentinel-fab');
    const sheet = document.getElementById('book-sentinel-sheet');
    fab?.classList.remove('hidden');
    sheet?.classList.remove('hidden');
}

function toggleSentinelSheet() {
    if (window.innerWidth > 768) return;
    const sheet = document.getElementById('book-sentinel-sheet');
    const fab = document.getElementById('book-sentinel-fab');
    if (!sheet || !fab || fab.classList.contains('hidden')) return;
    if (sheet.classList.contains('hidden')) {
        sheet.classList.remove('hidden');
        return;
    }
    minimizeSentinelSheet();
}

function minimizeSentinelSheet() {
    if (window.innerWidth > 768) return;
    document.getElementById('book-sentinel-sheet')?.classList.add('hidden');
    document.getElementById('book-sentinel-fab')?.classList.remove('hidden');
}

function closeSentinelSheet() {
    if (window.innerWidth > 768) return;
    document.getElementById('book-sentinel-sheet')?.classList.add('hidden');
    document.getElementById('book-sentinel-fab')?.classList.add('hidden');
    document.getElementById('book-sentinel-content')?.replaceChildren();
    setSentinelHeader();
}

function setSentinelHeader(config = {}) {
    const backButton = document.getElementById('book-sentinel-top-back');
    if (!backButton) return;
    const label = backButton.querySelector('span');
    sentinelBackHandler = typeof config.onBack === 'function' ? config.onBack : null;
    if (label) {
        label.textContent = config.label || "Voltar";
    }
    backButton.classList.toggle('hidden', !sentinelBackHandler);
    backButton.setAttribute('aria-hidden', sentinelBackHandler ? 'false' : 'true');
}

function openGameCard(title, html) {
    document.getElementById('book-game-card-title').innerHTML = escapeHtml(title);
    document.getElementById('book-game-card-body').innerHTML = html;
    document.getElementById('book-game-card-overlay')?.classList.add('active');
}

function closeGameCard() {
    document.getElementById('book-game-card-overlay')?.classList.remove('active');
}

function openResult(title, score, detail) {
    updateGameBadge();
    openGameCard(title, `<div class="book-result-card ${score >= 0 ? 'positive' : 'negative'}">
        <i class="fa-solid ${score >= 0 ? 'fa-trophy' : 'fa-rotate-right'}"></i>
        <strong>${score} pontos</strong>
        <span>${escapeHtml(detail)}</span>
    </div>`);
}

async function saveScore(key, score) {
    if (!BookState.db || !BookState.notaId || !BookState.dadosNota) return;
    const collectionName = BookState.dadosNota.onde === "share" ? "Share" : "Local";
    const entry = { valor: score, data: new Date().toISOString() };
    const pontos = isPlainObject(BookState.dadosNota.pontos) ? { ...BookState.dadosNota.pontos } : {};
    pontos[key] = Array.isArray(pontos[key]) ? [...pontos[key], entry] : [entry];
    BookState.dadosNota = { ...BookState.dadosNota, pontos };
    try {
        await updateDoc(doc(BookState.db, collectionName, BookState.notaId), { [`pontos.${key}`]: arrayUnion(entry) });
    } catch (error) {
        console.warn("[BookGames] Não consegui guardar pontos no Firebase.", error);
    }
    updateGameBadge();
}

function scoreSummary() {
    const pontos = BookState.dadosNota?.pontos || {};
    const items = Object.entries(SCORE_LABELS).map(([key, label]) => {
        const value = pontos[key];
        const total = Array.isArray(value) ? value.reduce((sum, item) => sum + Number(item?.valor ?? item ?? 0), 0) : Number(value || 0);
        return { key, label, total };
    });
    return { total: items.reduce((sum, item) => sum + item.total, 0), items };
}

function renderScoresTab(body) {
    const { total, items } = scoreSummary();
    body.innerHTML = `<div class="book-score-panel">
        <div class="book-score-total"><i class="fa-solid fa-gamepad"></i><strong>${total}</strong><span>pontos nesta nota</span></div>
        <div class="book-score-breakdown">
            ${items.map(item => `<div><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></div>`).join('')}
        </div>
    </div>`;
}

function updateGameBadge() {
    const { total, items } = scoreSummary();
    const score = document.getElementById('book-games-score');
    const btn = document.getElementById('book-games');
    if (score) {
        score.textContent = total === 0 ? "" : String(total);
        score.classList.toggle('empty', total === 0);
    }
    if (btn && lastScoreTotal !== null && total !== lastScoreTotal) {
        btn.classList.remove('score-up', 'score-down');
        btn.classList.add(total > lastScoreTotal ? 'score-up' : 'score-down');
        setTimeout(() => btn.classList.remove('score-up', 'score-down'), 900);
    }
    lastScoreTotal = total;
    if (btn) btn.title = `Jogos: ${total} pontos\n${items.map(item => `${item.label}: ${item.total}`).join('\n')}`;
}

function bindDragOrder() {
    let dragged = null;
    document.querySelectorAll('.book-order-list li').forEach(item => {
        item.addEventListener('dragstart', () => {
            dragged = item;
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', event => {
            event.preventDefault();
            const list = item.parentElement;
            if (!dragged || dragged === item) return;
            const rect = item.getBoundingClientRect();
            list.insertBefore(dragged, event.clientY < rect.top + rect.height / 2 ? item : item.nextSibling);
        });
    });
}

function buildNoteModel() {
    const title = BookState.dadosNota?.nome || "Nota";
    const text = sanitizeGameText(textoDaNota(BookState.dadosNota, getVisibleBookBoxes()));
    const sentences = text
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .flatMap(line => line.split(/(?<=[.!?])\s+/))
        .map(line => line.trim())
        .filter(line => line.length > 18);
    const snippets = getVisibleBookBoxes()
        .map(c => textoDaCaixa(c).trim())
        .filter(Boolean)
        .map(textLine => textLine.slice(0, 180));
    return { title, text, sentences, snippets };
}

function summarizeText(sentences) {
    return sentences.slice(0, 3).map(cleanSummarySentence).join(' ');
}

function makeDistractorSummary(sentences, title) {
    const first = cleanSummarySentence(sentences[1] || sentences[0] || title);
    const second = `O foco principal recai em detalhes paralelos e conclusões fora do centro da nota.`;
    return `${first} ${second}`;
}

function makeContrarySummary(sentences, title) {
    const keyword = firstKeyword(title || sentences[0] || 'tema');
    return `A nota evita aprofundar ${keyword} e limita-se a ideias sem ligação entre si, sem desenvolvimento interno consistente.`;
}

function synthTitle(sentences) {
    const source = sentences[0] || "Nota";
    return source.split(/[,:-]/)[0].slice(0, 54).trim() || "Nota";
}

function firstKeyword(text) {
    return String(text).split(/\s+/).find(word => word.length > 4) || "o tema";
}

function lastKeyword(text) {
    return String(text).split(/\s+/).reverse().find(word => word.length > 4) || "o assunto";
}

function makeIntruderSnippet(sentences, title) {
    const keyword = firstKeyword(title || sentences[0] || 'a nota');
    return `Esta passagem redefine ${keyword} com um rumo oposto ao da nota e introduz uma conclusão que não aparece no texto original.`;
}

function splitSentence(sentence) {
    const words = String(sentence).split(/\s+/);
    const cut = Math.max(4, Math.floor(words.length * 0.45));
    return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

function invertEnding(text) {
    const words = String(text).split(/\s+/).reverse();
    return words.join(' ').slice(0, 180);
}

function genericEnding(title) {
    const keyword = firstKeyword(title || 'a nota');
    return `surge apenas como referência lateral, sem relação real com ${keyword} nem com a progressão do conteúdo.`;
}

function cleanSummarySentence(text) {
    return sanitizeGameText(text).replace(/\s+/g, ' ').trim().slice(0, 180);
}

function sanitizeGameText(text) {
    return String(text || "")
        .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, ' ')
        .replace(/https?:\/\/\S+/g, match => match.length > 80 ? ' ' : match)
        .replace(/\s+/g, ' ')
        .trim();
}

function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}
