const MENSAGEM_SERVIDOR_INDISPONIVEL =
    "SERVIDOR EM BAIXO, NÃO UTILIZE A PLATAFORMA PARA ESCREVER. CONTATE O ADMINISTRADOR. PEDIMOS DESCULPA.";

const CODIGOS_SERVIDOR_INDISPONIVEL = new Set([
    "resource-exhausted",
    "unavailable",
    "deadline-exceeded",
    "internal"
]);

function obterCodigo(erro) {
    return String(erro?.code || "").split("/").pop().toLowerCase();
}

export function erroIndicaServidorIndisponivel(erro) {
    const codigo = obterCodigo(erro);
    if (CODIGOS_SERVIDOR_INDISPONIVEL.has(codigo)) return true;

    const mensagem = String(erro?.message || erro || "").toLowerCase();
    return mensagem.includes("quota exceeded") ||
        mensagem.includes("resource exhausted") ||
        mensagem.includes("using maximum backoff delay");
}

function criarBanner() {
    let banner = document.getElementById("server-status-banner");
    if (banner) return banner;

    banner = document.createElement("div");
    banner.id = "server-status-banner";
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "assertive");
    banner.textContent = MENSAGEM_SERVIDOR_INDISPONIVEL;
    document.body.appendChild(banner);
    return banner;
}

export function mostrarAvisoServidorIndisponivel(erro = null) {
    if (erro && !erroIndicaServidorIndisponivel(erro)) return false;
    const banner = criarBanner();
    banner.hidden = false;
    document.documentElement.classList.add("servidor-indisponivel");
    return true;
}

function instalarMonitorErros() {
    if (window.__monitorServidorIndisponivelInstalado) return;
    window.__monitorServidorIndisponivelInstalado = true;

    window.addEventListener("unhandledrejection", evento => {
        mostrarAvisoServidorIndisponivel(evento.reason);
    });

    window.addEventListener("error", evento => {
        mostrarAvisoServidorIndisponivel(evento.error || evento.message);
    });

    // O Firestore também regista falhas internas diretamente na consola, sem
    // as entregar sempre como uma rejeição da aplicação. Monitorizamos apenas
    // mensagens que identifiquem uma quota/capacidade esgotada.
    ["error", "warn"].forEach(tipo => {
        const consolaOriginal = console[tipo].bind(console);
        console[tipo] = (...argumentos) => {
            if (argumentos.some(erroIndicaServidorIndisponivel)) {
                mostrarAvisoServidorIndisponivel(argumentos.find(erroIndicaServidorIndisponivel));
            }
            consolaOriginal(...argumentos);
        };
    });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
    instalarMonitorErros();
}

export { MENSAGEM_SERVIDOR_INDISPONIVEL };
