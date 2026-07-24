import { CORES_BASE, guardarNomeDestaque, obterNomeDestaque } from './paleta-cores.js';

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

function criarCartaoDestaque(corObj, selecionado, aoSelecionar, aoEditar) {
    const cartao = document.createElement('div');
    cartao.className = 'card-cor-item';
    cartao.style.cssText = `display:flex; flex-direction:column; background:${selecionado ? 'rgba(255,255,255,0.08)' : 'var(--bg-panel)'}; border:2px solid ${selecionado ? corObj.code : 'transparent'}; border-radius:6px; overflow:hidden; cursor:pointer; transition:0.2s; margin-bottom:5px;`;

    const faixa = document.createElement('div');
    faixa.style.cssText = `height:8px; width:100%; background-color:${corObj.code};`;

    const area = document.createElement('div');
    area.className = 'click-area';
    area.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 10px; gap:10px;';

    const identidade = document.createElement('div');
    identidade.style.cssText = 'display:flex; align-items:center; gap:10px; pointer-events:none; flex:1; overflow:hidden;';
    const amostra = document.createElement('div');
    amostra.style.cssText = `width:18px; height:18px; border-radius:50%; background:${corObj.code}; display:flex; align-items:center; justify-content:center; flex-shrink:0;`;
    if (selecionado) {
        const check = document.createElement('i');
        check.className = 'fa-solid fa-check';
        check.style.cssText = 'color:white; font-size:9px;';
        amostra.appendChild(check);
    }
    const nome = document.createElement('span');
    nome.textContent = obterNomeDestaque(corObj.code, corObj.name);
    nome.style.cssText = `font-size:12px; font-weight:600; color:${selecionado ? 'white' : 'var(--text-muted)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
    identidade.append(amostra, nome);

    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'btn-edit-cor';
    editar.title = 'Editar nome da cor';
    editar.setAttribute('aria-label', 'Editar nome da cor');
    editar.style.cssText = 'border:0; background:transparent; font-size:11px; color:var(--primary); opacity:0.5; padding:5px; cursor:pointer;';
    editar.appendChild(document.createElement('i'));
    editar.firstChild.className = 'fa-solid fa-pen';

    area.append(identidade, editar);
    area.addEventListener('click', event => {
        if (event.target.closest('.btn-edit-cor')) {
            event.stopPropagation();
            aoEditar(corObj, obterNomeDestaque(corObj.code, corObj.name));
            return;
        }
        aoSelecionar();
    });
    cartao.append(faixa, area);
    return cartao;
}

function obterCoresDestaque(caixa) {
    const atual = caixa.destaques;
    if (!atual || CORES_BASE.some(cor => cor.code === atual)) return CORES_BASE;
    return [{ code: atual, name: 'Destaque actual' }, ...CORES_BASE];
}
function abrirEditorNomeDestaque(caixa, corObj, nomeAtual, overlay, onAtualizar) {
    const editOverlay = document.getElementById('popup-editar-cor-overlay');
    const inputNome = document.getElementById('input-nome-cor');
    const amostra = document.getElementById('amostra-cor-edicao');
    const btnGuardar = document.getElementById('btn-guardar-nome-cor');
    const btnCancelar = document.getElementById('btn-cancelar-nome-cor');
    if (!editOverlay || !inputNome || !amostra || !btnGuardar || !btnCancelar) return;

    editOverlay.style.zIndex = '60000';
    amostra.style.backgroundColor = corObj.code;
    inputNome.value = nomeAtual;
    overlay.classList.remove('active');
    editOverlay.classList.add('active');

    btnGuardar.onclick = async () => {
        const guardado = await guardarNomeDestaque(corObj.code, inputNome.value);
        if (!guardado) return;
        editOverlay.classList.remove('active');
        abrirPaletaFirmamento(caixa, onAtualizar, 'destaques');
    };
    btnCancelar.onclick = () => {
        editOverlay.classList.remove('active');
        overlay.classList.add('active');
    };
    setTimeout(() => inputNome.focus(), 150);
}

export function abrirPaletaFirmamento(caixa, onAtualizar, abaInicial = 'colorir') {
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
                abrirPaletaFirmamento(caixa, onAtualizar, 'colorir');
            }));
        });
        listaCores.appendChild(grelha);
    });

    listaDestaques.replaceChildren();
    obterCoresDestaque(caixa).forEach(corObj => {
        listaDestaques.appendChild(criarCartaoDestaque(
            corObj,
            caixa.destaques === corObj.code,
            () => {
                caixa.destaques = caixa.destaques === corObj.code ? '' : corObj.code;
                atualizar();
                abrirPaletaFirmamento(caixa, onAtualizar, 'destaques');
            },
            (cor, nome) => abrirEditorNomeDestaque(caixa, cor, nome, overlay, onAtualizar)
        ));
    });

    const tabs = [...overlay.querySelectorAll('[data-firmamento-tab]')];
    const paineis = [...overlay.querySelectorAll('[data-firmamento-painel]')];
    const selecionarTab = alvo => {
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.firmamentoTab === alvo));
        paineis.forEach(painel => { painel.hidden = painel.dataset.firmamentoPainel !== alvo; });
    };
    tabs.forEach(tab => { tab.onclick = () => selecionarTab(tab.dataset.firmamentoTab); });
    selecionarTab(abaInicial);

    document.getElementById('btn-fechar-firmamento-cores').onclick = () => overlay.classList.remove('active');
    document.getElementById('btn-remover-destaque-firmamento').onclick = () => {
        caixa.destaques = '';
        atualizar();
        abrirPaletaFirmamento(caixa, onAtualizar, 'destaques');
    };
    overlay.classList.add('active');
}

