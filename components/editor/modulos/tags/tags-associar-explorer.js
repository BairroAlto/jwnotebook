import { collection, orderBy, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { hidratarNotaComCaixas, obterCaixasLocais } from '../../../local/caixas-repository.js';

function textoSeguro(valor, fallback = '') {
    const texto = String(valor ?? '').trim();
    return texto || fallback;
}

function criarIcone(classe) {
    const icone = document.createElement('i');
    icone.className = classe;
    icone.setAttribute('aria-hidden', 'true');
    return icone;
}

function criarLinhaToggle({ icon, titulo, detalhe = '', nivel, aberto = false, onToggle }) {
    const linha = document.createElement('button');
    linha.type = 'button';
    linha.className = 'associar-toggle-row';
    linha.style.setProperty('--associar-level', nivel);
    linha.setAttribute('aria-expanded', String(aberto));

    linha.appendChild(criarIcone('fa-solid fa-chevron-right associar-toggle-chevron'));
    linha.appendChild(criarIcone(icon));

    const textos = document.createElement('span');
    textos.className = 'associar-toggle-copy';
    const tituloEl = document.createElement('strong');
    tituloEl.textContent = titulo;
    textos.appendChild(tituloEl);
    if (detalhe) {
        const detalheEl = document.createElement('small');
        detalheEl.textContent = detalhe;
        textos.appendChild(detalheEl);
    }
    linha.appendChild(textos);
    linha.addEventListener('click', onToggle);
    return linha;
}

function criarMensagem(texto, nivel = 0) {
    const mensagem = document.createElement('p');
    mensagem.className = 'associar-explorer-message';
    mensagem.style.setProperty('--associar-level', nivel);
    mensagem.textContent = texto;
    return mensagem;
}

async function obterItensDoPai(state, paiId) {
    if (state.cache.has(paiId)) return state.cache.get(paiId);

    const { dbRef, authRef } = state.ctx;
    const userId = authRef.currentUser?.uid;
    if (!userId) return [];

    const consulta = query(
        collection(dbRef, 'Local'),
        where('pastapai', '==', paiId),
        where('userId', '==', userId),
        where('estado', '==', 'on'),
        orderBy('ordem', 'asc')
    );
    const snapshot = await getDocs(consulta);
    const itens = snapshot.docs.map(docSnap => ({ docIdFirebase: docSnap.id, ...docSnap.data() }));
    state.cache.set(paiId, itens);
    return itens;
}

function criarAcaoAssociarNota(item, state) {
    const acao = document.createElement('button');
    acao.type = 'button';
    acao.className = 'associar-node-action';
    acao.title = 'Associar nota';
    acao.setAttribute('aria-label', `Associar nota ${textoSeguro(item.nome, 'Sem título')}`);
    acao.appendChild(criarIcone('fa-solid fa-diagram-project'));
    acao.addEventListener('click', event => {
        event.stopPropagation();
        state.onVincular(item.docIdFirebase, textoSeguro(item.nome, 'Sem título'), 'nota', { entidade: 'nota' });
    });
    return acao;
}

async function renderizarCaixasNota(container, nota, nivel, state) {
    container.replaceChildren();
    const notaComCaixas = await hidratarNotaComCaixas(
        { ...nota, onde: 'local' },
        state.ctx.dbRef,
        state.ctx.authRef,
        nota.docIdFirebase
    );
    const caixas = (notaComCaixas.caixas || []).filter(caixa => caixa.estado === 'on');
    if (!caixas.length) {
        container.appendChild(criarMensagem('Esta nota não tem caixas activas.', nivel + 1));
        return;
    }

    caixas.forEach(caixa => {
        const config = state.identidade[caixa.tipo] || state.identidade.contentor;
        const linha = document.createElement('button');
        linha.type = 'button';
        linha.className = 'associar-box-row';
        linha.style.setProperty('--associar-level', nivel + 1);
        linha.appendChild(criarIcone(config.icon));
        linha.querySelector('i').style.color = config.cor;
        const resumo = textoSeguro(caixa.titulo, textoSeguro(caixa.conteudo, 'Bloco vazio').slice(0, 45));
        const texto = document.createElement('span');
        texto.textContent = resumo;
        linha.appendChild(texto);
        linha.appendChild(criarIcone('fa-solid fa-link'));
        linha.addEventListener('click', () => state.onVincular(caixa.id, resumo, caixa.tipo, { entidade: 'caixa', notaId: nota.docIdFirebase }));
        container.appendChild(linha);
    });
}

function criarNotaNode(nota, nivel, state) {
    const wrapper = document.createElement('div');
    wrapper.className = 'associar-node associar-note-node';

    const header = document.createElement('div');
    header.className = 'associar-note-header';
    const content = document.createElement('div');
    content.className = 'associar-node-content';
    content.hidden = true;

    const toggle = criarLinhaToggle({
        icon: 'fa-solid fa-file-lines',
        titulo: textoSeguro(nota.nome, 'Nota sem título'),
        detalhe: 'Mostrar caixas',
        nivel,
        onToggle: () => {
            const aberto = !content.hidden;
            content.hidden = aberto;
            toggle.setAttribute('aria-expanded', String(!aberto));
            toggle.classList.toggle('is-open', !aberto);
            if (!aberto && !content.dataset.carregado) {
                renderizarCaixasNota(content, nota, nivel, state);
                content.dataset.carregado = 'true';
            }
        }
    });
    header.append(toggle, criarAcaoAssociarNota(nota, state));
    wrapper.append(header, content);
    return wrapper;
}

function criarAcaoAssociarPasta(item, state) {
    const acao = document.createElement('button');
    acao.type = 'button';
    acao.className = 'associar-node-action';
    acao.title = 'Associar pasta';
    acao.setAttribute('aria-label', `Associar pasta ${textoSeguro(item.nome, 'Pasta sem nome')}`);
    acao.appendChild(criarIcone('fa-solid fa-diagram-project'));
    acao.addEventListener('click', event => {
        event.stopPropagation();
        state.onVincular(item.docIdFirebase || item.id, textoSeguro(item.nome, 'Pasta sem nome'), 'pasta', { entidade: 'pasta' });
    });
    return acao;
}
function criarPastaNode(pasta, nivel, state) {
    const wrapper = document.createElement('div');
    wrapper.className = 'associar-node associar-folder-node';
    const content = document.createElement('div');
    content.className = 'associar-node-content';
    content.hidden = true;

    const toggle = criarLinhaToggle({
        icon: 'fa-solid fa-folder',
        titulo: textoSeguro(pasta.nome, 'Pasta sem nome'),
        detalhe: 'Mostrar notas e subpastas',
        nivel,
        onToggle: async () => {
            const aberto = !content.hidden;
            content.hidden = aberto;
            toggle.setAttribute('aria-expanded', String(!aberto));
            toggle.classList.toggle('is-open', !aberto);
            if (!aberto && !content.dataset.carregado) {
                content.appendChild(criarMensagem('A carregar...', nivel + 1));
                try {
                    await renderizarNivel(content, pasta.docIdFirebase || pasta.id, nivel + 1, state);
                    content.dataset.carregado = 'true';
                } catch (error) {
                    console.error('Erro ao carregar a pasta do explorador:', error);
                    content.replaceChildren(criarMensagem('Não foi possível carregar esta pasta.', nivel + 1));
                }
            }
        }
    });
    const header = document.createElement('div');
    header.className = 'associar-folder-header';
    header.append(toggle, criarAcaoAssociarPasta(pasta, state));
    wrapper.append(header, content);
    return wrapper;
}

async function renderizarNivel(container, paiId, nivel, state) {
    container.replaceChildren();
    const itens = await obterItensDoPai(state, paiId);
    const pastas = itens.filter(item => item.tipo === 'pasta');
    const notas = itens.filter(item => item.tipo !== 'pasta');

    pastas.forEach(pasta => container.appendChild(criarPastaNode(pasta, nivel, state)));
    notas.forEach(nota => container.appendChild(criarNotaNode(nota, nivel, state)));

    if (!pastas.length && !notas.length) {
        container.appendChild(criarMensagem('Não existem itens nesta pasta.', nivel));
    }
}

function textoNormalizado(valor) {
    return String(valor ?? '').toLocaleLowerCase('pt-PT').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function criarResultadoPesquisa(item, tipo, titulo, detalhe, state, meta = {}) {
    const linha = document.createElement('button');
    linha.type = 'button';
    linha.className = 'associar-search-result';
    linha.appendChild(criarIcone(meta.icon || (tipo === 'pasta' ? 'fa-solid fa-folder' : 'fa-solid fa-file-lines')));
    const textos = document.createElement('span');
    textos.className = 'associar-search-result-copy';
    const nome = document.createElement('strong');
    nome.textContent = titulo;
    const info = document.createElement('small');
    info.textContent = detalhe;
    textos.append(nome, info);
    linha.appendChild(textos);
    linha.appendChild(criarIcone('fa-solid fa-link'));
    linha.addEventListener('click', () => state.onVincular(item.docIdFirebase || item.id, titulo, tipo, meta));
    return linha;
}

export async function pesquisarExploradorAssociar(ctx, termo, onVincular, identidade, containerId = 'arvore-associar-content') {
    const container = document.getElementById(containerId);
    const userId = ctx.authRef?.currentUser?.uid;
    const pesquisa = textoNormalizado(termo).trim();
    if (!container || !userId || !pesquisa) return;

    const { caixas: caixasLocais, notas } = await obterCaixasLocais(ctx.dbRef, userId);
    const state = { ctx, onVincular, identidade };
    const resultados = [];

    notas.forEach((dadosNota, notaId) => {
        if (dadosNota.estado !== 'on') return;
        const item = { docIdFirebase: notaId, ...dadosNota };
        const nome = textoSeguro(item.nome, item.tipo === 'pasta' ? 'Pasta sem nome' : 'Nota sem título');
        if (textoNormalizado(nome).includes(pesquisa)) {
            resultados.push({
                item,
                tipo: item.tipo === 'pasta' ? 'pasta' : 'nota',
                titulo: nome,
                detalhe: item.tipo === 'pasta' ? 'Pasta' : 'Nota',
                meta: { entidade: item.tipo === 'pasta' ? 'pasta' : 'nota' }
            });
        }

        if (item.tipo !== 'pasta') {
            caixasLocais
                .filter(caixa => caixa.localDocId === notaId && caixa.estado === 'on')
                .forEach(caixa => {
                    const titulo = textoSeguro(caixa.titulo, textoSeguro(caixa.conteudo, 'Bloco vazio').slice(0, 45));
                    if (textoNormalizado(titulo).includes(pesquisa)) {
                        resultados.push({
                            item: { ...item, id: caixa.id, docIdFirebase: caixa.id },
                            tipo: caixa.tipo,
                            titulo,
                            detalhe: nome,
                            meta: { entidade: 'caixa', notaId }
                        });
                    }
                });
        }
    });

    container.replaceChildren();
    if (!resultados.length) {
        container.appendChild(criarMensagem('Não foram encontrados conteúdos.', 0));
        return;
    }
    resultados.forEach(resultado => container.appendChild(criarResultadoPesquisa(
        resultado.item,
        resultado.tipo,
        resultado.titulo,
        resultado.detalhe,
        state,
        resultado.meta
    )));
}
export async function carregarExploradorAssociar(ctx, onVincular, identidade, containerId = 'arvore-associar-content') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = {
        ctx,
        onVincular,
        identidade,
        cache: new Map()
    };

    container.replaceChildren(criarMensagem('A carregar pastas...', 0));
    try {
        await renderizarNivel(container, 'root', 0, state);
    } catch (error) {
        console.error('Erro ao carregar o explorador de associações:', error);
        container.replaceChildren(criarMensagem('Erro ao carregar as pastas.', 0));
    }
}
