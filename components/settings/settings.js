// components/settings/settings.js
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { inicializarAmigos } from './amigos.js';

let timerGravacao = null;

/**
 * Atualiza o ícone de definições no topo do site (Avatar do utilizador)
 */
function atualizarIconeBotaoTopo(avatar) {
    const btnDefinicoes = document.getElementById('btnDefinicoes');
    if (!btnDefinicoes) return;
    const icone = btnDefinicoes.querySelector('i');
    if (!icone) return;

    // Se o avatar for 'gear', usa o ícone padrão, caso contrário usa o símbolo escolhido
    if (!avatar || avatar === "" || avatar === "gear") {
        icone.className = "fa-solid fa-gear";
    } else {
        const prefixo = (avatar === 'discord' || avatar === 'xbox' || avatar === 'mailchimp') ? 'fa-brands' : 'fa-solid';
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

    // 1. GARANTIR VISIBILIDADE DO BOTÃO
    if (btnAbrir) btnAbrir.style.display = 'flex';

    // 2. CARREGAR PREFERÊNCIAS DO UTILIZADOR (Firebase -> UI)
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const dados = snap.data();

            // A) Aplicar Tamanhos de Letra Guardados
            if (dados.tamanholetra) {
                Object.entries(dados.tamanholetra).forEach(([varName, value]) => {
                    // Aplica no CSS Global
                    document.documentElement.style.setProperty(varName, value + 'px');
                    // Sincroniza a posição do slider no popup
                    const input = document.querySelector(`input[data-var="${varName}"]`);
                    if (input) input.value = value;
                });
            }

            // B) Estado do Colapso de Títulos
            if (dados.colapsoTitulos) {
                if (checkColapso) checkColapso.checked = true;
                document.body.classList.add('modo-colapso-titulos');
            }

            // C) Estado da Rede de Respostas
            if (dados.shareAnswers) {
                if (checkShare) checkShare.checked = true;
            }

            // D) Aplicar Avatar Escolhido
            const avatarAtual = dados.avatar || "gear";
            atualizarIconoBotaoTopo(avatarAtual);
            const avatarItem = document.querySelector(`.avatar-item[data-avatar="${avatarAtual}"]`);
            if (avatarItem) {
                document.querySelectorAll('.avatar-item').forEach(i => i.classList.remove('active'));
                avatarItem.classList.add('active');
            }
        }
    } catch (e) { 
        console.error("❌ [SETTINGS] Erro ao carregar perfil:", e); 
    }

    // 3. GESTÃO DE ABERTURA E ABAS
    if (btnAbrir) btnAbrir.onclick = () => overlay.classList.add('active');
    if (btnFechar) btnFechar.onclick = () => overlay.classList.remove('active');

    const tabs = document.querySelectorAll('.tab-settings');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.setting-content').forEach(c => c.style.display = 'none');
            const targetId = tab.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.style.display = 'block';

            // Se for a aba de reciclagem, carrega os dados específicos
            if (targetId === 'set-reciclagem') {
                import('./recycle-manager.js').then(m => m.carregarTodaReciclagem(db, user.uid));
            }
        };
    });

    // 4. TOGGLE: REDE DE RESPOSTAS (Sincronização Social)
    if (checkShare) {
        checkShare.onchange = async (e) => {
            const ativo = e.target.checked;
            const uid = user.uid;
            try {
                // Grava no perfil do utilizador
                await updateDoc(userRef, { shareAnswers: ativo });
                // Grava na coleção pública de descoberta
                const shareRef = doc(db, "Partilharcom", uid);
                await setDoc(shareRef, { userId: uid, shareAnswers: ativo, lastUpdate: new Date().toISOString() }, { merge: true });
                
                // Notifica o sistema para atualizar abas sociais se necessário
                window.dispatchEvent(new CustomEvent('sync:rede-respostas', { detail: { ativa: ativo } }));
            } catch (err) {
                console.error("❌ [SETTINGS] Erro ao gravar partilha:", err);
                checkShare.checked = !ativo; 
            }
        };
    }

    // 5. TOGGLE: COLAPSO DE TÍTULOS (Recarregar para aplicar classes complexas)
    if (checkColapso) {
        checkColapso.onchange = async (e) => {
            const ativo = e.target.checked;
            checkColapso.disabled = true;
            try {
                await updateDoc(userRef, { colapsoTitulos: ativo });
                window.location.reload(); // Refresh necessário para re-processar alturas dos títulos
            } catch (err) {
                checkColapso.disabled = false;
            }
        };
    }

    // 6. SELEÇÃO DE AVATAR (Ícone do Topo)
    document.querySelectorAll('.avatar-item').forEach(item => {
        item.onclick = async () => {
            const novoAvatar = item.dataset.avatar;
            atualizarIconeBotaoTopo(novoAvatar);
            
            try {
                await updateDoc(userRef, { avatar: novoAvatar });
                document.querySelectorAll('.avatar-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            } catch (e) {
                console.error("❌ Erro ao guardar avatar:", e);
            }
        };
    });

    // 7. SLIDERS DE FONTES (INTELIGÊNCIA VISUAL)
    // Gere --fs-left-items, --fs-right-results (Índice/IA), --fs-editor-texto, etc.
    document.querySelectorAll('.field-font input[type="range"]').forEach(slider => {
        slider.oninput = (e) => {
            const varName = e.target.getAttribute('data-var');
            const valor = e.target.value;

            // APLICAÇÃO IMEDIATA (Para o utilizador ver o resultado enquanto arrasta)
            document.documentElement.style.setProperty(varName, valor + 'px');
            
            // DEBOUNCE: Só grava no Firebase 1.5 segundos após o utilizador parar de mexer
            clearTimeout(timerGravacao);
            timerGravacao = setTimeout(async () => {
                const novaConfig = {};
                // Recolhe todos os valores atuais dos sliders para guardar o pacote completo
                document.querySelectorAll('.field-font input[type="range"]').forEach(i => {
                    novaConfig[i.getAttribute('data-var')] = i.value;
                });

                try {
                    await updateDoc(userRef, { tamanholetra: novaConfig });
                    console.log("💾 [SETTINGS] Tamanhos de fonte sincronizados com a nuvem.");
                } catch (err) {
                    console.error("❌ Erro ao guardar fontes:", err);
                }
            }, 1500);
        };
    });

    // 8. SUBSISTEMAS E LOGOUT
    inicializarAmigos(db, auth);
    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) {
        btnSair.onclick = () => {
            signOut(auth).then(() => {
                window.location.reload();
            }).catch(err => alert("Erro ao sair: " + err.message));
        };
    }
}
