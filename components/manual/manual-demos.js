import { FERRAMENTAS_MANUAL } from './manual-data.js';
import { configurarDuplicacaoManual } from './manual-duplicate.js';

const timers = (items) => {
    const ids = [];
    const later = (fn, delay) => ids.push(setTimeout(fn, delay));
    return { later, clear: () => ids.forEach(clearTimeout) };
};

function node(tag, className, text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

const controlo = (icon, label, extra = '') => ({ icon, label, extra });
const separador = Object.freeze({ separator: true });
const estatico = (icon, label) => ({ icon, label, static: true });

const TOOLBARS = {
    contentor: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), separador, controlo('fa-satellite-dish', 'Pesquisa X-SAT')],
        right: [controlo('fa-tag', 'Conexões'), controlo('fa-paper-plane', 'Partilhar'), controlo('fa-palette', 'Mudar cor'), controlo('fa-trash', 'Ocultar', 'danger')]
    },
    subnota: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), separador, controlo('fa-satellite-dish', 'Pesquisa X-SAT')],
        right: [controlo('fa-tag', 'Conexões'), controlo('fa-paper-plane', 'Partilhar'), controlo('fa-palette', 'Mudar cor'), controlo('fa-trash', 'Ocultar', 'danger')]
    },
    questao: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), separador, controlo('fa-satellite-dish', 'Pesquisa X-SAT')],
        right: [controlo('fa-tag', 'Conexões'), controlo('fa-paper-plane', 'Partilhar'), controlo('fa-palette', 'Mudar cor'), controlo('fa-trash', 'Ocultar', 'danger')]
    },
    raciocinio: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-satellite-dish', 'Pesquisa X-SAT')],
        right: [controlo('fa-tag', 'Conexões'), controlo('fa-paper-plane', 'Partilhar'), controlo('fa-palette', 'Mudar cor'), controlo('fa-trash', 'Ocultar', 'danger')]
    },
    elevador: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-folder-plus', 'Adicionar barra pai')],
        right: [controlo('fa-tag', 'Tópicos'), controlo('fa-paper-plane', 'Partilhar'), controlo('fa-trash', 'Ocultar Elevador', 'danger')]
    },
    bairro: {
        left: [controlo('fa-chevron-up', 'Mover Bairro para cima'), controlo('fa-chevron-down', 'Mover Bairro para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-building', 'Adicionar grupo de tarefas')],
        right: [controlo('fa-palette', 'Colorir Bairro'), controlo('fa-trash', 'Ocultar Bairro', 'danger')]
    },
    firmamento: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-satellite-dish', 'Pesquisa X-SAT')],
        right: [controlo('fa-palette', 'Centro de Personalização'), controlo('fa-trash', 'Ocultar', 'danger')]
    },
    cartaovisita: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), controlo('fa-plus', 'Inserir ferramenta abaixo', 'add')],
        right: [controlo('fa-trash', 'Ocultar', 'danger')]
    },
    citacaobiblica: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-magnifying-glass', 'Escolher versículos')],
        right: [controlo('fa-trash', 'Ocultar', 'danger')]
    },
    webcard: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-magnifying-glass', 'Configurar links')],
        right: [controlo('fa-trash', 'Ocultar', 'danger')]
    },
    galeria: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), controlo('fa-magnifying-glass', 'Configurar imagens')],
        right: [controlo('fa-trash', 'Ocultar', 'danger')]
    },
    sumariar: {
        left: [controlo('fa-chevron-up', 'Mover para cima'), controlo('fa-chevron-down', 'Mover para baixo'), separador, controlo('fa-plus', 'Inserir ferramenta abaixo', 'add'), separador, controlo('fa-magnifying-glass', 'Configurar sumário')],
        right: [estatico('fa-mailchimp', 'Sumariar IA'), controlo('fa-trash', 'Ocultar', 'danger')]
    }
};

