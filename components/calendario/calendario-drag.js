export function initializeTaskDrag({ onMoveTask }) {
    let draggedTaskId = '';
    let dragSource = null;
    let activeTarget = null;
    let touchState = null;
    let suppressNextClick = false;

    document.addEventListener('dragstart', (event) => {
        const source = event.target.closest?.('[data-task-id]');
        if (!source) return;
        draggedTaskId = source.dataset.taskId;
        dragSource = source;
        source.classList.add('drag-source');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedTaskId);
    });

    document.addEventListener('dragover', (event) => {
        if (!draggedTaskId) return;
        const target = findDropTarget(event.clientX, event.clientY);
        if (!target) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setActiveTarget(target);
    });

    document.addEventListener('drop', (event) => {
        if (!draggedTaskId) return;
        const target = findDropTarget(event.clientX, event.clientY) || activeTarget;
        if (!target) return;
        event.preventDefault();
        onMoveTask(draggedTaskId, target.dropDate, target.dropTime);
        cleanupDesktopDrag();
    });

    document.addEventListener('dragend', cleanupDesktopDrag);

    document.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if (event.target.closest('.task-check, .schedule-event-check, input, select, a')) return;
        const source = event.target.closest('[data-task-id]');
        if (!source) return;
        if (!source.draggable) return;

        const isMouse = event.pointerType === 'mouse';
        if (isMouse) return;

        touchState = {
            pointerId: event.pointerId,
            source,
            taskId: source.dataset.taskId,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            active: false,
            isMouse,
            wasDraggable: source.draggable,
            ghost: null,
            preview: null,
            timer: isMouse ? null : window.setTimeout(() => activateTouchDrag(source), 320)
        };
        source.draggable = false;
    }, { passive: true });

    document.addEventListener('pointermove', (event) => {
        if (!touchState || event.pointerId !== touchState.pointerId) return;
        touchState.x = event.clientX;
        touchState.y = event.clientY;

        if (!touchState.active) {
            const distance = Math.hypot(event.clientX - touchState.startX, event.clientY - touchState.startY);
            if (distance <= 9) return;
            if (!touchState.isMouse) {
                cancelTouchDrag();
                return;
            }
            activateTouchDrag(touchState.source);
        }

        event.preventDefault();
        positionGhost(touchState.ghost, event.clientX, event.clientY);
        const target = findDropTarget(event.clientX, event.clientY);
        setActiveTarget(target);
        updateDragPreview(touchState.preview, target);
    }, { passive: false });

    document.addEventListener('pointerup', (event) => {
        if (!touchState || event.pointerId !== touchState.pointerId) return;
        if (touchState.active) {
            event.preventDefault();
            suppressNextClick = true;
            window.setTimeout(() => { suppressNextClick = false; }, 450);
            if (activeTarget) onMoveTask(touchState.taskId, activeTarget.dropDate, activeTarget.dropTime);
        }
        cancelTouchDrag();
    });

    document.addEventListener('click', (event) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    document.addEventListener('pointercancel', cancelTouchDrag);
    document.addEventListener('contextmenu', (event) => {
        if (touchState?.active) event.preventDefault();
    });

    function activateTouchDrag(source) {
        if (!touchState) return;
        touchState.active = true;
        source.classList.add('drag-source');
        source.setPointerCapture?.(touchState.pointerId);
        const ghost = source.cloneNode(true);
        ghost.classList.remove('drag-source');
        ghost.classList.add('drag-ghost');
        ghost.removeAttribute('draggable');
        ghost.querySelectorAll('[id]').forEach((item) => item.removeAttribute('id'));
        document.body.append(ghost);
        touchState.ghost = ghost;
        if (source.classList.contains('schedule-event')) {
            const preview = source.cloneNode(true);
            preview.classList.remove('drag-source', 'drag-ghost');
            preview.classList.add('drag-preview');
            preview.removeAttribute('draggable');
            preview.removeAttribute('data-task-id');
            preview.removeAttribute('data-drop-date');
            preview.setAttribute('aria-hidden', 'true');
            preview.querySelectorAll('[id]').forEach((item) => item.removeAttribute('id'));
            touchState.preview = preview;
        }
        document.body.classList.add('task-touch-dragging');
        positionGhost(ghost, touchState.x, touchState.y);
        const target = findDropTarget(touchState.x, touchState.y);
        setActiveTarget(target);
        updateDragPreview(touchState.preview, target);
        navigator.vibrate?.(25);
    }

    function cancelTouchDrag() {
        if (!touchState) return;
        window.clearTimeout(touchState.timer);
        touchState.source.draggable = touchState.wasDraggable;
        touchState.source.classList.remove('drag-source');
        touchState.ghost?.remove();
        touchState.preview?.remove();
        document.body.classList.remove('task-touch-dragging');
        touchState = null;
        clearActiveTarget();
    }

    function cleanupDesktopDrag() {
        dragSource?.classList.remove('drag-source');
        dragSource = null;
        draggedTaskId = '';
        clearActiveTarget();
    }

    function setActiveTarget(target) {
        if (activeTarget?.element === target?.element) {
            activeTarget = target;
            return;
        }
        clearActiveTarget();
        activeTarget = target;
        activeTarget?.element.classList.add('drag-over');
    }

    function clearActiveTarget() {
        activeTarget?.element.classList.remove('drag-over');
        activeTarget = null;
    }
}

function findDropTarget(x, y) {
    const pointTarget = document.elementFromPoint(x, y);
    const scheduleCanvas = pointTarget?.closest?.('.schedule-canvas');
    if (scheduleCanvas) {
        const column = Array.from(scheduleCanvas.querySelectorAll('.schedule-day-column'))
            .find((candidate) => {
                const bounds = candidate.getBoundingClientRect();
                return x >= bounds.left && x <= bounds.right;
            });
        if (column) {
            return {
                element: column,
                dropDate: column.dataset.dropDate,
                dropTime: timeFromScheduleY(y, scheduleCanvas.getBoundingClientRect().top)
            };
        }
    }

    const element = pointTarget?.closest?.('[data-drop-date]');
    return element ? { element, dropDate: element.dataset.dropDate, dropTime: '' } : null;
}

function timeFromScheduleY(y, canvasTop) {
    const HOUR_START = 7;
    const HOUR_END = 22;
    const HOUR_HEIGHT = 72;
    const rawMinutes = HOUR_START * 60 + ((y - canvasTop) / HOUR_HEIGHT) * 60;
    const snappedMinutes = Math.round(rawMinutes / 15) * 15;
    const minutes = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, snappedMinutes));
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function updateDragPreview(preview, target) {
    if (!preview) return;
    const column = target?.element;
    const canvas = column?.closest?.('.schedule-canvas');
    if (!canvas || !target.dropTime) {
        preview.remove();
        return;
    }

    if (preview.parentElement !== canvas) canvas.append(preview);
    const columns = Array.from(canvas.querySelectorAll('.schedule-day-column'));
    const columnIndex = columns.indexOf(column);
    const [hours, minutes] = target.dropTime.split(':').map(Number);
    const top = ((hours + minutes / 60 - 7) / 1) * 72;
    preview.style.setProperty('--event-column', String(columnIndex));
    preview.style.setProperty('--event-top', `${Math.max(0, top)}px`);
}

function positionGhost(ghost, x, y) {
    if (!ghost) return;
    ghost.style.left = `${x + 14}px`;
    ghost.style.top = `${y + 14}px`;
}
