import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

export const LIMITE_ABAS_BROWSER = 15;

function normalizarOnde(valor) {
    return String(valor || '').toLowerCase() === 'share' ? 'share' : 'local';
}

export function normalizarAbasBrowser(valor) {
    const vistos = new Set();
    return (Array.isArray(valor) ? valor : [])
        .map(item => typeof item === 'string'
            ? { id: item, onde: 'local' }
            : { id: item?.id, onde: normalizarOnde(item?.onde) })
        .filter(item => {
            if (!item.id || vistos.has(String(item.id))) return false;
            vistos.add(String(item.id));
            return true;
        });
}

export function avaliarEspacoNasAbas(dadosNotaMae, notaId = null) {
    const abas = normalizarAbasBrowser(dadosNotaMae?.browser);
    const jaAberta = Boolean(notaId && abas.some(aba => aba.id === notaId));
    const total = 1 + abas.length;
    return {
        disponivel: jaAberta || total < LIMITE_ABAS_BROWSER,
        jaAberta,
        total,
        limite: LIMITE_ABAS_BROWSER,
        abas
    };
}

export async function garantirAbaBrowser({ db, colecaoMae, maeId, dadosNotaMae, notaId, onde }) {
    const estado = avaliarEspacoNasAbas(dadosNotaMae, notaId);
    if (!estado.disponivel) return estado;
    if (estado.jaAberta || notaId === maeId) return { ...estado, jaAberta: true };

    const browser = [...estado.abas, { id: notaId, onde: normalizarOnde(onde) }];
    await updateDoc(doc(db, colecaoMae, maeId), { browser });
    return { ...estado, jaAberta: false, browser, total: 1 + browser.length };
}

