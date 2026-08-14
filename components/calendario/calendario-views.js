import { createIconElement } from './calendario-icons.js';

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_HEIGHT = 72;
const WEEKDAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function renderCalendarView(options) {
    const {
        container,
        mode,
        selectedDate,
        weekStart,
        tasksByDate,
        visibleCategories,
        onToggleTask,
        onEditTask,
        onSelectDate,
        onOpenDate
    } = options;

    container.replaceChildren();
    container.className = 'timeline calendar-view-host';

    if (mode === 'month') {
        container.append(createMonthView({
            selectedDate,
            tasksByDate,
            visibleCategories,
            onToggleTask,
            onEditTask,
            onOpenDate
        }));
        return;
    }

    const days = mode === 'week'
        ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
        : [selectedDate];

    container.append(createScheduleView({
        days,
        selectedDate,
        tasksByDate,
        visibleCategories,
        onToggleTask,
        onEditTask,
        onSelectDate
    }));
}

function createScheduleView(options) {
    const {
        days,
        selectedDate,
        tasksByDate,
        visibleCategories,
        onToggleTask,
        onEditTask,
        onSelectDate
    } = options;

    const section = document.createElement('section');
    section.className = 'calendar-schedule';

    const scroller = document.createElement('div');
    scroller.className = 'schedule-scroller';

    const frame = document.createElement('div');
    frame.className = 'schedule-frame';
    frame.style.setProperty('--schedule-columns', String(days.length));

    const header = document.createElement('header');
    header.className = 'schedule-header-row';
    const corner = document.createElement('span');
    corner.className = 'schedule-corner';
    header.append(corner);

    const currentDay = startOfDay(new Date());
    days.forEach((date) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'schedule-day-header';
        button.dataset.dropDate = dateKey(date);
        if (sameDay(date, selectedDate)) button.classList.add('is-selected');
        if (sameDay(date, currentDay)) button.classList.add('is-today');
        button.setAttribute('aria-label', formatLongDate(date));

        const weekday = document.createElement('span');
        weekday.textContent = date.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
        const number = document.createElement('strong');
        number.textContent = String(date.getDate());
        button.append(weekday, number);
        button.addEventListener('click', () => onSelectDate(date));
        header.append(button);
    });

    const body = document.createElement('div');
    body.className = 'schedule-body-row';
    const timeAxis = document.createElement('div');
    timeAxis.className = 'schedule-time-axis';

    for (let hour = HOUR_START; hour < HOUR_END; hour += 1) {
        const label = document.createElement('time');
        label.className = 'schedule-time-label';
        label.style.top = `${(hour - HOUR_START) * HOUR_HEIGHT}px`;
        label.textContent = `${String(hour).padStart(2, '0')}:00`;
        timeAxis.append(label);
    }

    const canvas = document.createElement('div');
    canvas.className = 'schedule-canvas';
    canvas.style.setProperty('--schedule-columns', String(days.length));
    days.forEach((date) => {
        const column = document.createElement('div');
        column.className = 'schedule-day-column';
        column.dataset.dropDate = dateKey(date);
        canvas.append(column);
    });

    days.forEach((date, dayIndex) => {
        getTasksForDate(tasksByDate, date)
            .filter((task) => visibleCategories.has(task.calendarId || task.category))
            .filter((task) => task.time && !task.noTime)
            .sort((first, second) => first.time.localeCompare(second.time))
            .forEach((task) => {
                canvas.append(createScheduleEvent(task, date, dayIndex, days.length, onToggleTask, onEditTask));
            });
    });

    const now = new Date();
    const todayIndex = days.findIndex((date) => sameDay(date, now));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (todayIndex >= 0 && nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60) {
        const line = document.createElement('span');
        line.className = 'schedule-now-line';
        line.style.setProperty('--now-top', `${((nowMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT}px`);
        line.style.left = `calc((100% / ${days.length}) * ${todayIndex})`;
        line.style.right = `calc(100% - (100% / ${days.length}) * ${todayIndex + 1})`;
        canvas.append(line);
    }

    body.append(timeAxis, canvas);
    frame.append(header, body);
    scroller.append(frame);
    section.append(scroller);

    window.requestAnimationFrame(() => {
        const firstTaskMinute = findFirstTaskMinute(days, tasksByDate, visibleCategories);
        const preferredMinute = firstTaskMinute === null ? 8 * 60 : Math.max(HOUR_START * 60, firstTaskMinute - 30);
        scroller.scrollTop = Math.max(0, ((preferredMinute - HOUR_START * 60) / 60) * HOUR_HEIGHT);
    });

    return section;
}

