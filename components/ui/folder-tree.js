// components/ui/folder-tree.js

/**
 * Renderiza uma árvore de pastas recolhível e seleccionável.
 * O conteúdo dos itens é criado via DOM para manter os nomes seguros.
 */
export function renderFolderTree(container, {
    items = [],
    rootId,
    rootLabel,
    rootIcon = "fa-folder-tree",
    folderIcon = "fa-folder",
    theme = "local",
    getParentId = item => item.pastapai || rootId,
    getItemId = item => item.id,
    getItemName = item => item.nome || "Sem nome",
    currentId = null,
    excludeId = null,
    onSelect = () => {}
}) {
    if (!container) return;

    container.innerHTML = "";

    const pastas = items
        .filter(item => item.tipo === "pasta")
        .filter(item => getItemId(item) !== excludeId)
        .map(item => ({
            id: getItemId(item),
            name: getItemName(item),
            parentId: getParentId(item)
        }));

    const porPai = new Map();
    pastas.forEach(pasta => {
        if (!porPai.has(pasta.parentId)) porPai.set(pasta.parentId, []);
        porPai.get(pasta.parentId).push(pasta);
    });

    porPai.forEach(lista => lista.sort((a, b) => a.name.localeCompare(b.name, "pt-PT")));

    const raiz = criarNoPasta({
        id: rootId,
        name: rootLabel,
        level: 0,
        icon: rootIcon,
        theme,
        isCurrent: currentId === rootId,
        isOpen: true,
        hasChildren: (porPai.get(rootId) || []).length > 0,
        container,
        onSelect
    });
    container.appendChild(raiz.wrapper);

    renderizarFilhos(raiz.children, rootId, 1, [rootId]);

    function renderizarFilhos(parentContainer, parentId, level, ancestors) {
        (porPai.get(parentId) || []).forEach(pasta => {
            // Evita que dados circulares bloqueiem a renderização da árvore.
            if (ancestors.includes(pasta.id)) return;

            const filhos = porPai.get(pasta.id) || [];
            const no = criarNoPasta({
                id: pasta.id,
                name: pasta.name,
                level,
                icon: folderIcon,
                theme,
                isCurrent: currentId === pasta.id,
                isOpen: false,
                hasChildren: filhos.length > 0,
                container,
                onSelect
            });
            parentContainer.appendChild(no.wrapper);
            renderizarFilhos(no.children, pasta.id, level + 1, [...ancestors, pasta.id]);
        });
    }
}

function criarNoPasta({
    id,
    name,
    level,
    icon,
    theme,
    isCurrent,
    isOpen,
    hasChildren,
    container,
    onSelect
}) {
    const wrapper = document.createElement("div");
    wrapper.className = "folder-tree-node";

    const header = document.createElement("div");
    header.className = "tree-item tree-folder-header folder-tree-selectable";
    header.dataset.folderTreeId = id;
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-selected", "false");
    header.style.setProperty("--folder-tree-level", level);

    if (isCurrent) {
        header.classList.add("pasta-actual-mover");
        header.setAttribute("aria-current", "location");
    }

    const chevron = document.createElement("i");
    chevron.className = `fa-solid ${isOpen ? "fa-chevron-down" : "fa-chevron-right"} folder-tree-chevron`;
    if (!hasChildren) chevron.classList.add("is-empty");

    const folder = document.createElement("i");
    folder.className = `fa-solid ${icon} folder-tree-icon folder-tree-icon--${theme}`;

    const label = document.createElement("span");
    label.className = "folder-tree-label";
    label.textContent = name;

    header.append(chevron, folder, label);

    const children = document.createElement("div");
    children.className = "tree-folder-content folder-tree-children";
    header.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) children.classList.add("open");

    const alternarAbertura = () => {
        if (!hasChildren) return;
        const aberto = children.classList.toggle("open");
        chevron.classList.toggle("fa-chevron-right", !aberto);
        chevron.classList.toggle("fa-chevron-down", aberto);
        header.setAttribute("aria-expanded", String(aberto));
    };

    const seleccionar = () => {
        container.querySelectorAll(".folder-tree-selectable").forEach(item => {
            item.classList.remove("folder-tree-item--selected");
            item.setAttribute("aria-selected", "false");
        });
        header.classList.add("folder-tree-item--selected");
        header.setAttribute("aria-selected", "true");
        onSelect({ id, name });
    };

    header.addEventListener("click", () => {
        seleccionar();
        alternarAbertura();
    });

    header.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        seleccionar();
        alternarAbertura();
    });

    wrapper.append(header, children);
    return { wrapper, children };
}
