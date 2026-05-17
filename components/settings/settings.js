// components/settings/settings.js
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { inicializarAmigos } from './amigos.js';
import { abrirNotaNoEditor } from '../editor/editor.js'; // 🚀 CAMINHO CORRIGIDO AQUI
import { AISearchEngine } from '../direita/ai-search-engine.js';

let timerGravacao = null;

/**
 * Atualiza o ícone de definições no topo (Avatar)
 */
function atualizarIconeBotaoTopo(avatar) {
    const btnDefinicoes = document.getElementById('btnDefinicoes');
    if (!btnDefinicoes) return;
    const icone = btnDefinicoes.querySelector('i');
    if (!icone) return;

    if (!avatar || avatar === "" || avatar === "gear") {
        icone.className = "fa-solid fa-gear";
    } else {
        const prefixo = (avatar === 'discord' || avatar === 'xbox') ? 'fa-brands' : 'fa-solid';
        icone.className = `${prefixo} fa-${avatar}`;
    }
}

/**
 * INICIALIZADOR PRINCIPAL DAS DEFINIÇÕES
 */
export async function inicializarSettings(db, auth) {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const overlay = document.getElementById('popup-settings-overlay');
    const btnAbrir = document.getElementById('btnDefinicoes');
    const btnFechar = document.getElementById('btn-fechar-settings');
    
    // Elementos de Toggles
    const checkColapso = document.getElementById('check-colapso-titulos');
    const checkShare = document.getElementById('check-partilhar-respostas');

    // 1. CONFIGURAR ABERTURA E FECHO
    if (btnAbrir) btnAbrir.onclick = () => overlay.classList.add('active');
    if (btnFechar) btnFechar.onclick = () => overlay.classList.remove('active');

    // 2. CARREGAR PREFERÊNCIAS DO FIREBASE
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const dados = snap.data();
            
            // A. Aplicar Tamanhos de Letra
            if (dados.tamanholetra) {
                Object.entries(dados.tamanholetra).forEach(([varName, value]) => {
                    document.documentElement.style.setProperty(varName, value + 'px');
                    const input = document.querySelector(`input[data-var="${varName}"]`);
                    if (input) input.value = value;
                });
            }

            // B. Estado do Colapso de Títulos
            if (dados.colapsoTitulos && checkColapso) {
                checkColapso.checked = true;
                document.body.classList.add('modo-colapso-titulos');
            }

            // C. Estado da Rede de Respostas
            if (dados.shareAnswers && checkShare) {
                checkShare.checked = true;
            }

            // D. Aplicar Avatar
            atualizarIconeBotaoTopo(dados.avatar || "gear");
        }
    } catch (e) { console.error("Erro ao carregar perfil:", e); }

    // Botão de atalho da lupa no topo do site
const btnLupaTopo = document.getElementById('btnAbrirGpsDireto');
if (btnLupaTopo) {
    btnLupaTopo.onclick = () => {
        overlay.classList.add('active'); // Abre o popup
        const tabPesquisa = document.querySelector('.tab-settings[data-target="set-search"]');
        if (tabPesquisa) tabPesquisa.click(); // Salta direto para a aba de pesquisa
    };
}

    // 3. GESTÃO DE ABAS
    const tabs = document.querySelectorAll('.tab-settings');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.setting-content').forEach(c => c.style.display = 'none');
            const targetId = tab.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.style.display = 'block';

            if (targetId === 'set-reciclagem') {
                import('./recycle-manager.js').then(m => m.carregarTodaReciclagem(db, user.uid));
            }
        };
    });

    // 4. LÓGICA DE BUSCA SEMÂNTICA (NEXO GPS)
  const btnBusca = document.getElementById('btn-executar-tab-search');
const inputBusca = document.getElementById('input-tab-search');

