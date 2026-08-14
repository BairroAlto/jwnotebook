const CODIGOS_TRANSITORIOS = new Set([
    "aborted",
    "deadline-exceeded",
    "internal",
    "resource-exhausted",
    "unavailable"
]);

function codigoFirestore(erro) {
    return String(erro?.code || "").split("/").pop().toLowerCase();
}

function esperar(tempo) {
    return new Promise(resolve => setTimeout(resolve, tempo));
}

async function executarComBackoff(operacao, tentativas = 4) {
    let ultimoErro = null;

    for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
        try {
            return await operacao();
        } catch (erro) {
            ultimoErro = erro;
            const transitorio = CODIGOS_TRANSITORIOS.has(codigoFirestore(erro));
            if (!transitorio || tentativa === tentativas - 1) throw erro;

            const base = Math.min(800 * (2 ** tentativa), 6400);
            await esperar(base + Math.floor(Math.random() * 250));
        }
    }

    throw ultimoErro;
}

/**
 * Fila coalescente: nunca existem duas gravações do editor em simultâneo.
 * Se surgirem alterações durante uma gravação, é executado mais um ciclo com
 * o estado mais recente depois de o primeiro terminar.
 */
export function criarFilaPersistencia(executar) {
    let ultimoPedido = 0;
    let ultimoConcluido = 0;
    let emCurso = null;
    let aguardantes = [];

    const concluirAguardantes = (limite, resultado, erro = null) => {
        const concluidos = aguardantes.filter(item => item.pedido <= limite);
        aguardantes = aguardantes.filter(item => item.pedido > limite);
        concluidos.forEach(item => {
            if (erro) item.reject(erro);
            else item.resolve(resultado);
        });
    };

    const iniciar = () => {
        if (emCurso) return emCurso;

        emCurso = (async () => {
            let resultado = null;
            while (ultimoConcluido < ultimoPedido) {
                const pedidoAbrangido = ultimoPedido;
                try {
                    resultado = await executarComBackoff(executar);
                    ultimoConcluido = pedidoAbrangido;
                    concluirAguardantes(pedidoAbrangido, resultado);
                } catch (erro) {
                    // O estado do editor continua marcado como alterado. Os
                    // pedidos actuais terminam com erro e uma edição futura
                    // poderá iniciar uma nova tentativa controlada.
                    ultimoConcluido = ultimoPedido;
                    concluirAguardantes(ultimoConcluido, null, erro);
                    break;
                }
            }
            return resultado;
        })().finally(() => {
            emCurso = null;
            if (ultimoConcluido < ultimoPedido) iniciar();
        });

        return emCurso;
    };

    return {
        solicitar() {
            const pedido = ++ultimoPedido;
            const promessa = new Promise((resolve, reject) => {
                aguardantes.push({ pedido, resolve, reject });
            });
            iniciar();
            return promessa;
        },
        aguardar() {
            return emCurso || Promise.resolve();
        },
        estaEmCurso() {
            return Boolean(emCurso);
        }
    };
}
