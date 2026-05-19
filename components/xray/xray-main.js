// components/xray/xray-main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';

import { state } from './xray-state.js';
import { executarAnaliseProfunda } from './xray-search.js';
import { XRayUI } from './xray-ui.js';
import { iniciarSettingsXRay, renderizarPiccards } from './xray-settings-manager.js';
import { iniciarExportManager } from './xray-export-manager.js';
import { iniciarAutenticacao } from '../auth/auth.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let timerManifesto = null;
let timerManuscrito = null;

/**
 * 1. ARRANQUE DO SISTEMA (BOOTSTRAP COM BUFFER DE 0.5s)
 */
async function bootstrap() {
    console.log("🛠️ [X-RAY] Iniciando Bootstrap...");

    const carregar = async (id, path) => {
        const el = document.getElementById(id);
        if(el) { 
            try {
                const res = await fetch(path); 
                el.innerHTML = await res.text(); 
            } catch (e) { console.error(`Erro ao carregar ${path}:`, e); }
        }
    };

    // 1. CARREGAR TODOS OS FRAGMENTOS (Incluindo o novo de criação)
    await Promise.all([
        carregar('area-menu-xray', 'components/xray/xray-menu.html'),
        carregar('area-settings-xray', 'components/xray/xray-settings.html'),
        carregar('area-export-xray', 'components/xray/xray-export.html'),
        carregar('area-create-xray', 'components/xray/xray-create.html') // NOVO
    ]);
    
    iniciarAutenticacao(app, db);

    // 2. LÓGICA DO NOVO POPUP DE CRIAÇÃO (SUBSTITUI O PROMPT)
 const btnNovoTrigger = document.getElementById('btn-novo-xray');
    const popupCriar = document.getElementById('popup-criar-xray');
    const inputNome = document.getElementById('input-nome-xray-novo');
    const btnConfirmar = document.getElementById('btn-confirmar-xray-novo');
    const btnCancelar = document.getElementById('btn-cancelar-xray-novo');

    if (btnNovoTrigger) {
        btnNovoTrigger.onclick = () => {
            popupCriar.classList.add('active');
            inputNome.value = "";
            setTimeout(() => inputNome.focus(), 200);
        };
    }

    // 🚀 COLA AQUI O BLOCO DO ENTER:
    if (inputNome) {
        inputNome.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita comportamentos estranhos do browser
                btnConfirmar.click();
            }
        };
    }

    if (btnCancelar) btnCancelar.onclick = () => popupCriar.classList.remove('active');


    if (btnConfirmar) {
        btnConfirmar.onclick = async () => {
            const nome = inputNome.value.trim();
            if (!nome) return;

            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

            try {
                const dadosIniciais = {
                    nome: nome,
                    userId: auth.currentUser.uid,
                    timestamp: serverTimestamp(),
                    ultimaedicao: new Date().toISOString(),
                    estado: "on",
                    manifesto: "",
                    manuscrito: ""
                };

                const docRef = await addDoc(collection(db, "xray"), dadosIniciais);
                popupCriar.classList.remove('active');
                window.abrirProjetoX(docRef.id, dadosIniciais);
            } catch (e) {
                console.error(e);
                btnConfirmar.disabled = false;
                btnConfirmar.innerText = "CRIAR AGORA";
            }
        };
    }

    // D) Vigiar Estado de Login
    onAuthStateChanged(auth, async (user) => {
        const loginScreen = document.getElementById('login-screen');
        const loadingScreen = document.getElementById('loading-screen');
        const dashboard = document.getElementById('xray-dashboard');
        const workspace = document.getElementById('xray-workspace');

        if (user) {
            console.log("✅ [AUTH] Logado como:", user.email);
            
            await carregarPreferencia(user.uid);
            iniciarSettingsXRay(db, auth);
            iniciarExportManager(db, auth);
            carregarListaProjetosXRay(user.uid);

            if(loginScreen) loginScreen.style.display = 'none';

            const EXTRA_BUFFER = 500; 
            setTimeout(() => {
                if(loadingScreen) {
                    loadingScreen.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                        if (state.projetoAtivo) {
                            if(workspace) workspace.style.display = 'grid';
                        } else {
                            if(dashboard) dashboard.style.display = 'flex';
                        }
                    }, 600);
                }
            }, EXTRA_BUFFER);

        } else {
            console.log("🔒 [AUTH] Sessão encerrada.");
            if(loadingScreen) loadingScreen.style.display = 'none';
            if(loginScreen) loginScreen.style.display = 'flex';
            if(dashboard) dashboard.style.display = 'none';
            if(workspace) workspace.style.display = 'none';
        }
    });
}