function criarControlo(item) {
    if (item.separator) return node('span', 'demo-control-separator');
    if (item.static) {
        const marca = node('span', 'demo-static-control');
        marca.innerHTML = '<i class="fa-brands ' + item.icon + '" aria-hidden="true"></i>';
        marca.title = item.label;
        marca.setAttribute('aria-label', item.label);
        return marca;
    }

    const controlo = node('button', 'demo-control' + (item.extra ? ' demo-control--' + item.extra : ''));
    controlo.type = 'button';
    controlo.tabIndex = item.extra === 'add' ? 0 : -1;
    controlo.innerHTML = '<i class="fa-solid ' + item.icon + '" aria-hidden="true"></i>';
    controlo.title = item.label;
    controlo.setAttribute('aria-label', item.label);
    if (item.extra === 'add') {
        controlo.dataset.demoAction = 'duplicate';
        controlo.classList.add('demo-control--interactive');
        controlo.title = 'Abrir ferramentas e duplicar esta ferramenta';
        controlo.setAttribute('aria-label', 'Abrir ferramentas e duplicar esta ferramenta');
        controlo.setAttribute('aria-disabled', 'false');
    } else {
        controlo.setAttribute('aria-disabled', 'true');
    }
    return controlo;
}

function toolbar(color, config = {}) {
    const bar = node('div', 'demo-toolbar');
    bar.style.setProperty('--demo-color', color);
    const left = node('div', 'demo-toolbar-group');
    const right = node('div', 'demo-toolbar-group');
    (config.left || []).map(criarControlo).forEach(item => left.appendChild(item));
    (config.right || []).map(criarControlo).forEach(item => right.appendChild(item));
    bar.append(left, right);
    return bar;
}
function textField(className, text, placeholder = '') {
    const field = node('div', className, text || placeholder);
    field.setAttribute('role', 'textbox');
    field.setAttribute('aria-label', placeholder || 'Conteúdo da demonstração');
    return field;
}

function simpleTextDemo(type, color, title, content, options = {}) {
    const frame = node('div', `demo-frame demo-frame--${type}`);
    frame.style.setProperty('--demo-color', color);
    frame.appendChild(toolbar(color, TOOLBARS[type]));
    if (options.focus) {
        const focus = node('span', 'demo-focus-chip', options.focus);
        frame.appendChild(focus);
    }
    if (title) frame.appendChild(textField('demo-title-field', title, 'Título'));
    frame.appendChild(textField('demo-content-field', content, 'Conteúdo'));
    return frame;
}

function buildContentor() {
    return simpleTextDemo('contentor', '#ea580c', '', 'A Rota da Seda ligava a China ao Mediterrâneo.', { focus: 'Foco: Geografia' });
}

function buildSubnota() {
    return simpleTextDemo('subnota', '#3b82f6', 'Uma cidade junto ao Tejo', 'Lisboa cresceu como porto e ponto de encontro entre rotas atlânticas.');
}

function buildQuestao() {
    return simpleTextDemo('questao', '#10b981', 'Porque mudam as fronteiras?', 'Rios, tratados e disputas podem redesenhar um mapa ao longo do tempo.');
}

function buildRaciocinio() {
    const frame = simpleTextDemo('raciocinio', '#f59e0b', 'Pistas sobre o Egipto', 'O Nilo, a agricultura e as cidades ajudam a explicar o nascimento desta civilização.');
    const number = node('span', 'demo-reason-number', '#1');
    frame.querySelector('.demo-title-field').prepend(number);
    return frame;
}

