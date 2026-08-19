import {
    abrirConfiguradorInspirador,
    criarPreferenciasInspiradorIniciais,
    obterChaveGeracaoInspirador,
    obterCitacoesInspirador,
    obterImagemCitacaoInspirador,
    limparTextoCitacaoInspirador,
    normalizarPreferenciasInspirador
} from '../../inspirador/inspirador-service.js';
import { iniciarSelecaoFerramentas } from './tool-selection.js';

const COR_INSPIRADOR = '#26915d';
const COR_INSPIRADOR_CLARA = '#bbf7d0';
const GRADIENTE_INSPIRADOR = 'linear-gradient(135deg, #ffffff 0%, #dcfce7 52%, #86efac 100%)';

function criarMensagem(texto, cor = '#b6d7c2') {
    const mensagem = document.createElement('div');
    mensagem.textContent = texto;
    mensagem.style.cssText = `padding:18px; text-align:center; color:${cor}; font-size:11px; font-style:italic; line-height:1.5;`;
    return mensagem;
}

function criarCartaoCitacao(citacao, grelha) {
    const textoLimpo = limparTextoCitacaoInspirador(citacao.texto);
    if (!textoLimpo) return null;

    const cartao = document.createElement('article');
    cartao.className = `inspirador-citacao${grelha ? ' inspirador-citacao--grelha' : ''}`;
    if (grelha) {
        cartao.style.backgroundImage = `linear-gradient(180deg, rgba(8, 47, 32, .1), rgba(8, 47, 32, .88)), url("${obterImagemCitacaoInspirador(citacao)}")`;
    }

    const icone = document.createElement('i');
    icone.className = 'fa-solid fa-quote-left inspirador-citacao__icon';
    icone.setAttribute('aria-hidden', 'true');
    const texto = document.createElement('p');
    texto.className = 'inspirador-citacao__texto';
    texto.textContent = `“${textoLimpo}”`;
    const autor = document.createElement('strong');
    autor.className = 'inspirador-citacao__autor';
    autor.textContent = citacao.autor || 'Autor desconhecido';

    cartao.append(icone, texto, autor);
    return cartao;
}

function criarCorpo(citacoes, preferencias) {
    const corpo = document.createElement('div');
    corpo.className = `inspirador-corpo inspirador-corpo--${preferencias.vista}`;
    citacoes.forEach(citacao => {
        const cartao = criarCartaoCitacao(citacao, preferencias.vista === 'grelha');
        if (cartao) corpo.appendChild(cartao);
    });
    return corpo;
}

export function criarInspirador(caixa, onAlterar, onApagar, onMover, onAddAbaixo) {
    iniciarSelecaoFerramentas();
    caixa.inspiradorPreferencias = normalizarPreferenciasInspirador(
        caixa.inspiradorPreferencias || criarPreferenciasInspiradorIniciais()
    );
    if (!Array.isArray(caixa.inspiradorCitacoes)) caixa.inspiradorCitacoes = [];

    const caixaDiv = document.createElement('section');
    caixaDiv.className = 'tool-interativa inspirador-ferramenta';
    caixaDiv.style.cssText = `
        margin-bottom:15px; overflow:hidden; position:relative;
        border:1px solid ${COR_INSPIRADOR_CLARA}aa; border-radius:14px;
        background:linear-gradient(145deg, rgba(255,255,255,.06) 0%, rgba(134,239,172,.12) 100%);
        transition:.3s;
    `;
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = '0 4px 22px rgba(134,239,172,.22)';
        caixaDiv.style.transform = 'translateY(-1px)';
        caixaDiv.style.borderColor = COR_INSPIRADOR_CLARA;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = 'none';
        caixaDiv.style.transform = 'translateY(0)';
        caixaDiv.style.borderColor = `${COR_INSPIRADOR_CLARA}aa`;
    };

    const header = document.createElement('div');
    header.className = 'tool-barra inspirador-ferramenta__header';
    header.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${GRADIENTE_INSPIRADOR}; color:#163329;`;
    header.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center; font-size:13px;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity:.8;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity:.8;"></i>
            <div style="width:1px; height:14px; background:rgba(38,145,93,.28); margin:0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color:${COR_INSPIRADOR}; font-size:15px;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar Inspirador" style="cursor:pointer; color:${COR_INSPIRADOR}; font-size:13px; margin-left:5px;"></i>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer; opacity:.85; font-size:12px; color:#b42318;"></i>
        </div>
    `;

    const corpo = document.createElement('div');
    corpo.className = 'inspirador-ferramenta__corpo';
    corpo.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:14px;';
    let pedidoAtual = 0;

    const renderizar = () => {
        corpo.replaceChildren();
        if (!caixa.inspiradorCitacoes.length) {
            corpo.appendChild(criarMensagem('A procurar frase inspiradora…', '#86efac'));
            return;
        }
        corpo.appendChild(criarCorpo(caixa.inspiradorCitacoes, caixa.inspiradorPreferencias));
    };

    const actualizarCitacoes = async () => {
        const pedido = ++pedidoAtual;
        const preferencias = normalizarPreferenciasInspirador(caixa.inspiradorPreferencias);
        const chave = obterChaveGeracaoInspirador(caixa, preferencias);
        if (caixa.inspiradorCacheKey === chave && caixa.inspiradorCitacoes.length) {
            renderizar();
            return;
        }

        corpo.replaceChildren(criarMensagem('A procurar frase inspiradora…', '#86efac'));
        try {
            const citacoes = await obterCitacoesInspirador(preferencias);
            if (pedido !== pedidoAtual) return;
            caixa.inspiradorCitacoes = citacoes;
            caixa.inspiradorCacheKey = chave;
            onAlterar(caixa);
            renderizar();
        } catch (erro) {
            if (pedido !== pedidoAtual) return;
            corpo.replaceChildren(criarMensagem('Não foi possível carregar as citações agora. Tenta novamente.', '#fecaca'));
            console.info('[INSPIRADOR] Falha ao carregar citações:', erro.message);
        }
    };

    header.querySelector('.btn-lupa').onclick = async () => {
        const configuracao = await abrirConfiguradorInspirador(caixa);
        if (!configuracao) return;
        caixa.inspiradorPreferencias = configuracao;
        caixa.inspiradorCitacoes = [];
        caixa.inspiradorCacheKey = null;
        onAlterar(caixa);
        await actualizarCitacoes();
    };
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, 'cima');
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, 'baixo');
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    caixaDiv.append(header, corpo);
    caixaDiv.refreshInspirador = actualizarCitacoes;
    renderizar();
    actualizarCitacoes();
    return caixaDiv;
}
