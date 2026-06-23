import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { textoDaNota, textoDaCaixa, textoParaFala, escapeHtml } from './book-utils.js';
import { guardarPreferenciasUtilizador } from '../settings/preferences.js';

let voices = [];
let filteredVoices = [];
let utterance = null;
let presentationIndex = 0;
let speechStoppedManually = false;
let speechSessionId = 0;

export function sincronizarBookReaderPrefs() {
    carregarVozes();
    BookState.settings.selectedVoiceId = window.NotaBookUserPrefs?.voz || BookState.settings.selectedVoiceId || filteredVoices[0]?.voiceURI || null;
    syncSpeechRateUi();
    syncTeleprompterRateUi();
}

export function iniciarBookReader() {
    carregarVozes();
    if (window.speechSynthesis?.addEventListener) {
        window.speechSynthesis.addEventListener('voiceschanged', carregarVozes);
    }
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = carregarVozes;
    document.getElementById('book-voice-select')?.addEventListener('change', e => {
        selecionarVoz(e.target.value);
    });
    document.getElementById('book-speech-play')?.addEventListener('click', playSpeech);
    document.getElementById('book-speech-pause')?.addEventListener('click', pauseSpeech);
    document.getElementById('book-speech-stop')?.addEventListener('click', stopSpeech);
    document.getElementById('book-player-close')?.addEventListener('click', fecharBarraLeitura);
    document.getElementById('book-speech-rate')?.addEventListener('input', e => {
        BookState.settings.speechRate = Number(e.target.value);
        syncSpeechRateUi();
    });
    document.getElementById('book-teleprompter-rate')?.addEventListener('input', e => {
        BookState.settings.teleprompterRate = Number(e.target.value);
        syncTeleprompterRateUi();
        if (BookState.teleprompterTimer) {
            stopTeleprompter();
            startTeleprompter();
        }
    });
    document.getElementById('book-teleprompter-toggle')?.addEventListener('click', () => {
        const controls = document.getElementById('book-teleprompter-controls');
        controls?.classList.toggle('hidden');
        controls && (controls.style.display = controls.classList.contains('hidden') ? 'none' : 'block');
        if (BookState.teleprompterTimer) stopTeleprompter();
        else startTeleprompter();
    });
    document.getElementById('book-presentation-toggle')?.addEventListener('click', abrirModoApresentacao);
    document.getElementById('book-presentation-prev')?.addEventListener('click', () => navegarSlide(-1));
    document.getElementById('book-presentation-next')?.addEventListener('click', () => navegarSlide(1));
    document.getElementById('book-presentation-close')?.addEventListener('click', fecharModoApresentacao);
    document.addEventListener('keydown', onPresentationKeydown);
    syncSpeechRateUi();
    syncTeleprompterRateUi();
}

export function abrirBarraLeitura() {
    const bar = document.getElementById('book-player-float');
    if (!bar) return;
    bar.classList.remove('hidden');
    bar.style.display = 'flex';
    syncSpeechRateUi();
}

export function toggleSpeakerMenu() {
    const menu = document.getElementById('book-speaker-menu');
    if (!menu) return;
    const hidden = menu.classList.toggle('hidden');
    menu.style.display = hidden ? 'none' : 'grid';
    if (!hidden) {
        syncTeleprompterRateUi();
    }
}

