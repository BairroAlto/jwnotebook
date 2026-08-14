import {
    carregarCalendarios,
    guardarCalendarios,
    normalizarCalendarios
} from './calendario-calendarios-repository.js';

const CORES = [
    ['#f4b7a9', '#a44f3b'],
    ['#cfc5ff', '#594ca8'],
    ['#bfe5d5', '#36745b'],
    ['#f5df9d', '#8a6818'],
    ['#c9dff4', '#39709e']
];

export function inicializarGestorCalendarios({ db, getUser, aoMudar }) {
    const elements = {
        mount: document.querySelector('#calendar-manager'),
        open: document.querySelector('#open-calendar-manager'),
        close: document.querySelector('#close-calendar-manager'),
        options: document.querySelector('#calendar-options'),
        tabs: [...document.querySelectorAll('#calendar-manager [data-calendar-tab]')],
        views: [...document.querySelectorAll('#calendar-manager [data-manager-view]')],
        createForm: document.querySelector('#calendar-create-form'),
        name: document.querySelector('#calendar-name'),
        editList: document.querySelector('#calendar-edit-list'),
        status: document.querySelector('#calendar-manager-status')
    };

    let calendars = [];

    elements.open?.addEventListener('click', () => {
        openManager('create');
        elements.name?.focus();
    });
    elements.close?.addEventListener('click', closeManager);
    elements.mount?.addEventListener('click', (event) => {
        if (event.target === elements.mount) closeManager();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.mount && !elements.mount.hidden) closeManager();
    });

    elements.tabs.forEach((tab) => tab.addEventListener('click', () => openManager(tab.dataset.calendarTab)));
    elements.createForm?.addEventListener('submit', criarCalendario);
    elements.editList?.addEventListener('click', guardarEdicao);
    elements.options?.addEventListener('change', alterarVisibilidade);

    renderCalendarios();

    return { carregar, obterCalendarios: () => calendars };

    async function carregar(user) {
        calendars = [];
        if (!user) {
            renderCalendarios();
            aoMudar?.(calendars);
            return;
        }

        try {
            const result = await carregarCalendarios(db, user.uid);
            calendars = result.calendarios;
            if (result.necessitaInicializacao) await guardarCalendarios(db, user.uid, calendars);
            renderCalendarios();
            aoMudar?.(calendars);
        } catch (error) {
            console.error(`[CALENDARIOS][FIREBASE] Falha no gestor: projecto=${db?.app?.options?.projectId || '(desconhecido)'} userId=${user.uid} code=${error?.code || '(sem-code)'} message=${error?.message || error}`);
            // Mesmo sem permissões para o gestor, o calendário deve continuar
            // a mostrar as categorias base (incluindo tarefas do Meu Bairro).
            renderCalendarios();
            aoMudar?.(calendars);
            setStatus('Não foi possível carregar os calendários.');
        }
    }

    async function criarCalendario(event) {
        event.preventDefault();
        const user = getUser?.();
        const nome = elements.name?.value.trim();
        if (!user || !nome) {
            setStatus('Inicia sessão para criares um calendário.');
            return;
        }

        if (calendars.some((calendar) => calendar.nome.toLocaleLowerCase('pt-PT') === nome.toLocaleLowerCase('pt-PT'))) {
            setStatus('Já existe um calendário com esse nome.');
            return;
        }

        const [cor, acento] = String(new FormData(elements.createForm).get('calendarColor')).split('|');
        const novo = {
            id: criarIdCalendario(nome),
            nome,
            cor,
            acento,
            visivel: true
        };
        calendars = normalizarCalendarios([...calendars, novo]);
        await guardarEAtualizar('Calendário criado.');
        elements.createForm.reset();
        openManager('edit');
    }

    async function guardarEdicao(event) {
        const button = event.target.closest('[data-calendar-save]');
        if (!button) return;
        const user = getUser?.();
        if (!user) {
            setStatus('Inicia sessão para alterares os calendários.');
            return;
        }

        const item = button.closest('[data-calendar-id]');
        const id = item?.dataset.calendarId;
        const nome = item?.querySelector('[data-calendar-name]')?.value.trim();
        const colorValue = item?.querySelector('[data-calendar-color]:checked')?.value || '';
        const [cor, acento] = colorValue.split('|');
        if (!id || !nome || !cor || !acento) return;

        calendars = calendars.map((calendar) => calendar.id === id
            ? { ...calendar, nome, cor, acento }
            : calendar);
        await guardarEAtualizar('Calendário actualizado.');
    }

    async function alterarVisibilidade(event) {
        const input = event.target.closest('[data-calendar-visibility]');
        if (!input) return;
        calendars = calendars.map((calendar) => calendar.id === input.dataset.calendarVisibility
            ? { ...calendar, visivel: input.checked }
            : calendar);
        renderCalendarios();
        aoMudar?.(calendars);
        try {
            const user = getUser?.();
            if (user) await guardarCalendarios(db, user.uid, calendars);
        } catch (error) {
            console.error('[CALENDARIOS] Não foi possível guardar a visibilidade:', error);
            setStatus('A visibilidade não foi guardada.');
        }
    }

    async function guardarEAtualizar(message) {
        try {
            await guardarCalendarios(db, getUser().uid, calendars);
            renderCalendarios();
            aoMudar?.(calendars);
            setStatus(message);
        } catch (error) {
            console.error('[CALENDARIOS] Não foi possível guardar:', error);
            setStatus('Não foi possível guardar este calendário.');
        }
    }

    function renderCalendarios() {
        if (elements.options) {
            elements.options.replaceChildren();
            calendars.forEach((calendar) => {
                const label = document.createElement('label');
                label.className = 'calendar-option';
                label.style.setProperty('--calendar-color', calendar.cor);
                label.style.setProperty('--calendar-accent', calendar.acento);

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = calendar.visivel !== false;
                input.dataset.calendarVisibility = calendar.id;

                const dot = document.createElement('span');
                dot.className = 'calendar-dot';
                const name = document.createElement('span');
                name.textContent = calendar.nome;
                label.append(input, dot, name);
                elements.options.append(label);
            });
        }

        if (elements.editList) {
            elements.editList.replaceChildren();
            if (!calendars.length) {
                const empty = document.createElement('p');
                empty.className = 'calendar-manager-status';
                empty.textContent = 'Ainda não existem calendários.';
                elements.editList.append(empty);
                return;
            }
            calendars.forEach((calendar) => elements.editList.append(criarItemEdicao(calendar)));
        }
    }

    function criarItemEdicao(calendar) {
        const item = document.createElement('article');
        item.className = 'calendar-edit-item';
        item.dataset.calendarId = calendar.id;

        const field = document.createElement('label');
        field.className = 'calendar-edit-field';
        field.innerHTML = '<span>Nome</span>';
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = 40;
        name.value = calendar.nome;
        name.dataset.calendarName = 'true';
        field.append(name);

        const colors = document.createElement('div');
        colors.className = 'calendar-color-picker';
        colors.innerHTML = '<legend>Cor</legend>';
        CORES.forEach(([cor, acento], index) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `calendar-color-${calendar.id}`;
            input.value = `${cor}|${acento}`;
            input.dataset.calendarColor = 'true';
            input.checked = calendar.cor === cor;
            const swatch = document.createElement('span');
            swatch.style.setProperty('--calendar-color', cor);
            swatch.textContent = ['Coral', 'Lavanda', 'Menta', 'Dourado', 'Azul'][index];
            label.append(input, swatch);
            colors.append(label);
        });

        const actions = document.createElement('div');
        actions.className = 'calendar-edit-actions';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'calendar-edit-save';
        save.dataset.calendarSave = 'true';
        save.textContent = 'Guardar alterações';
        actions.append(save);

        item.append(field, colors, actions);
        return item;
    }

    function openManager(tab) {
        if (!elements.mount) return;
        elements.mount.hidden = false;
        elements.tabs.forEach((button) => {
            const active = button.dataset.calendarTab === tab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
        elements.views.forEach((view) => { view.hidden = view.dataset.managerView !== tab; });
        setStatus('');
    }

    function closeManager() {
        if (elements.mount) elements.mount.hidden = true;
    }

    function setStatus(message) {
        if (elements.status) elements.status.textContent = message;
    }
}

function criarIdCalendario(nome) {
    const slug = nome.toLocaleLowerCase('pt-PT')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'calendario';
    return `${slug}-${Date.now().toString(36)}`;
}
