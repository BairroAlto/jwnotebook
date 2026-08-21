import { obterEstatisticasHabito } from './habito-model.js';
import { criarGestorCategorias } from './habito-categorias.js';

function criarIndicador(rotulo, valor, detalhe, classe = '') {
    const indicador = document.createElement('div');
    indicador.className = `habito-estatistica-cartao ${classe}`.trim();

    const nome = document.createElement('span');
    nome.className = 'habito-estatistica-cartao__rotulo';
    nome.textContent = rotulo;
    const numero = document.createElement('strong');
    numero.className = 'habito-estatistica-cartao__valor';
    numero.textContent = String(valor);
    const nota = document.createElement('small');
    nota.textContent = detalhe;
    indicador.append(nome, numero, nota);
    return indicador;
}

function criarEstatisticas(estado) {
    const painel = document.createElement('section');
    painel.className = 'habito-estatisticas-painel';
    painel.setAttribute('aria-label', 'Estatísticas dos hábitos');

    const estatisticas = obterEstatisticasHabito(estado);
    const introducao = document.createElement('div');
    introducao.className = 'habito-popup__introducao';
    const titulo = document.createElement('strong');
    titulo.textContent = 'Progresso dos hábitos';
    const descricao = document.createElement('span');
    descricao.textContent = 'Resumo dos estados registados nas tuas categorias.';
    introducao.append(titulo, descricao);

    const grelha = document.createElement('div');
    grelha.className = 'habito-estatisticas-grelha';
    grelha.append(
        criarIndicador('Feito', estatisticas.feito, 'registos concluídos', 'is-feito'),
        criarIndicador('Não', estatisticas.nao, 'registos recusados', 'is-nao'),
        criarIndicador('Passo', estatisticas.passo, 'registos adiados', 'is-passo'),
        criarIndicador('Dias', estatisticas.diasRegistados, 'dias com atividade', 'is-dias')
    );

    const resumo = document.createElement('div');
    resumo.className = 'habito-estatisticas-resumo';
    resumo.innerHTML = `<span>Taxa de conclusão</span><strong>${estatisticas.taxaFeito}%</strong>`;
    const progresso = document.createElement('div');
    progresso.className = 'habito-estatisticas-progresso';
    const progressoValor = document.createElement('span');
    progressoValor.style.width = `${estatisticas.taxaFeito}%`;
    progresso.appendChild(progressoValor);
    resumo.appendChild(progresso);

    const tituloCategorias = document.createElement('h4');
    tituloCategorias.textContent = 'Por categoria';
    const lista = document.createElement('div');
    lista.className = 'habito-estatisticas-categorias';
    if (!estatisticas.categorias.length) {
        lista.appendChild(document.createTextNode('Ainda não existem categorias.'));
    } else {
        estatisticas.categorias.forEach(item => {
            const linha = document.createElement('div');
            linha.className = 'habito-estatisticas-categoria';
            linha.style.setProperty('--habito-cor', item.categoria.cor);
            const nome = document.createElement('strong');
            nome.textContent = item.categoria.nome;
            const dados = document.createElement('span');
            dados.textContent = `${item.feito} feitos · ${item.nao} não · ${item.passo} passo`;
            const sequencia = document.createElement('small');
            sequencia.textContent = item.sequencia ? `${item.sequencia} dia${item.sequencia === 1 ? '' : 's'} seguidos` : 'Sem sequência atual';
            linha.append(nome, dados, sequencia);
            lista.appendChild(linha);
        });
    }

    painel.append(introducao, grelha, resumo, tituloCategorias, lista);
    return painel;
}

export function abrirPopupHabito(estado, { aoAlterar, aoApagar } = {}) {
    document.getElementById('popup-habito-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'popup-habito-overlay';
    overlay.className = 'popup-overlay active';
    overlay.style.zIndex = '10030';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Configuração do Hábito');

    const popup = document.createElement('div');
    popup.className = 'popup-content habito-popup';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'popup-header habito-popup__cabecalho';
    cabecalho.innerHTML = `
        <div>
            <span class="habito-popup__eyebrow">Ferramenta</span>
            <h3>Hábito</h3>
        </div>
        <button type="button" data-habito-fechar aria-label="Fechar Hábito"><i class="fa-solid fa-xmark"></i></button>
    `;

    const tabs = document.createElement('div');
    tabs.className = 'habito-popup__tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Secções do Hábito');
    tabs.innerHTML = `
        <button type="button" class="habito-popup__tab" data-habito-tab="estatisticas" role="tab" aria-selected="false"><i class="fa-solid fa-chart-line"></i> Estatísticas</button>
        <button type="button" class="habito-popup__tab is-active" data-habito-tab="categorias" role="tab" aria-selected="true"><i class="fa-solid fa-list-check"></i> Categorias</button>
    `;

    const corpo = document.createElement('div');
    corpo.className = 'habito-popup__corpo';
    const painelEstatisticas = criarEstatisticas(estado);
    painelEstatisticas.hidden = true;
    const painelCategorias = document.createElement('section');
    painelCategorias.className = 'habito-popup__painel habito-popup__painel--categorias';
    const actualizarEstatisticas = () => {
        const novoPainel = criarEstatisticas(estado);
        novoPainel.hidden = painelEstatisticas.hidden;
        painelEstatisticas.replaceChildren(...novoPainel.childNodes);
    };

    const fechar = () => {
        document.removeEventListener('keydown', aoTecla);
        overlay.remove();
    };
    const aoTecla = evento => {
        if (evento.key === 'Escape') fechar();
    };

    painelCategorias.appendChild(criarGestorCategorias(
        estado,
        fechar,
        () => {
            aoAlterar?.();
            actualizarEstatisticas();
        },
        categoriaId => {
            aoApagar?.(categoriaId);
            actualizarEstatisticas();
        }
    ));
    corpo.append(painelEstatisticas, painelCategorias);
    popup.append(cabecalho, tabs, corpo);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const seleccionarTab = tabEscolhida => {
        const alvo = tabEscolhida.dataset.habitoTab;
        tabs.querySelectorAll('[data-habito-tab]').forEach(tab => {
            const ativo = tab === tabEscolhida;
            tab.classList.toggle('is-active', ativo);
            tab.setAttribute('aria-selected', String(ativo));
        });
        painelEstatisticas.hidden = alvo !== 'estatisticas';
        painelCategorias.hidden = alvo !== 'categorias';
    };
    tabs.querySelectorAll('[data-habito-tab]').forEach(tab => {
        tab.addEventListener('click', () => seleccionarTab(tab));
    });
    cabecalho.querySelector('[data-habito-fechar]').addEventListener('click', fechar);
    overlay.addEventListener('click', evento => {
        if (evento.target === overlay) fechar();
    });
    document.addEventListener('keydown', aoTecla);
    return fechar;
}
