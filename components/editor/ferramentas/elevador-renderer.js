import { criarIdElevador, garantirEstruturaElevador, moverItem } from '../../constants/elevador.js';
import { criarBotaoElevador, criarCampoElevador, criarGrupoControlosElevador } from './elevador-controls.js';
import { tornarElevadorArrastavel } from './elevador-drag.js';

function alterarEstrutura(caixa, onTextoAlterado, renderizar) {
    onTextoAlterado(caixa);
    renderizar();
}

function configurarBloqueio(campo, { isShare, estaBloqueadoPorOutro, caixa }) {
    if (!isShare || estaBloqueadoPorOutro) return;
    campo.addEventListener('focus', () => window.definirBloqueioCaixa?.(caixa.id, true));
    campo.addEventListener('blur', () => window.definirBloqueioCaixa?.(caixa.id, false));
}

function criarControloMovimento(array, index, deslocamento, label, renderizar, caixa, onTextoAlterado, onAlterado = () => {}) {
    return criarBotaoElevador({
        icon: deslocamento < 0 ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down',
        className: 'elevador-control--move',
        label,
        disabled: index + deslocamento < 0 || index + deslocamento >= array.length,
        onClick: () => {
            if (moverItem(array, index, deslocamento)) { onAlterado(); alterarEstrutura(caixa, onTextoAlterado, renderizar); }
        }
    });
}

function criarInputUrl(item, classe, placeholder, caixa, onTextoAlterado) {
    const campo = criarCampoElevador({ value: item.url, placeholder, className: `${classe} elevador-url` });
    campo.addEventListener('input', event => {
        item.url = event.target.value;
        onTextoAlterado(caixa);
    });
    return campo;
}

