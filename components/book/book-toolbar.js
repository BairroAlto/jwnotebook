import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { textoDaNota, detectarReferenciasBiblicas } from './book-utils.js';
import { refreshNotaAtual } from './book-viewer.js';
import { abrirBarraLeitura, toggleSpeakerMenu } from './book-reader.js';
import { abrirBookGames } from './book-games.js';
import { abrirBookAI } from './book-ai.js';
import { baixarPdfNota } from './book-pdf.js';
import { ensureBookRightPanel } from './book-right-panel.js';
import { iniciarXSat, dispararPesquisaParabolica } from '../direita/xsat-controller.js';
import { MobileBottomSheet } from '../ui/mobile-bottom-sheet.js';

export function iniciarBookToolbar() {
    document.getElementById('book-copy')?.addEventListener('click', copiarNota);
    document.getElementById('book-pdf')?.addEventListener('click', baixarPdfNota);
    document.getElementById('book-refresh')?.addEventListener('click', refreshNotaAtual);
    document.getElementById('book-read')?.addEventListener('click', abrirBarraLeitura);
    document.getElementById('book-speaker')?.addEventListener('click', toggleSpeakerMenu);
    document.getElementById('book-games')?.addEventListener('click', abrirBookGames);
    document.getElementById('book-ai')?.addEventListener('click', abrirBookAI);
    document.getElementById('book-satellite')?.addEventListener('click', pesquisarReferencias);

    document.addEventListener('click', async (event) => {
        if (!event.target.closest('#book-speaker') && !event.target.closest('#book-speaker-menu')) {
            const menu = document.getElementById('book-speaker-menu');
            if (menu && !menu.classList.contains('hidden')) {
                menu.classList.add('hidden');
                menu.style.display = 'none';
            }
        }
        const refBtn = event.target.closest('.book-bible-ref');
        if (!refBtn) return;
        await ensureBookRightPanel();
        iniciarXSat();
        const livro = refBtn.dataset.livro;
        const cap = refBtn.dataset.cap;
        const ver = refBtn.dataset.ver;
        const texto = `${livro} ${cap}:${ver}`;
        const modulo = await import('../direita/biblia-brain.js');
        modulo.abrirVersiculoNoBrain(livro, cap, ver, texto, BookState.db, BookState.auth);
        if (window.switchPanel) window.switchPanel('brain');
    });
}

async function copiarNota() {
    const texto = textoDaNota(BookState.dadosNota, getVisibleBookBoxes());
    await navigator.clipboard?.writeText(texto);
    flashButton('book-copy');
}

async function pesquisarReferencias() {
    const texto = textoDaNota(BookState.dadosNota, getVisibleBookBoxes());
    const refs = detectarReferenciasBiblicas(texto);
    await ensureBookRightPanel({ reveal: true });
    document.getElementById('area-direita')?.classList.add('active');
    iniciarXSat();
    if (window.innerWidth <= 768) MobileBottomSheet.abrir();
    if (window.switchPanel) window.switchPanel('xsat');
    if (!refs.length) {
        document.querySelector('.xsat-num[data-num="1"]')?.click();
        return;
    }
    const comando = refs.map(ref => ref.verFim ? `${ref.livro} ${ref.cap}:${ref.ver}-${ref.verFim}` : `${ref.livro} ${ref.cap}:${ref.ver}`).join("; ");
    await dispararPesquisaParabolica(comando, false);
    if (window.switchPanel) window.switchPanel('xsat');
}

function flashButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.add('book-flash');
    setTimeout(() => btn.classList.remove('book-flash'), 900);
}
