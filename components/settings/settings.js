// components/settings/settings.js
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { inicializarAmigos } from './amigos.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { AISearchEngine } from '../direita/ai-search-engine.js';

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
    
    // --- GESTÃO DE ABERTURA ---
    if (btnAbrir) btnAbrir.onclick = () => overlay.classList.add('active');
    if (btnFechar) btnFechar.onclick = () => overlay.classList.remove('active');

    // 1. CARREGAR PREFERÊNCIAS
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const dados = snap.data();
            if (dados.tamanholetra) {
                Object.entries(dados.tamanholetra).forEach(([varName, value]) => {
                    document.documentElement.style.setProperty(varName, value + 'px');
                });
            }
            atualizarIconeBotaoTopo(dados.avatar || "gear");
        }
    } catch (e) { console.error(e); }

    // 2. GESTÃO DE ABAS
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

    // 3. LÓGICA DE BUSCA SEMÂNTICA (NEXO GPS) COM ANIMAÇÃO DO MACACO
    const btnBusca = document.getElementById('btn-executar-tab-search');
    const inputBusca = document.getElementById('input-tab-search');

    if (btnBusca) {
        btnBusca.onclick = async () => {
            const query = inputBusca.value.trim();
            if (!query) return;

            const status = document.getElementById('search-status-info');
            const listaUI = document.getElementById('list-results-gps');

            // --- ESTADO DE CARREGAMENTO (O MACACO A SALTAR) ---
            btnBusca.disabled = true;
            btnBusca.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
            listaUI.innerHTML = "";
            
            status.innerHTML = `
                <div style="text-align:center; padding:20px; color:var(--primary); animation: fadeIn 0.3s ease;">
                    <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:35px; margin-bottom:15px; display:block;"></i>
                    <p style="font-family:monospace; font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">
                        O BOOKAi ESTÁ A PROCESSAR SINAPSE...
                    </p>
                </div>
            `;

            try {
                // Executar a procura no motor DeepSeek
                const resultados = await AISearchEngine.procurar(query, db, user.uid);

                if (!resultados || resultados.length === 0) {
                    status.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-ghost"></i> Nenhuma nota encontrada com esse significado.</span>`;
                } else {
                    status.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> Encontrei <b>${resultados.length}</b> correspondências:`;
                    
                    resultados.forEach(nota => {
                        const card = document.createElement('div');
                        card.className = "menu-item-list";
                        card.style.cssText = "background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-left: 4px solid var(--primary); margin-bottom: 8px; justify-content: space-between; padding: 12px 15px; cursor: pointer; transition: 0.2s;";
                        
                        card.innerHTML = `
                            <div style="display:flex; align-items:center; gap:12px; overflow:hidden; pointer-events:none;">
                                <i class="fa-solid fa-file-lines" style="color:var(--primary);"></i>
                                <span style="font-weight:700; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nota.title}</span>
                            </div>
                            <i class="fa-solid fa-arrow-right-to-bracket" style="opacity:0.4; pointer-events:none;"></i>
                        `;
                        
                        // Efeito de hover manual no card
                        card.onmouseenter = () => card.style.background = "rgba(99, 102, 241, 0.15)";
                        card.onmouseleave = () => card.style.background = "rgba(99, 102, 241, 0.08)";

                        card.onclick = async () => {
                            overlay.classList.remove('active');
                            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                            
                            let snap = await getDoc(doc(db, "Local", nota.id));
                            if (!snap.exists()) snap = await getDoc(doc(db, "Share", nota.id));
                            
                            if (snap.exists()) {
                                abrirNotaNoEditor(nota.id, snap.data(), db, auth);
                            }
                        };
                        listaUI.appendChild(card);
                    });
                }
            } catch (err) {
                console.error("Erro na busca:", err);
                status.innerHTML = `<span style="color:#f87171;">Erro na ligação ao Nexo.</span>`;
            } finally {
                btnBusca.disabled = false;
                btnBusca.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
            }
        };

        inputBusca.onkeydown = (e) => { if (e.key === 'Enter') btnBusca.click(); };
    }

    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) btnSair.onclick = () => signOut(auth).then(() => window.location.reload());

    inicializarAmigos(db, auth);
}