function buildElevador() {
    const frame = node('div', 'demo-frame demo-frame--elevador');
    frame.style.setProperty('--demo-color', '#ef4444');
    frame.appendChild(toolbar('#ef4444', TOOLBARS.elevador));

    const section = node('div', 'demo-elevator-section');
    const sectionHeader = node('div', 'demo-elevator-section-header');
    sectionHeader.append(
        node('span', 'demo-drag-handle', '⋮⋮'),
        node('strong', 'demo-elevator-parent-title', 'História de Lisboa')
    );
    const sectionActions = node('div', 'demo-inline-actions');
    sectionActions.append(
        criarControlo(controlo('fa-link', 'Adicionar ligação')),
        criarControlo(controlo('fa-folder-tree', 'Adicionar filho')),
        criarControlo(controlo('fa-eye-slash', 'Ocultar barra pai'))
    );
    sectionHeader.appendChild(sectionActions);

    const child = node('div', 'demo-elevator-child');
    child.append(
        node('span', 'demo-drag-handle', '⋮⋮'),
        node('strong', 'demo-elevator-child-title', 'O terramoto de 1755')
    );
    const childActions = node('div', 'demo-inline-actions');
    childActions.append(
        criarControlo(controlo('fa-link', 'Adicionar ligação ao filho')),
        criarControlo(controlo('fa-eye-slash', 'Ocultar filho')),
        criarControlo(controlo('fa-trash', 'Remover filho', 'danger'))
    );
    child.appendChild(childActions);

    const links = node('div', 'demo-elevator-link-list');
    const linkData = [
        ['Lisboa Pombalina', 'notabook/historia-lisboa-pombalina'],
        ['Reconstrução pós-1755', 'notabook/reconstrucao-de-1755']
    ];
    linkData.forEach((item, index) => {
        const row = node('div', 'demo-elevator-link-row');
        row.style.setProperty('--link-delay', (index * 180) + 'ms');
        row.append(
            node('span', 'demo-drag-handle', '⋮⋮'),
            node('span', 'demo-elevator-link-icon', '↗'),
            node('span', 'demo-elevator-link-label', item[0]),
            node('span', 'demo-elevator-link-url', item[1])
        );
        links.appendChild(row);
    });

    sectionHeader.classList.add('is-visible');
    section.append(sectionHeader, child, links);
    frame.appendChild(section);
    return { frame, animate: controls => {
        controls.later(() => child.classList.add('is-visible'), 520);
        controls.later(() => links.classList.add('is-visible'), 980);
    }};
}
function buildBairro() {
    const frame = node('div', 'demo-frame demo-frame--bairro');
    frame.style.setProperty('--demo-color', '#c084fc');
    frame.appendChild(toolbar('#c084fc', TOOLBARS.bairro));

    const group = node('div', 'demo-task-group');
    const groupHeader = node('div', 'demo-task-group-header');
    groupHeader.append(
        node('span', 'demo-group-icon', '⌂'),
        node('strong', 'demo-group-title', 'Missão: conhecer o Atlântico')
    );
    const groupActions = node('div', 'demo-inline-actions');
    groupActions.append(
        criarControlo(controlo('fa-plus', 'Adicionar tarefa', 'add')),
        criarControlo(controlo('fa-ellipsis-vertical', 'Abrir Posto de Ligação'))
    );
    groupHeader.appendChild(groupActions);
    group.appendChild(groupHeader);

    const checkPicker = node('div', 'demo-check-picker');
    checkPicker.appendChild(node('span', 'demo-check-label', 'Marcação'));
    [['fa-circle', 'Bola'], ['fa-square', 'Quadrado'], ['fa-arrow-right', 'Seta']].forEach((item, index) => {
        const option = node('span', 'demo-check-option' + (index === 0 ? ' is-selected' : ''));
        option.title = 'Tipo de marcação: ' + item[1];
        option.setAttribute('aria-label', option.title);
        option.innerHTML = '<i class="fa-solid ' + item[0] + '" aria-hidden="true"></i>';
        checkPicker.appendChild(option);
    });
    group.appendChild(checkPicker);

    const tasks = [
        node('div', 'demo-task', 'Localizar os Açores'),
        node('div', 'demo-task', 'Comparar duas rotas')
    ];
    tasks.forEach(task => group.appendChild(task));
    frame.appendChild(group);

    return { frame, animate: controls => {
        controls.later(() => group.classList.add('is-built'), 260);
        controls.later(() => checkPicker.querySelectorAll?.('.demo-check-option')[1]?.classList.add('is-selected'), 620);
        controls.later(() => tasks[0].classList.add('is-visible'), 760);
        controls.later(() => tasks[1].classList.add('is-visible'), 980);
        controls.later(() => tasks[0].classList.add('is-complete'), 1380);
        controls.later(() => tasks[0].classList.add('is-hidden'), 2240);
    }};
}
function buildFirmamento() {
    const frame = node('div', 'demo-frame demo-frame--firmamento');
    frame.style.setProperty('--demo-color', '#d4af37');
    frame.style.setProperty('--firmamento-surface', '#111827');
    frame.appendChild(toolbar('#d4af37', TOOLBARS.firmamento));

    const palette = node('div', 'demo-firmamento-palette');
    ['#111827', '#1d4ed8', '#78350f'].forEach((color, index) => {
        const swatch = node('span', 'demo-swatch' + (index === 0 ? ' is-selected' : ''));
        swatch.style.setProperty('--swatch', color);
        swatch.title = 'Cor de fundo do Firmamento';
        swatch.setAttribute('aria-label', swatch.title);
        palette.appendChild(swatch);
    });

    const content = textField('demo-firmamento-content', 'Subtópico: as estrelas orientavam navegadores.', 'Conteúdo');
    const highlight = node('span', 'demo-firmamento-highlight', 'Destaque');
    frame.append(palette, content, highlight);

    return { frame, animate: controls => {
        controls.later(() => {
            frame.style.setProperty('--firmamento-surface', '#172554');
            palette.children[0].classList.remove('is-selected');
            palette.children[1].classList.add('is-selected');
            content.classList.add('is-written');
        }, 700);
        controls.later(() => highlight.classList.add('is-visible'), 1120);
    }};
}
function buildCartaoVisita() {
    const frame = node('div', 'demo-frame demo-frame--cartao');
    frame.style.setProperty('--demo-color', '#d4af37');
    frame.appendChild(toolbar('#d4af37', TOOLBARS.cartaovisita));
    const body = node('div', 'demo-card-body');
    const image = node('div', 'demo-card-image', '✦');
    const copy = node('div', 'demo-card-copy');
    copy.append(node('strong', 'demo-title-field', 'Vasco da Gama'), node('span', 'demo-content-field', 'Uma viagem marítima que mudou as rotas para a Índia.'));
    body.append(image, copy);
    frame.appendChild(body);
    return frame;
}

