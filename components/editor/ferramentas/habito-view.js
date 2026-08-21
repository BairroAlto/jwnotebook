import {
    ESTADOS_HABITO,
    formatarSemanaHabito,
    obterEstadoNoDia
} from './habito-model.js';

export function criarBotaoIcone(icon, titulo, classe = '') {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `habito-icon-button ${classe}`.trim();
    botao.title = titulo;
    botao.setAttribute('aria-label', titulo);
    botao.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
    return botao;
}

export function criarMensagem(texto, cor = 'var(--text-muted)') {
    const mensagem = document.createElement('div');
    mensagem.className = 'habito-mensagem';
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    return mensagem;
}

function criarOpcoesEstado(categoria, dia, estado, aoDefinirEstado, aoLimparEstado) {
    const painel = document.createElement('div');
    painel.className = 'habito-estados-dia';
    painel.setAttribute('aria-label', `Estado de ${categoria.nome} em ${dia.numero}`);

    const limpar = document.createElement('button');
    limpar.type = 'button';
    limpar.className = 'habito-dia-reset';
    limpar.textContent = `${dia.diaSemana.toLowerCase()}. ${dia.numero}`;
    limpar.title = 'Limpar o estado deste dia';
    limpar.setAttribute('aria-label', `Limpar o estado de ${dia.diaSemana} ${dia.numero}`);
    limpar.addEventListener('click', () => aoLimparEstado(dia.chave, categoria.id));
    painel.appendChild(limpar);

    const opcoes = [
        [ESTADOS_HABITO.feito, 'fa-check', 'Feito'],
        [ESTADOS_HABITO.nao, 'fa-xmark', 'Não'],
        [ESTADOS_HABITO.passo, 'fa-forward-step', 'Passo']
    ];
    const estadoActual = obterEstadoNoDia(estado, dia.chave, categoria.id);
    opcoes.forEach(([valor, icone, nome]) => {
        const botao = criarBotaoIcone(icone, nome, `habito-estado-opcao habito-estado-opcao--${valor}`);
        botao.classList.toggle('is-active', estadoActual === valor);
        botao.addEventListener('click', () => aoDefinirEstado(dia.chave, categoria.id, valor));
        painel.appendChild(botao);
    });
    return painel;
}

function criarDiaHabito(categoria, dia, estado, aoAbrirDia, diaAberto, aoDefinirEstado, aoLimparEstado) {
    const estadoDia = obterEstadoNoDia(estado, dia.chave, categoria.id);
    const coluna = document.createElement('div');
    coluna.className = 'habito-dia-coluna';

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `habito-dia-botao${estadoDia ? ` is-${estadoDia}` : ''}${dia.fimDeSemana ? ' is-weekend' : ''}${dia.isFuturo ? ' is-futuro' : ''}`;
    botao.style.setProperty('--habito-cor', categoria.cor);
    botao.setAttribute('aria-pressed', String(Boolean(estadoDia)));
    botao.setAttribute('aria-disabled', String(Boolean(dia.isFuturo)));
    botao.setAttribute('aria-label', `${categoria.nome} — ${dia.diaSemana} ${dia.numero}`);

    const numero = document.createElement('span');
    numero.textContent = String(dia.numero);
    botao.appendChild(numero);

    if (estadoDia) {
        const icones = {
            [ESTADOS_HABITO.feito]: 'fa-check',
            [ESTADOS_HABITO.nao]: 'fa-xmark',
            [ESTADOS_HABITO.passo]: 'fa-forward-step'
        };
        const marca = document.createElement('i');
        marca.className = `fa-solid ${icones[estadoDia]} habito-dia-botao__marca`;
        marca.setAttribute('aria-hidden', 'true');
        botao.appendChild(marca);
    }

    if (!dia.isFuturo) {
        botao.addEventListener('click', () => aoAbrirDia(dia.chave, categoria.id));
    } else {
        botao.disabled = true;
    }
    coluna.appendChild(botao);

    if (diaAberto?.data === dia.chave && diaAberto?.categoriaId === categoria.id) {
        coluna.classList.add('is-aberta');
        coluna.appendChild(criarOpcoesEstado(categoria, dia, estado, aoDefinirEstado, aoLimparEstado));
    }
    return coluna;
}

