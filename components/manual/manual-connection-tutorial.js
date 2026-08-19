const ABAS_REAIS = Object.freeze([
    'hub', 'neuronios', 'associar', 'topicos',
    'referencias', 'glosa', 'codex', 'files'
]);

const GUIA_TOTAIS = Object.freeze({
    hub: 2,
    neuronios: 5,
    associar: 2,
    topicos: 3,
    referencias: 3,
    glosa: 2,
    codex: 2,
    files: 2
});

let limparDemonstracaoAtual = () => {};

function definirAba(root, aba) {
    if (!ABAS_REAIS.includes(aba)) return;

    root.querySelectorAll('[data-manual-link-tab]').forEach(tab => {
        const ativa = tab.dataset.manualLinkTab === aba;
        tab.classList.toggle('is-active', ativa);
        tab.setAttribute('aria-selected', String(ativa));
        tab.tabIndex = ativa ? 0 : -1;
    });

    root.querySelectorAll('[data-manual-link-panel]').forEach(panel => {
        const ativo = panel.dataset.manualLinkPanel === aba;
        panel.hidden = !ativo;
        panel.classList.toggle('is-active', ativo);
    });
}

function alterarTexto(root, seletor, texto) {
    root.querySelector(seletor)?.replaceChildren(document.createTextNode(texto));
}

function realcar(root, elemento) {
    if (!elemento) return;
    elemento.classList.add('is-tutorial-focus');
}

