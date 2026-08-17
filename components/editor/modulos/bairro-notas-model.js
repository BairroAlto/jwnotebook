export const CAMPO_NOTAS_BAIRRO = 'notasAnexadas';
export const CAMPO_HISTORICO_NOTAS_BAIRRO = 'historicoNotas';
export const LIMITE_NOTAS_POR_TAREFA = 15;
export const LIMITE_HISTORICO_NOTAS = 30;

function normalizarOrigem(valor) {
    return String(valor || '').toLowerCase() === 'share' ? 'share' : 'local';
}

function normalizarNota(nota) {
    const dados = typeof nota === 'string' ? { id: nota } : (nota || {});
    const id = dados.id || dados.docIdFirebase || dados.notaId;
    if (!id) return null;
    return {
        id: String(id),
        onde: normalizarOrigem(dados.onde),
        nome: String(dados.nome || 'Nota sem título'),
        origem: dados.origem === 'criada' ? 'criada' : 'anexada',
        anexadaEm: Number(dados.anexadaEm) || Date.now()
    };
}

export function garantirNotasAnexadas(filho) {
    if (!filho) return [];
    const vistos = new Set();
    filho[CAMPO_NOTAS_BAIRRO] = (Array.isArray(filho[CAMPO_NOTAS_BAIRRO])
        ? filho[CAMPO_NOTAS_BAIRRO]
        : [])
        .map(normalizarNota)
        .filter(nota => {
            if (!nota) return false;
            const chave = `${nota.onde}:${nota.id}`;
            if (vistos.has(chave)) return false;
            vistos.add(chave);
            return true;
        });
    return filho[CAMPO_NOTAS_BAIRRO];
}

export function anexarNotaAoFilho(filho, nota) {
    const notas = garantirNotasAnexadas(filho);
    const normalizada = normalizarNota(nota);
    if (!normalizada || notas.length >= LIMITE_NOTAS_POR_TAREFA) return false;
    if (notas.some(item => item.id === normalizada.id && item.onde === normalizada.onde)) return false;
    notas.push(normalizada);
    return normalizada;
}

export function removerNotaDoFilho(filho, nota) {
    const notas = garantirNotasAnexadas(filho);
    const indice = notas.findIndex(item => item.id === nota?.id && item.onde === normalizarOrigem(nota?.onde));
    if (indice < 0) return false;
    notas.splice(indice, 1);
    return true;
}

function normalizarRegistoHistorico(nota) {
    const normalizada = normalizarNota(nota);
    if (!normalizada) return null;
    const registo = {
        ...normalizada,
        removidaEm: Number(nota?.removidaEm) || Date.now()
    };
    if (nota?.estado === 'off') registo.estado = 'off';
    if (nota?.reciclagemPendente === true) registo.reciclagemPendente = true;
    return registo;
}

export function garantirHistoricoNotas(filho) {
    if (!filho) return [];
    const vistos = new Set();
    filho[CAMPO_HISTORICO_NOTAS_BAIRRO] = (Array.isArray(filho[CAMPO_HISTORICO_NOTAS_BAIRRO])
        ? filho[CAMPO_HISTORICO_NOTAS_BAIRRO]
        : [])
        .map(normalizarRegistoHistorico)
        .filter(nota => {
            if (!nota) return false;
            const chave = `${nota.onde}:${nota.id}`;
            if (vistos.has(chave)) return false;
            vistos.add(chave);
            return true;
        })
        .sort((a, b) => b.removidaEm - a.removidaEm);
    return filho[CAMPO_HISTORICO_NOTAS_BAIRRO];
}

export function registarNotaNoHistorico(filho, nota) {
    const normalizada = normalizarRegistoHistorico({ ...nota, removidaEm: Date.now() });
    if (!normalizada) return false;
    const historico = garantirHistoricoNotas(filho);
    const chave = `${normalizada.onde}:${normalizada.id}`;
    const semRegistoActual = historico.filter(item => `${item.onde}:${item.id}` !== chave);
    filho[CAMPO_HISTORICO_NOTAS_BAIRRO] = [normalizada, ...semRegistoActual]
        .slice(0, LIMITE_HISTORICO_NOTAS);
    return true;
}

export function reanexarNotaDoHistorico(filho, nota) {
    const anexada = anexarNotaAoFilho(filho, nota);
    if (!anexada) return false;
    const historico = garantirHistoricoNotas(filho);
    const indice = historico.findIndex(item => item.id === nota?.id && item.onde === normalizarOrigem(nota?.onde));
    if (indice >= 0) historico.splice(indice, 1);
    return true;
}

export function temNotaCriadaNoFilho(filho) {
    return Boolean(filho?.notaCriadaId) || garantirNotasAnexadas(filho).some(nota => nota.origem === 'criada');
}
