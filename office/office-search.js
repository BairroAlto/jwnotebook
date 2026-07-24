import { normalizar } from './office-core.js';

export function filtrosAtivos(containerSelector) {
    const cards = Array.from(document.querySelectorAll(`${containerSelector} .piccard`));
    const active = cards.filter(card => card.classList.contains('active')).map(card => card.dataset.filter);
    return active.length ? active : cards.map(card => card.dataset.filter);
}

export function filtrarIndice(index, query, filtros, limit = 60) {
    const termo = normalizar(query);
    return index
        .filter(item => filtros.includes(item.filter) && normalizar(item.text).includes(termo))
        .slice(0, limit);
}
