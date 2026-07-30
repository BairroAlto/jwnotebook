import { CORES_BASE } from './paleta-cores.js';

const COR_PADRAO_BAIRRO = { code: '#c084fc', name: 'Púrpura claro' };
const CORES_EXTRAS_BAIRRO = [
    { code: '#000000', name: 'Preto' },
    { code: '#FFFFFF', name: 'Branco' },
    { code: '#8B4513', name: 'Castanho' },
    { code: '#0B1F4B', name: 'Azul escuro' }
];
const CORES_BAIRRO = [COR_PADRAO_BAIRRO, ...CORES_EXTRAS_BAIRRO, ...CORES_BASE];

function criarCartaoCor(caixa, cor, atualizar, fechar) {
    const selecionada = caixa.corBairro === cor.code;
    const cartao = document.createElement('button');
    cartao.type = 'button';
    cartao.className = `bairro-cor-item${selecionada ? ' selecionada' : ''}`;
    cartao.style.setProperty('--bairro-cor', cor.code);
    cartao.setAttribute('aria-pressed', String(selecionada));
    cartao.innerHTML = `
        <span class="bairro-cor-faixa"></span>
        <span class="bairro-cor-corpo">
            <span class="bairro-cor-amostra"></span>
            <span class="bairro-cor-nome">${cor.name}</span>
            ${selecionada ? '<i class="fa-solid fa-check bairro-cor-check" aria-hidden="true"></i>' : ''}
        </span>`;
    cartao.addEventListener('click', () => {
        caixa.corBairro = selecionada ? '#c084fc' : cor.code;
        caixa.corBairro = cor.code;
        atualizar?.(caixa);
        Array.from(document.querySelectorAll('.bairro-shell')).find(el => el.dataset.bairroId === String(caixa.id))?.style.setProperty('--bairro-cor', caixa.corBairro);
        fechar?.();
    });
    return cartao;
}

export function abrirPaletaBairro(caixa, onAtualizar) {
    const overlay = document.getElementById('popup-bairro-cores-overlay');
    const lista = document.getElementById('bairro-lista-cores');
    if (!overlay || !lista) return;

    lista.replaceChildren();
    CORES_BAIRRO.forEach(cor => lista.appendChild(criarCartaoCor(
        caixa,
        cor,
        onAtualizar,
        () => overlay.classList.remove('active')
    )));

    document.getElementById('btn-fechar-bairro-cores')?.addEventListener('click', () => overlay.classList.remove('active'), { once: true });
    overlay.classList.add('active');
}