function carregarVozes() {
    voices = window.speechSynthesis?.getVoices?.() || [];
    filteredVoices = pickAllowedVoices(voices);
    if (!filteredVoices.length && voices.length) {
        filteredVoices = normalizeVoiceCatalog(voices);
    }
    const select = document.getElementById('book-voice-select');
    const cards = document.getElementById('book-voice-cards');
    if (!select || !cards) return;

    if (!filteredVoices.length) {
        select.innerHTML = '';
        cards.innerHTML = '<div class="book-voice-card" style="grid-column:1 / -1; cursor:default;"><span><strong>Sem vozes compativeis</strong><small>O navegador ainda nao disponibilizou vozes PT/EN.</small></span></div>';
        BookState.settings.selectedVoiceId = null;
        return;
    }

    select.innerHTML = filteredVoices.map(voice => `
        <option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voice.label)}</option>
    `).join('');

    const prefVoice = window.NotaBookUserPrefs?.voz || BookState.settings.selectedVoiceId;
    const selected = filteredVoices.find(v => v.voiceURI === prefVoice) || filteredVoices[0] || null;
    BookState.settings.selectedVoiceId = selected?.voiceURI || null;

    cards.innerHTML = filteredVoices.map(voice => `
        <button class="book-voice-card voice-${voice.gender} ${voice.voiceURI === BookState.settings.selectedVoiceId ? 'active' : ''}" data-voice-id="${escapeHtml(voice.voiceURI)}">
            <i class="fa-solid ${voice.gender === 'female' ? 'fa-person-dress' : 'fa-person'}"></i>
            <span><strong>${escapeHtml(voice.label)}</strong><small>${escapeHtml(voice.meta)}</small></span>
        </button>
    `).join('');

    if (selected) select.value = selected.voiceURI;
    cards.querySelectorAll('.book-voice-card').forEach(card => {
        card.addEventListener('click', async () => {
            await selecionarVoz(card.dataset.voiceId);
        });
    });
}

async function selecionarVoz(voiceId) {
    BookState.settings.selectedVoiceId = voiceId || null;
    const select = document.getElementById('book-voice-select');
    if (select) select.value = voiceId || '';
    document.querySelectorAll('.book-voice-card').forEach(card => {
        card.classList.toggle('active', card.dataset.voiceId === voiceId);
    });
    if (window.NotaBookUserPrefs) window.NotaBookUserPrefs.voz = voiceId || null;
    const uid = BookState.auth?.currentUser?.uid;
    if (uid) {
        await guardarPreferenciasUtilizador(BookState.db, uid, { voz: voiceId || null });
    }
}

function pickAllowedVoices(list) {
    const tagged = list.map((voice, index) => ({
        voice,
        _index: index,
        voiceURI: voice.voiceURI || voice.name || `voice-${index}`,
        name: voice.name || voice.voiceURI || `Voice ${index + 1}`,
        lang: voice.lang || '',
        gender: inferVoiceGender(`${voice.name || ''} ${voice.voiceURI || ''}`),
        langGroup: /^pt(-|$)/i.test(voice.lang || '') ? 'pt' : (/^en(-|$)/i.test(voice.lang || '') ? 'en' : null)
    })).filter(voice => voice.langGroup);

    const localePriority = {
        pt: [/pt-pt/i, /portugal/i, /^pt/i],
        en: [/en-gb/i, /en-us/i, /^en/i]
    };

    const chosen = [];
    [['pt', 'female'], ['pt', 'male'], ['en', 'female'], ['en', 'male']].forEach(([langGroup, gender]) => {
        const pool = tagged.filter(item => item.langGroup === langGroup && item.gender === gender && !chosen.some(sel => sel.voiceURI === item.voiceURI));
        if (!pool.length) return;

        const voice = [...pool].sort((a, b) => {
            const rankA = getLocaleRank(a, localePriority[langGroup]);
            const rankB = getLocaleRank(b, localePriority[langGroup]);
            if (rankA !== rankB) return rankA - rankB;
            return a._index - b._index;
        })[0];

        chosen.push({
            ...voice,
            voice: voice.voice,
            label: `${langGroup === 'pt' ? 'PT' : 'EN'} ${gender === 'female' ? 'Feminina' : 'Masculina'}`,
            meta: `${gender === 'female' ? 'Feminina' : 'Masculina'} - ${formatVoiceLocale(voice.lang, langGroup)}`
        });
    });

    return chosen;
}

