export const CORES_FIRMAMENTO = [
    { nome: 'Preto', valor: '#050505', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Grafite', valor: '#1f2937', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Branco', valor: '#f8fafc', texto: '#0f172a', grupo: 'Cores sólidas' },
    { nome: 'Cinza', valor: '#64748b', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Vermelho', valor: '#b91c1c', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Laranja', valor: '#c2410c', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Castanho', valor: '#6b4226', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Âmbar', valor: '#d97706', texto: '#111827', grupo: 'Cores sólidas' },
    { nome: 'Amarelo', valor: '#facc15', texto: '#111827', grupo: 'Cores sólidas' },
    { nome: 'Verde', valor: '#15803d', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Esmeralda', valor: '#047857', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Azul', valor: '#1d4ed8', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Roxo', valor: '#7e22ce', texto: '#ffffff', grupo: 'Cores sólidas' },
    { nome: 'Rosa', valor: '#be185d', texto: '#ffffff', grupo: 'Cores sólidas' },

    { nome: 'Noite', valor: 'linear-gradient(135deg, #020617, #1e293b)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Oceano', valor: 'linear-gradient(135deg, #0f172a, #075985)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Aurora', valor: 'linear-gradient(135deg, #312e81, #0f766e)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Galáxia', valor: 'linear-gradient(135deg, #111827, #581c87)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Crepúsculo', valor: 'linear-gradient(135deg, #7c2d12, #4c1d95)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Pôr do sol', valor: 'linear-gradient(135deg, #dc2626, #f59e0b)', texto: '#111827', grupo: 'Gradientes' },
    { nome: 'Floresta', valor: 'linear-gradient(135deg, #052e16, #15803d)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Menta', valor: 'linear-gradient(135deg, #0f766e, #6ee7b7)', texto: '#06281f', grupo: 'Gradientes' },
    { nome: 'Céu', valor: 'linear-gradient(135deg, #0369a1, #7dd3fc)', texto: '#082f49', grupo: 'Gradientes' },
    { nome: 'Gelo', valor: 'linear-gradient(135deg, #e0f2fe, #c4b5fd)', texto: '#172554', grupo: 'Gradientes' },
    { nome: 'Lavanda', valor: 'linear-gradient(135deg, #6d28d9, #c084fc)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Rosa-dourado', valor: 'linear-gradient(135deg, #be185d, #fbbf24)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Carvão', valor: 'linear-gradient(135deg, #000000, #525252)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Metal', valor: 'linear-gradient(135deg, #334155, #cbd5e1)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Terra', valor: 'linear-gradient(135deg, #451a03, #a16207)', texto: '#ffffff', grupo: 'Gradientes' },
    { nome: 'Solar', valor: 'linear-gradient(135deg, #fde047, #fb7185)', texto: '#3f171d', grupo: 'Gradientes' }
];

const DESTAQUES_FIRMAMENTO = [
    '#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6',
    '#38bdf8', '#6366f1', '#a855f7', '#ec4899'
];

export function obterTextoFirmamento(cor) {
    return CORES_FIRMAMENTO.find(item => item.valor === cor)?.texto || '#ffffff';
}

function criarAmostra(item, selecionado, aoClicar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `firmamento-cor${selecionado ? ' selecionada' : ''}`;
    botao.title = item.nome;
    botao.innerHTML = `<span style="background:${item.valor}"></span><small>${item.nome}</small>`;
    botao.addEventListener('click', aoClicar);
    return botao;
}

export function abrirPaletaFirmamento(caixa, onAtualizar) {
    const overlay = document.getElementById('popup-firmamento-cores-overlay');
    const listaCores = document.getElementById('firmamento-lista-cores');
    const listaDestaques = document.getElementById('firmamento-lista-destaques');
    if (!overlay || !listaCores || !listaDestaques) return;

    const atualizar = () => {
        onAtualizar?.(caixa);
        window.atualizarFeedEGravarGlobal?.(false);
    };

    listaCores.replaceChildren();
    ['Cores sólidas', 'Gradientes'].forEach(grupo => {
        const titulo = document.createElement('p');
        titulo.className = 'firmamento-paleta-grupo';
        titulo.textContent = grupo;
        listaCores.appendChild(titulo);

        const grelha = document.createElement('div');
        grelha.className = 'firmamento-paleta-grid';
        CORES_FIRMAMENTO.filter(item => item.grupo === grupo).forEach(item => {
            grelha.appendChild(criarAmostra(item, caixa.corFirmamento === item.valor, () => {
                caixa.corFirmamento = item.valor;
                caixa.textoFirmamento = item.texto;
                atualizar();
                abrirPaletaFirmamento(caixa, onAtualizar);
            }));
        });
        listaCores.appendChild(grelha);
    });

    listaDestaques.replaceChildren();
    DESTAQUES_FIRMAMENTO.forEach(cor => {
        const item = { nome: cor, valor: cor };
        listaDestaques.appendChild(criarAmostra(item, caixa.destaques === cor, () => {
            caixa.destaques = caixa.destaques === cor ? '' : cor;
            atualizar();
            abrirPaletaFirmamento(caixa, onAtualizar);
        }));
    });

    const tabs = [...overlay.querySelectorAll('[data-firmamento-tab]')];
    const paineis = [...overlay.querySelectorAll('[data-firmamento-painel]')];
    const selecionarTab = alvo => {
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.firmamentoTab === alvo));
        paineis.forEach(painel => { painel.hidden = painel.dataset.firmamentoPainel !== alvo; });
    };
    tabs.forEach(tab => { tab.onclick = () => selecionarTab(tab.dataset.firmamentoTab); });
    selecionarTab('colorir');

    document.getElementById('btn-fechar-firmamento-cores').onclick = () => overlay.classList.remove('active');
    document.getElementById('btn-remover-destaque-firmamento').onclick = () => {
        caixa.destaques = '';
        atualizar();
        abrirPaletaFirmamento(caixa, onAtualizar);
    };
    overlay.classList.add('active');
}