export function criarBarraSemana(semanaCompleta, deslocacao, aoAnterior, aoSeguinte, aoHoje) {
    const barra = document.createElement('div');
    barra.className = 'habito-semana-barra';

    const anterior = criarBotaoIcone('fa-chevron-left', 'Semana anterior');
    anterior.addEventListener('click', aoAnterior);

    const periodo = document.createElement('strong');
    periodo.textContent = formatarSemanaHabito(semanaCompleta);

    const hoje = document.createElement('button');
    hoje.type = 'button';
    hoje.className = 'habito-hoje-button';
    hoje.innerHTML = '<i class="fa-solid fa-calendar-day" aria-hidden="true"></i> Hoje';
    hoje.title = 'Voltar ao dia atual e cancelar a seleção';
    hoje.setAttribute('aria-label', 'Voltar ao dia atual e cancelar a seleção');
    hoje.addEventListener('click', aoHoje);

    const seguinte = criarBotaoIcone('fa-chevron-right', 'Semana seguinte');
    seguinte.disabled = deslocacao >= 0;
    seguinte.addEventListener('click', aoSeguinte);

    barra.append(anterior, periodo, hoje, seguinte);
    return barra;
}

export function criarCabecalhoSemana(semana) {
    const cabecalho = document.createElement('div');
    cabecalho.className = 'habito-semana-cabecalho';
    cabecalho.style.gridTemplateColumns = `repeat(${semana.length}, minmax(30px, 1fr))`;
    semana.forEach(dia => {
        const celula = document.createElement('div');
        celula.className = `habito-semana-cabecalho__dia${dia.fimDeSemana ? ' is-weekend' : ''}${dia.isFuturo ? ' is-futuro' : ''}`;
        celula.textContent = {
            Seg: 'seg.',
            Ter: 'ter.',
            Qua: 'qua.',
            Qui: 'qui.',
            Sex: 'sex.',
            Sáb: 'sáb.',
            Dom: 'dom.'
        }[dia.diaSemana] || dia.diaSemana;
        cabecalho.appendChild(celula);
    });
    return cabecalho;
}

export function criarFiltrosCategorias(estado, categoriaFiltro, aoSeleccionar) {
    const filtros = document.createElement('div');
    filtros.className = 'habito-filtros-categorias';

    const todos = document.createElement('button');
    todos.type = 'button';
    todos.className = `habito-filtro${!categoriaFiltro ? ' is-active' : ''}`;
    todos.textContent = 'All';
    todos.addEventListener('click', () => aoSeleccionar(null));
    filtros.appendChild(todos);

    estado.categorias.forEach(categoria => {
        const filtro = document.createElement('button');
        filtro.type = 'button';
        filtro.className = `habito-filtro${categoriaFiltro === categoria.id ? ' is-active' : ''}`;
        filtro.style.setProperty('--habito-cor', categoria.cor);
        filtro.innerHTML = '<i class="fa-solid fa-person-running" aria-hidden="true"></i>';
        filtro.appendChild(document.createTextNode(categoria.nome));
        filtro.addEventListener('click', () => aoSeleccionar(categoria.id));
        filtros.appendChild(filtro);
    });
    return filtros;
}

export function criarLinhaCategoria(categoria, semana, estado, diaAberto, aoAbrirDia, aoDefinirEstado, aoLimparEstado) {
    const linha = document.createElement('article');
    linha.className = 'habito-categoria-linha';
    linha.style.setProperty('--habito-cor', categoria.cor);

    const cabecalho = document.createElement('div');
    cabecalho.className = 'habito-categoria-linha__cabecalho';
    const nome = document.createElement('strong');
    nome.textContent = categoria.nome;
    cabecalho.append(nome);

    const dias = document.createElement('div');
    dias.className = 'habito-categoria-linha__dias';
    dias.style.gridTemplateColumns = `repeat(${semana.length}, minmax(30px, 1fr))`;
    semana.forEach(dia => dias.appendChild(
        criarDiaHabito(categoria, dia, estado, aoAbrirDia, diaAberto, aoDefinirEstado, aoLimparEstado)
    ));
    linha.append(cabecalho, dias);
    return linha;
}