function renderizarLink({ link, links, index, caixa, onTextoAlterado, renderizar, onLinkAlterado = () => {} }) {
    const linha = document.createElement('div');
    linha.className = 'elevador-link-row';
    const pega = document.createElement('span');
    linha.appendChild(pega);
    const campo = criarInputUrl(link, 'elevador-link-url', 'Link (URL)...', caixa, onTextoAlterado);
    campo.addEventListener('input', onLinkAlterado);
    linha.appendChild(campo);

    const controlos = criarGrupoControlosElevador();
    controlos.classList.add('elevador-link-controls');
    controlos.appendChild(criarControloMovimento(links, index, -1, 'Mover link para cima', renderizar, caixa, onTextoAlterado, onLinkAlterado));
    controlos.appendChild(criarControloMovimento(links, index, 1, 'Mover link para baixo', renderizar, caixa, onTextoAlterado, onLinkAlterado));
    controlos.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-trash',
        label: 'Remover link',
        className: 'elevador-control--danger',
        onClick: () => {
            links.splice(index, 1);
            onLinkAlterado();
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    linha.appendChild(controlos);
    tornarElevadorArrastavel({
        elemento: linha,
        pega,
        array: links,
        item: link,
        onMoved: () => { onLinkAlterado(); alterarEstrutura(caixa, onTextoAlterado, renderizar); }
    });
    return linha;
}
function renderizarFilho({ filho, filhos, index, caixa, onTextoAlterado, renderizar, bloqueio }) {
    const card = document.createElement('article');
    card.className = `elevador-child${filho.oculto ? ' elevador-child--hidden' : ''}`;
    const links = Array.isArray(filho.links) ? filho.links : [];
    const sincronizarUrlLegada = () => {
        filho.url = links[0]?.url || '';
    };

    const linha = document.createElement('div');
    linha.className = 'elevador-child-header';
    const pega = document.createElement('span');
    linha.appendChild(pega);

    if (filho.oculto) {
        const label = document.createElement('span');
        label.className = 'elevador-hidden-label';
        label.textContent = `Filho oculto: ${filho.nome || 'Sem nome'}`;
        linha.appendChild(label);
    } else {
        const nome = criarCampoElevador({ value: filho.nome, placeholder: 'Nome do filho...', className: 'elevador-child-name' });
        configurarBloqueio(nome, { ...bloqueio, caixa });
        nome.addEventListener('input', event => {
            filho.nome = event.target.value;
            onTextoAlterado(caixa);
        });
        linha.appendChild(nome);
    }

    const controlos = criarGrupoControlosElevador();
    controlos.classList.add('elevador-child-controls');
    controlos.appendChild(criarControloMovimento(filhos, index, -1, 'Mover filho para cima', renderizar, caixa, onTextoAlterado));
    controlos.appendChild(criarControloMovimento(filhos, index, 1, 'Mover filho para baixo', renderizar, caixa, onTextoAlterado));
    controlos.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-link',
        label: 'Adicionar link ao filho',
        className: 'elevador-control--add',
        onClick: () => {
            links.push({ id: criarIdElevador(), url: '' });
            sincronizarUrlLegada();
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    controlos.appendChild(criarBotaoElevador({
        icon: filho.oculto ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash',
        label: filho.oculto ? 'Mostrar filho' : 'Ocultar filho',
        className: 'elevador-control--muted',
        onClick: () => {
            filho.oculto = !filho.oculto;
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    controlos.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-trash',
        label: 'Remover filho',
        className: 'elevador-control--danger',
        onClick: () => {
            filhos.splice(index, 1);
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    linha.appendChild(controlos);
    card.appendChild(linha);

    if (!filho.oculto) {
        const linksContainer = document.createElement('div');
        linksContainer.className = 'elevador-child-links';
        links.forEach((link, linkIndex) => {
            const linhaLink = renderizarLink({
                link,
                links,
                index: linkIndex,
                caixa,
                onTextoAlterado,
                renderizar,
                onLinkAlterado: sincronizarUrlLegada
            });
            linksContainer.appendChild(linhaLink);
        });
        card.appendChild(linksContainer);
    }

    tornarElevadorArrastavel({
        elemento: card,
        pega,
        array: filhos,
        item: filho,
        onMoved: () => alterarEstrutura(caixa, onTextoAlterado, renderizar)
    });
    return card;
}
function renderizarPai({ pai, pais, index, caixa, corpo, onTextoAlterado, renderizar, bloqueio }) {
    const paiDiv = document.createElement('section');
    paiDiv.className = 'elevador-parent';

    const linha = document.createElement('div');
    linha.className = 'elevador-parent-header';
    const pega = document.createElement('span');
    linha.appendChild(pega);
    const nome = criarCampoElevador({ value: pai.nome, placeholder: 'Nome da barra pai...', className: 'elevador-parent-title', multiline: true });
    configurarBloqueio(nome, { ...bloqueio, caixa });
    nome.addEventListener('input', event => {
        pai.nome = event.target.value;
        event.target.style.height = 'auto';
        event.target.style.height = `${event.target.scrollHeight + 2}px`;
        onTextoAlterado(caixa);
    });
    linha.appendChild(nome);

    const controlos = criarGrupoControlosElevador();
    controlos.classList.add('elevador-parent-controls');
    controlos.appendChild(criarControloMovimento(pais, index, -1, 'Mover barra pai para cima', renderizar, caixa, onTextoAlterado));
    controlos.appendChild(criarControloMovimento(pais, index, 1, 'Mover barra pai para baixo', renderizar, caixa, onTextoAlterado));
    controlos.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-link',
        label: 'Adicionar link',
        className: 'elevador-control--muted',
        onClick: () => {
            pai.links.push({ id: criarIdElevador(), url: '' });
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    controlos.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-folder-tree',
        label: 'Adicionar filho',
        className: 'elevador-control--muted',
        onClick: () => {
            pai.pastafilho.push({ id: criarIdElevador(), nome: '', url: '', oculto: false });
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    controlos.appendChild(criarBotaoElevador({
        icon: pai.oculto ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash',
        label: pai.oculto ? 'Mostrar barra pai' : 'Ocultar barra pai',
        className: 'elevador-control--muted',
        onClick: () => {
            pai.oculto = !pai.oculto;
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    controlos.appendChild(criarBotaoElevador({
        icon: 'fa-solid fa-trash',
        label: 'Remover barra pai',
        className: 'elevador-control--danger',
        onClick: () => {
            pais.splice(index, 1);
            alterarEstrutura(caixa, onTextoAlterado, renderizar);
        }
    }));
    linha.appendChild(controlos);
    paiDiv.appendChild(linha);

    requestAnimationFrame(() => {
        nome.style.height = 'auto';
        nome.style.height = `${nome.scrollHeight + 2}px`;
    });

    if (!pai.oculto) {
        const conteudo = document.createElement('div');
        conteudo.className = 'elevador-content';
        pai.links.forEach((link, linkIndex) => {
            conteudo.appendChild(renderizarLink({ link, links: pai.links, index: linkIndex, caixa, onTextoAlterado, renderizar }));
        });
        pai.pastafilho.forEach((filho, filhoIndex) => {
            conteudo.appendChild(renderizarFilho({ filho, filhos: pai.pastafilho, index: filhoIndex, caixa, onTextoAlterado, renderizar, bloqueio }));
        });
        paiDiv.appendChild(conteudo);
    }

    tornarElevadorArrastavel({
        elemento: paiDiv,
        pega,
        array: pais,
        item: pai,
        onMoved: () => alterarEstrutura(caixa, onTextoAlterado, renderizar)
    });
    corpo.appendChild(paiDiv);
}

export function renderizarEstruturaElevador({ caixa, corpo, onTextoAlterado, bloqueio }) {
    garantirEstruturaElevador(caixa);

    const renderizar = () => {
        corpo.replaceChildren();
        caixa.pastapai.forEach((pai, index) => renderizarPai({
            pai,
            pais: caixa.pastapai,
            index,
            caixa,
            corpo,
            onTextoAlterado,
            renderizar,
            bloqueio
        }));
    };

    renderizar();
    return renderizar;
}







