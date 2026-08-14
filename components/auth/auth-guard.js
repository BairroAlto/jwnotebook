import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * Guarda uma página que só deve aceitar interações depois de o Firebase
 * confirmar uma sessão autenticada.
 *
 * A segurança dos dados continua a ser garantida pelas regras do Firebase.
 * Esta guarda trata da experiência da página e impede interações acidentais
 * enquanto o ecrã de login está visível.
 */
export function criarGuardaDeAutenticacao({
    auth,
    loginSelector = '#login-screen',
    blockedClass = 'auth-page-blocked',
    protectedSelector = '',
    hideProtected = true
} = {}) {
    let utilizador = null;
    const loginRoot = document.querySelector(loginSelector);
    const protectedRoots = protectedSelector
        ? [...document.querySelectorAll(protectedSelector)]
        : [];

    document.body.classList.add(blockedClass);

    const actualizarEstado = (novoUtilizador) => {
        utilizador = novoUtilizador || null;
        document.body.classList.remove('auth-page-booting');
        document.body.classList.toggle(blockedClass, !utilizador);
        if (hideProtected) {
            protectedRoots.forEach((root) => root.classList.toggle('auth-protected-blocked', !utilizador));
        }
    };

    const removerCliqueAnonimo = (event) => {
        const alvo = event.target instanceof Element ? event.target : null;
        if (utilizador || alvo?.closest(loginSelector)) return;
        if (!loginRoot && (!protectedSelector || !alvo?.closest(protectedSelector))) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    const removerTeclaAnonima = (event) => {
        const alvo = event.target instanceof Element ? event.target : null;
        if (utilizador || alvo?.closest(loginSelector)) return;
        if (!loginRoot && (!protectedSelector || !alvo?.closest(protectedSelector))) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    document.addEventListener('click', removerCliqueAnonimo, true);
    document.addEventListener('keydown', removerTeclaAnonima, true);
    const pararObservacao = onAuthStateChanged(auth, actualizarEstado);

    return {
        obterUtilizador: () => utilizador,
        destruir() {
            pararObservacao();
            document.removeEventListener('click', removerCliqueAnonimo, true);
            document.removeEventListener('keydown', removerTeclaAnonima, true);
            document.body.classList.remove(blockedClass);
        }
    };
}
