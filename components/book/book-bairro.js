const MARCADORES_CHECK = {
    bola: '●',
    quadrado: '■',
    seta: '➜',
    nenhum: '○'
};

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function obterCor(valor, fallback = '#c084fc') {
    const cor = String(valor || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(cor) ? cor : fallback;
}

function formatarData(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).replace('.', '');
}

function obterGrupos(caixa) {
    return (Array.isArray(caixa?.pastapai) ? caixa.pastapai : [])
        .filter(pai => pai && pai.oculto !== true)
        .map(pai => ({
            ...pai,
            pastafilho: (Array.isArray(pai.pastafilho) ? pai.pastafilho : [])
                .filter(filho => filho && filho.oculto !== true)
        }));
}

function obterNomeCheck(valor) {
    return MARCADORES_CHECK[valor] || MARCADORES_CHECK.nenhum;
}

function renderizarConfiguracao(caixa, cor) {
    const etiquetas = [
        `Cor: ${cor}`,
        `Criação: ${caixa.direcaoCriacao === 'cima' ? 'para cima' : 'para baixo'}`,
        `Agrupamento: ${caixa.agruparDataModo || 'dia'}`,
        caixa.organizarPorData ? 'Organizado por data' : 'Ordem manual',
        caixa.mostrarDataTarefa ? 'Data da tarefa' : '',
        caixa.mostrarDataRealizacaoTarefa ? 'Data de realização' : ''
    ].filter(Boolean);

    return `<div class="book-bairro-settings">${etiquetas.map(etiqueta =>
        `<span>${escapeHtml(etiqueta)}</span>`
    ).join('')}</div>`;
}

export function renderizarBairroBook(caixa) {
    const cor = obterCor(caixa?.corBairro);
    const grupos = obterGrupos(caixa);
    const gruposHtml = grupos.length
        ? grupos.map(pai => {
            const tarefas = pai.pastafilho.map(filho => {
                const datas = [
                    caixa.mostrarDataTarefa ? formatarData(filho.criadaEm || filho.timestamp) : '',
                    caixa.mostrarDataRealizacaoTarefa ? formatarData(filho.timestampRealizacao) : ''
                ].filter(Boolean);
                const detalheData = datas.length ? `<small>${escapeHtml(datas.join(' · '))}</small>` : '';
                return `<li class="book-bairro-task${filho.concluido ? ' is-complete' : ''}">
                    <span class="book-bairro-check" aria-hidden="true">${obterNomeCheck(filho.check || pai.check)}</span>
                    <span class="book-bairro-task-name">${escapeHtml(filho.nome || 'Tarefa sem nome')}</span>
                    ${detalheData}
                </li>`;
            }).join('');

            return `<section class="book-bairro-group">
                <h3><span class="book-bairro-check" aria-hidden="true">${obterNomeCheck(pai.check)}</span>${escapeHtml(pai.nome || 'Grupo sem nome')}</h3>
                <ul>${tarefas || '<li class="book-bairro-empty">Sem tarefas neste grupo.</li>'}</ul>
            </section>`;
        }).join('')
        : '<p class="book-bairro-empty">Este modelo ainda não tem grupos.</p>';

    return `${renderizarConfiguracao(caixa, cor)}
        <div class="book-bairro-groups">${gruposHtml}</div>`;
}

export function textoBairroBook(caixa) {
    const cor = obterCor(caixa?.corBairro);
    const linhas = [
        `Bairro Tarefas. Cor ${cor}.`,
        `Criação ${caixa?.direcaoCriacao === 'cima' ? 'para cima' : 'para baixo'}.`,
        `Agrupamento por ${caixa?.agruparDataModo || 'dia'}.`
    ];

    if (caixa?.organizarPorData) linhas.push('Organizado por data.');
    if (caixa?.mostrarDataTarefa) linhas.push('Mostra a data da tarefa.');
    if (caixa?.mostrarDataRealizacaoTarefa) linhas.push('Mostra a data de realização.');

    obterGrupos(caixa).forEach((pai, indicePai) => {
        linhas.push(`Grupo ${indicePai + 1}: ${pai.nome || 'Grupo sem nome'}.`);
        pai.pastafilho.forEach((filho, indiceFilho) => {
            const estado = filho.concluido ? 'concluída' : 'por concluir';
            const dataCriacao = caixa?.mostrarDataTarefa ? formatarData(filho.criadaEm || filho.timestamp) : '';
            const dataRealizacao = caixa?.mostrarDataRealizacaoTarefa ? formatarData(filho.timestampRealizacao) : '';
            const datas = [dataCriacao, dataRealizacao].filter(Boolean).join(', ');
            linhas.push(`Tarefa ${indiceFilho + 1}: ${filho.nome || 'Tarefa sem nome'}, ${estado}${datas ? `, ${datas}` : ''}.`);
        });
    });

    return linhas.join('\n');
}