function buildCitation() {
    const frame = node('div', 'demo-frame demo-frame--citation');
    frame.style.setProperty('--demo-color', '#94a3b8');
    frame.appendChild(toolbar('#94a3b8', TOOLBARS.citacaobiblica));

    const empty = node('div', 'demo-citation-empty', 'Clica na lupa para anexar escrituras...');
    const selector = node('section', 'demo-bible-selector');
    selector.setAttribute('role', 'dialog');
    selector.setAttribute('aria-label', 'Selector de Escrituras');

    const selectorHeader = node('div', 'demo-bible-selector-header');
    selectorHeader.append(
        node('strong', '', 'Selecionar Escrituras'),
        node('span', 'demo-bible-close', '×')
    );
    const navigation = node('div', 'demo-bible-navigation', 'Bíblia > Selecionar Livro');
    const stage = node('div', 'demo-bible-stage');
    const manual = node('div', 'demo-bible-manual');
    const manualLabel = node('label', '', 'Escrever referências');
    const manualInput = node('input', 'demo-bible-reference');
    manualInput.id = 'demo-bible-reference';
    manualInput.type = 'text';
    manualInput.readOnly = true;
    manualInput.placeholder = 'Ex.: Lucas 4:3';
    manualInput.setAttribute('aria-label', 'Escrever referências');
    manual.append(manualLabel, manualInput, node('small', '', 'Separa várias referências com ponto e vírgula.'));

    const selectorFooter = node('div', 'demo-bible-selector-footer');
    const count = node('span', 'demo-bible-count', '0 versículos selecionados');
    const confirm = node('button', 'demo-bible-confirm', 'Confirmar');
    confirm.type = 'button';
    confirm.setAttribute('aria-disabled', 'true');
    selectorFooter.append(count, confirm);
    selector.append(selectorHeader, navigation, stage, manual, selectorFooter);

    const attached = node('div', 'demo-citation-attached');
    const reference = node('strong', 'demo-citation-reference', 'Lucas 4:3');
    const text = node('span', 'demo-citation-text', '“Se és Filho de Deus, manda que esta pedra se transforme em pão.”');
    attached.append(reference, text);
    frame.append(empty, selector, attached);

    const livros = ['Mt', 'Mc', 'Lc', 'Jo'];
    const capitulos = ['1', '2', '3', '4'];
    const versiculos = ['1', '2', '3', '4'];
    stage.replaceChildren(...livros.map(livro => node('span', 'demo-bible-choice', livro)));

    return { frame, animate: controls => {
        controls.later(() => {
            empty.classList.add('is-dimmed');
            selector.classList.add('is-visible');
        }, 240);
        controls.later(() => {
            navigation.textContent = 'Bíblia > Lucas';
            stage.replaceChildren(...capitulos.map(capitulo => node('span', 'demo-bible-choice', capitulo)));
        }, 520);
        controls.later(() => {
            navigation.textContent = 'Bíblia > Lucas > Cap. 4';
            stage.replaceChildren(...versiculos.map(versiculo => node('span', 'demo-bible-choice' + (versiculo === '3' ? ' is-selected' : ''), versiculo)));
        }, 800);
        controls.later(() => {
            manualInput.value = 'Lucas 4:3';
            count.textContent = '1 versículo seleccionado';
        }, 1030);
        controls.later(() => {
            selector.classList.remove('is-visible');
            empty.classList.add('is-hidden');
            attached.classList.add('is-visible');
        }, 1280);
    }};
}
function buildWebcard() {
    const frame = node('div', 'demo-frame demo-frame--webcard');
    frame.style.setProperty('--demo-color', '#8b5cf6');
    frame.appendChild(toolbar('#8b5cf6', TOOLBARS.webcard));

    const empty = node('div', 'demo-web-empty', 'Clica na lupa para analisar URLs e gerar cartões...');
    const config = node('section', 'demo-web-config');
    config.setAttribute('role', 'dialog');
    config.setAttribute('aria-label', 'Configurar WebCard');
    const configHeader = node('div', 'demo-web-config-header');
    configHeader.append(node('strong', '', 'CONFIGURAR WEBCARD'), node('span', '', 'Até 5 links'));
    config.append(configHeader, node('p', '', 'Insere até 5 links para gerar os cartões visuais.'));
    const urlList = node('div', 'demo-web-url-list');
    const urls = ['https://ensina.rtp.pt/lisboa', 'https://www.visitlisboa.com/'];
    for (let index = 0; index < 5; index += 1) {
        const input = node('input', 'demo-web-url-input');
        input.type = 'text';
        input.readOnly = true;
        input.value = urls[index] || '';
        input.placeholder = 'Link ' + (index + 1) + (index === 0 ? ' (https://...)' : '');
        input.setAttribute('aria-label', 'Link ' + (index + 1));
        urlList.appendChild(input);
    }
    const configActions = node('div', 'demo-web-config-actions');
    const generate = node('button', 'demo-web-config-button demo-web-config-button--primary', 'Gerar Cards');
    generate.type = 'button';
    generate.setAttribute('aria-disabled', 'true');
    configActions.appendChild(generate);
    config.append(urlList, configActions);

    const resolving = node('div', 'demo-web-resolving');
    resolving.append(
        node('div', 'demo-web-skeleton', 'A resolver metadados...'),
        node('div', 'demo-web-skeleton', 'A resolver metadados...')
    );
    const results = node('div', 'demo-web-result-grid');
    const resultData = [
        ['Lisboa: uma cidade virada para o Tejo', 'ensina.rtp.pt', '#312e81'],
        ['Visitar Lisboa', 'visitlisboa.com', '#4c1d95']
    ];
    resultData.forEach(item => {
        const card = node('article', 'demo-web-result-card');
        card.setAttribute('role', 'link');
        card.setAttribute('aria-label', item[0] + ' — ' + item[1]);
        const image = node('div', 'demo-web-result-image', 'Imagem');
        image.style.setProperty('--card-image', item[2]);
        image.setAttribute('role', 'img');
        image.setAttribute('aria-label', 'Imagem do cartão');
        const copy = node('div', 'demo-web-result-copy');
        copy.append(node('strong', 'demo-web-result-title', item[0]), node('span', 'demo-web-result-site', item[1]));
        card.append(image, copy);
        results.appendChild(card);
    });
    frame.append(empty, config, resolving, results);

    return { frame, animate: controls => {
        controls.later(() => {
            empty.classList.add('is-dimmed');
            config.classList.add('is-visible');
        }, 240);
        controls.later(() => {
            config.classList.remove('is-visible');
            resolving.classList.add('is-visible');
        }, 760);
        controls.later(() => {
            resolving.classList.remove('is-visible');
            results.classList.add('is-visible');
        }, 1420);
    }};
}
function buildGallery() {
    const frame = node('div', 'demo-frame demo-frame--gallery');
    frame.style.setProperty('--demo-color', '#ec4899');
    frame.appendChild(toolbar('#ec4899', TOOLBARS.galeria));
    const grid = node('div', 'demo-gallery-grid');
    ['#0f766e', '#b45309', '#1d4ed8'].forEach((color, index) => {
        const image = node('div', 'demo-gallery-image', index === 0 ? 'Ilha' : index === 1 ? 'Deserto' : 'Montanha');
        image.style.setProperty('--image-color', color);
        image.style.setProperty('--image-delay', `${index * 180}ms`);
        grid.appendChild(image);
    });
    frame.appendChild(grid);
    return frame;
}

