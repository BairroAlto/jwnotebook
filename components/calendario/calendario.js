import { renderCalendarView } from './calendario-views.js';
import { renderListView } from './calendario-list.js';
import { initializeTaskDrag } from './calendario-drag.js';
import { initializeIconPicker } from './calendario-icons.js';
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';
import { iniciarAutenticacao } from '../biblioteca-brain/auth/auth.js';
import {
    apagarTarefas,
    guardarTarefas,
    observarTarefas
} from './calendario-repository.js';
import { inicializarGestorCalendarios } from './calendario-manager.js';
import { inicializarEditorAnotacoes } from './calendario-anotacoes.js';
import { abrirPopupPartilhar } from '../editor/modulos/partilhar.js';
import { criarIntegracaoGoogleCalendar } from './calendario-google.js';
import { obterAcessoFerramenta } from '../settings/feature-admin.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
console.info(`[FIREBASE][CALENDARIO] Inicializado: configProjectId=${firebaseConfig.projectId} runtimeProjectId=${app.options?.projectId || '(desconhecido)'}`);
const pendingCloudOperations = new Map();
let cloudUser = null;
let cloudSnapshotReady = false;
let calendarManager;
let googleCalendar;
let googleCalendarPremium = false;
let meuBairroPermitido = false;
let googleRangeKey = '';
let googleLoading = false;
let calendars = [];
const pageLoading = {
    authChecked: false,
    calendarsLoaded: false,
    tasksLoaded: false
};

const categoryMeta = {
    trabalho: { icon: '◒', label: 'Trabalho' },
    pessoal: { icon: '⌂', label: 'Pessoal' },
    'bem-estar': { icon: '☘', label: 'Bem-estar' },
    nenhuma: { icon: 'fa-solid fa-ban', label: 'Nada' }
};

const weekdayShort = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const today = startOfDay(new Date());

const state = {
    selectedDate: new Date(today),
    weekStart: startOfWeek(today),
    monthCursor: new Date(today.getFullYear(), today.getMonth(), 1),
    viewMode: 'list',
    lastCalendarView: 'week',
    taskFilter: 'all',
    editingTaskId: null,
    tasks: {},
    googleEvents: {},
    // As categorias base ficam disponíveis mesmo antes de o gestor Firebase
    // carregar os calendários personalizados do utilizador.
    visibleCategories: new Set(Object.keys(categoryMeta)),
    timer: {
        duration: 25 * 60,
        remaining: 25 * 60,
        running: false,
        intervalId: null
    }
};

const laterTasks = [];
let toastTimeout;
let iconPicker;
let anotacoesEditor;

const elements = {
    greeting: document.querySelector('#greeting'),
    weekSection: document.querySelector('.week-section'),
    weekStrip: document.querySelector('#week-strip'),
    selectedDateLabel: document.querySelector('#selected-date-label'),
    selectedDateTitle: document.querySelector('#selected-date-title'),
    progressText: document.querySelector('#progress-text'),
    progressPercent: document.querySelector('#progress-percent'),
    progressBar: document.querySelector('#progress-bar'),
    periodLabel: document.querySelector('#calendar-period-label'),
    calendarSubviews: document.querySelector('#calendar-subviews'),
    timeline: document.querySelector('#timeline'),
    addInlineTask: document.querySelector('#add-inline-task'),
    monthTitle: document.querySelector('#month-title'),
    miniCalendar: document.querySelector('#mini-calendar'),
    laterList: document.querySelector('#later-list'),
    laterCount: document.querySelector('#later-count'),
    modal: document.querySelector('#task-modal'),
    taskForm: document.querySelector('#task-form'),
    taskIcon: document.querySelector('#task-icon'),
    taskIconTrigger: document.querySelector('#task-icon-trigger'),
    taskIconMenu: document.querySelector('#task-icon-menu'),
    taskIconPreview: document.querySelector('#task-icon-preview'),
    taskModalKicker: document.querySelector('#task-modal-kicker'),
    taskModalTitle: document.querySelector('#task-modal-title'),
    bairroTaskDetails: document.querySelector('#bairro-task-details'),
    bairroTaskDetailsTitle: document.querySelector('#bairro-task-details-title'),
    bairroTaskDetailsList: document.querySelector('#bairro-task-details-list'),
    bairroTaskOpenNote: document.querySelector('#bairro-task-open-note'),
    taskTitle: document.querySelector('#task-title'),
    taskDate: document.querySelector('#task-date'),
    taskTime: document.querySelector('#task-time'),
    taskTimeMenuTrigger: document.querySelector('#task-time-menu-trigger'),
    taskTimeMenu: document.querySelector('#task-time-menu'),
    taskDuration: document.querySelector('#task-duration'),
    taskRepeat: document.querySelector('#task-repeat'),
    taskRepeatOptions: document.querySelector('#custom-repeat-options'),
    taskRepeatInterval: document.querySelector('#task-repeat-interval'),
    taskRepeatUnit: document.querySelector('#task-repeat-unit'),
    taskAnnotationsAdd: document.querySelector('#task-add-annotation'),
    taskAnnotationsList: document.querySelector('#task-annotations-list'),
    taskSubmit: document.querySelector('#task-submit'),
    deleteTask: document.querySelector('#delete-task'),
    focusMode: document.querySelector('#focus-mode'),
    focusTaskName: document.querySelector('#focus-task-name'),
    completeFocusTask: document.querySelector('#complete-focus-task'),
    toast: document.querySelector('#toast'),
    loading: document.querySelector('#calendar-loading'),
    loadingMessage: document.querySelector('#calendar-loading-message'),
    googleConnect: document.querySelector('#google-calendar-connect'),
    googleDisconnect: document.querySelector('#google-calendar-disconnect'),
    googleStatus: document.querySelector('#google-calendar-status')
};

initialize();

window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    console.info('[CALENDARIO] Página restaurada do Back-Forward Cache; a recarregar os dados Firebase.');
    window.location.reload();
});

async function initialize() {
    await esperarRecursosDaPagina();
    await carregarGestorCalendarios();
    setGreeting();
    iconPicker = initializeIconPicker({
        trigger: elements.taskIconTrigger,
        menu: elements.taskIconMenu,
        input: elements.taskIcon,
        preview: elements.taskIconPreview
    });
    anotacoesEditor = inicializarEditorAnotacoes({
        addButton: elements.taskAnnotationsAdd,
        list: elements.taskAnnotationsList,
        onPartilhar: partilharAnotacaoTarefa
    });
    calendarManager = inicializarGestorCalendarios({
        db,
        getUser: () => cloudUser,
        aoMudar: atualizarCalendarios
    });
    googleCalendar = criarIntegracaoGoogleCalendar({
        auth,
        onEstado: actualizarEstadoGoogle,
        onEventos: aplicarEventosGoogle
    });
    inicializarControlosGoogle();
    bindControls();
    initializeTaskDrag({ onMoveTask: moveTaskToDate });
    await carregarTopo();
    renderAll();
    window.addEventListener('notabook:plan-preview-changed', () => {
        actualizarAcessoMeuBairro(cloudUser).then(() => renderAll());
    });
    iniciarAutenticacao(app, db, { gerirLoading: false });
    iniciarSincronizacaoCloud();
}

async function esperarRecursosDaPagina() {
    if (document.readyState !== 'complete') {
        await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    }
    if (document.fonts?.ready) await document.fonts.ready;
}

