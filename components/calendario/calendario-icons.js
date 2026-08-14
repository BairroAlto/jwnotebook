const iconCategories = [
    {
        label: 'Planeamento',
        icons: ['fa-calendar-check', 'fa-calendar-days', 'fa-calendar-week', 'fa-clock', 'fa-hourglass-half', 'fa-list-check', 'fa-check', 'fa-xmark', 'fa-plus', 'fa-minus', 'fa-arrows-rotate', 'fa-bell', 'fa-flag', 'fa-bullseye', 'fa-bookmark']
    },
    {
        label: 'Trabalho e estudo',
        icons: ['fa-briefcase', 'fa-laptop', 'fa-computer', 'fa-file-lines', 'fa-folder-open', 'fa-clipboard', 'fa-pen', 'fa-pencil', 'fa-ruler', 'fa-calculator', 'fa-book', 'fa-graduation-cap', 'fa-chalkboard-user', 'fa-chalkboard', 'fa-magnifying-glass']
    },
    {
        label: 'Casa',
        icons: ['fa-house', 'fa-house-chimney', 'fa-couch', 'fa-bed', 'fa-kitchen-set', 'fa-bath', 'fa-broom', 'fa-spray-can-sparkles', 'fa-soap', 'fa-toilet-paper', 'fa-box', 'fa-box-open', 'fa-key', 'fa-lightbulb', 'fa-plug']
    },
    {
        label: 'Saúde e bem-estar',
        icons: ['fa-heart-pulse', 'fa-brain', 'fa-pills', 'fa-syringe', 'fa-kit-medical', 'fa-notes-medical', 'fa-bandage', 'fa-thermometer-half', 'fa-eye', 'fa-glasses', 'fa-tooth', 'fa-person-walking', 'fa-person-running', 'fa-dumbbell', 'fa-spa']
    },
    {
        label: 'Comida e bebida',
        icons: ['fa-mug-hot', 'fa-utensils', 'fa-apple-whole', 'fa-carrot', 'fa-bowl-food', 'fa-burger', 'fa-pizza-slice', 'fa-cake-candles', 'fa-bottle-water', 'fa-wine-glass', 'fa-martini-glass', 'fa-ice-cream', 'fa-cookie-bite', 'fa-lemon', 'fa-pepper-hot']
    },
    {
        label: 'Transportes e viagens',
        icons: ['fa-car', 'fa-bus', 'fa-train', 'fa-plane', 'fa-bicycle', 'fa-motorcycle', 'fa-ship', 'fa-taxi', 'fa-truck', 'fa-route', 'fa-map', 'fa-map-location-dot', 'fa-location-dot', 'fa-compass', 'fa-suitcase-rolling']
    },
    {
        label: 'Pessoas e emoções',
        icons: ['fa-user', 'fa-users', 'fa-person', 'fa-child', 'fa-baby', 'fa-people-group', 'fa-face-smile', 'fa-face-laugh', 'fa-face-meh', 'fa-face-sad-tear', 'fa-face-angry', 'fa-thumbs-up', 'fa-thumbs-down', 'fa-hands-clapping', 'fa-hand']
    },
    {
        label: 'Natureza e tempo',
        icons: ['fa-sun', 'fa-moon', 'fa-cloud', 'fa-cloud-sun', 'fa-snowflake', 'fa-leaf', 'fa-tree', 'fa-seedling', 'fa-fire', 'fa-droplet', 'fa-wind', 'fa-bolt', 'fa-umbrella', 'fa-rainbow', 'fa-mountain-sun']
    },
    {
        label: 'Criatividade e lazer',
        icons: ['fa-music', 'fa-headphones', 'fa-microphone', 'fa-camera', 'fa-image', 'fa-video', 'fa-gamepad', 'fa-puzzle-piece', 'fa-palette', 'fa-paintbrush', 'fa-scissors', 'fa-dice', 'fa-chess', 'fa-masks-theater', 'fa-film']
    },
    {
        label: 'Finanças e ferramentas',
        icons: ['fa-wallet', 'fa-credit-card', 'fa-coins', 'fa-money-bill', 'fa-cart-shopping', 'fa-basket-shopping', 'fa-receipt', 'fa-gift', 'fa-wrench', 'fa-screwdriver-wrench', 'fa-hammer', 'fa-screwdriver', 'fa-gear', 'fa-recycle', 'fa-trash']
    }
];

const DEFAULT_ICON = 'fa-solid fa-calendar-check';

export function createIconElement(icon, extraClass = '') {
    const value = String(icon || '').trim();
    const isFontAwesome = value.includes('fa-');
    const element = document.createElement(isFontAwesome ? 'i' : 'span');
    element.className = extraClass;
    element.setAttribute('aria-hidden', 'true');

    if (isFontAwesome) element.classList.add(...normaliseIconClass(value).split(' '));
    else element.textContent = value || '•';

    return element;
}

export function initializeIconPicker({ trigger, menu, input, preview }) {
    let closePicker;
    menu.replaceChildren();

    iconCategories.forEach((category) => {
        const group = document.createElement('section');
        group.className = 'icon-picker-category';

        const heading = document.createElement('h3');
        heading.textContent = category.label;
        group.append(heading);

        const grid = document.createElement('div');
        grid.className = 'icon-picker-grid';
        category.icons.forEach((iconName) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'icon-picker-option';
            option.dataset.icon = `fa-solid ${iconName}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-label', iconName.replace('fa-', '').replaceAll('-', ' '));
            option.title = iconName.replace('fa-', '').replaceAll('-', ' ');
            option.append(createIconElement(option.dataset.icon));
            option.addEventListener('click', () => {
                setIcon(option.dataset.icon);
                closePicker();
            });
            grid.append(option);
        });

        group.append(grid);
        menu.append(group);
    });

    function setIcon(icon = DEFAULT_ICON) {
        const normalised = normaliseIconClass(icon);
        input.value = normalised;
        preview.className = normalised;
        preview.setAttribute('aria-label', `Ícone escolhido: ${normalised.replace('fa-solid ', '').replace('fa-', '').replaceAll('-', ' ')}`);
        menu.querySelectorAll('.icon-picker-option').forEach((option) => {
            const selected = option.dataset.icon === normalised;
            option.classList.toggle('selected', selected);
            option.setAttribute('aria-selected', String(selected));
        });
    }

    function openPicker() {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
    }

    closePicker = () => {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menu.hidden) openPicker();
        else closePicker();
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('#task-icon-picker')) closePicker();
    });

    menu.addEventListener('click', (event) => event.stopPropagation());
    setIcon(input.value || DEFAULT_ICON);

    return { setIcon, close: closePicker };
}

export function getIconCount() {
    return iconCategories.reduce((total, category) => total + category.icons.length, 0);
}

function normaliseIconClass(icon) {
    const value = String(icon || '').trim();
    if (!value || !value.includes('fa-')) return DEFAULT_ICON;
    return value.includes('fa-solid') ? value : `fa-solid ${value}`;
}
