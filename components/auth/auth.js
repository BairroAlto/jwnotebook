// components/auth/auth.js
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut,
    setPersistence,
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * Inicializa o sistema de autenticação e vigia o estado do utilizador.
 * @param {object} app - Instância do Firebase App
 * @param {object} db - Instância do Firestore
 */
export function iniciarAutenticacao(app, db) {
    const auth = getAuth(app);

    // 🚀 CORREÇÃO 1: Forçar persistência local. 
    // Isto garante que o iPhone não peça login toda a vez que fechas a app.
    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            console.log("🔐 AUTH: Persistência configurada para Local.");
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

    // 1. VIGIAR ESTADO DE LOGIN (Real-time)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("✅ AUTH: Utilizador autenticado:", user.email);
            
            // Esconder telas de acesso
            if(loginScreen) loginScreen.style.display = 'none';
            if(loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
            }
        } else {
            console.log("🔒 AUTH: Nenhuma sessão ativa.");
            
            // Mostrar ecrã de login e esconder loading
            if(loadingScreen) loadingScreen.style.display = 'none';
            if(loginScreen) loginScreen.style.display = 'flex';
            
            // Garantir que os inputs estão limpos
            if(emailInput) emailInput.value = "";
            if(passwordInput) passwordInput.value = "";
        }
    });

    // 2. LÓGICA DE LOGIN
    if(btnLogin) {
        btnLogin.addEventListener('click', () => {
            // 🚀 CORREÇÃO 2: Leitura direta no momento do clique.
            // O iPhone Auto-fill preenche os campos mas às vezes o JS não deteta a mudança.
            // Ler o .value diretamente aqui ignora esse problema.
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if(!email || !password) {
                mostrarErro("Preenche todos os campos.");
                return;
            }

            btnLogin.innerText = "A entrar...";
            btnLogin.disabled = true;

            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    console.log("🚀 AUTH: Login efetuado com sucesso.");
                    btnLogin.innerText = "Entrar";
                    btnLogin.disabled = false;
                    if(loginError) loginError.style.display = 'none';
                })
                .catch((error) => {
                    console.error("❌ AUTH: Erro no login:", error.code);
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

    // 3. LÓGICA DE LOGOUT
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
        }
    }

    return auth;
}