async function carregarGestorCalendarios() {
    const mount = document.querySelector('#calendar-manager-mount');
    if (!mount) return;
    try {
        const response = await fetch('components/calendario/calendario-manager.html');
        if (!response.ok) throw new Error('Não foi possível carregar o gestor de calendários.');
        mount.innerHTML = await response.text();
    } catch (error) {
        console.error('[CALENDARIOS] Não foi possível carregar o gestor:', error);
    }
}

function atualizarCalendarios(novosCalendarios = []) {
    calendars = novosCalendarios;
    const calendarIds = new Set(calendars.map((calendar) => calendar.id));
    const legacyIds = Object.keys(categoryMeta).filter((category) => !calendarIds.has(category));
    state.visibleCategories = new Set(
        [
            ...calendars.filter((calendar) => calendar.visivel !== false).map((calendar) => calendar.id),
            ...legacyIds,
            'nenhuma'
        ]
    );
    if (googleCalendar?.estaLigado()) state.visibleCategories.add('google');
    console.info(`[CALENDARIO][CATEGORIAS] Calendários actualizados: recebidos=${calendars.length} visiveis=${[...state.visibleCategories].join(',')}`);
    renderAll();
}

function inicializarControlosGoogle() {
    if (elements.googleConnect) elements.googleConnect.disabled = true;
    if (!googleCalendar?.estaConfigurado()) {
        actualizarEstadoGoogle({
            tipo: 'informacao',
            mensagem: 'Liga a conta Google para mostrar os teus eventos.'
        });
    }

    elements.googleConnect?.addEventListener('click', async () => {
        if (!googleCalendarPremium) {
            actualizarEstadoGoogle({
                tipo: 'bloqueado',
                mensagem: 'A ligação ao Google Calendar requer o plano Premium ou Premium Plus.'
            });
            return;
        }
        elements.googleConnect.disabled = true;
        actualizarEstadoGoogle({ tipo: 'a-ligar', mensagem: 'A abrir a autorização Google…' });
        try {
            await googleCalendar.ligar();
        } catch (error) {
            actualizarEstadoGoogle({
                tipo: 'erro',
                mensagem: error.message || 'Não foi possível ligar o Google Calendar.'
            });
        } finally {
            elements.googleConnect.disabled = false;
        }
    });
    elements.googleDisconnect?.addEventListener('click', () => googleCalendar.desligar());
}

async function actualizarAcessoGoogle(user) {
    googleCalendarPremium = false;

    if (!user) {
        actualizarEstadoGoogle({
            tipo: 'bloqueado',
            mensagem: 'Inicia sessão para verificar o acesso ao Google Calendar.'
        });
        return false;
    }

    actualizarEstadoGoogle({ tipo: 'a-verificar', mensagem: 'A verificar o plano…' });

    try {
        googleCalendarPremium = await obterAcessoFerramenta(auth, 'google_calendar');

        if (!googleCalendarPremium) {
            if (googleCalendar?.estaLigado()) googleCalendar.desligar();
            actualizarEstadoGoogle({
                tipo: 'bloqueado',
                mensagem: 'A ligação ao Google Calendar requer o plano Premium ou Premium Plus.'
            });
            return false;
        }

        actualizarEstadoGoogle({
            tipo: 'informacao',
            mensagem: 'Liga a conta Google para mostrar os teus eventos.'
        });
        return true;
    } catch (_) {
        actualizarEstadoGoogle({
            tipo: 'erro',
            mensagem: 'Não foi possível confirmar o teu plano. A ligação está bloqueada.'
        });
        return false;
    }
}

async function actualizarAcessoMeuBairro(user) {
    // O acesso ao conteúdo é apenas visual: os registos continuam no Firebase.
    meuBairroPermitido = false;
    if (!user) {
        console.info('[MEU-BAIRRO][CALENDARIO] Acesso: sem utilizador.');
        renderAll();
        return false;
    }

    try {
        meuBairroPermitido = await obterAcessoFerramenta(auth, 'posto_meu_bairro');
        console.info(`[MEU-BAIRRO][CALENDARIO] Acesso validado: permitido=${meuBairroPermitido} userId=${user.uid} feature=posto_meu_bairro`);
        renderAll();
    } catch (error) {
        console.warn('[MEU-BAIRRO][CALENDARIO] Não foi possível confirmar o acesso:', error);
        renderAll();
    }
    return meuBairroPermitido;
}

function actualizarEstadoGoogle({ tipo, mensagem }) {
    if (elements.googleStatus) {
        elements.googleStatus.textContent = mensagem || '';
        elements.googleStatus.classList.toggle('error', tipo === 'erro');
    }
    if (elements.googleConnect) {
        elements.googleConnect.textContent = tipo === 'ligado' ? 'Actualizar' : 'Ligar';
        elements.googleConnect.hidden = tipo === 'ligado' ? false : false;
        elements.googleConnect.disabled = !googleCalendarPremium || ['a-ligar', 'a-carregar', 'a-verificar'].includes(tipo);
    }
    if (elements.googleDisconnect) elements.googleDisconnect.hidden = tipo !== 'ligado';
    if (tipo === 'ligado') {
        state.visibleCategories.add('google');
        renderAll();
    }
    if (tipo === 'desligado') {
        state.visibleCategories.delete('google');
        state.googleEvents = {};
        googleRangeKey = '';
        renderAll();
    }
}

function aplicarEventosGoogle(eventos = []) {
    state.googleEvents = eventos.reduce((porData, evento) => {
        porData[evento.date] = [...(porData[evento.date] || []), evento];
        return porData;
    }, {});
    renderAll();
}

function sincronizarEventosGoogleVisiveis() {
    if (!googleCalendar?.estaLigado() || googleLoading) return;

    const { inicio, fim } = obterIntervaloGoogle();
    const rangeKey = `${inicio.toISOString()}|${fim.toISOString()}`;
    if (rangeKey === googleRangeKey) return;

    googleLoading = true;
    actualizarEstadoGoogle({ tipo: 'a-carregar', mensagem: 'A carregar os eventos Google…' });
    googleCalendar.carregarEventos(inicio, fim)
        .then(() => {
            googleRangeKey = rangeKey;
            actualizarEstadoGoogle({ tipo: 'ligado', mensagem: 'Eventos Google actualizados.' });
        })
        .catch((error) => {
            console.error('[GOOGLE-CALENDAR] Não foi possível carregar eventos:', error);
            actualizarEstadoGoogle({ tipo: 'erro', mensagem: error.message || 'Não foi possível carregar os eventos Google.' });
        })
        .finally(() => { googleLoading = false; });
}

function obterIntervaloGoogle() {
    if (state.viewMode === 'month') {
        return {
            inicio: new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1),
            fim: new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth() + 1, 1)
        };
    }
    if (state.viewMode === 'week') {
        return { inicio: startOfDay(state.weekStart), fim: addDays(startOfDay(state.weekStart), 7) };
    }
    const inicio = startOfDay(state.selectedDate);
    return { inicio, fim: addDays(inicio, 1) };
}

