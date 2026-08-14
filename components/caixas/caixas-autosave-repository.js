import { doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Mantém cada pedido bem abaixo do limite de 10 MiB do Firestore. Para notas
// excepcionalmente grandes, as caixas são sincronizadas primeiro e o documento
// principal só é actualizado no fim, continuando a ser a fonte compatível.
const MAX_OPERACOES_POR_LOTE = 350;

function valorParaEscrita(valor) {
    if (Array.isArray(valor)) return valor.map(valorParaEscrita);
    if (!valor || typeof valor !== "object") return valor;

    const prototipo = Object.getPrototypeOf(valor);
    if (prototipo !== Object.prototype && prototipo !== null) return valor;

    return Object.fromEntries(
        Object.entries(valor)
            .filter(([, item]) => item !== undefined)
            .map(([chave, item]) => [chave, valorParaEscrita(item)])
    );
}

function caixaNormalizada(caixa, metadados) {
    return valorParaEscrita({
        ...caixa,
        id: undefined,
        ...metadados,
        estado: caixa.estado || "on"
    });
}

function aplicarOperacao(lote, operacao) {
    if (operacao.tipo === "delete") lote.delete(operacao.referencia);
    else lote.set(operacao.referencia, operacao.dados, { merge: true });
}

async function confirmarOperacoesEmLotes(db, operacoes) {
    for (let indice = 0; indice < operacoes.length; indice += MAX_OPERACOES_POR_LOTE) {
        const lote = writeBatch(db);
        operacoes
            .slice(indice, indice + MAX_OPERACOES_POR_LOTE)
            .forEach(operacao => aplicarOperacao(lote, operacao));
        await lote.commit();
    }
}

/**
 * Persiste um autosave sem regravar todos os documentos de caixas.
 * O array `caixas` do documento principal é mantido por compatibilidade com os
 * leitores actuais; a colecção normalizada recebe apenas as caixas alteradas.
 */
export async function persistirAutosaveCaixas({
    db,
    colecaoNota,
    colecaoCaixas,
    notaId,
    userId,
    campoNotaId,
    caixas = [],
    idsAlterados = [],
    idsAnteriores = [],
    sincronizacaoCompleta = false,
    sincronizarListaCaixas = false,
    apagarRemovidas = false,
    camposNota = {}
}) {
    if (!db || !colecaoNota || !colecaoCaixas || !notaId || !userId || !campoNotaId) {
        throw new Error("Contexto de persistência de caixas incompleto.");
    }

    const caixasValidas = caixas.filter(caixa => caixa?.id);
    const ids = [...new Set(caixasValidas.map(caixa => String(caixa.id)))];
    const idsAlvo = sincronizacaoCompleta
        ? new Set(ids)
        : new Set(idsAlterados.filter(Boolean).map(String));
    const metadados = { userId, [campoNotaId]: notaId };

    const operacoes = caixasValidas
        .filter(caixa => idsAlvo.has(String(caixa.id)))
        .map(caixa => ({
            tipo: "set",
            referencia: doc(db, colecaoCaixas, String(caixa.id)),
            dados: caixaNormalizada(caixa, metadados)
        }));

    if (sincronizacaoCompleta && apagarRemovidas) {
        const idsActuais = new Set(ids);
        [...new Set(idsAnteriores.filter(Boolean).map(String))]
            .filter(id => !idsActuais.has(id))
            .forEach(id => operacoes.push({
                tipo: "delete",
                referencia: doc(db, colecaoCaixas, id)
            }));
    }

    const payloadNota = valorParaEscrita(camposNota);
    if (sincronizarListaCaixas) {
        Object.assign(payloadNota, {
            caixas: valorParaEscrita(caixasValidas),
            CaixasOut: ids,
            caixaIds: ids,
            caixasMigradas: true
        });
    }

    const referenciaNota = doc(db, colecaoNota, notaId);

    // O caso normal (uma caixa alterada) permanece atómico com a nota principal.
    if (operacoes.length < MAX_OPERACOES_POR_LOTE) {
        const lote = writeBatch(db);
        operacoes.forEach(operacao => aplicarOperacao(lote, operacao));
        lote.update(referenciaNota, payloadNota);
        await lote.commit();
    } else {
        // Uma nota que exceda o lote seguro mantém o documento principal intacto
        // até todas as caixas terem sido sincronizadas.
        await confirmarOperacoesEmLotes(db, operacoes);
        const loteNota = writeBatch(db);
        loteNota.update(referenciaNota, payloadNota);
        await loteNota.commit();
    }

    return {
        ids,
        caixasEscritas: operacoes.filter(operacao => operacao.tipo === "set").length,
        caixasRemovidas: operacoes.filter(operacao => operacao.tipo === "delete").length,
        escritasEstimadas: operacoes.length + 1
    };
}