/**
 * 2. CARREGAR PREFERÊNCIAS (FONTE, ETC)
 */
async function carregarPreferencia(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid));
        if(snap.exists()) {
            const d = snap.data();
            if(d.xraytext) document.documentElement.style.setProperty('--xray-esq-font', d.xraytext + "px");
            if(d.xrayresultsfont) document.documentElement.style.setProperty('--xray-dir-font', d.xrayresultsfont + "px");
        }
    } catch (e) { console.error("Erro ao carregar preferências:", e); }
}

/**
 * 3. LISTAGEM DE PROJETOS
 */
function carregarListaProjetosXRay(uid) {
    const q = query(collection(db, "xray"), where("userId", "==", uid), where("estado", "==", "on"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('lista-projetos-xray');
        if (!container) return;
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = `<p style="color:gray; grid-column: 1/-1; padding:20px; opacity:0.4; font-size:12px;">Nenhuma investigação ativa.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const card = document.createElement('div');
            card.className = "project-card";
            card.innerHTML = `<i class="fa-solid fa-microscope"></i><h3>${d.nome}</h3><small>Visto: ${new Date(d.ultimaedicao).toLocaleDateString()}</small>`;
            card.onclick = () => window.abrirProjetoX(docSnap.id, d);
            container.appendChild(card);
        });
    });
}

/**
 * 4. ABERTURA DE PROJETO
 */
window.abrirProjetoX = (id, dados) => {
    state.projetoAtivo = { id, ...dados };
    document.getElementById('xray-dashboard').style.display = 'none';
    document.getElementById('xray-workspace').style.display = 'grid';
    document.getElementById('projeto-info-header').innerText = `INVESTIGAÇÃO: ${dados.nome}`;
    
    document.getElementById('editor-manifesto').value = dados.manifesto || "";
    document.getElementById('editor-manuscrito').value = dados.manuscrito || "";
    
    vincularEventosTrabalho();
    
    if(dados.manifesto && dados.manifesto.trim() !== "") {
        XRayUI.mostrarLoading();
        processarFluxoTotal(dados.manifesto);
    }
};

/**
 * 5. FLUXO DE TRABALHO
 */
function vincularEventosTrabalho() {
    document.getElementById('editor-manifesto').oninput = (e) => {
        XRayUI.mostrarLoading();
        clearTimeout(timerManifesto);
        timerManifesto = setTimeout(() => processarFluxoTotal(e.target.value), 1500);
    };

    document.getElementById('editor-manuscrito').oninput = (e) => {
        clearTimeout(timerManuscrito);
        timerManuscrito = setTimeout(() => {
            gravarNoFirebase({ manuscrito: e.target.value });
        }, 1000);
    };

    // Tabs logic
    document.querySelectorAll('.tab-btn-left').forEach(b => b.onclick = () => {
        document.querySelectorAll('.tab-btn-left').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const t = b.dataset.target;
        ['editor-manifesto','editor-manuscrito','leitura-display'].forEach(id => {
            document.getElementById(id).style.display = (t === id ? 'block' : 'none');
        });
    });

    document.querySelectorAll('.tab-btn-right').forEach(b => b.onclick = () => {
        document.querySelectorAll('.tab-btn-right').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        XRayUI.renderizarResultados(b.dataset.tab);
    });
}

async function processarFluxoTotal(texto) {
    if(!texto) return;
    await gravarNoFirebase({ manifesto: texto });
    await executarAnaliseProfunda(texto);
    const aba = document.querySelector('.tab-btn-right.active').dataset.tab;
    XRayUI.renderizarResultados(aba);
}

async function gravarNoFirebase(campos) {
    if (!state.projetoAtivo || !state.projetoAtivo.id) return;
    try {
        await updateDoc(doc(db, "xray", state.projetoAtivo.id), { ...campos, ultimaedicao: new Date().toISOString() });
    } catch (e) { console.error("Erro Firebase Save:", e); }
}

// Global UI Actions
window.setModoResumoX = (m) => { state.modoResumo = m; XRayUI.renderizarResultados('resumo'); };
window.toggleSilencioX = (n) => { if(state.config.silenciados.has(n)) state.config.silenciados.delete(n); else state.config.silenciados.add(n); renderizarPiccards(); refreshX(); };
window.toggleCatX = (id) => { if(state.config.fontesOcultas.has(id)) state.config.fontesOcultas.delete(id); else state.config.fontesOcultas.add(id); renderizarPiccards(); refreshX(); };

function refreshX() { 
    const a = document.querySelector('.tab-btn-right.active'); 
    if(a) XRayUI.renderizarResultados(a.dataset.tab); 
}

// Iniciar Processo
bootstrap();