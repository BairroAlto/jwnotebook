// components/biblioteca-brain/auth/auth.js
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    setPersistence,
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { criarGuardaDeAutenticacao } from './auth-guard.js';

/**
 * Inicializa o sistema de autenticação e vigia o estado do utilizador.
 * @param {object} app - Instância do Firebase App
 * @param {object} db - Instância do Firestore
 */
export function iniciarAutenticacao(app, db, { gerirLoading = true } = {}) {
    const auth = getAuth(app);
    criarGuardaDeAutenticacao({ auth });

    // 🚀 CORREÇÃO 1: Forçar persistência local. 
    // Garante que o iPhone se lembra de ti e não pede login sempre que abres a app.
    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            console.log("🔐 AUTH: Memória de sessão ativada.");
        })
        .catch((error) => {
            console.error("❌ AUTH: Erro na persistência:", error);
        });
    
    // Elementos da Interface
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const btnLogin = document.getElementById('btnLogin');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('login-error');

    // 1. VIGIAR ESTADO DE LOGIN (Tempo Real)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("✅ AUTH: Bem-vindo,", user.email);
            
            // Esconder ecrãs de acesso
            if(loginScreen) loginScreen.style.display = 'none';
            if(gerirLoading && loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
            }
        } else {
            console.log("🔒 AUTH: Nenhuma sessão ativa encontrada.");
            
            /**
             * 🚀 PROTEÇÃO ANTI-PISCA:
             * Esperamos 1 segundo antes de mostrar o ecrã de login.
             * Isto evita que o popup de "Acesso Restrito" apareça enquanto a net
             * ainda está a recuperar a tua sessão guardada.
             */
            // O callback sÃ³ Ã© chamado depois de o Firebase confirmar que nÃ£o
            // existe uma sessÃ£o. Mostrar o login imediatamente evita expor a
            // pÃ¡gina protegida durante o atraso do antigo temporizador.
            if(loadingScreen) loadingScreen.style.display = 'none';
            if(loginScreen) loginScreen.style.display = 'flex';
            
            if(emailInput) emailInput.value = "";
            if(passwordInput) passwordInput.value = "";
        }
    });

    // 2. LÓGICA DO BOTÃO DE LOGIN
    if(btnLogin) {
        btnLogin.addEventListener('click', () => {
            // Lemos os valores diretamente no clique para ignorar bugs de auto-preenchimento
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if(!email || !password) {
                mostrarErro("Preenche todos os campos.");
                return;
            }

            btnLogin.innerText = "A validar...";
            btnLogin.disabled = true;

            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    console.log("🚀 AUTH: Login efetuado.");
                    btnLogin.innerText = "Entrar";
                    btnLogin.disabled = false;
                })
                .catch((error) => {
                    console.error("❌ AUTH: Falha no login:", error.code);
                    btnLogin.innerText = "Entrar";
                    btnLogin.disabled = false;
                    
                    let mensagem = "Credenciais incorretas.";
                    if(error.code === 'auth/invalid-email') mensagem = "Email inválido.";
                    if(error.code === 'auth/user-not-found') mensagem = "Utilizador não existe.";
                    if(error.code === 'auth/wrong-password') mensagem = "Password incorreta.";
                    
                    mostrarErro(mensagem);
                });
        });
    }

    configurarLoginGoogle(auth, btnLogin, loginError);

    // 3. LÓGICA DE SAIR (LOGOUT)
    window.executarLogout = () => {
        if (confirm("Desejas realmente encerrar a sessão?")) {
            signOut(auth).then(() => {
                console.log("👋 AUTH: Sessão encerrada.");
                location.reload(); 
            }).catch((error) => {
                alert("Erro ao sair: " + error.message);
            });
        }
    };

    function mostrarErro(msg) {
        if(loginError) {
            loginError.style.display = 'block';
            loginError.innerText = msg;
            setTimeout(() => { loginError.style.display = 'none'; }, 4000);
        }
    }

    return auth;
}

function configurarLoginGoogle(auth, btnLogin, loginError) {
    if (!btnLogin) return;

    const botaoGoogle = document.getElementById('btnLoginGoogle') || document.createElement('button');
    if (!botaoGoogle.id) {
        botaoGoogle.id = 'btnLoginGoogle';
        btnLogin.insertAdjacentElement('afterend', botaoGoogle);
    }
    botaoGoogle.type = 'button';
    botaoGoogle.className = 'login-google-button';
    botaoGoogle.innerHTML = '<i class="fa-brands fa-google" aria-hidden="true"></i> Entrar com Google';

    botaoGoogle.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        botaoGoogle.disabled = true;
        btnLogin.disabled = true;
        botaoGoogle.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> A entrar...';

        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('[AUTH][GOOGLE] Falha ao entrar:', error.code || error);
            const mensagens = {
                'auth/popup-closed-by-user': 'A janela Google foi fechada.',
                'auth/popup-blocked': 'O navegador bloqueou a janela Google. Permite pop-ups para este site.',
                'auth/cancelled-popup-request': 'O pedido Google foi cancelado.',
                'auth/account-exists-with-different-credential': 'Este e-mail já existe com outro método de login.'
            };
            mostrarErroLogin(mensagens[error.code] || 'Não foi possível entrar com Google.', loginError);
        } finally {
            botaoGoogle.disabled = false;
            btnLogin.disabled = false;
            botaoGoogle.innerHTML = '<i class="fa-brands fa-google" aria-hidden="true"></i> Entrar com Google';
        }
    });
}

function mostrarErroLogin(mensagem, elemento) {
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.style.display = 'block';
    setTimeout(() => { elemento.style.display = 'none'; }, 5000);
}
