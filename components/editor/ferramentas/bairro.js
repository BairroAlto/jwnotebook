import { garantirEstruturaBairro, criarPaiBairro } from '../../constants/bairro.js';
import { criarBotaoBairro, criarGrupoBairro } from './bairro-controls.js';
import { renderizarEstruturaBairro } from './bairro-renderer.js';

function separador() {
    const el = document.createElement('span');
    el.className = 'bairro-separador';
    el.setAttribute('aria-hidden', 'true');
    return el;
}

export function criarBairro(caixa, onTextoAlterado, onApagar, onPaleta, onMover, onAddAbaixo) {
    garantirEstruturaBairro(caixa);

    const bloco = document.createElement('section');
    bloco.className = 'bairro-shell';
    bloco.dataset.bairroId = caixa.id;
    bloco.style.setProperty('--bairro-cor', caixa.corBairro || '#c084fc');

    const cabecalho = document.createElement('header');
    cabecalho.className = 'bairro-header';
    const esquerda = criarGrupoBairro();
    esquerda.classList.add('bairro-header-group');
    esquerda.appendChild(criarBotaoBairro({ icon: 'fa-solid fa-chevron-up', label: 'Mover Bairro para cima', onClick: () => onMover(caixa, 'cima') }));
    esquerda.appendChild(criarBotaoBairro({ icon: 'fa-solid fa-chevron-down', label: 'Mover Bairro para baixo', onClick: () => onMover(caixa, 'baixo') }));
    esquerda.appendChild(separador());
    esquerda.appendChild(criarBotaoBairro({ icon: 'fa-solid fa-plus', label: 'Inserir ferramenta abaixo', className: 'bairro-control--add', onClick: () => onAddAbaixo(caixa.id) }));
    esquerda.appendChild(criarBotaoBairro({
        icon: 'fa-solid fa-building',
        label: 'Adicionar Grupo de Tarefas',
        className: 'bairro-control--add',
        onClick: () => {
            caixa.pastapai.push(criarPaiBairro());
            onTextoAlterado(caixa);
            renderizar();
        }
    }));

    const direita = criarGrupoBairro();
    direita.classList.add('bairro-header-group');
    direita.appendChild(criarBotaoBairro({ icon: 'fa-solid fa-palette', label: 'Colorir Bairro', className: 'bairro-control--muted', onClick: () => onPaleta(caixa) }));
    direita.appendChild(criarBotaoBairro({ icon: 'fa-solid fa-trash', label: 'Ocultar Bairro', className: 'bairro-control--danger', onClick: () => onApagar(caixa) }));
    cabecalho.append(esquerda, direita);

    const corpo = document.createElement('div');
    corpo.className = 'bairro-body';
    let renderizar = () => {};
    renderizar = renderizarEstruturaBairro({ caixa, corpo, onTextoAlterado });
    bloco.append(cabecalho, corpo);
    return bloco;
}