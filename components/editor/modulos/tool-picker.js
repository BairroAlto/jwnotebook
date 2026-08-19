import { FERRAMENTAS_REGISTO } from '../../constants/ferramentas.js';

const ESTILO_ITEM = `
    display:flex; flex-direction:column; align-items:center; gap:8px;
    cursor:pointer; padding:12px 5px; border-radius:8px;
    background:rgba(255,255,255,0.03); border:1px solid var(--border-color);
    transition:0.2s;
`;

function criarItemFerramenta(ferramenta) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'tool-item';
    item.dataset.toolType = ferramenta.id;
    item.style.cssText = ESTILO_ITEM;
    item.setAttribute('aria-label', `Inserir ${ferramenta.nome}`);
    item.innerHTML = `
        <i class="${ferramenta.icon}" style="font-size:20px; color:${ferramenta.cor};"></i>
        <span style="font-size:8.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; text-align:center;">${ferramenta.nome}</span>
    `;
    item.addEventListener('click', () => window.inserirFerramentaNoEditor?.(ferramenta.id));
    return item;
}

export function inicializarSeletorFerramentas() {
    const lista = document.getElementById('popup-ferramentas-base-lista');
    if (!lista) return;

    const ferramentasBase = FERRAMENTAS_REGISTO.filter(ferramenta => !ferramenta.disponivelNaLoja);
    lista.replaceChildren(...ferramentasBase.map(criarItemFerramenta));

    document.querySelector('[data-fechar-ferramentas]')?.addEventListener('click', () => {
        document.getElementById('popup-ferramentas-inline')?.classList.remove('active');
    });
}
