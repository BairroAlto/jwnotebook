// Catálogo único dos modos disponíveis no Laboratório da nota.

export const MODOS_NOTA = Object.freeze([
    { id: 'normal', nome: 'Modo Normal', descricao: 'Escrita sequencial padrão' },
    { id: 'arquivo', nome: 'Modo Arquivo', descricao: 'Gestão por gavetas e prateleiras' },
    { id: 'post', nome: 'Modo Post', descricao: 'Feed invertido (mais recentes)' },
    { id: 'diario', nome: 'Modo Diário', descricao: 'Agrupa ferramentas por dia' },
    { id: 'minimal', nome: 'Modo Minimal', descricao: 'Eclipse a interface e destaca a nota' },
    { id: 'social', nome: 'Modo Social', descricao: 'Reações em notas partilhadas' },
    { id: 'sentinela', nome: 'Modo Sentinela', descricao: 'Estudo profundo de A Sentinela' }
]);

export const IDS_MODOS_NOTA = Object.freeze(MODOS_NOTA.map(modo => modo.id));

export function obterDefinicaoModoNota(id) {
    return MODOS_NOTA.find(modo => modo.id === id) || null;
}

export function chaveAcessoModoNota(id) {
    return IDS_MODOS_NOTA.includes(id) ? `modo_${id}` : null;
}
