import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { textoDaNota, textoParaFala } from './book-utils.js';

let voices = [];
let utterance = null;

export function iniciarBookReader() {
    carregarVozes();
    window.speechSynthesis?.addEventListener('voiceschanged', carregarVozes);
    document.getElementById('book-speech-play')?.addEventListener('click', playSpeech);
    document.getElementById('book-speech-pause')?.addEventListener('click', pauseSpeech);
    document.getElementById('book-speech-stop')?.addEventListener('click', stopSpeech);
    document.getElementById('book-speech-rate')?.addEventListener('input', e => {
        BookState.settings.speechRate = Number(e.target.value);
        const value = document.getElementById('book-speech-rate-value');
        if (value) value.textContent = `${BookState.settings.speechRate.toFixed(1)}x`;
        if (BookState.teleprompterTimer) {
            toggleTeleprompter();
            toggleTeleprompter();
        }
    });
}

export function abrirSpeechPopup() {
    document.getElementById('book-popup-speech')?.classList.add('active');
    const rate = document.getElementById('book-speech-rate');
    const value = document.getElementById('book-speech-rate-value');
    if (rate) rate.value = BookState.settings.speechRate || 1;
    if (value) value.textContent = `${Number(BookState.settings.speechRate || 1).toFixed(1)}x`;
    carregarVozes();
}

export function toggleTeleprompter() {
    if (BookState.teleprompterTimer) {
        clearInterval(BookState.teleprompterTimer);
        BookState.teleprompterTimer = null;
        document.getElementById('book-speaker')?.classList.remove('active');
        return;
    }
    const scroller = document.querySelector('.book-center');
    if (!scroller) return;
    document.getElementById('book-speaker')?.classList.add('active');
    const rate = Math.max(0.6, Math.min(1.8, Number(document.getElementById('book-speech-rate')?.value || BookState.settings.speechRate || 1)));
    BookState.teleprompterTimer = setInterval(() => {
        scroller.scrollBy({ top: 1 + rate, behavior: "auto" });
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) toggleTeleprompter();
    }, Math.max(18, 50 - (rate * 12)));
}

function carregarVozes() {
    voices = window.speechSynthesis?.getVoices?.() || [];
    const select = document.getElementById('book-voice-select');
    const cards = document.getElementById('book-voice-cards');
    if (!select) return;
    const ptVoices = voices.filter(v => /^pt/i.test(v.lang));
    const list = ptVoices.length ? ptVoices : voices;
    select.innerHTML = list.map(v => `<option value="${voices.indexOf(v)}">${v.name} (${v.lang})</option>`).join('');
    if (!cards) return;
    cards.innerHTML = list.map((v, i) => {
        const realIndex = voices.indexOf(v);
        const gender = inferVoiceGender(v.name);
        return `<button class="book-voice-card voice-${gender} ${i === 0 ? 'active' : ''}" data-voice-index="${realIndex}">
            <i class="fa-solid ${gender === 'female' ? 'fa-person-dress' : 'fa-person'}"></i>
            <span><strong>${escapeHtmlVoice(shortVoiceName(v.name))}</strong><small>${gender === 'female' ? 'Feminina' : 'Masculina'} · ${escapeHtmlVoice(v.lang)}</small></span>
        </button>`;
    }).join('');
    cards.querySelectorAll('.book-voice-card').forEach(card => {
        card.addEventListener('click', () => {
            select.value = card.dataset.voiceIndex;
            cards.querySelectorAll('.book-voice-card').forEach(item => item.classList.remove('active'));
            card.classList.add('active');
        });
    });
}

function inferVoiceGender(name) {
    const female = /helia|thalia|francisca|raquel|maria|ana|ines|inês|female|woman/i;
    return female.test(String(name || "")) ? "female" : "male";
}

function shortVoiceName(name) {
    return String(name || "Voz").replace(/^Microsoft\s+/i, "").replace(/\s+Online.*$/i, "").replace(/\s+-\s+Portuguese.*$/i, "");
}

function escapeHtmlVoice(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function playSpeech() {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        return;
    }
    stopSpeech();
    const texto = textoParaFala(textoDaNota(BookState.dadosNota, getVisibleBookBoxes()));
    utterance = new SpeechSynthesisUtterance(texto);
    const select = document.getElementById('book-voice-select');
    const voice = voices[Number(select?.value)];
    if (voice) utterance.voice = voice;
    utterance.rate = Number(document.getElementById('book-speech-rate')?.value || BookState.settings.speechRate || 1);
    utterance.lang = voice?.lang || "pt-PT";
    window.speechSynthesis.speak(utterance);
}

function pauseSpeech() {
    if (window.speechSynthesis?.speaking) window.speechSynthesis.pause();
}

function stopSpeech() {
    window.speechSynthesis?.cancel();
    utterance = null;
}