function createScheduleEvent(task, date, dayIndex, columnCount, onToggleTask, onEditTask) {
    const isGoogleEvent = task.source === 'google';
    const startMinutes = timeToMinutes(task.time);
    const top = Math.max(0, ((startMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT);
    const height = Math.max(31, (Number(task.duration) / 60) * HOUR_HEIGHT);

    const event = document.createElement('article');
    event.className = `schedule-event draggable-task ${task.category}${task.completed ? ' completed' : ''}${isGoogleEvent ? ' google-event' : ''}`;
    event.dataset.taskId = task.id;
    event.dataset.dropDate = dateKey(date);
    event.draggable = !isGoogleEvent;
    event.style.setProperty('--schedule-columns', String(columnCount));
    event.style.setProperty('--event-column', String(dayIndex));
    event.style.setProperty('--event-top', `${top}px`);
    event.style.setProperty('--event-height', `${height}px`);
    event.addEventListener('click', (clickEvent) => {
        if (clickEvent.target.closest('.schedule-event-check')) return;
        if (isGoogleEvent) {
            if (task.htmlLink) window.open(task.htmlLink, '_blank', 'noopener');
            return;
        }
        onEditTask(task.id);
    });
    event.title = `${task.time} · ${task.title}`;

    const copy = document.createElement('div');
    copy.className = 'schedule-event-copy';
    const title = document.createElement('strong');
    title.className = 'schedule-event-title';
    title.append(createIconElement(task.icon || 'fa-solid fa-calendar-check', 'schedule-task-icon'), document.createTextNode(` ${task.title}`));
    const meta = document.createElement('small');
    meta.className = 'schedule-event-meta';
    meta.textContent = formatDuration(task.duration);
    copy.append(title, meta);

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'schedule-event-check';
    check.textContent = task.completed ? '✓' : '';
    check.setAttribute('aria-label', task.completed ? `Reabrir ${task.title}` : `Concluir ${task.title}`);
    if (!isGoogleEvent) {
        check.addEventListener('click', (clickEvent) => {
            clickEvent.stopPropagation();
            onToggleTask(task.id);
        });
    } else {
        check.disabled = true;
    }

    event.append(copy, check);
    return event;
}

function createMonthView(options) {
    const {
        selectedDate,
        tasksByDate,
        visibleCategories,
        onToggleTask,
        onEditTask,
        onOpenDate
    } = options;

    const section = document.createElement('section');
    section.className = 'month-calendar-view';
    const inner = document.createElement('div');
    inner.className = 'month-view-inner';

    const weekdays = document.createElement('div');
    weekdays.className = 'month-weekdays';
    WEEKDAY_NAMES.forEach((name) => {
        const label = document.createElement('span');
        label.className = 'month-weekday';
        label.textContent = name;
        weekdays.append(label);
    });

    const grid = document.createElement('div');
    grid.className = 'month-grid';
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const currentDay = startOfDay(new Date());

    for (let index = 0; index < 42; index += 1) {
        const date = addDays(gridStart, index);
        const cell = document.createElement('article');
        cell.className = 'month-cell';
        cell.dataset.dropDate = dateKey(date);
        if (date.getMonth() !== selectedDate.getMonth()) cell.classList.add('outside-month');
        if (sameDay(date, selectedDate)) cell.classList.add('is-selected');
        if (sameDay(date, currentDay)) cell.classList.add('is-today');

        const dateButton = document.createElement('button');
        dateButton.type = 'button';
        dateButton.className = 'month-date-button';
        dateButton.textContent = String(date.getDate());
        dateButton.setAttribute('aria-label', formatLongDate(date));
        dateButton.addEventListener('click', () => onOpenDate(date));
        cell.append(dateButton);

        const taskList = document.createElement('div');
        taskList.className = 'month-task-list';
        const tasks = getTasksForDate(tasksByDate, date)
            .filter((task) => visibleCategories.has(task.calendarId || task.category))
            .sort((first, second) => first.time.localeCompare(second.time));

        tasks.slice(0, 3).forEach((task) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            const isGoogleEvent = task.source === 'google';
            pill.className = `month-task-pill ${task.category}${task.completed ? ' completed' : ''}${isGoogleEvent ? ' google-event' : ''}`;
            pill.dataset.taskId = task.id;
            pill.dataset.dropDate = dateKey(date);
            pill.draggable = !isGoogleEvent;
            pill.setAttribute('aria-label', `${task.time}, ${task.title}`);
            const title = document.createElement('span');
            title.append(document.createTextNode(`${task.time} `), createIconElement(task.icon || 'fa-solid fa-calendar-check', 'month-task-icon'), document.createTextNode(` ${task.title}`));
            pill.append(title);
            pill.addEventListener('click', () => {
                if (isGoogleEvent) {
                    if (task.htmlLink) window.open(task.htmlLink, '_blank', 'noopener');
                    return;
                }
                onEditTask(task.id);
            });
            taskList.append(pill);
        });

        if (tasks.length > 3) {
            const more = document.createElement('span');
            more.className = 'month-more';
            more.textContent = `+ ${tasks.length - 3} ${tasks.length - 3 === 1 ? 'tarefa' : 'tarefas'}`;
            taskList.append(more);
        }

        cell.append(taskList);
        grid.append(cell);
    }

    inner.append(weekdays, grid);
    section.append(inner);
    return section;
}

function findFirstTaskMinute(days, tasksByDate, visibleCategories) {
    const values = days.flatMap((date) => getTasksForDate(tasksByDate, date))
        .filter((task) => visibleCategories.has(task.calendarId || task.category))
        .filter((task) => task.time && !task.noTime)
        .map((task) => timeToMinutes(task.time))
        .filter((minutes) => minutes >= HOUR_START * 60 && minutes <= HOUR_END * 60);
    return values.length ? Math.min(...values) : null;
}

function getTasksForDate(tasksByDate, date) {
    return tasksByDate[dateKey(date)] || [];
}

function timeToMinutes(value) {
    const [hours, minutes] = String(value).split(':').map(Number);
    return hours * 60 + minutes;
}

function formatDuration(minutes) {
    if (!minutes || minutes === 'none' || Number(minutes) <= 0) return 'Sem duração';
    if (Number(minutes) < 60) return `${minutes} min`;
    const hours = Math.floor(Number(minutes) / 60);
    const remainder = Number(minutes) % 60;
    return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function formatLongDate(date) {
    const formatted = date.toLocaleDateString('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
    return formatted.charAt(0).toLocaleUpperCase('pt-PT') + formatted.slice(1);
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

function sameDay(first, second) {
    return dateKey(first) === dateKey(second);
}
