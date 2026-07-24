import { garantirEstruturaElevador, criarIdElevador } from '../../constants/elevador.js';
import { criarBotaoElevador, criarGrupoControlosElevador } from './elevador-controls.js';
import { renderizarEstruturaElevador } from './elevador-renderer.js';

function criarSeparador() {
    const separador = document.createElement('span');
    separador.className = 'elevador-separator';
    separador.setAttribute('aria-hidden', 'true');
    return separador;
}

function criarCabecalhoElevador(caixa, callbacks) {
    const { onApagar, onPartilhar, onMover, onTags, onAddAbaixo } = callbacks;
    const header = document.createElement('header');
    header.className = 'elevador-header';

    const esquerda = criarGrupoControlosElevador();
    esquerda.classList.add('elevador-header-group');
    esquerda.appendChild(criarBotaoElevador({ icon: 'fa-solid fa-chevron-up', label: 'Mover ferramenta para cima', onClick: () => onMover(caixa, 'cima') }));
    esquerda.appendChild(criarBotaoElevador({ icon: 'fa-solid fa-chevron-down', label: 'Mover ferramenta para baixo', onClick: () => onMover(caixa, 'baixo') }));
    esquerda.appendChild(criarSeparador());
    esquerda.appendChild(criarBotaoElevador({ icon: 'fa-solid fa-plus', label: 'Inserir ferramenta abaixo', className: 'elevador-control--add', onClick: () => onAddAbaixo(caixa.id) }));
    esquerda.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-folder-plus',
        label: 'Adicionar barra pai',
        className: 'elevador-control--danger',
        onClick: () => {
            caixa.pastapai.push({ id: criarIdElevador(), nome: '', oculto: false, links: [], pastafilho: [] });
            callbacks.renderizarEstrutura();
            callbacks.onTextoAlterado(caixa);
        }
    }));

    const direita = criarGrupoControlosElevador();
    direita.classList.add('elevador-header-group');
    direita.appendChild(criarBotaoElevador({ icon: 'fa-solid fa-tag', label: 'Tópicos', className: 'elevador-control--muted', onClick: () => onTags(caixa) }));
    direita.appendChild(criarBotaoElevador({ icon: 'fa-solid fa-paper-plane', label: 'Partilhar', className: 'elevador-control--muted', onClick: () => onPartilhar(caixa) }));
    direita.appendChild(criarBotaoElevador({ icon: 'fa-solid fa-trash', label: 'Ocultar Elevador', className: 'elevador-control--danger', onClick: () => onApagar(caixa) }));

    header.append(esquerda, direita);
    return header;
}

/** Cria o Elevador de referências e a sua estrutura hierárquica editável. */
export function criarElevadorVermelho(caixa, onTextoAlterado, onApagar, onPaleta, onPartilhar, onMover, onTags, onAddAbaixo) {
    garantirEstruturaElevador(caixa);

    const caixaDiv = document.createElement('section');
    caixaDiv.className = 'elevador-shell';
    const meuUid = window.authInstance?.currentUser?.uid;
    const estaBloqueadoPorOutro = Boolean(caixa.bloqueio && caixa.bloqueio.userId !== meuUid);
    const isShare = window.dadosNotaOriginal?.onde === 'share';

    if (isShare && estaBloqueadoPorOutro) {
        caixaDiv.style.opacity = '0.5';
        caixaDiv.style.pointerEvents = 'none';
        const aviso = document.createElement('div');
        aviso.className = 'elevador-lock-warning';
        const icone = document.createElement('i');
        icone.className = 'fa-solid fa-lock';
        icone.setAttribute('aria-hidden', 'true');
        aviso.append(icone, ` EM EDIÇÃO POR: ${String(caixa.bloqueio.userName || 'Outro utilizador')}`);
        caixaDiv.appendChild(aviso);
    }

    const corpo = document.createElement('div');
    corpo.className = 'elevador-body';
    let renderizarEstrutura;
    const callbacks = {
        onTextoAlterado,
        renderizarEstrutura: () => renderizarEstrutura(),
        onApagar,
        onPartilhar,
        onMover,
        onTags,
        onAddAbaixo
    };

    renderizarEstrutura = renderizarEstruturaElevador({
        caixa,
        corpo,
        onTextoAlterado,
        bloqueio: { isShare, estaBloqueadoPorOutro }
    });

    const header = criarCabecalhoElevador(caixa, callbacks);
    caixaDiv.append(header, corpo);
    return caixaDiv;
}
