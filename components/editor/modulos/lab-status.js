// components/editor/modulos/lab-status.js

export function atualizarIconeLab(modos) {
    const iconLab = document.getElementById('btn-editor-lab');
    if (!iconLab) return;

    const lista = Array.isArray(modos) ? modos : [modos];
    
    const isPost = lista.includes('post');
    const isArquivo = lista.includes('arquivo');
    const isSentinela = lista.includes('sentinela');
    const isNormal = lista.includes('normal') || (lista.length === 1 && lista[0] === 'normal');

    // CONFIGURAÇÕES PADRÃO (NORMAL)
    let classe = "fa-flask";
    let cor = "var(--text-muted)";
    let filter = "none";

    // 🚀 LÓGICA DE PRIORIDADE E CORES
    if (isSentinela) {
        // MODO SENTINELA: Ícone da Torre em Castanho Claro
        classe = "fa-tower-observation";
        cor = "#d4a373"; // Castanho Claro / Tan
        filter = "drop-shadow(0 0 5px rgba(212, 163, 115, 0.4))";
    } 
    else if (isPost && isArquivo) {
        classe = "fa-vials";
        cor = "#fbbf24";
    } 
    else if (isPost) {
        classe = "fa-vial-circle-check";
        cor = "#ef4444";
    } 
    else if (isArquivo) {
        classe = "fa-vial-circle-check";
        cor = "#22c55e";
    }

    iconLab.className = `fa-solid ${classe}`;
    iconLab.style.color = cor;
    iconLab.style.filter = filter;
}