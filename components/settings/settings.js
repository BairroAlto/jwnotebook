// components/settings/settings.js
import { doc, getDoc, updateDoc, setDoc, getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { inicializarAmigos } from './amigos.js';

let timerGravacao = null;


/**
 * Atualiza o ícone de definições no topo do site
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
 * INICIALIZADOR PRINCIPAL
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

    // 1. MOSTRAR O BOTÃO DE DEFINIÇÕES
    if (btnAbrir) btnAbrir.style.display = 'flex';

    // 2. CARREGAR DADOS DO PERFIL DO FIREBASE
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const dados = snap.data();

            // A) Aplicar Fontes
            if (dados.tamanholetra) {
                Object.entries(dados.tamanholetra).forEach(([varName, value]) => {
                    document.documentElement.style.setProperty(varName, value + 'px');
                    const input = document.querySelector(`input[data-var="${varName}"]`);
                    if (input) input.value = value;
                });
            }

            // B) Aplicar Estado do Colapso (Visual)
            if (dados.colapsoTitulos) {
                if (checkColapso) checkColapso.checked = true;
                document.body.classList.add('modo-colapso-titulos');
            }

            // C) Aplicar Estado da Partilha de Respostas (Visual)
            if (dados.shareAnswers) {
                if (checkShare) checkShare.checked = true;
            }

            // D) Aplicar Avatar
            const avatarAtual = dados.avatar || "gear";
            atualizarIconeBotaoTopo(avatarAtual);
            const avatarItem = document.querySelector(`.avatar-item[data-avatar="${avatarAtual}"]`);
            if (avatarItem) avatarItem.classList.add('active');
        }
    } catch (e) { console.error("Erro ao carregar definições:", e); }

    // 3. LOGICA DE NAVEGAÇÃO ENTRE ABAS
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

            if (targetId === 'set-reciclagem') {
                import('./recycle-manager.js').then(m => m.carregarTodaReciclagem(db, user.uid));
            }
        };
    });

    // 4. LÓGICA DO TOGGLE: PARTILHAR RESPOSTAS (Gravação Dupla)
  if (checkShare) {
    checkShare.onchange = async (e) => {
        const ativo = e.target.checked;
        const uid = user.uid;

        try {
            await updateDoc(userRef, { shareAnswers: ativo });
            const shareRef = doc(db, "Partilharcom", uid);
            await setDoc(shareRef, { userId: uid, shareAnswers: ativo, lastUpdate: new Date().toISOString() }, { merge: true });

            // NOVO: Notificar o sistema para esconder/mostrar a aba
            window.dispatchEvent(new CustomEvent('sync:rede-respostas', { detail: { ativa: ativo } }));

        } catch (err) {
                console.error("Erro ao gravar partilha:", err);
                checkShare.checked = !ativo; // Reverte em caso de falha
            }
        };
    }

    // 5. LÓGICA DO TOGGLE: COLAPSO TITULOS (Refresh Total)
    if (checkColapso) {
        checkColapso.onchange = async (e) => {
            const ativo = e.target.checked;
            checkColapso.disabled = true;
            try {
                await updateDoc(userRef, { colapsoTitulos: ativo });
                window.location.reload();
            } catch (err) {
                console.error("Erro ao gravar colapso:", err);
                checkColapso.disabled = false;
            }
        };
    }

    // 6. SELEÇÃO DE AVATAR
    document.querySelectorAll('.avatar-item').forEach(item => {
        item.onclick = async () => {
            const novo = item.dataset.avatar;
            atualizarIconeBotaoTopo(novo);
            await updateDoc(userRef, { avatar: novo });
            document.querySelectorAll('.avatar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        };
    });

    // 7. SLIDERS DE FONTES (Debounce para performance)
    document.querySelectorAll('.field-font input[type="range"]').forEach(slider => {
        slider.oninput = (e) => {
            const varName = e.target.getAttribute('data-var');
            document.documentElement.style.setProperty(varName, e.target.value + 'px');
            
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

    // 8. INICIALIZAR AMIGOS E LOGOUT
    inicializarAmigos(db, auth);
    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) btnSair.onclick = () => signOut(auth).then(() => location.reload());
}