function iniciarSincronizacaoCloud() {
    observarTarefas({
        db,
        auth,
        aoMudarUtilizador(user) {
            if (cloudUser?.uid !== user?.uid) pendingCloudOperations.clear();
            cloudUser = user;
            cloudSnapshotReady = false;
            pageLoading.authChecked = true;
            pageLoading.tasksLoaded = !user;
            pageLoading.calendarsLoaded = !user;
            if (user) {
                Promise.all([
                    actualizarAcessoGoogle(user),
                    actualizarAcessoMeuBairro(user)
                ])
                    .then(([googlePermitido]) => googlePermitido ? googleCalendar?.restaurarSessao?.() : undefined)
                    .then(() => renderAll());
            } else if (googleCalendar?.estaLigado()) {
                googleCalendarPremium = false;
                meuBairroPermitido = false;
                googleCalendar.desligar();
            } else {
                actualizarAcessoGoogle(null);
                meuBairroPermitido = false;
            }
            if (!user) {
                pendingCloudOperations.clear();
                state.tasks = {};
                state.googleEvents = {};
                renderAll();
            }
            atualizarMensagemCarregamento(user ? 'A carregar os teus dados…' : 'Sessão não iniciada. A abrir o modo local…');
            if (!user) atualizarMensagemCarregamento('Inicia sessão para aceder ao calendário.');
            Promise.resolve(calendarManager?.carregar(user)).finally(() => {
                pageLoading.calendarsLoaded = true;
                terminarCarregamentoSePronto();
            });
            terminarCarregamentoSePronto();
        },
        aoMudar(tarefasRemotas) {
            cloudSnapshotReady = true;
            aplicarTarefasRemotas(tarefasRemotas);
            descarregarOperacoesCloud();
            pageLoading.tasksLoaded = true;
            terminarCarregamentoSePronto();
        },
        aoErro(error) {
            console.error('[TAREFAS] Não foi possível sincronizar com o Firebase:', error);
            showToast('As tarefas ficaram guardadas neste dispositivo.');
            pageLoading.tasksLoaded = true;
            atualizarMensagemCarregamento('Firebase indisponível. A abrir os dados locais…');
            terminarCarregamentoSePronto();
        }
    });
}

function atualizarMensagemCarregamento(message) {
    if (elements.loadingMessage) elements.loadingMessage.textContent = message;
}

function terminarCarregamentoSePronto() {
    if (!pageLoading.authChecked || !pageLoading.calendarsLoaded || !pageLoading.tasksLoaded) return;
    if (!elements.loading || elements.loading.dataset.ready === 'true') return;
    elements.loading.dataset.ready = 'true';
    elements.loading.classList.add('is-closing');
    document.body.classList.remove('calendar-is-loading');
    window.setTimeout(() => { elements.loading.hidden = true; }, 240);
}

function aplicarTarefasRemotas(tarefasRemotas) {
    const tarefasMeuBairro = tarefasRemotas.filter(task => task.origemBairro);
    console.info(`[CALENDARIO][FIREBASE] Snapshot recebido: total=${tarefasRemotas.length} meuBairro=${tarefasMeuBairro.length} permitido=${meuBairroPermitido}`);
    tarefasMeuBairro.forEach(task => {
        console.info(`[CALENDARIO][FIREBASE] Tarefa Meu Bairro recebida: id=${task.id} data=${task.data || task.date || ''}`);
    });
    if (cloudUser) {
        tarefasRemotas
            .filter((task) => task.serieId && task.ocorrenciaPrincipal === false)
            .forEach((task) => {
                pendingCloudOperations.set(task.id, {
                    type: 'delete',
                    taskId: task.id
                });
            });
    }

    const tarefasPendentes = new Map(
        [...pendingCloudOperations.values()]
            .filter((operation) => operation.type === 'write')
            .map((operation) => [operation.task.id, operation])
    );

    // Um conjunto remoto vazio não apaga o cache local de uma instalação nova.
    // A partir daqui, novas alterações são sempre enviadas para a coleção.
    if (!tarefasRemotas.length && Object.keys(state.tasks).length) {
        tarefasPendentes.forEach(({ task, dateKey }) => {
            removerSerieDasTarefas(state.tasks, task.id);
            expandirTarefa(task, dateKey).forEach(({ task: occurrence, dateKey: occurrenceDateKey }) => {
                state.tasks[occurrenceDateKey] = [...(state.tasks[occurrenceDateKey] || []), occurrence];
            });
        });
        return;
    }

    const principais = tarefasRemotas.filter((task) => !task.serieId || task.ocorrenciaPrincipal !== false);
    const agrupadas = agruparTarefasPorData(expandirTarefas(principais));
    tarefasPendentes.forEach(({ task, dateKey }) => {
        removerSerieDasTarefas(agrupadas, task.id);
        expandirTarefa(task, dateKey).forEach(({ task: occurrence, dateKey: occurrenceDateKey }) => {
            agrupadas[occurrenceDateKey] = [...(agrupadas[occurrenceDateKey] || []), occurrence];
        });
    });
    pendingCloudOperations.forEach((operation) => {
        if (operation.type !== 'delete') return;
        Object.keys(agrupadas).forEach((key) => {
            agrupadas[key] = agrupadas[key].filter((task) => task.id !== operation.taskId);
        });
    });

    state.tasks = agrupadas;
    console.info(`[CALENDARIO][ESTADO] Tarefas agrupadas: datas=${Object.keys(state.tasks).join(',') || '(nenhuma)'} total=${Object.values(state.tasks).reduce((total, lista) => total + lista.length, 0)}`);
    renderAll();
}

function agruparTarefasPorData(tarefas) {
    return tarefas.reduce((accumulator, item) => {
        // As tarefas expandidas chegam como { task, dateKey }; tarefas simples
        // continuam a ser aceites para manter compatibilidade com o cache antigo.
        const task = item?.task || item;
        const key = item?.dateKey || task?.data || task?.date;
        if (!key) return accumulator;
        accumulator[key] = [
            ...(accumulator[key] || []),
            { ...task, date: key }
        ];
        return accumulator;
    }, {});
}

function expandirTarefas(tarefas) {
    return tarefas.flatMap((task) => expandirTarefa(task, task.data || task.date || task.ocorrenciaData));
}

function expandirTarefa(task, fallbackDateKey) {
    const startDateKey = task.data || task.date || task.ocorrenciaData || fallbackDateKey;
    if (!startDateKey) return [];
    const master = {
        ...task,
        serieId: null,
        ocorrenciaData: startDateKey,
        ocorrenciaPrincipal: true
    };
    return gerarOcorrencias(master, startDateKey).map(({ task: occurrence, dateKey }) => ({
        task: { ...occurrence, date: dateKey },
        dateKey
    }));
}

function removerSerieDasTarefas(tarefasPorData, serieId) {
    Object.keys(tarefasPorData).forEach((key) => {
        tarefasPorData[key] = tarefasPorData[key].filter((task) => (task.serieId || task.id) !== serieId);
        if (!tarefasPorData[key].length) delete tarefasPorData[key];
    });
}

function enfileirarGravacaoCloud(task, taskDateKey) {
    if (!task?.id) return;
    if (!cloudUser) return Promise.resolve();
    pendingCloudOperations.set(task.id, { type: 'write', task: { ...task }, dateKey: taskDateKey });
    console.log('[CALENDARIO][FIREBASE] Gravação colocada na fila:', {
        taskId: task.id,
        dateKey: taskDateKey,
        caixas: task.caixas
    });
    return descarregarOperacoesCloud();
}

function enfileirarEliminacaoCloud(taskId) {
    if (!taskId) return;
    if (!cloudUser) return Promise.resolve();
    pendingCloudOperations.set(taskId, { type: 'delete', taskId });
    return descarregarOperacoesCloud();
}