function escreverExemplo(input, valor) {
    if (!input) return;
    input.value = valor;
    input.classList.toggle('has-value', Boolean(valor.trim()));
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function reporEstadoDemonstracao(root) {
    root.querySelectorAll('.is-tutorial-focus').forEach(elemento => elemento.classList.remove('is-tutorial-focus'));

    const explorador = root.querySelector('[data-tutorial-result="explorer"]');
    if (explorador) explorador.hidden = true;
    const botaoExplorador = root.querySelector('[data-tutorial-action="show-explorer"]');
    if (botaoExplorador) botaoExplorador.textContent = 'Mostrar Explorador';
    alterarTexto(root, '[data-tutorial-status="explorer"]', 'Explorador fechado');

    const formularioTopicos = root.querySelector('[data-tutorial-result="topic-form"]');
    if (formularioTopicos) formularioTopicos.hidden = true;
    const campoSubtopico = root.querySelector('[data-tutorial-result="subtopic-field"]');
    if (campoSubtopico) campoSubtopico.hidden = true;
    const botaoTopicos = root.querySelector('[data-tutorial-action="toggle-topic-form"]');
    botaoTopicos?.classList.remove('is-complete');
    alterarTexto(root, '[data-tutorial-status="topic"]', 'Formulário fechado');

    root.querySelectorAll('input').forEach(input => {
        input.value = '';
        input.classList.remove('has-value');
    });

    root.querySelectorAll('[data-tutorial-action="add-glosa"], [data-tutorial-action="add-codex"]')
        .forEach(botao => botao.classList.remove('is-complete'));
    alterarTexto(root, '[data-tutorial-status="neuronios"]', 'A aguardar uma pesquisa.');
    alterarTexto(root, '[data-tutorial-status="reference"]', 'Escolhe uma das duas opções no editor para abrir o respectivo formulário.');
    alterarTexto(root, '[data-tutorial-status="glosa"]', 'Clica para ver o comportamento no editor.');
    alterarTexto(root, '[data-tutorial-status="codex"]', 'Clica para ver o comportamento no editor.');
}

function agendarDemonstracao(root, passos) {
    const temporizadores = [];
    passos.forEach(({ depois = 0, executar }) => {
        temporizadores.push(window.setTimeout(() => executar(), depois));
    });

    limparDemonstracaoAtual = () => {
        temporizadores.forEach(temporizador => window.clearTimeout(temporizador));
        root.querySelectorAll('.is-tutorial-focus').forEach(elemento => elemento.classList.remove('is-tutorial-focus'));
    };
}

function iniciarDemonstracao(root, aba) {
    limparDemonstracaoAtual();
    reporEstadoDemonstracao(root);

    const painel = root.querySelector(`[data-manual-link-panel="${aba}"]`);
    const foco = seletor => realcar(root, painel?.querySelector(seletor));
    const status = texto => alterarTexto(root, '[data-tutorial-status="auto"] span', texto);
    const guia = (passo, texto) => {
        status(texto);
        alterarTexto(root, '[data-tutorial-step]', `Passo ${passo}/${GUIA_TOTAIS[aba] || 1}`);
        alterarTexto(root, '[data-tutorial-message]', texto);
    };

    const demonstracoes = {
        hub: [
            { depois: 250, executar: () => { foco('.manual-real-empty'); guia(1, 'A verificar os vínculos da caixa seleccionada…'); } },
            { depois: 1200, executar: () => guia(2, 'Sem vínculos nesta demonstração: o Hub mantém o estado vazio real.') }
        ],
        neuronios: [
            { depois: 250, executar: () => { foco('input[aria-label="Pesquisar texto bíblico"]'); guia(1, 'A seleccionar a pesquisa de texto bíblico.'); alterarTexto(root, '[data-tutorial-status="neuronios"]', 'A escrever um exemplo de pesquisa.'); } },
            { depois: 850, executar: () => { const input = painel?.querySelector('input[aria-label="Pesquisar texto bíblico"]'); escreverExemplo(input, 'Dan 1:1'); input?.focus(); guia(2, 'Exemplo escrito: “Dan 1:1”.'); } },
            { depois: 1700, executar: () => { foco('input[aria-label="Pesquisar tema Cosmos"]'); guia(3, 'A passar para a pesquisa de tema Cosmos.'); alterarTexto(root, '[data-tutorial-status="neuronios"]', 'Agora a pesquisa de tema fica pronta para receber texto.'); } },
            { depois: 2450, executar: () => { const input = painel?.querySelector('input[aria-label="Pesquisar tema Cosmos"]'); escreverExemplo(input, 'tema'); input?.focus(); guia(4, 'Exemplo escrito: “tema”.'); } },
            { depois: 3350, executar: () => guia(5, 'A aplicação real só apresenta resultados existentes na conta; o Manual não os inventa.') }
        ],
        associar: [
            { depois: 300, executar: () => { foco('[data-tutorial-action="show-explorer"]'); guia(1, 'A abrir o Explorador de associações.'); painel?.querySelector('[data-tutorial-action="show-explorer"]')?.click(); } },
            { depois: 1250, executar: () => guia(2, 'O Explorador está aberto; a árvore real é carregada a partir da conta.') }
        ],
        topicos: [
            { depois: 300, executar: () => { foco('[data-tutorial-action="toggle-topic-form"]'); guia(1, 'A abrir o formulário de Novo Vínculo.'); painel?.querySelector('[data-tutorial-action="toggle-topic-form"]')?.click(); } },
            { depois: 1050, executar: () => { foco('input[aria-label="Procurar tópico"]'); painel?.querySelector('input[aria-label="Procurar tópico"]')?.focus(); guia(2, 'Escreve e escolhe um tópico devolvido pela aplicação.'); } },
            { depois: 2050, executar: () => guia(3, 'O campo de subtópico só aparece depois de uma escolha real.') }
        ],
        referencias: [
            { depois: 300, executar: () => { foco('[data-tutorial-action="reference-full"]'); guia(1, 'A demonstrar a opção Referência Completa.'); painel?.querySelector('[data-tutorial-action="reference-full"]')?.click(); } },
            { depois: 1450, executar: () => { foco('[data-tutorial-action="reference-link"]'); guia(2, 'A demonstrar a opção Apenas Link Direto.'); painel?.querySelector('[data-tutorial-action="reference-link"]')?.click(); } },
            { depois: 2500, executar: () => guia(3, 'No editor, cada escolha abre o formulário correspondente.') }
        ],
        glosa: [
            { depois: 350, executar: () => { foco('[data-tutorial-action="add-glosa"]'); guia(1, 'A acrescentar uma caixa de glosa, como no editor.'); painel?.querySelector('[data-tutorial-action="add-glosa"]')?.click(); } },
            { depois: 1350, executar: () => guia(2, 'O editor permite até 5 caixas de glosa nesta caixa.') }
        ],
        codex: [
            { depois: 350, executar: () => { foco('[data-tutorial-action="add-codex"]'); guia(1, 'A criar um novo cartão de Mapeamento Codex.'); painel?.querySelector('[data-tutorial-action="add-codex"]')?.click(); } },
            { depois: 1350, executar: () => guia(2, 'No editor, o cartão fica pronto para receber a referência bibliográfica.') }
        ],
        files: [
            { depois: 300, executar: () => { foco('.manual-real-empty'); guia(1, 'A consultar a área de ficheiros associados.'); alterarTexto(root, '[data-tutorial-status="files"]', 'A aguardar o módulo de armazenamento.'); } },
            { depois: 1250, executar: () => guia(2, 'O conteúdo real é carregado pelo armazenamento; esta demonstração não cria ficheiros.') }
        ]
    };

    agendarDemonstracao(root, demonstracoes[aba] || []);
}

function configurarAcoes(root, onNavigate) {
    root.querySelectorAll('[data-manual-link-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            const aba = tab.dataset.manualLinkTab;
            definirAba(root, aba);
            iniciarDemonstracao(root, aba);
        });
    });

    root.querySelector('[data-tutorial-action="show-explorer"]')?.addEventListener('click', event => {
        const aberto = !root.querySelector('[data-tutorial-result="explorer"]')?.hidden;
        root.querySelector('[data-tutorial-result="explorer"]')?.toggleAttribute('hidden', aberto);
        event.currentTarget.textContent = aberto ? 'Mostrar Explorador' : 'Ocultar Explorador';
        alterarTexto(root, '[data-tutorial-status="explorer"]', aberto ? 'Explorador fechado' : 'Explorador aberto');
    });

    root.querySelector('[data-tutorial-action="toggle-topic-form"]')?.addEventListener('click', event => {
        const formulario = root.querySelector('[data-tutorial-result="topic-form"]');
        const aberto = !formulario?.hidden;
        formulario?.toggleAttribute('hidden', aberto);
        event.currentTarget.classList.toggle('is-complete', !aberto);
        alterarTexto(root, '[data-tutorial-status="topic"]', aberto ? 'Formulário fechado' : 'Formulário aberto');
    });

    root.querySelector('[data-tutorial-action="reference-full"]')?.addEventListener('click', () => {
        alterarTexto(root, '[data-tutorial-status="reference"]', 'No editor: abre o formulário de Referência Completa.');
    });
    root.querySelector('[data-tutorial-action="reference-link"]')?.addEventListener('click', () => {
        alterarTexto(root, '[data-tutorial-status="reference"]', 'No editor: abre o formulário Apenas Link Direto.');
    });

    root.querySelector('[data-tutorial-action="add-glosa"]')?.addEventListener('click', event => {
        event.currentTarget.classList.add('is-complete');
        alterarTexto(root, '[data-tutorial-status="glosa"]', 'No editor, acrescenta uma caixa de glosa até ao limite de 5.');
    });

    root.querySelector('[data-tutorial-action="add-codex"]')?.addEventListener('click', event => {
        event.currentTarget.classList.add('is-complete');
        alterarTexto(root, '[data-tutorial-status="codex"]', 'No editor, abre um novo cartão de Mapeamento Codex.');
    });

    root.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => input.classList.toggle('has-value', Boolean(input.value.trim())));
    });

    root.querySelector('[data-tutorial-action="voltar-caixas"]')?.addEventListener('click', () => onNavigate?.('caixas'));
}

export function inicializarTutorialLigacao({ onNavigate } = {}) {
    const root = document.getElementById('manual-ligacao-tutorial');
    if (!root || root.dataset.initializado === 'true') return () => {};

    root.dataset.initializado = 'true';
    configurarAcoes(root, onNavigate);
    definirAba(root, 'hub');
    iniciarDemonstracao(root, 'hub');
    window.selecionarAbaManualLigacao = aba => {
        definirAba(root, aba);
        iniciarDemonstracao(root, aba);
    };

    return () => {
        limparDemonstracaoAtual();
        delete root.dataset.initializado;
        delete window.selecionarAbaManualLigacao;
    };
}