function normalizeVoiceCatalog(list) {
    return list.map((voice, index) => ({
        ...voice,
        voice,
        _index: index,
        voiceURI: voice.voiceURI || voice.name || `voice-${index}`,
        name: voice.name || voice.voiceURI || `Voice ${index + 1}`,
        lang: voice.lang || '',
        gender: inferVoiceGender(`${voice.name || ''} ${voice.voiceURI || ''}`),
        label: voice.name || voice.lang || `Voice ${index + 1}`,
        meta: voice.lang || 'Sem idioma'
    }));
}

function inferVoiceGender(name) {
    const female = /helia|thalia|francisca|raquel|maria|ana|ines|female|woman|zira|aria|sara|hazel|libby/i;
    return female.test(String(name || '')) ? 'female' : 'male';
}

function getLocaleRank(voice, patterns) {
    const nativeVoice = getNativeVoice(voice);
    const haystack = `${nativeVoice?.lang || voice.lang || ''} ${nativeVoice?.name || voice.name || ''}`.toLowerCase();
    const idx = patterns.findIndex(pattern => pattern.test(haystack));
    return idx === -1 ? 99 : idx;
}

function formatVoiceLocale(lang, fallbackGroup) {
    if (/^pt-pt$/i.test(lang)) return 'Portugal';
    if (/^pt(-|$)/i.test(lang || '')) return 'Portugues';
    if (/^en-gb$/i.test(lang)) return 'English (UK)';
    if (/^en-us$/i.test(lang)) return 'English (US)';
    if (/^en(-|$)/i.test(lang || '')) return 'English';
    return fallbackGroup === 'pt' ? 'Portugues' : 'English';
}

async function playSpeech() {
    if (!window.speechSynthesis) return;
    abrirBarraLeitura();
    if (window.speechSynthesis.paused) {
        setSpeechButtonState('playing');
        window.speechSynthesis.resume();
        return;
    }
    stopSpeech();
    const sessionId = ++speechSessionId;
    speechStoppedManually = false;
    if (!filteredVoices.length) carregarVozes();
    const texto = obterTextoLeitura();
    if (!texto.trim()) {
        console.warn('Book reader: sem texto disponível para leitura.');
        return;
    }
    utterance = new SpeechSynthesisUtterance(texto);
    const voiceEntry = filteredVoices.find(item => item.voiceURI === BookState.settings.selectedVoiceId) || filteredVoices[0] || null;
    const nativeVoice = getNativeVoice(voiceEntry) || voices.find(v => v.voiceURI === voiceEntry?.voiceURI) || voices[0] || null;
    if (nativeVoice) utterance.voice = nativeVoice;
    utterance.rate = Number(BookState.settings.speechRate || 1);
    utterance.lang = nativeVoice?.lang || 'pt-PT';
    utterance.onstart = () => {
        if (sessionId !== speechSessionId) return;
        setSpeechButtonState('playing');
    };
    utterance.onpause = () => {
        if (sessionId !== speechSessionId) return;
        setSpeechButtonState('paused');
    };
    utterance.onresume = () => {
        if (sessionId !== speechSessionId) return;
        setSpeechButtonState('playing');
    };
    utterance.onend = () => {
        if (sessionId !== speechSessionId) return;
        utterance = null;
        if (!speechStoppedManually) setSpeechButtonState('idle');
    };
    utterance.onerror = () => {
        if (sessionId !== speechSessionId) return;
        utterance = null;
        if (!speechStoppedManually) setSpeechButtonState('idle');
    };
    setSpeechButtonState('playing');
    window.speechSynthesis.speak(utterance);
}

function pauseSpeech() {
    if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.pause();
        setSpeechButtonState('paused');
    }
}

function stopSpeech() {
    speechSessionId += 1;
    speechStoppedManually = true;
    setSpeechButtonState('stopped');
    window.speechSynthesis?.cancel();
    utterance = null;
}

function fecharBarraLeitura() {
    stopSpeech();
    const bar = document.getElementById('book-player-float');
    if (!bar) return;
    bar.classList.add('hidden');
    bar.style.display = 'none';
}

