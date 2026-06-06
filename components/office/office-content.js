export function extrairTextoConteudo(item) {
    return (item?.conteudo || []).map(bloco => bloco.texto || "").join("\n");
}

export function normalizarItensPublicacao(json) {
    if (json?.capitulos) return json.capitulos.map(item => Array.isArray(item) ? item[0] : item);
    if (json?.artigos) return json.artigos;
    if (json?.video) return [json.video];
    return [];
}
