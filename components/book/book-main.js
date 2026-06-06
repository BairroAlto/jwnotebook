import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';
import { iniciarAutenticacao } from '../auth/auth.js';
import { inicializarLeituraLocal } from '../local/ler-local.js';
import { inicializarLeituraShare } from '../share/ler-share.js';
import { inicializarLists } from '../lists/ler-lists.js';
import { inicializarLeituraPins } from '../esquerda/ler-pins.js';
import { iniciarControladorEsquerda } from '../esquerda/esquerda-controller.js';
import { MobileBottomSheet } from '../ui/mobile-bottom-sheet.js';
import { iniciarXSat } from '../direita/xsat-controller.js';
import { iniciarBookSettings } from './book-settings.js';
import { iniciarBookToolbar } from './book-toolbar.js';
import { iniciarBookReader } from './book-reader.js';
import { iniciarBookGames } from './book-games.js';
import { iniciarBookAI } from './book-ai.js';
import './book-viewer.js';

window.NotaBookMode = "book";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
window.db = db;
window.auth = auth;
let bootDone = false;

iniciarAutenticacao(app, db);

await Promise.all([
    carregarComponente('area-book', 'components/book/book-viewer.html'),
    carregarComponente('area-topo', 'components/topo/menu.html'),
    carregarComponente('area-esquerda', 'components/esquerda/menu.html'),
    carregarComponente('area-direita', 'components/direita/menu.html'),
    carregarComponente('area-popup-topicos', 'components/popup/popup-topicos.html'),
    carregarComponente('area-popup-confirmar-topico', 'components/popup/popup-confirmar-topico.html'),
    carregarComponente('area-popup-cosmos', 'components/popup/popup-cosmos.html'),
    carregarComponente('area-popup-confirmar', 'components/popup/popup-confirmar.html'),
    carregarComponente('area-popup-confirmar-remover', 'components/popup/popup-confirmar-remover.html'),
    carregarComponente('area-popup-confirmar-brain', 'components/popup/popup-confirmar-brain.html'),
    carregarComponente('area-popup-cosmos-fontes', 'components/popup/popup-cosmos-fontes.html'),
    carregarComponente('area-popup-ancora-nota', 'components/popup/popup-ancora-nota.html'),
    carregarComponente('area-popup-biblia-citacao', 'components/popup/popup-biblia-citacao.html')
]);

ativarMenuBook();
document.getElementById('area-direita')?.classList.add('book-readonly-panel');
MobileBottomSheet.iniciar();
iniciarControladorEsquerda();
iniciarXSat();
iniciarBookSettings();
iniciarBookToolbar();
iniciarBookReader();
iniciarBookGames();
iniciarBookAI();
bindGlobalUi();
window.ensureOfficeRightPanel = ensureBookRightPanel;

onAuthStateChanged(auth, async user => {
    if (!user) {
        setTimeout(() => {
            if (!auth.currentUser) {
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('login-screen').style.display = 'flex';
            }
        }, 900);
        return;
    }

    if (bootDone) return;
    bootDone = true;
    document.getElementById('login-screen').style.display = 'none';
    inicializarLeituraLocal(db, auth);
    inicializarLeituraShare(db, auth);
    inicializarLists(db, auth);
    inicializarLeituraPins(db, auth);
    setTimeout(() => {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => loading.style.display = 'none', 450);
        }
    }, 350);
});

async function carregarComponente(id, path) {
    const el = document.getElementById(id);
    if (!el) return;
    const res = await fetch(path);
    el.innerHTML = await res.text();
}

function ativarMenuBook() {
    document.querySelectorAll('#area-topo .nav-item').forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        link.classList.toggle('active', text === "book");
    });
}

function bindGlobalUi() {
    bindRightPanelNavigation();
    document.querySelectorAll('[data-close-popup]').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.popup-overlay')?.classList.remove('active'));
    });
    document.addEventListener('click', event => {
        if (event.target.id === 'mobile-overlay') {
            document.getElementById('area-esquerda')?.classList.add('closed');
            if (!document.getElementById('area-direita')?.classList.contains('active')) {
                document.getElementById('mobile-overlay')?.classList.remove('active');
            }
        }
    });
    document.getElementById('btn-mobile-esquerda')?.addEventListener('click', () => {
        const esq = document.getElementById('area-esquerda');
        const overlay = document.getElementById('mobile-overlay');
        const closed = esq.classList.toggle('closed');
        overlay.classList.toggle('active', !closed);
    });
    document.getElementById('btn-mobile-direita')?.addEventListener('click', () => MobileBottomSheet.abrir());
}

function bindRightPanelNavigation() {
    window.switchPanel = (panel) => {
        const right = document.getElementById('area-direita');
        right?.classList.add('active');
        document.querySelectorAll('#area-direita .tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        document.querySelectorAll('#area-direita .segmented-control button').forEach(btn => btn.classList.remove('active'));
        const target = document.getElementById(`panel-${panel}`);
        const btn = document.getElementById(`btn-${panel}`);
        if (target) {
            target.classList.add('active');
            target.style.display = 'flex';
        }
        if (btn) btn.classList.add('active');
        if (window.innerWidth <= 768) {
            MobileBottomSheet.abrir();
        }
    };

    window.switchEyeTab = (tab) => {
        const ids = {
            indice: 'indice-nota-container',
            textos: 'textos-container',
            ancora: 'ancora-nota-container',
            fontes: 'fontes-nota-container',
            caixas: 'caixas-associadas-container'
        };
        Object.values(ids).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.querySelectorAll('#sub-tabs-eye i').forEach(icon => icon.classList.remove('active'));
        const target = document.getElementById(ids[tab]);
        if (target) {
            target.style.display = 'flex';
            target.style.flexDirection = 'column';
        }
        document.getElementById(`btn-tab-${tab}`)?.classList.add('active');

        const dados = window.bookNotaAtual || {};
        const modos = Array.isArray(dados.modo) ? dados.modo : [dados.modo || 'normal'];
        const isSentinela = modos.includes('sentinela');
        const caixas = (window.bookCaixasAtuais || []).filter(c => {
            if (c.estado !== 'on') return false;
            return isSentinela ? !!c.referenciacodex : !c.referenciacodex;
        });
        if (tab === 'textos') import('../direita/eye-textos-biblia.js').then(m => m.detectarEExibirTextosBiblicos(caixas));
        if (tab === 'fontes') import('../direita/eye-fontes-nota.js').then(m => m.carregarFontesGlobaisDaNota(caixas));
        if (tab === 'indice') import('../direita/indice.js').then(m => m.renderizarIndice(caixas, modos.includes('post')));
        if (tab === 'ancora') import('../direita/eye-ancora.js').then(m => m.iniciarAbaAncora(window.itemSelecionadoId, window.db, window.auth));
    };
}
