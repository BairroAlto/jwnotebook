const COR_CONTENTOR = '#ea580c';

function gerarId() {
    return globalThis.crypto?.randomUUID?.()
        || `caixa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function criarCaixaAnotacao(overrides = {}) {
    return {
        id: gerarId(),
        tipo: 'contentor',
        titulo: '',
        conteudo: '',
        foco: 'original',
        destaques: '',
        estado: 'on',
        ordem: 1,
        timestamp: new Date().toISOString(),
        protecao: 'fechado',
        timedelete: null,
        fundir: [],
        ...overrides
    };
}

export function normalizarCaixas(caixas = [], legado = '') {
    const origem = Array.isArray(caixas) && caixas.length
        ? caixas
        : (String(legado || '').trim() ? [criarCaixaAnotacao({ conteudo: String(legado).trim() })] : []);

    return origem
        .filter((caixa) => caixa && typeof caixa === 'object')
        .map((caixa, indice) => criarCaixaAnotacao({
            ...caixa,
            id: String(caixa.id || gerarId()),
            tipo: caixa.tipo || 'contentor',
            titulo: String(caixa.titulo || ''),
            conteudo: String(caixa.conteudo || ''),
            foco: caixa.foco || 'original',
            destaques: caixa.destaques || '',
            estado: caixa.estado || 'on',
            ordem: Number(caixa.ordem) || indice + 1,
            timestamp: caixa.timestamp || new Date().toISOString(),
            protecao: caixa.protecao || 'fechado',
            timedelete: caixa.timedelete ?? null,
            fundir: Array.isArray(caixa.fundir) ? caixa.fundir : []
        }));
}

export function inicializarEditorAnotacoes({ addButton, list, onPartilhar }) {
    let caixas = [];

    function actualizarOrdem() {
        caixas.forEach((caixa, indice) => {
            caixa.ordem = indice + 1;
        });
    }

    function render() {
        if (!list) return;
        list.replaceChildren();
        if (addButton) addButton.disabled = caixas.length >= 1;

        caixas.forEach((caixa, indice) => {
            const card = document.createElement('article');
            card.className = 'task-annotation-card';
            card.style.setProperty('--task-annotation-accent', COR_CONTENTOR);
            card.style.setProperty('--task-annotation-accent-rgb', '234, 88, 12');
            card.dataset.annotationId = caixa.id;

            const header = document.createElement('header');
            header.className = 'task-annotation-card-head';
            header.innerHTML = `
                <span class="task-annotation-card-label">COMENTÁRIO</span>
                <div class="task-annotation-card-tools" aria-label="Ferramentas da anotação">
                    <button type="button" data-annotation-share aria-label="Partilhar anotação" title="Partilhar"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
                    <button type="button" aria-label="Destacar anotação" title="Destaque"><i class="fa-solid fa-palette" aria-hidden="true"></i></button>
                    <button type="button" class="task-annotation-remove" aria-label="Remover anotação" title="Remover"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
                </div>
            `;

            const body = document.createElement('div');
            body.className = 'task-annotation-card-body';
            if (caixa.destaques) body.style.background = caixa.destaques;

            const textarea = document.createElement('textarea');
            textarea.className = 'task-annotation-textarea';
            textarea.placeholder = 'Escreve aqui as tuas anotações…';
            textarea.value = caixa.conteudo;
            if (caixa.destaques) textarea.style.color = '#000';
            textarea.addEventListener('input', () => {
                caixa.conteudo = textarea.value;
                caixa.timestamp = new Date().toISOString();
            });

            body.append(textarea);
            card.append(header, body);
            list.append(card);

            header.querySelector('.task-annotation-remove')?.addEventListener('click', () => {
                caixas.splice(indice, 1);
                actualizarOrdem();
                render();
            });

            header.querySelector('[data-annotation-share]')?.addEventListener('click', () => {
                onPartilhar?.({ ...caixa, conteudo: textarea.value });
            });
        });
    }

    addButton?.addEventListener('click', (event) => {
        event.preventDefault();
        if (caixas.length >= 1) return;
        caixas.push(criarCaixaAnotacao({ ordem: caixas.length + 1 }));
        render();
        list?.lastElementChild?.querySelector('textarea')?.focus();
    });

    return {
        carregar(novasCaixas = [], legado = '') {
            caixas = normalizarCaixas(novasCaixas, legado).slice(0, 1);
            actualizarOrdem();
            render();
        },
        obterCaixas() {
            list?.querySelectorAll('.task-annotation-textarea').forEach((textarea, indice) => {
                const caixa = caixas[indice];
                if (!caixa) return;
                caixa.conteudo = textarea.value;
                caixa.timestamp = new Date().toISOString();
            });
            actualizarOrdem();
            const resultado = caixas.slice(0, 1).map((caixa) => ({ ...caixa, fundir: [...(caixa.fundir || [])] }));
            console.log('[CALENDARIO][ANOTACOES] Caixas recolhidas:', resultado);
            return resultado;
        },
        limpar() {
            caixas = [];
            render();
        }
    };
}
