import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    doc,
    getDoc,
    getFirestore,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loader = document.getElementById("auth-loader");
const loginView = document.getElementById("login-view");
const pendingView = document.getElementById("pending-view");
const authForm = document.getElementById("auth-form");
const formTitle = document.getElementById("form-title");
const formIntro = document.getElementById("form-intro");
const nameField = document.getElementById("name-field");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitButton = document.getElementById("submit-button");
const switchMode = document.getElementById("switch-mode");
const switchButton = document.getElementById("switch-button");
const togglePassword = document.getElementById("toggle-password");
const formMessage = document.getElementById("form-message");
const logoutButton = document.getElementById("logout-button");

let isRegistering = false;
let isCreatingProfile = false;

function showLogin() {
    loader.hidden = true;
    loginView.hidden = false;
    pendingView.hidden = true;
}

function showPending() {
    loader.hidden = true;
    loginView.hidden = true;
    pendingView.hidden = false;
}

function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = !message;
}

function setFormBusy(isBusy) {
    submitButton.disabled = isBusy;
    switchButton.disabled = isBusy;
    submitButton.textContent = isBusy ? "A processar…" : (isRegistering ? "Registar" : "Entrar");
}

function setMode(registering) {
    isRegistering = registering;
    formTitle.textContent = registering ? "Cria a tua conta" : "Acede ao NotaBook";
    formIntro.textContent = registering
        ? "Regista-te para começares a organizar as tuas notas."
        : "Entra para continuares a organizar as tuas notas.";
    nameField.hidden = !registering;
    nameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    switchMode.firstChild.textContent = registering ? "Já tens conta? " : "Ainda não tens conta? ";
    switchButton.textContent = registering ? "Fazer login" : "Criar conta";
    showMessage("");
    setFormBusy(false);
}

function firebaseErrorMessage(error) {
    const messages = {
        "auth/email-already-in-use": "Este e-mail já está a ser utilizado.",
        "auth/invalid-email": "Introduz um e-mail válido.",
        "auth/invalid-credential": "E-mail ou palavra-passe incorretos.",
        "auth/user-not-found": "Não encontrámos uma conta com este e-mail.",
        "auth/wrong-password": "A palavra-passe está incorreta.",
        "auth/weak-password": "A palavra-passe deve ter pelo menos 6 caracteres.",
        "auth/too-many-requests": "Foram feitas demasiadas tentativas. Tenta novamente mais tarde."
    };
    return messages[error.code] || "Não foi possível concluir a operação. Tenta novamente.";
}

switchButton.addEventListener("click", () => setMode(!isRegistering));

togglePassword.addEventListener("click", () => {
    const isPasswordVisible = passwordInput.type === "text";
    passwordInput.type = isPasswordVisible ? "password" : "text";
    togglePassword.textContent = isPasswordVisible ? "Mostrar" : "Ocultar";
    togglePassword.setAttribute("aria-label", isPasswordVisible ? "Mostrar palavra-passe" : "Ocultar palavra-passe");
});

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password || (isRegistering && !name)) {
        showMessage("Preenche todos os campos obrigatórios.");
        return;
    }

    setFormBusy(true);

    try {
        if (isRegistering) {
            isCreatingProfile = true;
            const credentials = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", credentials.user.uid), {
                nome: name,
                email,
                ativo: true,
                aceite: "off",
                createdAt: serverTimestamp()
            });
            showPending();
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        console.error("Erro de autenticação:", error);
        showMessage(firebaseErrorMessage(error));
    } finally {
        isCreatingProfile = false;
        setFormBusy(false);
    }
});

logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    emailInput.value = "";
    passwordInput.value = "";
    showLogin();
});

async function startAuthentication() {
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
        console.warn("Não foi possível guardar a sessão neste dispositivo:", error);
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            showLogin();
            return;
        }

        if (isCreatingProfile) return;

        try {
            const profileSnapshot = await getDoc(doc(db, "users", user.uid));
            const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
            const isApproved = profile.aceite === "on" || profile.aceite === true;

            if (isApproved) {
                window.location.assign("index.html");
            } else {
                showPending();
            }
        } catch (error) {
            console.error("Erro ao verificar o perfil:", error);
            showMessage("Não foi possível verificar as permissões da conta.");
            showLogin();
        }
    });
}

startAuthentication();
