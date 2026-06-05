// components/settings/settings.js
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { inicializarAmigos } from './amigos.js';
import { abrirNotaNoEditor } from '../editor/editor.js'; 

let timerGravacao = null;
let nomesCoresCustom = {};

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
    
    // Elementos da Busca Semântica (Nexo GPS)
    const btnBusca = document.getElementById('btn-executar-tab-search');
    const inputBusca = document.getElementById('input-tab-search');
    const inputRefine = document.getElementById('input-tab-refine');
    const refineContainer = document.getElementById('refine-search-container');
    const listaUI = document.getElementById('list-results-gps');
    const statusInfo = document.getElementById('search-status-info');

    // 1. CONFIGURAR ABERTURA E FECHO
    if (btnAbrir) btnAbrir.onclick = () => overlay.classList.add('active');
    if (btnFechar) btnFechar.onclick = () => {
        overlay.classList.remove('active');
        if (refineContainer) refineContainer.style.display = 'none';
    };

   // 2. CARREGAR PREFERÊNCIAS DO UTILIZADOR
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const dados = snap.data();

            // A. Aplicar Tamanhos de Letra (Sliders)
            if (dados.tamanholetra) {
                Object.entries(dados.tamanholetra).forEach(([varName, value]) => {
                    document.documentElement.style.setProperty(varName, value + 'px');
                    const input = document.querySelector(`input[data-var="${varName}"]`);
                    if (input) input.value = value;
                });
            }

            // 🚀 B. Lógica de Colapso de Títulos (Wrap vs No-Wrap)
            // Aplica a classe ao body imediatamente para o CSS atuar
            if (dados.colapsoTitulos) {
                document.body.classList.add('modo-colapso-titulos');
                const checkColapso = document.getElementById('check-colapso-titulos');
                if (checkColapso) checkColapso.checked = true;
            } else {
                document.body.classList.remove('modo-colapso-titulos');
                const checkColapso = document.getElementById('check-colapso-titulos');
                if (checkColapso) checkColapso.checked = false;
            }

            // C. Rede de Respostas (Social)
            const checkShare = document.getElementById('check-partilhar-respostas');
            if (checkShare) {
                checkShare.checked = (dados.shareAnswers === "on");
            }

            // D. Nomes de Cores Personalizados
            if (dados.caixadestaques) nomesCoresCustom = dados.caixadestaques;
            
            // E. Avatar e Identidade
            atualizarIconeBotaoTopo(dados.avatar || "gear");
        }
    } catch (e) { 
        console.error("❌ [SETTINGS] Erro ao carregar perfil do Firebase:", e); 
    }

    // 3. GESTÃO DE ABAS DO PAINEL
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

    // ========================================================
    // 📡 MOTOR NEXO GPS (BUSCA SEMÂNTICA)
    // ========================================================

    const executarBuscaGps = async (termo) => {
        if (!termo) return;

        btnBusca.disabled = true;
        btnBusca.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        listaUI.style.opacity = "0.4"; // Feedback de processamento
        
        statusInfo.innerHTML = `
            <div style="text-align:center; padding:10px; color:var(--primary);">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:30px; margin-bottom:10px; display:block;"></i>
                <p style="font-family:monospace; font-size:9px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">VARRENDO A REDE...</p>
            </div>`;

        try {
            const { AISearchEngine } = await import('../direita/ai-search-engine.js');
            const resultados = await AISearchEngine.procurar(termo, db, user.uid);

            listaUI.innerHTML = "";
            listaUI.style.opacity = "1";

          if (!resultados || resultados.length === 0) {
    statusInfo.innerHTML = `<span style="color:#f87171;">❌ Nenhuma correspondência encontrada.</span>`;
} else {
    statusInfo.innerHTML = `✅ Encontrei <b>${resultados.length}</b> resultados:`;
           
                
                resultados.forEach(nota => {
                    const card = document.createElement('div');
                    card.className = "menu-item-list";
                    
                    // 🎨 DESIGN DINÂMICO (LOCAL=Indigo | SHARE=Vermelho)
                    const isShare = (nota.source && nota.source.toUpperCase() === "SHARE");
                    const corPrimaria = isShare ? "#ef4444" : "var(--primary)";
                    const bgCard = isShare ? "rgba(239, 68, 68, 0.08)" : "rgba(99, 102, 241, 0.08)";
                    const borderCard = isShare ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.2)";

                    card.style.cssText = `
                        background: ${bgCard}; border: 1px solid ${borderCard}; 
                        border-left: 4px solid ${corPrimaria}; margin-bottom: 10px; 
                        padding: 15px; cursor: pointer; display: flex; 
                        flex-direction: column; gap: 8px; border-radius: 12px; transition: 0.2s;
                    `;

                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; pointer-events:none;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <i class="fa-solid ${isShare ? 'fa-share-nodes' : 'fa-file-lines'}" style="color:${corPrimaria}; font-size:14px;"></i>
                                <span style="font-weight:800; color:white; font-size:15px; letter-spacing:0.3px;">${nota.title}</span>
                            </div>
                            <span style="font-size:8px; font-weight:900; color:${corPrimaria}; opacity:0.7; border:1px solid ${corPrimaria}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${isShare ? 'SHARE' : 'LOCAL'}</span>
                        </div>
                        <div style="font-size:12.5px; color:var(--text-muted); padding-left:26px; font-style: italic; line-height:1.4; opacity:0.9;">
                            "${nota.snippet}..."
                        </div>
                    `;

                    card.onclick = async () => {
                        // 1. Extração Blindada do ID (IA-Safe)
                        const idNotaRaw = nota.id || nota.ID || nota.Id;
                        const idNotaLimpo = idNotaRaw ? String(idNotaRaw).trim() : null;
                        
                        const idBlocoRaw = nota.blockId || nota.blockid || nota.BlockId;
                        const idBlocoLimpo = idBlocoRaw ? String(idBlocoRaw).trim() : null;

                        if (!idNotaLimpo) return alert("Erro no endereço da nota devolvido pela IA.");

                        overlay.classList.remove('active');

                        try {
                            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                            const { abrirNotaNoEditor } = await import('../editor/editor.js');

                            // 2. Busca Automática em Ambbas as Coleções (Fallback)
                            let colecaoPrincipal = isShare ? "Share" : "Local";
                            let noteRef = doc(db, colecaoPrincipal, idNotaLimpo);
                            let snap = await getDoc(noteRef);

                            if (!snap.exists()) {
                                // Tenta na outra coleção se a primeira falhar
                                colecaoPrincipal = (colecaoPrincipal === "Local") ? "Share" : "Local";
                                noteRef = doc(db, colecaoPrincipal, idNotaLimpo);
                                snap = await getDoc(noteRef);
                            }
                            
                            if (snap.exists()) {
                                // 🚀 SALTO DE PRECISÃO: Abre nota e faz scroll para o parágrafo
                                await abrirNotaNoEditor(idNotaLimpo, snap.data(), db, auth, idBlocoLimpo);
                                
                                // UX: Fechar menu mobile se estiver aberto
                                if (window.innerWidth <= 768) {
                                    document.getElementById('area-esquerda')?.classList.add('closed');
                                    document.getElementById('mobile-overlay')?.classList.remove('active');
                                }
                            } else {
                                alert("Nota não localizada. Pode ter sido movida ou removida.");
                            }
                        } catch (err) { console.error("Erro no salto GPS:", err); }
                    };
                    listaUI.appendChild(card);
                });

                // Mostrar o campo de refinamento após a primeira busca
                refineContainer.style.display = 'block';
                 inputRefine.value = ""; 
            }
        } catch (err) { 
            console.error(err);
            statusInfo.innerHTML = `<span style="color:#ef4444;">Erro na varredura do satélite.</span>`; 
        }
        finally { 
            btnBusca.disabled = false; 
            btnBusca.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`; 
        }
    };

    // 6. TOGGLE: COLAPSO DE TÍTULOS
const checkColapso = document.getElementById('check-colapso-titulos');
if (checkColapso) {
    checkColapso.onchange = async (e) => {
        const novoEstado = e.target.checked;
        
        console.log("💾 [SETTINGS] Gravando preferência de colapso:", novoEstado);

        try {
            // 1. Grava no Firebase (Documento do utilizador)
            await updateDoc(userRef, { 
                colapsoTitulos: novoEstado 
            });

            // 2. Feedback visual antes de recarregar (opcional)
            console.log("✅ Gravado. Recarregando página...");

            // 3. Força o recarregamento da página para aplicar o CSS e as alturas
            window.location.reload();
            
        } catch (err) {
            console.error("❌ Erro ao gravar preferência:", err);
            alert("Erro ao salvar definição. Verifica a tua ligação.");
            // Reverte o botão visualmente se falhar
            e.target.checked = !novoEstado;
        }
    };
}

    // Listeners de Busca
    btnBusca.onclick = () => executarBuscaGps(inputBusca.value.trim());
    inputBusca.onkeydown = (e) => { if (e.key === 'Enter') btnBusca.click(); };
    
    // Listener de Refinamento (Enter no campo itálico)
    inputRefine.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const contextoExtra = inputRefine.value.trim();
            if (contextoExtra) {
                const perguntaCompleta = `No contexto anterior, foca agora em: ${contextoExtra}`;
                executarBuscaGps(perguntaCompleta);
                inputRefine.value = "";
            }
        }
    };

    // 4. LOGOUT E SLIDERS (MANUTENÇÃO)
    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) btnSair.onclick = () => signOut(auth).then(() => window.location.reload());

    inicializarAmigos(db, auth);
}

/**
 * UTILS: AVATAR E UI
 */
function atualizarIconeBotaoTopo(avatar) {
    const btn = document.getElementById('btnDefinicoes');
    if (!btn) return;
    const icone = btn.querySelector('i');
    if (!icone) return;
    if (!avatar || avatar === "gear") { icone.className = "fa-solid fa-gear"; }
    else {
        const prefixo = (avatar === 'discord' || avatar === 'xbox') ? 'fa-brands' : 'fa-solid';
        icone.className = `${prefixo} fa-${avatar}`;
    }
}
