// components/editor/modulos/lab-status.js

/**
 * Atualiza visualmente o ícone do Laboratório com base nos modos ativos.
 * @param {Array} modos - Lista de modos da nota (ex: ['post', 'arquivo'])
 */
export function atualizarIconeLab(modos) {
    const iconLab = document.getElementById('btn-editor-lab');
    if (!iconLab) return;

    const isPost = modos.includes('post');
    const isArquivo = modos.includes('arquivo');

    // 1. Configurações de Estado
    let classeIcone = "fa-flask"; // Default
    let corIcone = "var(--text-muted)"; // Default

    if (isPost && isArquivo) {
        // AMBOS ATIVOS
        classeIcone = "fa-vials";
        corIcone = "#fbbf24"; // Amarelo
    } 
    else if (isPost) {
        // APENAS POST
        classeIcone = "fa-vial-circle-check";
        corIcone = "#ef4444"; // Vermelho
    } 
    else if (isArquivo) {
        // APENAS ARQUIVO
        classeIcone = "fa-vial-circle-check";
        corIcone = "#22c55e"; // Verde
    }

    // 2. Aplicação Visual
    // Removemos as classes antigas do FontAwesome e injetamos as novas
    iconLab.className = `fa-solid ${classeIcone}`;
    iconLab.style.color = corIcone;
    
    // Adicionamos uma pequena transição suave
    iconLab.style.transition = "all 0.3s ease";
}