async function descarregarOperacoesCloud() {
    console.log('[CALENDARIO][FIREBASE] Preparar sincronização:', {
        utilizador: cloudUser?.uid || null,
        snapshotPronto: cloudSnapshotReady,
        operacoes: pendingCloudOperations.size
    });
    if (!cloudUser || !cloudSnapshotReady || !pendingCloudOperations.size) {
        console.warn('[CALENDARIO][FIREBASE] Sincronização adiada:', {
            semUtilizador: !cloudUser,
            snapshotAindaNaoPronto: !cloudSnapshotReady,
            semOperacoes: !pendingCloudOperations.size
        });
        return;
    }

    const operations = [...pendingCloudOperations.entries()];
    const tamanhoMaximoLote = 400;

    for (let inicio = 0; inicio < operations.length; inicio += tamanhoMaximoLote) {
        const lote = operations.slice(inicio, inicio + tamanhoMaximoLote);
        const gravacoes = lote.map(([, operation]) => operation)
            .filter((operation) => operation.type === 'write')
            .map((operation) => ({ task: operation.task, dateKey: operation.dateKey }));
        const eliminacoes = lote.map(([, operation]) => operation)
            .filter((operation) => operation.type === 'delete')
            .map((operation) => operation.taskId);

        try {
            await Promise.all([
                guardarTarefas(db, cloudUser.uid, gravacoes),
                apagarTarefas(db, cloudUser.uid, eliminacoes)
            ]);
            console.log('[CALENDARIO][FIREBASE] Operações gravadas:', {
                gravacoes: gravacoes.map(({ task, dateKey }) => ({ taskId: task.id, dateKey, caixas: task.caixas })),
                eliminacoes
            });
            lote.forEach(([operationId, operation]) => {
                if (pendingCloudOperations.get(operationId) === operation) pendingCloudOperations.delete(operationId);
            });
        } catch (error) {
            console.error('[TAREFAS] Falha ao gravar a tarefa:', error);
            showToast('Não foi possível sincronizar esta tarefa.');
        }
    }
}

async function carregarTopo() {
    const area = document.querySelector('#calendario-top-links');
    if (!area) return;

    try {
        const response = await fetch('components/topo/menu.html');
        if (!response.ok) throw new Error('Não foi possível carregar a navegação.');
        area.innerHTML = await response.text();
    } catch (error) {
        area.innerHTML = `
            <a href="index.html" class="nav-item">Notas</a>
            <a href="book.html" class="nav-item">Book</a>
            <a href="biblia.html" class="nav-item">Biblia</a>
            <a href="office.html" class="nav-item">OFFICE</a>
            <a href="xray.html" class="nav-item">X-RAY</a>
            <a href="palco.html" class="nav-item">PALCO</a>`;
    }

}

function bindControls() {
    document.querySelector('#previous-week').addEventListener('click', () => shiftWeek(-7));
    document.querySelector('#next-week').addEventListener('click', () => shiftWeek(7));
    document.querySelector('#previous-period').addEventListener('click', () => shiftPeriod(-1));
    document.querySelector('#next-period').addEventListener('click', () => shiftPeriod(1));
    document.querySelector('#today-button').addEventListener('click', selectToday);
    document.querySelector('#previous-month').addEventListener('click', () => shiftMonth(-1));
    document.querySelector('#next-month').addEventListener('click', () => shiftMonth(1));

    ['#open-task-modal', '#add-inline-task', '#mobile-add-task'].forEach((selector) => {
        document.querySelector(selector)?.addEventListener('click', () => openTaskModal());
    });

    document.querySelector('#close-task-modal').addEventListener('click', saveAndCloseTaskModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !elements.modal.hidden) saveAndCloseTaskModal();
        if (event.key === 'Escape' && !elements.focusMode.hidden) closeFocusMode();
    });

    elements.taskForm.addEventListener('submit', addTask);
    elements.deleteTask.addEventListener('click', deleteEditingTask);
    elements.taskTime.addEventListener('change', toggleNoTimeFields);
    elements.taskTimeMenuTrigger.addEventListener('click', toggleTimeMenu);
    elements.taskTimeMenu.querySelectorAll('[data-time-option]').forEach((button) => {
        button.addEventListener('click', () => selectTimeOption(button.dataset.timeOption));
    });
    elements.taskRepeat.addEventListener('change', toggleCustomRepeatOptions);
    document.querySelector('#clear-completed').addEventListener('click', clearCompletedTasks);

    elements.weekStrip.addEventListener('click', (event) => {
        const button = event.target.closest('.day-button');
        if (!button || !elements.weekStrip.contains(button)) return;
        const date = parseDateKey(button.dataset.dropDate);
        if (!Number.isNaN(date.getTime())) selectDate(date);
    });

    document.querySelectorAll('.view-tab').forEach((button) => {
        button.addEventListener('click', () => setViewMode(button.dataset.calendarView));
    });
    document.querySelectorAll('.display-tab').forEach((button) => {
        button.addEventListener('click', () => setDisplayMode(button.dataset.displayMode));
    });

    document.querySelectorAll('[data-timer-toggle]').forEach((button) => button.addEventListener('click', toggleTimer));
    document.querySelectorAll('[data-timer-reset]').forEach((button) => button.addEventListener('click', resetTimer));
    document.querySelectorAll('[data-timer-add]').forEach((button) => button.addEventListener('click', addTimerMinutes));
    document.querySelector('#open-focus-mode')?.addEventListener('click', openFocusMode);
    document.querySelector('#close-focus-mode').addEventListener('click', closeFocusMode);
    elements.completeFocusTask.addEventListener('click', completeCurrentFocusTask);
    elements.focusMode.addEventListener('click', (event) => {
        if (event.target === elements.focusMode) closeFocusMode();
    });

    document.querySelectorAll('.nav-item').forEach((button) => {
        button.addEventListener('click', () => handleNavigation(button));
    });

    document.querySelectorAll('.mobile-nav button:not(.mobile-add)').forEach((button, index) => {
        button.addEventListener('click', () => handleMobileNavigation(button, index));
    });
}

function renderAll() {
    const chaveSelecionada = dateKey(state.selectedDate);
    console.info(`[CALENDARIO][RENDER] A redesenhar: data=${chaveSelecionada} tarefasNaData=${state.tasks[chaveSelecionada]?.length || 0} categorias=${[...state.visibleCategories].join(',') || '(nenhuma)'} meuBairroPermitido=${meuBairroPermitido}`);
    renderWeek();
    renderSelectedDate();
    renderPeriodLabel();
    renderTimeline();
    renderProgress();
    renderMiniCalendar();
    renderLaterTasks();
    renderFocusTask();
    renderTimer();
    sincronizarEventosGoogleVisiveis();
}

function setGreeting() {
    const hour = new Date().getHours();
    elements.greeting.textContent = hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite';
}

function renderWeek() {
    elements.weekStrip.replaceChildren();

    for (let index = 0; index < 7; index += 1) {
        const date = addDays(state.weekStart, index);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'day-button';
        button.dataset.dropDate = dateKey(date);
        button.setAttribute('aria-label', formatLongDate(date));

        if (sameDay(date, state.selectedDate)) button.classList.add('selected');
        if (sameDay(date, today)) button.classList.add('is-today');
        if (getVisibleTasksForDate(date).length) button.classList.add('has-tasks');

        const weekday = document.createElement('span');
        weekday.textContent = weekdayShort[index];
        const dayNumber = document.createElement('strong');
        dayNumber.textContent = String(date.getDate());

        button.append(weekday, dayNumber);
        elements.weekStrip.append(button);
    }
}

function renderSelectedDate() {
    const relativeLabel = getRelativeDateLabel(state.selectedDate);
    elements.selectedDateLabel.textContent = relativeLabel;
    if (state.viewMode === 'month') {
        elements.selectedDateTitle.textContent = capitalize(state.selectedDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }));
    } else if (state.viewMode === 'week') {
        elements.selectedDateTitle.textContent = `Semana de ${formatShortDate(state.weekStart)}`;
    } else {
        elements.selectedDateTitle.textContent = relativeLabel === 'Hoje' ? 'O plano de hoje' : formatLongDate(state.selectedDate);
    }
}

