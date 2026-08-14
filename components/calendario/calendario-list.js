import { createIconElement } from './calendario-icons.js';

export function renderListView(options) {
    const {
        container,
        date,
        tasks,
        visibleCategories,
        onToggleTask,
        onEditTask
    } = options;

    container.replaceChildren();
    container.className = 'timeline list-view-host';

    const visibleTasks = tasks
        .filter((task) => visibleCategories.has(task.calendarId || task.category))
        .sort((first, second) => sortByTime(first, second));
    console.info(`[CALENDARIO][LISTA] Filtro de categorias: recebidas=${tasks.length} visiveis=${visibleTasks.length} categoriasActivas=${[...visibleCategories].join(',') || '(nenhuma)'} tarefas=${tasks.map(task => `${task.id}:${task.calendarId || task.category || '(sem-categoria)'}`).join(',') || '(nenhuma)'}`);

    if (!visibleTasks.length) {
        container.append(createEmptyState());
        return;
    }

    visibleTasks.forEach((task) => {
        container.append(createListTask(task, date, onToggleTask, onEditTask));
    });
}

function createListTask(task, date, onToggleTask, onEditTask) {
    const item = document.createElement('article');
    const isGoogleEvent = task.source === 'google';
    item.className = `timeline-item${isGoogleEvent ? ' google-event' : ''}`;
    item.dataset.taskId = task.id;
    if (!isGoogleEvent) {
        item.dataset.dropDate = dateKey(date);
        item.addEventListener('click', (event) => {
            if (event.target.closest('.task-check')) return;
            onEditTask(task.id);
        });
    } else if (task.htmlLink) {
        item.title = 'Abrir no Google Calendar';
        item.addEventListener('click', () => window.open(task.htmlLink, '_blank', 'noopener'));
    }

    const time = document.createElement('time');
    time.className = 'timeline-time';
    if (task.time && !task.noTime) time.dateTime = task.time;
    time.textContent = task.noTime || !task.time ? 'Sem hora' : task.time;

    const card = document.createElement('div');
    card.className = `task-card ${task.category}${task.completed ? ' completed' : ''}`;

    const icon = createIconElement(task.icon || 'fa-solid fa-calendar-check', 'task-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = task.icon || '•';

    const copy = document.createElement('div');
    copy.className = 'task-copy';
    const title = document.createElement('strong');
    title.textContent = task.title;
    const note = document.createElement('small');
    note.textContent = `${formatDuration(task.duration)}${task.note ? ` · ${task.note}` : ''}`;
    copy.append(title, note);

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'task-check';
    check.textContent = task.completed ? '✓' : '';
    check.setAttribute('aria-label', task.completed ? `Marcar ${task.title} como por fazer` : `Concluir ${task.title}`);
    if (!isGoogleEvent) {
        check.addEventListener('click', (event) => {
            event.stopPropagation();
            onToggleTask(task.id);
        });
    } else {
        check.disabled = true;
    }

    const renderedIcon = createIconElement(task.icon || 'fa-solid fa-calendar-check', 'task-icon');
    card.append(renderedIcon, copy, check);
    item.append(time, card);
    return item;
}

function createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const copy = document.createElement('div');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '☁';
    const title = document.createElement('strong');
    title.textContent = 'Um dia com espaço.';
    const description = document.createElement('p');
    description.textContent = 'Acrescenta apenas o que realmente cabe.';
    copy.append(icon, title, description);
    empty.append(copy);
    return empty;
}

function formatDuration(minutes) {
    if (!minutes || minutes === 'none' || Number(minutes) <= 0) return 'Sem duração';
    if (Number(minutes) < 60) return `${minutes} min`;
    const hours = Math.floor(Number(minutes) / 60);
    const remainder = Number(minutes) % 60;
    return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function sortByTime(first, second) {
    const firstTime = first.noTime || !first.time ? '99:99' : first.time;
    const secondTime = second.noTime || !second.time ? '99:99' : second.time;
    return firstTime.localeCompare(secondTime);
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
