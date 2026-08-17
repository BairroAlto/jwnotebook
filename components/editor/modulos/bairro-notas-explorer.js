import { listarItensParaAnexar } from './bairro-notas-repository.js';

function criarIcone(classe) {
    const icone = document.createElement('i');
    icone.className = classe;
    icone.setAttribute('aria-hidden', 'true');
    return icone;
}

function criarBotaoAba(onde, activa, aoClicar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `bairro-notas-explorer-tab${activa ? ' active' : ''}`;
    botao.dataset.origem = onde;
    botao.appendChild(criarIcone(onde === 'local' ? 'fa-solid fa-house-user' : 'fa-solid fa-share-nodes'));
    botao.append(onde === 'local' ? 'Local' : 'Share');
    botao.addEventListener('click', aoClicar);
    return botao;
}

function obterPai(item, onde, uid) {
    return onde === 'share' ? item?.[uid]?.pastapai || 'home' : item.pastapai || 'root';
}

function obterOrdem(item, onde, uid) {
    return Number(onde === 'share' ? item?.[uid]?.ordem : item.ordem) || Number.MAX_SAFE_INTEGER;
}

function ordenarItens(itens, onde, uid) {
    return [...itens].sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === 'pasta' ? -1 : 1;
        return obterOrdem(a, onde, uid) - obterOrdem(b, onde, uid) ||
            String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-PT');
    });
}

function criarLinhaNota(nota, nivel, aoSeleccionar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'bairro-notas-explorer-item bairro-notas-explorer-item--nota';
    botao.style.setProperty('--bairro-notas-nivel', nivel);
    botao.appendChild(criarIcone('fa-solid fa-file-lines'));
    const nome = document.createElement('span');
    nome.textContent = nota.nome || 'Nota sem título';
    botao.append(nome, criarIcone('fa-solid fa-paperclip'));
    botao.addEventListener('click', () => aoSeleccionar(nota));
    return botao;
}

function renderizarNivel({ container, itens, paiId, nivel, onde, uid, abertos, aoSeleccionar }) {
    const filhos = ordenarItens(itens.filter(item => obterPai(item, onde, uid) === paiId), onde, uid);
    filhos.forEach(item => {
        if (item.tipo !== 'pasta') {
            container.appendChild(criarLinhaNota(item, nivel, aoSeleccionar));
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'bairro-notas-explorer-pasta';
        const aberto = abertos.has(item.id);
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'bairro-notas-explorer-item bairro-notas-explorer-item--pasta';
        botao.style.setProperty('--bairro-notas-nivel', nivel);
        botao.setAttribute('aria-expanded', String(aberto));
        botao.appendChild(criarIcone(`fa-solid ${aberto ? 'fa-chevron-down' : 'fa-chevron-right'}`));
        botao.appendChild(criarIcone('fa-solid fa-folder'));
        const nome = document.createElement('span');
        nome.textContent = item.nome || 'Pasta sem nome';
        botao.appendChild(nome);
        wrapper.appendChild(botao);

        const conteudo = document.createElement('div');
        conteudo.hidden = !aberto;
        if (aberto) renderizarNivel({
            container: conteudo,
            itens,
            paiId: item.id,
            nivel: nivel + 1,
            onde,
            uid,
            abertos,
            aoSeleccionar
        });
        wrapper.appendChild(conteudo);
        botao.addEventListener('click', () => {
            if (abertos.has(item.id)) abertos.delete(item.id);
            else abertos.add(item.id);
            conteudo.hidden = !conteudo.hidden;
            botao.setAttribute('aria-expanded', String(!conteudo.hidden));
            botao.firstElementChild.className = `fa-solid ${conteudo.hidden ? 'fa-chevron-right' : 'fa-chevron-down'}`;
            if (!conteudo.hidden) {
                conteudo.replaceChildren();
                renderizarNivel({
                    container: conteudo,
                    itens,
                    paiId: item.id,
                    nivel: nivel + 1,
                    onde,
                    uid,
                    abertos,
                    aoSeleccionar
                });
            }
        });
        container.appendChild(wrapper);
    });
}

export function abrirExploradorNotasBairro({ db, auth, notaActualId, idsExcluidos = [], aoSeleccionar }) {
    document.getElementById('popup-bairro-notas-explorer-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'popup-bairro-notas-explorer-overlay';
    overlay.className = 'popup-overlay active bairro-notas-explorer-overlay';
    const popup = document.createElement('div');
    popup.className = 'popup-content bairro-notas-explorer';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'popup-header bairro-notas-explorer-cabecalho';
    const titulo = document.createElement('h3');
    titulo.textContent = 'Anexar nota';
    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'bairro-notas-explorer-fechar';
    fechar.setAttribute('aria-label', 'Fechar explorador de notas');
    fechar.appendChild(criarIcone('fa-solid fa-xmark'));
    cabecalho.append(titulo, fechar);

    const corpo = document.createElement('div');
    corpo.className = 'bairro-notas-explorer-corpo';
    const tabs = document.createElement('div');
    tabs.className = 'bairro-notas-explorer-tabs';
    const arvore = document.createElement('div');
    arvore.className = 'bairro-notas-explorer-arvore';
    corpo.append(tabs, arvore);
    popup.append(cabecalho, corpo);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const uid = auth?.currentUser?.uid;
    const excluidos = new Set([...idsExcluidos, notaActualId].filter(Boolean).map(String));
    const abertos = { local: new Set(), share: new Set() };
    let origemActual = 'local';
    let carregamento = 0;

    const terminar = () => overlay.remove();
    const seleccionar = nota => {
        aoSeleccionar?.({ id: nota.id, onde: origemActual, nome: nota.nome || 'Nota sem título' });
        terminar();
    };
    const carregar = async onde => {
        origemActual = onde;
        const versao = ++carregamento;
        tabs.querySelectorAll('button').forEach(botao => botao.classList.toggle('active', botao.dataset.origem === onde));
        arvore.textContent = 'A carregar notas...';
        try {
            const itens = (await listarItensParaAnexar({ db, auth, onde }))
                .filter(item => item.tipo === 'pasta' || !excluidos.has(String(item.id)));
            if (versao !== carregamento) return;
            arvore.replaceChildren();
            renderizarNivel({
                container: arvore,
                itens,
                paiId: onde === 'share' ? 'home' : 'root',
                nivel: 0,
                onde,
                uid,
                abertos: abertos[onde],
                aoSeleccionar: seleccionar
            });
            if (!arvore.children.length) arvore.textContent = 'Não existem notas disponíveis.';
        } catch (erro) {
            console.error('[BAIRRO-NOTAS] Não foi possível carregar o explorador:', erro);
            if (versao === carregamento) arvore.textContent = 'Não foi possível carregar as notas.';
        }
    };

    tabs.append(
        criarBotaoAba('local', true, () => carregar('local')),
        criarBotaoAba('share', false, () => carregar('share'))
    );
    fechar.addEventListener('click', terminar);
    overlay.addEventListener('click', evento => {
        if (evento.target === overlay) terminar();
    });
    carregar('local');
    return overlay;
}
