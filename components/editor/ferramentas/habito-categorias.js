import {
    actualizarCategoria,
    criarCategoria,
    limitarCategorias,
    removerCategoriaDoEstado
} from './habito-model.js';
import { criarBotaoIcone, criarMensagem } from './habito-view.js';

const COR_HABITO_CLARA = '#a78bfa';

export function criarGestorCategorias(estado, aoFechar, aoAlterar, aoApagar) {
    const painel = document.createElement('section');
    painel.className = 'habito-configurador';
    painel.setAttribute('aria-label', 'Configuração de categorias do Hábito');

    const cabecalho = document.createElement('div');
    cabecalho.className = 'habito-configurador__cabecalho';
    const titulo = document.createElement('div');
    const tituloPrincipal = document.createElement('strong');
    tituloPrincipal.textContent = 'Categorias';
    const subtitulo = document.createElement('span');
    subtitulo.textContent = 'Cria e organiza os hábitos que aparecem no calendário.';
    titulo.append(tituloPrincipal, subtitulo);
    const fechar = criarBotaoIcone('fa-xmark', 'Fechar configuração');
    fechar.addEventListener('click', aoFechar);
    cabecalho.append(titulo, fechar);

    const formulario = document.createElement('form');
    formulario.className = 'habito-configurador__formulario';
    const nome = document.createElement('input');
    nome.type = 'text';
    nome.maxLength = 42;
    nome.placeholder = 'Nome da categoria';
    nome.setAttribute('aria-label', 'Nome da nova categoria');
    const cor = document.createElement('input');
    cor.type = 'color';
    cor.value = COR_HABITO_CLARA;
    cor.title = 'Cor da categoria';
    cor.setAttribute('aria-label', 'Cor da categoria');
    const adicionar = document.createElement('button');
    adicionar.type = 'submit';
    adicionar.className = 'habito-configurador__adicionar';
    adicionar.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar';
    adicionar.disabled = estado.categorias.length >= limitarCategorias();
    formulario.append(nome, cor, adicionar);

    const lista = document.createElement('div');
    lista.className = 'habito-configurador__lista';

    const renderizarLista = () => {
        lista.replaceChildren();
        if (!estado.categorias.length) {
            lista.appendChild(criarMensagem('Ainda não existem categorias. Cria a primeira acima.', 'var(--text-muted)'));
            return;
        }

        estado.categorias.forEach(categoria => {
            const linha = document.createElement('div');
            linha.className = 'habito-configurador__linha';
            linha.style.setProperty('--habito-cor', categoria.cor);

            const ponto = document.createElement('span');
            ponto.className = 'habito-categoria-dot';
            ponto.setAttribute('aria-hidden', 'true');

            const nomeCategoria = document.createElement('input');
            nomeCategoria.type = 'text';
            nomeCategoria.value = categoria.nome;
            nomeCategoria.maxLength = 42;
            nomeCategoria.setAttribute('aria-label', `Nome de ${categoria.nome}`);

            const corEditar = document.createElement('input');
            corEditar.type = 'color';
            corEditar.value = categoria.cor;
            corEditar.title = `Cor de ${categoria.nome}`;

            const apagar = criarBotaoIcone('fa-trash-can', `Apagar ${categoria.nome}`, 'habito-configurador__apagar');
            const guardarAlteracao = () => {
                const mudouNome = nomeCategoria.value.trim() !== categoria.nome;
                const mudouCor = corEditar.value.toLowerCase() !== categoria.cor.toLowerCase();
                if (!mudouNome && !mudouCor) return;
                actualizarCategoria(estado, categoria.id, { nome: nomeCategoria.value, cor: corEditar.value });
                aoAlterar();
                renderizarLista();
            };

            nomeCategoria.addEventListener('change', guardarAlteracao);
            nomeCategoria.addEventListener('blur', guardarAlteracao);
            corEditar.addEventListener('change', guardarAlteracao);
            apagar.addEventListener('click', () => {
                if (!window.confirm(`Apagar a categoria “${categoria.nome}” e os seus registos?`)) return;
                removerCategoriaDoEstado(estado, categoria.id);
                aoApagar(categoria.id);
                renderizarLista();
            });
            linha.append(ponto, nomeCategoria, corEditar, apagar);
            lista.appendChild(linha);
        });
    };

    formulario.addEventListener('submit', evento => {
        evento.preventDefault();
        const nomeLimpo = nome.value.replace(/\s+/g, ' ').trim();
        if (!nomeLimpo) {
            nome.focus();
            return;
        }
        const nomeRepetido = estado.categorias.some(item => (
            item.nome.toLocaleLowerCase('pt-PT') === nomeLimpo.toLocaleLowerCase('pt-PT')
        ));
        if (nomeRepetido) {
            window.alert('Já existe uma categoria com esse nome.');
            return;
        }
        if (estado.categorias.length >= limitarCategorias()) return;
        estado.categorias.push(criarCategoria(nomeLimpo, cor.value, estado.categorias.length));
        nome.value = '';
        cor.value = COR_HABITO_CLARA;
        adicionar.disabled = estado.categorias.length >= limitarCategorias();
        aoAlterar();
        renderizarLista();
        nome.focus();
    });

    painel.append(cabecalho, formulario, lista);
    renderizarLista();
    return painel;
}
