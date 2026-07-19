import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';
import { iniciarAutenticacao } from '../auth/auth.js';
import { initPalcoStore } from './palco-store.js';
import { iniciarPalcoUI } from './palco-ui.js';
import {
    concluirNotificacaoPalco,
    eliminarNotificacaoPalco,
    iniciarNotificacoesPalco,
    obterNotificacoesPalco
} from './palco-notifications.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
window.db = db;
window.auth = auth;
window.NotaBookMode = "palco";

iniciarAutenticacao(app, db);
await carregarTopo();
marcarPalcoAtivo();
bindBaseUi();
initPalcoStore(db, auth);

let bootDone = false;
let palcoPrefs = { centerFontSize: 16, shareWithFriends: "off" };

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
    palcoPrefs = await carregarPrefs(user.uid);
    aplicarPrefsNaUI(palcoPrefs);
    await carregarPopupPartilha();
    await iniciarPalcoUI({ db, auth });
    iniciarNotificacoesPalco(renderizarBadge);
    ligarSettings(user.uid);
    setTimeout(() => {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => loading.style.display = 'none', 450);
        }
    }, 350);
});

async function carregarTopo() {
    const area = document.getElementById('area-topo');
    if (!area) return;
    const res = await fetch('components/topo/menu.html');
    area.innerHTML = await res.text();
}

async function carregarPopupPartilha() {
    const area = document.getElementById('area-popup-partilhar');
    if (!area) return;
    const res = await fetch('components/popup/popup-partilhar.html');
    area.innerHTML = await res.text();
}

function marcarPalcoAtivo() {
    document.querySelectorAll('#area-topo .nav-item').forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        link.classList.toggle('active', text === "palco");
    });
}

function bindBaseUi() {
    document.querySelectorAll('[data-close-palco-popup]').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.popup-overlay')?.classList.remove('active'));
    });
    document.getElementById('palco-btn-settings')?.addEventListener('click', () => {
        document.getElementById('palco-settings-overlay')?.classList.add('active');
    });
    document.getElementById('palco-btn-notifications')?.addEventListener('click', () => {
        renderizarNotificacoes();
        document.getElementById('palco-notifications-overlay')?.classList.add('active');
    });
}

async function carregarPrefs(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    const palco = snap.exists() ? (snap.data().palco || {}) : {};
    return {
        centerFontSize: Number(palco.centerFontSize || 16),
        shareWithFriends: palco.shareWithFriends || "off"
    };
}

function aplicarPrefsNaUI(prefs) {
    document.documentElement.style.setProperty('--palco-center-font', `${prefs.centerFontSize}px`);
    const range = document.getElementById('palco-font-range');
    const value = document.getElementById('palco-font-value');
    const toggle = document.getElementById('palco-share-toggle');
    if (range) range.value = prefs.centerFontSize;
    if (value) value.textContent = `${prefs.centerFontSize}px`;
    if (toggle) toggle.checked = prefs.shareWithFriends === "on";
}

function ligarSettings(uid) {
    const range = document.getElementById('palco-font-range');
    const value = document.getElementById('palco-font-value');
    const toggle = document.getElementById('palco-share-toggle');
    if (range) {
        range.addEventListener('input', async () => {
            palcoPrefs.centerFontSize = Number(range.value);
            document.documentElement.style.setProperty('--palco-center-font', `${palcoPrefs.centerFontSize}px`);
            if (value) value.textContent = `${palcoPrefs.centerFontSize}px`;
            await guardarPrefs(uid);
        });
    }
    if (toggle) {
        toggle.addEventListener('change', async () => {
            palcoPrefs.shareWithFriends = toggle.checked ? "on" : "off";
            await guardarPrefs(uid);
        });
    }
}

async function guardarPrefs(uid) {
    await setDoc(doc(db, "users", uid), { palco: palcoPrefs }, { merge: true });
}

function renderizarBadge(items) {
    const badge = document.getElementById('palco-notification-badge');
    const btn = document.getElementById('palco-btn-notifications');
    if (!badge) return;
    badge.style.display = items.length ? 'block' : 'none';
    if (btn) {
        btn.style.color = items.length ? '#ef4444' : '';
        btn.style.borderColor = items.length ? 'rgba(239, 68, 68, 0.4)' : '';
        btn.style.boxShadow = items.length ? '0 0 0 1px rgba(239, 68, 68, 0.12), 0 0 16px rgba(239, 68, 68, 0.18)' : '';
    }
}

function renderizarNotificacoes() {
    const body = document.getElementById('palco-notifications-body');
    if (!body) return;
    const items = obterNotificacoesPalco();
    if (!items.length) {
        body.innerHTML = `<div class="palco-empty-state">Sem novidades persistidas ainda. A estrutura da fase 1 já está pronta para a fase 2 do motor automático.</div>`;
        return;
    }

    body.innerHTML = items.map(item => `
        <article class="palco-notification-card">
            <figure>
                ${item.imageurl ? `<img src="${item.imageurl}" alt="${item.titulo || item.nome}">` : `<div class="palco-content-art"><i class="fa-solid fa-bell"></i></div>`}
            </figure>
            <div>
                <h4>${item.titulo || item.nome || 'Disponível'}</h4>
                <p>${item.dataOficial || item.data || 'Data sem detalhe'} · ${item.texto || 'Conteúdo disponível oficialmente.'}</p>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <button type="button" data-palco-notif-watch="${item.id}" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(16,185,129,0.35); background:rgba(16,185,129,0.14); color:#d1fae5; cursor:pointer; font-size:10px; font-weight:800;">Visto</button>
                    <button type="button" data-palco-notif-delete="${item.id}" style="padding:8px 10px; border-radius:999px; border:1px solid rgba(239,68,68,0.35); background:rgba(239,68,68,0.12); color:#fecaca; cursor:pointer; font-size:10px; font-weight:800;">Eliminar</button>
                </div>
            </div>
        </article>
    `).join('');

    body.querySelectorAll('[data-palco-notif-watch]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const item = items.find(entry => entry.id === btn.dataset.palcoNotifWatch);
            if (!item) return;
            btn.disabled = true;
            await concluirNotificacaoPalco(item);
            renderizarNotificacoes();
        });
    });

    body.querySelectorAll('[data-palco-notif-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            await eliminarNotificacaoPalco(btn.dataset.palcoNotifDelete);
            renderizarNotificacoes();
        });
    });
}