function renderTimeline() {
    if (state.viewMode === 'list') {
        const tarefasDaData = getVisibleTasksForDate(state.selectedDate);
        console.info(`[CALENDARIO][LISTA] A entregar à lista: data=${dateKey(state.selectedDate)} total=${tarefasDaData.length} ids=${tarefasDaData.map(task => task.id).join(',') || '(nenhum)'}`);
        renderListView({
            container: elements.timeline,
            date: state.selectedDate,
            tasks: tarefasDaData,
            visibleCategories: state.visibleCategories,
            onToggleTask: toggleTask,
            onEditTask: openTaskModal
        });
        return;
    }

    renderCalendarView({
        container: elements.timeline,
        mode: state.viewMode,
        selectedDate: state.selectedDate,
        weekStart: state.weekStart,
        tasksByDate: obterTarefasVisiveisPorData(),
        visibleCategories: state.visibleCategories,
        onToggleTask: toggleTask,
        onEditTask: openTaskModal,
        onSelectDate: selectDate,
        onOpenDate: openDateFromMonth
    });
}

function renderPeriodLabel() {
    if (state.viewMode === 'month') {
        elements.periodLabel.textContent = capitalize(state.selectedDate.toLocaleDateString('pt-PT', {
            month: 'long',
            year: 'numeric'
        }));
        return;
    }

    if (state.viewMode === 'week') {
        const weekEnd = addDays(state.weekStart, 6);
        elements.periodLabel.textContent = `${formatShortDate(state.weekStart)} — ${formatShortDate(weekEnd)}`;
        return;
    }

    elements.periodLabel.textContent = formatLongDate(state.selectedDate);
}

function renderProgress() {
    const tasks = getVisibleTasksForDate(state.selectedDate).filter((task) => task.source !== 'google');
    const completed = tasks.filter((task) => task.completed).length;
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    elements.progressText.textContent = `${completed} de ${tasks.length} ${tasks.length === 1 ? 'concluída' : 'concluídas'}`;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
}

function renderMiniCalendar() {
    elements.miniCalendar.replaceChildren();
    elements.monthTitle.textContent = state.monthCursor.toLocaleDateString('pt-PT', {
        month: 'long',
        year: 'numeric'
    });

    const year = state.monthCursor.getFullYear();
    const month = state.monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let index = 0; index < leadingEmptyDays; index += 1) {
        const empty = document.createElement('span');
        empty.className = 'mini-day empty';
        elements.miniCalendar.append(empty);
    }

    for (let day = 1; day <= totalDays; day += 1) {
        const date = new Date(year, month, day);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mini-day';
        button.dataset.dropDate = dateKey(date);
        button.textContent = String(day);
        button.setAttribute('aria-label', formatLongDate(date));
        if (sameDay(date, state.selectedDate)) button.classList.add('selected');
        if (sameDay(date, today)) button.classList.add('is-today');
        if (getVisibleTasksForDate(date).length) button.classList.add('has-tasks');
        button.addEventListener('click', () => selectDate(date));
        elements.miniCalendar.append(button);
    }
}

function renderLaterTasks() {
    elements.laterList.replaceChildren();
    const untimedTasks = Object.values(state.tasks)
        .flat()
        .filter((task) => tarefaVisivelNoCalendario(task) && (task.noTime || !task.time))
        .map((task) => ({ ...task, source: 'calendar' }));
    const untimedGoogleEvents = Object.values(state.googleEvents)
        .flat()
        .filter((task) => task.noTime || !task.time)
        .map((task) => ({ ...task, source: 'google' }));
    const sidebarTasks = [
        ...laterTasks.map((task) => ({ ...task, source: 'later' })),
        ...untimedTasks,
        ...untimedGoogleEvents
    ];

    sidebarTasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = `later-item${task.completed ? ' completed' : ''}`;
        if (task.source === 'calendar') {
            item.classList.add('is-editable');
            item.addEventListener('click', (event) => {
                if (!event.target.closest('.later-check')) openTaskModal(task.id);
            });
        } else if (task.source === 'google') {
            item.classList.add('google-event');
            if (task.htmlLink) item.addEventListener('click', () => window.open(task.htmlLink, '_blank', 'noopener'));
        }
        const check = document.createElement('button');
        check.type = 'button';
        check.className = 'later-check';
        check.textContent = task.completed ? '✓' : '';
        check.setAttribute('aria-label', task.completed ? `Reabrir ${task.title}` : `Concluir ${task.title}`);
        check.disabled = task.source === 'google';
        check.addEventListener('click', () => {
            if (task.source === 'calendar') toggleTask(task.id);
            else toggleLaterTask(task.id);
        });
        const title = document.createElement('span');
        title.textContent = task.title;
        item.append(check, title);
        elements.laterList.append(item);
    });

    elements.laterCount.textContent = String(sidebarTasks.filter((task) => !task.completed).length);
}

function renderTimer() {
    const minutes = Math.floor(state.timer.remaining / 60);
    const seconds = state.timer.remaining % 60;
    const progress = state.timer.duration ? (state.timer.remaining / state.timer.duration) * 100 : 0;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const buttonLabel = state.timer.running ? 'Pausar' : state.timer.remaining < state.timer.duration ? 'Continuar' : 'Começar';
    document.querySelectorAll('[data-timer-display]').forEach((item) => { item.textContent = display; });
    document.querySelectorAll('[data-timer-ring]').forEach((item) => item.style.setProperty('--timer-progress', `${progress}%`));
    document.querySelectorAll('[data-timer-toggle]').forEach((item) => { item.textContent = buttonLabel; });
}

function selectDate(date) {
    state.selectedDate = startOfDay(date);
    state.weekStart = startOfWeek(date);
    state.monthCursor = new Date(date.getFullYear(), date.getMonth(), 1);
    renderAll();
}

function selectToday() {
    selectDate(today);
}

function shiftWeek(days) {
    state.weekStart = addDays(state.weekStart, days);
    state.selectedDate = addDays(state.selectedDate, days);
    state.monthCursor = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
    renderAll();
}

function shiftPeriod(direction) {
    if (state.viewMode === 'month') {
        const currentDay = state.selectedDate.getDate();
        const targetMonthStart = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth() + direction, 1);
        const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
        selectDate(new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentDay, targetLastDay)));
        return;
    }

    if (state.viewMode === 'week') {
        shiftWeek(direction * 7);
        return;
    }

    selectDate(addDays(state.selectedDate, direction));
}

function shiftMonth(months) {
    state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + months, 1);
    renderMiniCalendar();
}