function startTeleprompter() {
    const scroller = document.querySelector('.book-center');
    if (!scroller) return;
    document.getElementById('book-speaker')?.classList.add('active');
    document.getElementById('book-teleprompter-toggle')?.classList.add('active');
    const rate = Math.max(0.6, Math.min(1.8, Number(BookState.settings.teleprompterRate || 1)));
    BookState.teleprompterTimer = setInterval(() => {
        scroller.scrollBy({ top: 1 + rate, behavior: 'auto' });
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) stopTeleprompter();
    }, Math.max(18, 50 - (rate * 12)));
}

function stopTeleprompter() {
    if (BookState.teleprompterTimer) {
        clearInterval(BookState.teleprompterTimer);
        BookState.teleprompterTimer = null;
    }
    document.getElementById('book-speaker')?.classList.remove('active');
    document.getElementById('book-teleprompter-toggle')?.classList.remove('active');
}

function abrirModoApresentacao() {
    const overlay = document.getElementById('book-presentation-overlay');
    if (!overlay) return;
    presentationIndex = 0;
    overlay.classList.remove('hidden');
    overlay.style.display = 'grid';
    renderPresentationSlide();
}

function fecharModoApresentacao() {
    const overlay = document.getElementById('book-presentation-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
}

function navegarSlide(delta) {
    const slides = getPresentationSlides();
    if (!slides.length) return;
    presentationIndex = Math.max(0, Math.min(slides.length - 1, presentationIndex + delta));
    renderPresentationSlide();
}

function renderPresentationSlide() {
    const stage = document.getElementById('book-presentation-stage');
    const counter = document.getElementById('book-presentation-counter');
    const slides = getPresentationSlides();
    if (!stage || !counter || !slides.length) return;
    const slide = slides[presentationIndex];
    counter.textContent = `${presentationIndex + 1} / ${slides.length}`;
    stage.innerHTML = `
        <article class="book-presentation-slide">
            <div class="book-presentation-badge">${escapeHtml(slide.tipo)}</div>
            <h2>${escapeHtml(slide.titulo)}</h2>
            <div class="book-presentation-content">${slide.conteudo}</div>
        </article>
    `;
}

function getPresentationSlides() {
    return getVisibleBookBoxes().flatMap(caixa => buildPresentationSlides(caixa));
}

function buildPresentationSlides(caixa) {
    const tipo = caixa.tipo || 'caixa';
    const titulo = caixa.titulo || 'Sem titulo';
    if (caixa.tipo === 'galeria' || Array.isArray(caixa.imagens) || caixa.tipo === 'webcard') {
        return [{ tipo, titulo, conteudo: formatSlideContent(caixa) }];
    }

    const texto = textoDaCaixa(caixa).replace(/^\s+|\s+$/g, '').replace(/^[\r\n]+/, '') || 'Sem conteudo';
    const partes = chunkPresentationText(texto);
    return partes.map((parte, index) => ({
        tipo,
        titulo: partes.length > 1 ? `${titulo} (${index + 1}/${partes.length})` : titulo,
        conteudo: `<p>${escapeHtml(parte).replace(/\n/g, '<br>')}</p>`
    }));
}

function formatSlideContent(caixa) {
    if (caixa.tipo === 'galeria' || Array.isArray(caixa.imagens)) {
        const imagens = Array.isArray(caixa.imagens) ? caixa.imagens : (caixa.links || []);
        return `<div class="book-presentation-gallery">${imagens.map(img => `<img src="${escapeHtml(img?.url || img?.src || img)}" alt="">`).join('')}</div>`;
    }
    if (caixa.tipo === 'webcard' && Array.isArray(caixa.links)) {
        return `<div class="book-presentation-links">${caixa.links.map(link => `<div class="book-presentation-link"><strong>${escapeHtml(link?.titulo || link?.site || 'Link')}</strong><span>${escapeHtml(link?.url || '')}</span></div>`).join('')}</div>`;
    }
    const texto = textoDaCaixa(caixa).replace(/^\s+|\s+$/g, '').replace(/^[\r\n]+/, '');
    return `<p>${escapeHtml(texto || 'Sem conteudo').replace(/\n/g, '<br>')}</p>`;
}

function chunkPresentationText(texto) {
    const maxChars = window.innerWidth <= 768 ? 520 : 820;
    const paragraphs = String(texto || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const chunks = [];
    let current = '';

    const pushCurrent = () => {
        if (current.trim()) chunks.push(current.trim());
        current = '';
    };

    paragraphs.forEach(paragraph => {
        if ((current + '\n\n' + paragraph).trim().length <= maxChars) {
            current = current ? `${current}\n\n${paragraph}` : paragraph;
            return;
        }
        pushCurrent();
        if (paragraph.length <= maxChars) {
            current = paragraph;
            return;
        }
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        sentences.forEach(sentence => {
            if (sentence.length > maxChars) {
                pushCurrent();
                splitLongTextByWords(sentence, maxChars).forEach(part => {
                    chunks.push(part);
                });
                return;
            }
            if ((current + ' ' + sentence).trim().length > maxChars) pushCurrent();
            current = current ? `${current} ${sentence}` : sentence;
        });
    });
    pushCurrent();
    return chunks.length ? chunks : ['Sem conteudo'];
}

function splitLongTextByWords(text, maxChars) {
    const chunks = [];
    let current = '';
    String(text || '').split(/\s+/).forEach(word => {
        if ((current + ' ' + word).trim().length > maxChars) {
            if (current.trim()) chunks.push(current.trim());
            current = word;
            return;
        }
        current = current ? `${current} ${word}` : word;
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

function syncSpeechRateUi() {
    const rate = Number(BookState.settings.speechRate || 1);
    const input = document.getElementById('book-speech-rate');
    const value = document.getElementById('book-speech-rate-value');
    if (input) input.value = String(rate);
    if (value) value.textContent = `${rate.toFixed(1)}x`;
}

function syncTeleprompterRateUi() {
    const rate = Number(BookState.settings.teleprompterRate || 1);
    const input = document.getElementById('book-teleprompter-rate');
    const value = document.getElementById('book-teleprompter-rate-value');
    if (input) input.value = String(rate);
    if (value) value.textContent = `${rate.toFixed(1)}x`;
}

function onPresentationKeydown(event) {
    const overlay = document.getElementById('book-presentation-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (event.key === 'Escape') fecharModoApresentacao();
    if (event.key === 'ArrowRight') navegarSlide(1);
    if (event.key === 'ArrowLeft') navegarSlide(-1);
}

function obterTextoLeitura() {
    const base = textoParaFala(textoDaNota(BookState.dadosNota, getVisibleBookBoxes()));
    const compact = String(base || '').replace(/\s+/g, ' ').trim();
    if (compact.length > 20) return base;

    const feed = document.getElementById('book-feed');
    const title = document.getElementById('book-title')?.innerText || '';
    const fallback = [title, feed?.innerText || ''].join('\n').trim();
    return fallback || base || '';
}

function getNativeVoice(entry) {
    if (!entry) return null;
    if (entry.voice && typeof entry.voice === 'object') return entry.voice;
    return entry;
}

function setSpeechButtonState(state) {
    const playBtn = document.getElementById('book-speech-play');
    const pauseBtn = document.getElementById('book-speech-pause');
    const stopBtn = document.getElementById('book-speech-stop');
    if (!playBtn || !pauseBtn || !stopBtn) return;

    playBtn.classList.remove('is-playing');
    pauseBtn.classList.remove('is-paused');
    stopBtn.classList.remove('is-stopped');

    if (state === 'playing') {
        playBtn.classList.add('is-playing');
    } else if (state === 'paused') {
        playBtn.classList.add('is-playing');
        pauseBtn.classList.add('is-paused');
    } else if (state === 'stopped') {
        stopBtn.classList.add('is-stopped');
    }
}