if (btnBusca) {
    btnBusca.onclick = async () => {
        const query = inputBusca.value.trim();
        if (!query) return;

        const status = document.getElementById('search-status-info');
        const listaUI = document.getElementById('list-results-gps');

        btnBusca.disabled = true;
        btnBusca.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        listaUI.innerHTML = "";
        
        status.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--primary);">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:35px; margin-bottom:15px; display:block;"></i>
                <p style="font-family:monospace; font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">PROCESSANDO SINAPSE...</p>
            </div>`;

        try {
            const { AISearchEngine } = await import('../direita/ai-search-engine.js');
            const resultados = await AISearchEngine.procurar(query, db, user.uid);

            if (!resultados || resultados.length === 0) {
                status.innerHTML = `<span style="color:#f87171;">❌ Nenhuma nota encontrada.</span>`;
            } else {
                status.innerHTML = `✅ Encontrei <b>${resultados.length}</b> correspondências:`;
                resultados.forEach(nota => {
                    const card = document.createElement('div');
                    card.className = "menu-item-list";
                    card.style.cssText = `background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-left: 4px solid var(--primary); margin-bottom: 8px; padding: 12px 15px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;`;
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; pointer-events:none;">
                            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                                <i class="fa-solid fa-file-lines" style="color:var(--primary); font-size:12px;"></i>
                                <span style="font-weight:700; color:white;">${nota.title}</span>
                            </div>
                            <i class="fa-solid fa-arrow-right-to-bracket" style="opacity:0.3; font-size:12px;"></i>
                        </div>
                        <div style="font-size:11px; color:var(--text-muted); padding-left:22px; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${nota.snippet}..."</div>`;
                    
                    card.onclick = async () => {
                        overlay.classList.remove('active');
                        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                        const snap = await getDoc(doc(db, "Local", nota.id));
                        if (snap.exists()) abrirNotaNoEditor(nota.id, snap.data(), db, auth);
                    };
                    listaUI.appendChild(card);
                });
            }
        } catch (err) { status.innerHTML = "Erro na busca."; }
        finally { btnBusca.disabled = false; btnBusca.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`; }
    };
    inputBusca.onkeydown = (e) => { if (e.key === 'Enter') btnBusca.click(); };
}

    // 5. TOGGLE: REDE DE RESPOSTAS
    if (checkShare) {
        checkShare.onchange = async (e) => {
            const ativo = e.target.checked;
            try {
                await updateDoc(userRef, { shareAnswers: ativo });
                await setDoc(doc(db, "Partilharcom", user.uid), { userId: user.uid, shareAnswers: ativo, lastUpdate: new Date().toISOString() }, { merge: true });
            } catch (err) { console.error(err); }
        };
    }

    // 6. TOGGLE: COLAPSO DE TÍTULOS
    if (checkColapso) {
        checkColapso.onchange = async (e) => {
            try {
                await updateDoc(userRef, { colapsoTitulos: e.target.checked });
                window.location.reload(); 
            } catch (err) { console.error(err); }
        };
    }

    // 7. SELEÇÃO DE AVATAR
    document.querySelectorAll('.avatar-item').forEach(item => {
        item.onclick = async () => {
            const novoAvatar = item.dataset.avatar;
            atualizarIconeBotaoTopo(novoAvatar);
            try {
                await updateDoc(userRef, { avatar: novoAvatar });
                document.querySelectorAll('.avatar-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            } catch (e) { console.error(e); }
        };
    });

    // 8. SLIDERS DE FONTES (Universal)
    document.querySelectorAll('.field-font input[type="range"]').forEach(slider => {
        slider.oninput = (e) => {
            const varName = e.target.getAttribute('data-var');
            const valor = e.target.value;
            document.documentElement.style.setProperty(varName, valor + 'px');
            
            clearTimeout(timerGravacao);
            timerGravacao = setTimeout(async () => {
                const config = {};
                document.querySelectorAll('.field-font input[type="range"]').forEach(i => {
                    config[i.getAttribute('data-var')] = i.value;
                });
                await updateDoc(userRef, { tamanholetra: config });
            }, 1500);
        };
    });

    // 9. LOGOUT E AMIGOS
    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) btnSair.onclick = () => signOut(auth).then(() => window.location.reload());

    inicializarAmigos(db, auth);
}