function setViewMode(mode) {
    const validModes = new Set(['day', 'week', 'month']);
    if (!validModes.has(mode)) mode = 'week';
    state.viewMode = mode;
    state.lastCalendarView = mode;
    document.querySelectorAll('.view-tab').forEach((button) => {
        const active = button.dataset.calendarView === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.display-tab').forEach((button) => {
        const active = button.dataset.displayMode === 'calendar';
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    elements.calendarSubviews.hidden = false;
    elements.weekSection.hidden = true;
    elements.addInlineTask.hidden = true;
    renderAll();
}

function setDisplayMode(mode) {
    if (mode === 'calendar') {
        setViewMode(state.lastCalendarView || 'week');
        return;
    }

    state.viewMode = 'list';
    document.querySelectorAll('.display-tab').forEach((button) => {
        const active = button.dataset.displayMode === 'list';
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    elements.calendarSubviews.hidden = true;
    elements.weekSection.hidden = false;
    elements.addInlineTask.hidden = false;
    renderAll();
}

function openDateFromMonth(date) {
    state.viewMode = 'day';
    state.lastCalendarView = 'day';
    document.querySelectorAll('.view-tab').forEach((button) => {
        const active = button.dataset.calendarView === 'day';
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    elements.weekSection.hidden = true;
    elements.addInlineTask.hidden = true;
    selectDate(date);
}

function toggleCustomRepeatOptions() {
    elements.taskRepeatOptions.hidden = elements.taskRepeat.value !== 'costume';
}

function setTaskTime(value) {
    const normalizedValue = value || 'none';
    elements.taskTime.value = normalizedValue === 'none' ? '' : normalizedValue;
    toggleNoTimeFields();
}

function toggleNoTimeFields() {
    const noTime = !elements.taskTime.value;
    elements.taskTime.disabled = noTime;
    elements.taskTime.required = !noTime;
}

function toggleTimeMenu() {
    const isOpen = !elements.taskTimeMenu.hidden;
    elements.taskTimeMenu.hidden = isOpen;
    elements.taskTimeMenuTrigger.setAttribute('aria-expanded', String(!isOpen));
}

function selectTimeOption(option) {
    if (option === 'none') {
        setTaskTime('none');
    } else {
        setTaskTime(elements.taskTime.value || '10:00');
    }
    elements.taskTimeMenu.hidden = true;
    elements.taskTimeMenuTrigger.setAttribute('aria-expanded', 'false');
}

function renderBairroTaskDetails(task) {
    const area = elements.bairroTaskDetails;
    if (!area) return;
    const eBairro = Boolean(task?.origemBairro);
    area.hidden = !eBairro;
    if (!eBairro) return;

    if (elements.bairroTaskDetailsTitle) {
        elements.bairroTaskDetailsTitle.textContent = `${task.bairroModelo || 'Meu Bairro'} · ${task.bairroNome || ''}`.trim();
    }
    if (elements.bairroTaskDetailsList) {
        elements.bairroTaskDetailsList.replaceChildren();
        (task.bairroCampos || []).forEach(campo => {
            if (!String(campo?.valor || '').trim()) return;
            const item = document.createElement('div');
            item.className = 'bairro-task-detail';
            const label = document.createElement('strong');
            label.textContent = campo.label || campo.id || 'Campo';
            const valor = document.createElement('span');
            valor.textContent = campo.valor;
            item.append(label, valor);
            elements.bairroTaskDetailsList.appendChild(item);
        });
        if (!elements.bairroTaskDetailsList.children.length) {
            const vazio = document.createElement('p');
            vazio.className = 'empty-state-copy';
            vazio.textContent = 'Ainda não há dados preenchidos neste exercício.';
            elements.bairroTaskDetailsList.appendChild(vazio);
        }
    }
    if (elements.bairroTaskOpenNote) {
        elements.bairroTaskOpenNote.onclick = () => {
            if (!task.bairroNotaId) return;
            const url = new URL('index.html', window.location.href);
            url.searchParams.set('nota', task.bairroNotaId);
            if (task.bairroCaixaId) url.searchParams.set('caixa', task.bairroCaixaId);
            window.open(url.href, '_blank', 'noopener');
        };
        elements.bairroTaskOpenNote.disabled = !task.bairroNotaId;
    }
}

function openTaskModal(taskId = null) {
    state.editingTaskId = taskId;
    elements.taskTimeMenu.hidden = true;
    elements.taskTimeMenuTrigger.setAttribute('aria-expanded', 'false');

    if (taskId) {
        const record = findTaskRecord(taskId);
        if (!record) return;

        elements.taskModalKicker.textContent = 'Editar tarefa';
        elements.taskModalTitle.textContent = '';
        elements.taskModalTitle.hidden = true;
        elements.taskSubmit.hidden = true;
        elements.deleteTask.hidden = false;
        elements.taskTitle.value = record.task.title;
        elements.taskDate.value = record.dateKey;
        setTaskTime(record.task.noTime || !record.task.time ? 'none' : record.task.time);
        elements.taskDuration.value = record.task.duration ? String(record.task.duration) : 'none';
        toggleNoTimeFields();
        iconPicker.setIcon(record.task.icon || 'fa-solid fa-calendar-check');
        elements.taskRepeat.value = record.task.repeat || 'sem-repeticao';
        elements.taskRepeatInterval.value = String(record.task.repeatInterval || 1);
        elements.taskRepeatUnit.value = record.task.repeatUnit || 'dias';
        toggleCustomRepeatOptions();
        anotacoesEditor.carregar(record.task.caixas, record.task.note);
        renderBairroTaskDetails(record.task);
        const categoryInput = elements.taskForm.querySelector(`input[name="category"][value="${record.task.category}"]`);
        if (categoryInput) categoryInput.checked = true;
    } else {
        elements.taskForm.reset();
        elements.taskModalKicker.textContent = 'Novo bloco';
        elements.taskModalTitle.textContent = '';
        elements.taskModalTitle.hidden = true;
        elements.taskSubmit.textContent = 'Adicionar ao meu dia';
        elements.taskSubmit.hidden = false;
        elements.deleteTask.hidden = true;
        elements.taskDate.value = dateKey(state.selectedDate);
        setTaskTime('none');
        elements.taskDuration.value = 'none';
        toggleNoTimeFields();
        iconPicker.setIcon('fa-solid fa-calendar-check');
        elements.taskRepeat.value = 'sem-repeticao';
        elements.taskRepeatInterval.value = '1';
        elements.taskRepeatUnit.value = 'dias';
        toggleCustomRepeatOptions();
        anotacoesEditor.limpar();
        renderBairroTaskDetails(null);
    }

    elements.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => elements.taskTitle.focus(), 50);
}

function saveAndCloseTaskModal() {
    console.log('[CALENDARIO][POPUP] Clique no X:', {
        editingTaskId: state.editingTaskId,
        novoBloco: !state.editingTaskId,
        formValido: elements.taskForm.reportValidity()
    });
    if (!state.editingTaskId) {
        closeTaskModal();
        return;
    }

    if (!elements.taskForm.reportValidity()) return;
    addTask({ preventDefault() {} });
}

function closeTaskModal() {
    state.editingTaskId = null;
    elements.modal.hidden = true;
    document.body.style.overflow = '';
}

async function partilharAnotacaoTarefa(caixa) {
    if (!cloudUser) return;
    if (!state.editingTaskId) {
        showToast('Guarda a tarefa antes de partilhares a anotação.');
        return;
    }

    const record = findTaskRecord(state.editingTaskId);
    if (!record) return;

    await abrirPopupPartilhar(
        { ...caixa, origem: 'notaday', tarefaId: record.task.id },
        record.task.id,
        () => {},
        db,
        auth
    );
}

async function addTask(event) {
    event.preventDefault();
    if (!cloudUser) {
        closeTaskModal();
        return;
    }
    const formData = new FormData(elements.taskForm);
    const category = String(formData.get('category'));
    const key = String(formData.get('date')) || dateKey(state.selectedDate);
    const title = String(formData.get('title')).trim();
    const noTime = !elements.taskTime.value;
    const time = noTime ? '' : String(formData.get('time'));
    const durationValue = String(formData.get('duration') || 'none');
    const duration = durationValue === 'none' ? 0 : Number(durationValue);
    const repeat = String(formData.get('repeat') || 'sem-repeticao');
    const repeatInterval = Math.max(1, Number(formData.get('repeatInterval')) || 1);
    const repeatUnit = String(formData.get('repeatUnit') || 'dias');
    const icon = String(formData.get('icon') || 'fa-solid fa-calendar-check');
    const caixas = anotacoesEditor?.obterCaixas() || [];
    const note = '';
    const calendarId = category;
    console.log('[CALENDARIO][TAREFA] A guardar tarefa:', {
        editingTaskId: state.editingTaskId,
        title,
        key,
        repeat,
        caixas
    });

    if (state.editingTaskId) {
        const record = findTaskRecord(state.editingTaskId);
        if (!record) return;

        Object.assign(record.task, { title, time, noTime, duration, repeat, repeatInterval, repeatUnit, icon, category, note, caixas, calendarId });

        if (repeat !== 'sem-repeticao' || record.task.serieId) {
            atualizarSerieRecorrente({
                ...record.task,
                id: record.task.serieId || record.task.id,
                serieId: null
            }, key);
            closeTaskModal();
            renderAll();
            showToast('Série actualizada.');
            return;
        }

        if (record.dateKey !== key) {
            state.tasks[record.dateKey] = state.tasks[record.dateKey].filter((task) => task.id !== record.task.id);
            state.tasks[key] = [...(state.tasks[key] || []), record.task];
        }

        enfileirarGravacaoCloud(record.task, key);
        closeTaskModal();
        renderAll();
        showToast('AlteraÃ§Ãµes guardadas.');
        return;
    }

    const task = {
        id: createId(),
        title,
        time,
        noTime,
        duration,
        repeat,
        repeatInterval,
        repeatUnit,
        category,
        note,
        caixas,
        calendarId,
        icon: categoryMeta[category]?.icon || '•',
        completed: false
    };
    task.icon = icon;

    const ocorrencias = gerarOcorrencias(task, key);
    ocorrencias.forEach(({ task: occurrence, dateKey: occurrenceDateKey }) => {
        state.tasks[occurrenceDateKey] = [...(state.tasks[occurrenceDateKey] || []), occurrence]
            .sort(sortTasksByTime);
    });
    const tarefaPrincipal = ocorrencias[0]?.task || task;
    if (cloudUser) {
        pendingCloudOperations.set(tarefaPrincipal.id, {
            type: 'write',
            task: { ...tarefaPrincipal, serieId: null, ocorrenciaPrincipal: true },
            dateKey: key
        });
    }
    descarregarOperacoesCloud();
    closeTaskModal();
    renderAll();
    showToast(repeat === 'sem-repeticao'
        ? 'Tarefa acrescentada ao teu dia.'
        : 'Tarefa e repetições acrescentadas ao calendário.');
}

function atualizarSerieRecorrente(task, startDateKey) {
    const serieId = task.id;
    removerSerieDaMemoria(serieId);

    const ocorrencias = gerarOcorrencias(task, startDateKey);
    ocorrencias.forEach(({ task: occurrence, dateKey: occurrenceDateKey }) => {
        state.tasks[occurrenceDateKey] = [...(state.tasks[occurrenceDateKey] || []), occurrence]
            .sort(sortTasksByTime);
    });
    const tarefaPrincipal = ocorrencias[0]?.task || task;
    if (cloudUser) {
        pendingCloudOperations.set(tarefaPrincipal.id, {
            type: 'write',
            task: { ...tarefaPrincipal, serieId: null, ocorrenciaPrincipal: true },
            dateKey: startDateKey
        });
    }
    return descarregarOperacoesCloud();
}

function removerSerieDaMemoria(serieId) {
    if (cloudUser) {
        pendingCloudOperations.set(serieId, {
            type: 'delete',
            taskId: serieId
        });
    }

    Object.entries(state.tasks).forEach(([key, tasks]) => {
        const remaining = tasks.filter((task) => (task.serieId || task.id) !== serieId);
        if (remaining.length) state.tasks[key] = remaining;
        else delete state.tasks[key];
    });
}

const recurrenceWindows = {
    dias: 365,
    semanas: 52,
    meses: 24,
    anos: 5
};

function gerarOcorrencias(task, startDateKey) {
    if (task.repeat === 'sem-repeticao') {
        return [{ task, dateKey: startDateKey }];
    }

    const startDate = parseDateKey(startDateKey);
    const unit = getRecurrenceUnit(task);
    const interval = Math.max(1, Number(task.repeatInterval) || 1);
    const total = 1 + Math.floor(recurrenceWindows[unit] / interval);

    return Array.from({ length: total }, (_, index) => {
        const occurrenceDate = getRecurrenceDate(startDate, task, unit, interval, index);
        const occurrenceDateKey = dateKey(occurrenceDate);
        const isMainOccurrence = index === 0;

        return {
            dateKey: occurrenceDateKey,
            task: {
                ...task,
                id: isMainOccurrence ? task.id : `${task.id}--${occurrenceDateKey}`,
                serieId: isMainOccurrence ? null : task.id,
                ocorrenciaData: occurrenceDateKey,
                ocorrenciaPrincipal: isMainOccurrence
            }
        };
    });
}

function getRecurrenceUnit(task) {
    if (task.repeat === 'diario') return 'dias';
    if (task.repeat === 'semanalmente') return 'semanas';
    if (task.repeat === 'mensal') return 'meses';
    if (task.repeat === 'anual') return 'anos';
    return task.repeatUnit || 'dias';
}

function getRecurrenceDate(startDate, task, unit, interval, index) {
    const amount = interval * index;
    if (unit === 'dias') return addDays(startDate, amount);
    if (unit === 'semanas') return addDays(startDate, amount * 7);
    if (unit === 'meses') return addMonthsFromStart(startDate, amount);
    return addYearsFromStart(startDate, amount);
}

function addMonthsFromStart(date, months) {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

function addYearsFromStart(date, years) {
    const targetYear = date.getFullYear() + years;
    const lastDay = new Date(targetYear, date.getMonth() + 1, 0).getDate();
    return new Date(targetYear, date.getMonth(), Math.min(date.getDate(), lastDay));
}

function deleteEditingTask() {
    if (!cloudUser) return;
    if (!state.editingTaskId) return;
    const record = findTaskRecord(state.editingTaskId);
    if (!record) return;
    if (!window.confirm(`Eliminar "${record.task.title}"?`)) return;

    state.tasks[record.dateKey] = state.tasks[record.dateKey].filter((task) => task.id !== record.task.id);
    enfileirarEliminacaoCloud(record.task.id);
    closeTaskModal();
    renderAll();
    showToast('Tarefa eliminada.');
}

function findTaskRecord(taskId) {
    for (const [dateKeyValue, tasks] of Object.entries(state.tasks)) {
        const task = tasks.find((item) => item.id === taskId);
        if (task) return { task, dateKey: dateKeyValue };
    }
    return null;
}

function toggleTask(taskId) {
    if (!cloudUser) return;
    Object.entries(state.tasks).forEach(([key, tasks]) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;
        task.completed = !task.completed;
        enfileirarGravacaoCloud(task, key);
    });
    renderAll();
}

function moveTaskToDate(taskId, targetDateKey, targetTime = '') {
    if (!cloudUser) return;
    let sourceDateKey = '';
    let movingTask = null;

    Object.entries(state.tasks).some(([key, tasks]) => {
        const taskIndex = tasks.findIndex((task) => task.id === taskId);
        if (taskIndex < 0) return false;
        sourceDateKey = key;
        [movingTask] = tasks.splice(taskIndex, 1);
        return true;
    });

    if (!movingTask || !targetDateKey) return;
    if (targetTime && !movingTask.noTime) movingTask.time = targetTime;
    if (sourceDateKey === targetDateKey) {
        state.tasks[sourceDateKey].push(movingTask);
        state.tasks[sourceDateKey].sort(sortTasksByTime);
        enfileirarGravacaoCloud(movingTask, sourceDateKey);
        renderAll();
        return;
    }

    state.tasks[targetDateKey] = [...(state.tasks[targetDateKey] || []), movingTask]
        .sort(sortTasksByTime);
    enfileirarGravacaoCloud(movingTask, targetDateKey);
    renderAll();
    showToast(`Tarefa movida para ${formatDateKey(targetDateKey)}.`);
}

function sortTasksByTime(first, second) {
    const firstTime = first.noTime || !first.time ? '99:99' : first.time;
    const secondTime = second.noTime || !second.time ? '99:99' : second.time;
    return firstTime.localeCompare(secondTime);
}

function clearCompletedTasks() {
    if (!cloudUser) return;
    const dates = state.viewMode === 'week'
        ? Array.from({ length: 7 }, (_, index) => addDays(state.weekStart, index))
        : state.viewMode === 'month'
            ? getDatesInMonth(state.selectedDate)
            : [state.selectedDate];
    const completedCount = dates.reduce((total, date) => total + getTasksForDate(date).filter((task) => task.completed).length, 0);

    if (!completedCount) {
        showToast('Não há tarefas concluídas para limpar.');
        return;
    }

    if (!window.confirm(`Remover ${completedCount} ${completedCount === 1 ? 'tarefa concluída' : 'tarefas concluídas'}?`)) return;

    dates.forEach((date) => {
        const key = dateKey(date);
        const completedTasks = (state.tasks[key] || []).filter((task) => task.completed);
        completedTasks.forEach((task) => enfileirarEliminacaoCloud(task.id));
        state.tasks[key] = (state.tasks[key] || []).filter((task) => !task.completed);
    });
    renderAll();
    showToast('Tarefas concluídas removidas.');
}

function toggleLaterTask(taskId) {
    const task = laterTasks.find((item) => item.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    renderLaterTasks();
}

function toggleTimer() {
    if (state.timer.remaining <= 0) resetTimer();
    state.timer.running = !state.timer.running;

    if (state.timer.running) {
        state.timer.intervalId = window.setInterval(() => {
            state.timer.remaining -= 1;
            if (state.timer.remaining <= 0) {
                state.timer.remaining = 0;
                state.timer.running = false;
                window.clearInterval(state.timer.intervalId);
                showToast('Bloco de foco concluído. Respira um pouco.');
            }
            renderTimer();
        }, 1000);
    } else {
        window.clearInterval(state.timer.intervalId);
    }
    renderTimer();
}

function resetTimer() {
    window.clearInterval(state.timer.intervalId);
    state.timer.duration = 25 * 60;
    state.timer.remaining = state.timer.duration;
    state.timer.running = false;
    renderTimer();
}

function addTimerMinutes() {
    state.timer.duration += 5 * 60;
    state.timer.remaining += 5 * 60;
    renderTimer();
}

function openFocusMode() {
    renderFocusTask();
    elements.focusMode.hidden = false;
    document.body.style.overflow = 'hidden';
    document.querySelector('#close-focus-mode').focus();
}

function closeFocusMode() {
    elements.focusMode.hidden = true;
    document.body.style.overflow = '';
}

function renderFocusTask() {
    const nextTask = getTasksForDate(state.selectedDate)
        .filter((task) => task.source !== 'google' && !task.completed)
        .sort((first, second) => first.time.localeCompare(second.time))[0];
    elements.focusTaskName.textContent = nextTask
        ? `${nextTask.time} · ${nextTask.title}`
        : 'Todas as tarefas deste dia estão concluídas.';
    elements.completeFocusTask.hidden = !nextTask;
    elements.completeFocusTask.dataset.taskId = nextTask?.id || '';
}

function completeCurrentFocusTask() {
    const taskId = elements.completeFocusTask.dataset.taskId;
    if (!taskId) return;
    toggleTask(taskId);
    showToast('Tarefa concluída. Bom trabalho.');
}

function handleNavigation(button) {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const view = button.dataset.view;
    if (view === 'focus') {
        openFocusMode();
        return;
    }
    if (view === 'today') {
        state.taskFilter = 'all';
        setDisplayMode('list');
    }
    if (view === 'plan') {
        state.taskFilter = 'all';
        setDisplayMode('calendar');
    }
    if (view === 'routines') {
        state.taskFilter = 'routines';
        setViewMode('week');
    }
    const target = view === 'routines'
            ? document.querySelector('.timeline-section')
            : view === 'plan'
                ? document.querySelector('.timeline-section')
                : document.querySelector('.topbar');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleMobileNavigation(button, index) {
    document.querySelectorAll('.mobile-nav button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    if (index === 2) {
        openFocusMode();
        return;
    }
    if (index === 0) {
        state.taskFilter = 'all';
        setDisplayMode('list');
    }
    if (index === 1) {
        state.taskFilter = 'all';
        setDisplayMode('calendar');
    }
    if (index === 3) {
        state.taskFilter = 'routines';
        setViewMode('week');
    }
    const targets = ['.topbar', '.timeline-section', '.focus-mode', '.timeline-section'];
    document.querySelector(targets[index])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showToast(message) {
    window.clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    toastTimeout = window.setTimeout(() => elements.toast.classList.remove('visible'), 2600);
}

function getTasksForDate(date) {
    const key = dateKey(date);
    return [...(state.tasks[key] || []), ...(state.googleEvents[key] || [])];
}

function getVisibleTasksForDate(date) {
    return getTasksForDate(date)
        .filter(tarefaVisivelNoCalendario)
        .filter(task => state.taskFilter === 'all' || isRoutineTask(task));
}

function obterTarefasVisiveisPorData() {
    const keys = new Set([...Object.keys(state.tasks), ...Object.keys(state.googleEvents)]);
    return Object.fromEntries([...keys].map((key) => {
        const tasks = [...(state.tasks[key] || []), ...(state.googleEvents[key] || [])]
            .filter(tarefaVisivelNoCalendario);
        return [key, state.taskFilter === 'all' ? tasks : tasks.filter(isRoutineTask)];
    }));
}

function tarefaVisivelNoCalendario(task) {
    const visivel = !task?.origemBairro || meuBairroPermitido;
    if (task?.origemBairro) {
        console.info(`[MEU-BAIRRO][CALENDARIO] Filtro: id=${task.id} data=${task.data || task.date || ''} permitido=${meuBairroPermitido} visivel=${visivel}`);
    }
    return visivel;
}

function isRoutineTask(task) {
    return task.repeat === 'diario' || task.repeat === 'semanalmente';
}

function getRelativeDateLabel(date) {
    const difference = Math.round((startOfDay(date) - today) / 86400000);
    if (difference === 0) return 'Hoje';
    if (difference === 1) return 'Amanhã';
    if (difference === -1) return 'Ontem';
    return capitalize(date.toLocaleDateString('pt-PT', { weekday: 'long' }));
}

function formatLongDate(date) {
    return capitalize(date.toLocaleDateString('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }));
}

function formatShortDate(date) {
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
    const copy = startOfDay(date);
    const offset = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - offset);
    return copy;
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function getDatesInMonth(date) {
    const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1));
}

function formatDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

function sameDay(first, second) {
    return dateKey(first) === dateKey(second);
}

function capitalize(value) {
    return value.charAt(0).toLocaleUpperCase('pt-PT') + value.slice(1);
}

function createId() {
    return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
