import {
    abrirConfiguradorTempo,
    carregarTempo,
    normalizarLocalizacaoTempo,
    normalizarOpcoesTempo,
    obterDiaAtual,
    obterIconeTempo
} from '../../weather/weather-service.js';
import { iniciarSelecaoFerramentas } from './tool-selection.js';

const COR_TEMPO = '#0ea5e9';
const COR_TEMPO_CLARA = '#7dd3fc';
const GRADIENTE_TEMPO = 'linear-gradient(135deg, #075985 0%, #0ea5e9 100%)';

function criarMensagem(texto, cor = 'var(--text-muted)') {
    const mensagem = document.createElement('div');
    mensagem.textContent = texto;
    mensagem.style.cssText = `padding:18px; text-align:center; color:${cor}; font-size:11px; font-style:italic;`;
    return mensagem;
}

function formatarNumero(valor, sufixo = '') {
    return Number.isFinite(Number(valor)) ? `${Math.round(Number(valor))}${sufixo}` : '—';
}

function formatarDiaTempo(valor) {
    const data = new Date(`${valor || ''}T12:00:00`);
    if (Number.isNaN(data.getTime())) return '';
    return new Intl.DateTimeFormat('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(data);
}

function criarDetalhe(rotulo, valor) {
    const detalhe = document.createElement('div');
    detalhe.style.cssText = 'padding:8px 9px; border:1px solid rgba(125,211,252,.18); border-radius:8px; background:rgba(14,165,233,.08);';

    const nome = document.createElement('small');
    nome.textContent = rotulo;
    nome.style.cssText = 'display:block; color:#bae6fd; font-size:9px; text-transform:uppercase;';

    const conteudo = document.createElement('strong');
    conteudo.textContent = valor;
    conteudo.style.cssText = 'display:block; margin-top:3px; color:var(--text-main); font-size:12px;';
    detalhe.append(nome, conteudo);
    return detalhe;
}

function criarCartaoTempo(dados, opcoes) {
    opcoes = normalizarOpcoesTempo(opcoes);
    const cartao = document.createElement('div');
    cartao.style.cssText = 'padding:14px; border:1px solid rgba(125,211,252,.28); border-radius:11px; background:linear-gradient(145deg, rgba(14,165,233,.16), rgba(8,47,73,.28));';

    const cabecalho = document.createElement('div');
    cabecalho.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px;';

    const local = document.createElement('div');
    const titulo = document.createElement('strong');
    titulo.textContent = dados.cidade || 'Cidade escolhida';
    titulo.style.cssText = 'display:block; color:var(--text-main); font-size:16px;';
    const subtitulo = document.createElement('small');
    subtitulo.textContent = [dados.regiao, dados.pais].filter(Boolean).join(' · ');
    subtitulo.style.cssText = 'display:block; margin-top:3px; color:#bae6fd; font-size:10px;';
    const dia = document.createElement('small');
    dia.textContent = formatarDiaTempo(dados.data);
    dia.style.cssText = 'display:block; margin-top:3px; color:#e0f2fe; font-size:10px; text-transform:capitalize;';
    local.append(titulo, subtitulo, dia);

    const icone = document.createElement('i');
    icone.className = `fa-solid ${obterIconeTempo(dados.codigo)}`;
    icone.style.cssText = 'color:#bae6fd; font-size:29px;';
    icone.style.display = opcoes.condicao ? '' : 'none';
    cabecalho.append(local, icone);

    const principal = document.createElement('div');
    principal.style.cssText = 'display:flex; align-items:baseline; gap:9px; margin:17px 0 4px;';
    const temperatura = document.createElement('strong');
    temperatura.textContent = formatarNumero(dados.temperatura, ' °C');
    temperatura.style.cssText = 'color:#e0f2fe; font-size:36px; line-height:1;';
    temperatura.style.display = opcoes.temperatura ? '' : 'none';
    const descricao = document.createElement('span');
    descricao.textContent = dados.descricao || 'Estado atual';
    descricao.style.cssText = 'color:#bae6fd; font-size:11px;';
    descricao.style.display = opcoes.condicao ? '' : 'none';
    principal.append(temperatura, descricao);
    principal.style.display = opcoes.temperatura || opcoes.condicao ? 'flex' : 'none';

    const detalhes = document.createElement('div');
    detalhes.style.cssText = 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:7px; margin-top:13px;';
    detalhes.append(
        criarDetalhe('Máxima', formatarNumero(dados.maxima, ' °C')),
        criarDetalhe('Mínima', formatarNumero(dados.minima, ' °C')),
        criarDetalhe('Vento', formatarNumero(dados.vento, ' km/h')),
        criarDetalhe('Sensação', formatarNumero(dados.sensacao, ' °C')),
        criarDetalhe('Humidade', formatarNumero(dados.humidade, ' %')),
        criarDetalhe('Chuva', formatarNumero(dados.probabilidadeChuva, ' %'))
    );
    [opcoes.maxima, opcoes.minima, opcoes.vento, opcoes.sensacao, opcoes.humidade, opcoes.chuva]
        .forEach((visivel, indice) => { detalhes.children[indice].style.display = visivel ? '' : 'none'; });
    detalhes.style.display = [opcoes.maxima, opcoes.minima, opcoes.vento, opcoes.sensacao, opcoes.humidade, opcoes.chuva].some(Boolean) ? 'grid' : 'none';

    cartao.append(cabecalho, principal, detalhes);
    return cartao;
}

export function criarTempo(caixa, onAlterar, onApagar, onMover, onAddAbaixo) {
    iniciarSelecaoFerramentas();
    caixa.tempoLocalizacao = normalizarLocalizacaoTempo(caixa.tempoLocalizacao);
    caixa.tempoOpcoes = normalizarOpcoesTempo(caixa.tempoOpcoes);
    const caixaDiv = document.createElement('section');
    caixaDiv.className = 'tool-interativa';
    caixaDiv.style.cssText = `
        margin-bottom:15px; overflow:hidden; position:relative;
        border:1px solid ${COR_TEMPO_CLARA}88; border-radius:14px;
        background:linear-gradient(145deg, rgba(8,47,73,.42) 0%, rgba(14,165,233,.13) 100%);
        transition:.3s;
    `;
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = '0 4px 20px rgba(14,165,233,.28)';
        caixaDiv.style.transform = 'translateY(-1px)';
        caixaDiv.style.borderColor = COR_TEMPO_CLARA;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = 'none';
        caixaDiv.style.transform = 'translateY(0)';
        caixaDiv.style.borderColor = `${COR_TEMPO_CLARA}88`;
    };

    const header = document.createElement('div');
    header.className = 'tool-barra';
    header.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${GRADIENTE_TEMPO}; color:white;`;
    header.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center; font-size:13px;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity:.8;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity:.8;"></i>
            <div style="width:1px; height:14px; background:rgba(255,255,255,.22); margin:0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color:#bbf7d0; font-size:15px;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar cidade" style="cursor:pointer; color:white; font-size:13px; margin-left:5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer; opacity:.85; font-size:12px; color:#fecaca;"></i>
    `;

    const corpo = document.createElement('div');
    corpo.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:14px;';
    let atualizacaoEmCurso = false;

    const renderizar = () => {
        const localizacao = normalizarLocalizacaoTempo(caixa.tempoLocalizacao);
        corpo.replaceChildren();
        if (!localizacao.cidade) {
            corpo.appendChild(criarMensagem('Clica na lupa para escolher uma cidade.', COR_TEMPO_CLARA));
            return;
        }

        const dados = caixa.tempoDados;
        const estaAtualizado = caixa.today === obterDiaAtual();
        if (!dados || !estaAtualizado) {
            corpo.appendChild(criarMensagem('A atualizar o tempo de hoje…', COR_TEMPO_CLARA));
            atualizarTempo();
            return;
        }
        corpo.appendChild(criarCartaoTempo(dados, caixa.tempoOpcoes));
    };

    const atualizarTempo = async () => {
        if (atualizacaoEmCurso) return;
        const localizacao = normalizarLocalizacaoTempo(caixa.tempoLocalizacao);
        if (!localizacao.cidade) return;
        atualizacaoEmCurso = true;
        try {
            caixa.tempoDados = await carregarTempo(localizacao);
            caixa.today = obterDiaAtual();
            onAlterar(caixa);
            renderizar();
        } catch (erro) {
            corpo.replaceChildren(criarMensagem('O tempo não pôde ser atualizado hoje. Tenta novamente.', '#bae6fd'));
            console.info('[TEMPO] Não foi possível atualizar:', erro.message);
        } finally {
            atualizacaoEmCurso = false;
        }
    };

    header.querySelector('.btn-lupa').onclick = async () => {
        const configuracao = await abrirConfiguradorTempo(caixa);
        if (!configuracao) return;
        caixa.tempoLocalizacao = configuracao.localizacao;
        caixa.tempoOpcoes = configuracao.opcoes;
        caixa.tempoDados = null;
        caixa.today = null;
        onAlterar(caixa);
        renderizar();
    };
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, 'cima');
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, 'baixo');
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    caixaDiv.append(header, corpo);
    caixaDiv.refreshTempo = atualizarTempo;
    renderizar();
    return caixaDiv;
}
