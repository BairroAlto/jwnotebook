import { iniciarSelecaoFerramentas } from './tool-selection.js';
import {
    definirEstadoNoDia,
    obterDiasHabito,
    obterDataHoje,
    obterSemanaHabito,
    normalizarEstadoHabito
} from './habito-model.js';
import { abrirPopupHabito } from './habito-popup.js';
import {
    criarBarraSemana,
    criarBotaoIcone,
    criarCabecalhoSemana,
    criarFiltrosCategorias,
    criarLinhaCategoria,
    criarMensagem
} from './habito-view.js';

const COR_HABITO_CLARA = '#a78bfa';
const GRADIENTE_HABITO = 'linear-gradient(135deg, #312e81 0%, #7c3aed 100%)';
const VERSAO_ESTILOS_HABITO = '20260821-habito-10';

function garantirEstilosHabito() {
    if (document.querySelector('link[data-habito-style]')) return;
    const estilo = document.createElement('link');
    estilo.rel = 'stylesheet';
    estilo.href = new URL(`./habito.css?v=${VERSAO_ESTILOS_HABITO}`, import.meta.url).href;
    estilo.dataset.habitoStyle = VERSAO_ESTILOS_HABITO;
    document.head.appendChild(estilo);
}

export function criarHabito(caixa, onAlterar, onApagar, onMover, onAddAbaixo) {
    garantirEstilosHabito();
    iniciarSelecaoFerramentas();
    caixa.habito = normalizarEstadoHabito(caixa.habito);

    let semanaDeslocacao = 0;
    let diaAberto = null;
    let categoriaFiltro = null;

    const caixaDiv = document.createElement('section');
    caixaDiv.className = 'tool-interativa';
    caixaDiv.style.cssText = `
        margin-bottom:15px; overflow:hidden; position:relative;
        border:1px solid ${COR_HABITO_CLARA}88; border-radius:14px;
        background:linear-gradient(145deg, rgba(30,27,75,.42) 0%, rgba(124,58,237,.12) 100%);
        transition:.3s;
    `;
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = '0 4px 20px rgba(124,58,237,.32)';
        caixaDiv.style.transform = 'translateY(-1px)';
        caixaDiv.style.borderColor = COR_HABITO_CLARA;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = 'none';
        caixaDiv.style.transform = 'translateY(0)';
        caixaDiv.style.borderColor = `${COR_HABITO_CLARA}88`;
    };

    const header = document.createElement('div');
    header.className = 'tool-barra';
    header.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${GRADIENTE_HABITO}; color:white;`;
    header.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center; font-size:13px;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity:.8;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity:.8;"></i>
            <div style="width:1px; height:14px; background:rgba(255,255,255,.22); margin:0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color:#bbf7d0; font-size:15px;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar categorias" style="cursor:pointer; color:white; font-size:13px; margin-left:5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer; opacity:.85; font-size:12px; color:#fecaca;"></i>
    `;

    const corpo = document.createElement('div');
    corpo.className = 'habito-corpo';
    corpo.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:14px;';

    const abrirConfigurador = () => {
        diaAberto = null;
        abrirPopupHabito(caixa.habito, {
            aoAlterar: () => {
                onAlterar(caixa);
                renderizar();
            },
            aoApagar: categoriaId => {
                if (categoriaFiltro === categoriaId) categoriaFiltro = null;
                onAlterar(caixa);
                renderizar();
            }
        });
    };

    const renderizar = () => {
        corpo.replaceChildren();
        const hojeChave = obterDataHoje();
        const semanaCompleta = obterSemanaHabito(hojeChave, semanaDeslocacao);
        const semana = obterDiasHabito(hojeChave, semanaDeslocacao, 2)
            .map(dia => ({ ...dia, isFuturo: semanaDeslocacao === 0 && dia.chave > hojeChave }));

        const lista = document.createElement('div');
        lista.className = 'habito-lista-categorias';
        lista.appendChild(criarBarraSemana(
            semanaCompleta,
            semanaDeslocacao,
            () => {
                semanaDeslocacao -= 1;
                diaAberto = null;
                renderizar();
            },
            () => {
                semanaDeslocacao = Math.min(0, semanaDeslocacao + 1);
                diaAberto = null;
                renderizar();
            },
            () => {
                semanaDeslocacao = 0;
                diaAberto = null;
                renderizar();
            }
        ));
        lista.appendChild(criarFiltrosCategorias(caixa.habito, categoriaFiltro, filtro => {
            categoriaFiltro = filtro;
            diaAberto = null;
            renderizar();
        }));
        lista.appendChild(criarCabecalhoSemana(semana));

        if (!semana.length) {
            lista.appendChild(criarMensagem('Ainda não existem dias disponíveis para esta semana.', COR_HABITO_CLARA));
        } else if (!caixa.habito.categorias.length) {
            lista.appendChild(criarMensagem('Clica na lupa para criares a primeira categoria.', COR_HABITO_CLARA));
        } else {
            const categoriasVisiveis = categoriaFiltro
                ? caixa.habito.categorias.filter(categoria => categoria.id === categoriaFiltro)
                : caixa.habito.categorias;
            categoriasVisiveis.forEach(categoria => {
                lista.appendChild(criarLinhaCategoria(
                    categoria,
                    semana,
                    caixa.habito,
                    diaAberto,
                    (data, categoriaId) => {
                        diaAberto = diaAberto?.data === data && diaAberto?.categoriaId === categoriaId
                            ? null
                            : { data, categoriaId };
                        renderizar();
                    },
                    (data, categoriaId, novoEstado) => {
                        definirEstadoNoDia(caixa.habito, data, categoriaId, novoEstado);
                        diaAberto = null;
                        onAlterar(caixa);
                        renderizar();
                    },
                    (data, categoriaId) => {
                        definirEstadoNoDia(caixa.habito, data, categoriaId, null);
                        diaAberto = null;
                        onAlterar(caixa);
                        renderizar();
                    }
                ));
            });
        }

        corpo.appendChild(lista);
    };

    header.querySelector('.btn-lupa').onclick = abrirConfigurador;
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, 'cima');
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, 'baixo');
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    caixaDiv.append(header, corpo);
    renderizar();
    return caixaDiv;
}