function buildSummary() {
    const frame = node('div', 'demo-frame demo-frame--summary');
    frame.style.setProperty('--demo-color', '#a855f7');
    frame.appendChild(toolbar('#a855f7', TOOLBARS.sumariar));
    const status = node('div', 'demo-summary-status');
    status.append(node('span', 'demo-summary-icon', '✦'), node('span', '', 'A sintetizar…'));
    const summary = node('p', 'demo-summary-result', 'Resumo: as rotas marítimas ligaram territórios e ideias.');
    frame.append(status, summary);
    return { frame, animate: controls => controls.later(() => {
        status.classList.add('is-done');
        summary.classList.add('is-visible');
    }, 1100) };
}

const BUILDERS = {
    contentor: buildContentor,
    subnota: buildSubnota,
    questao: buildQuestao,
    raciocinio: buildRaciocinio,
    elevador: buildElevador,
    bairro: buildBairro,
    firmamento: buildFirmamento,
    cartaovisita: buildCartaoVisita,
    citacaobiblica: buildCitation,
    webcard: buildWebcard,
    galeria: buildGallery,
    sumariar: buildSummary
};

export function renderManualDemo(container, tipo) {
    const controls = timers();
    const result = BUILDERS[tipo]?.() || buildContentor();
    const frame = result.frame || result;
    const ferramenta = FERRAMENTAS_MANUAL.find(item => item.id === tipo) || FERRAMENTAS_MANUAL[0];
    const stage = node('div', 'demo-duplicate-stage');
    frame.classList.add('is-playing');
    stage.appendChild(frame);
    container.replaceChildren(stage);
    result.animate?.(controls);
    const limparDuplicacao = configurarDuplicacaoManual({ stage, frame, ferramenta, controls });
    return () => {
        controls.clear();
        limparDuplicacao();
    };
}
