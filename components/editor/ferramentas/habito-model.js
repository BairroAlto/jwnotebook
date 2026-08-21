const LIMITE_CATEGORIAS = 24;
const LIMITE_NOME_CATEGORIA = 42;
const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const CORES_PADRAO = ['#8b5cf6', '#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899'];

export const HABITO_VERSAO = 2;
export const ESTADOS_HABITO = Object.freeze({
    feito: 'feito',
    nao: 'nao',
    passo: 'passo'
});

function criarId(prefixo = 'habito') {
    if (globalThis.crypto?.randomUUID) return `${prefixo}-${globalThis.crypto.randomUUID()}`;
    return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nomeSeguro(valor, fallback = 'Sem nome') {
    const nome = String(valor || '').replace(/\s+/g, ' ').trim().slice(0, LIMITE_NOME_CATEGORIA);
    return nome || fallback;
}

function corSegura(valor, indice = 0) {
    const cor = String(valor || '').trim();
    return /^#[0-9a-f]{6}$/i.test(cor) ? cor.toLowerCase() : CORES_PADRAO[indice % CORES_PADRAO.length];
}

function dataValida(valor) {
    if (!DATA_ISO_RE.test(String(valor || ''))) return false;
    const [ano, mes, dia] = String(valor).split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

function dataLocalParaChave(data = new Date()) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function mesLocalParaChave(data = new Date()) {
    return dataLocalParaChave(data).slice(0, 7);
}

function criarCategoriasIniciais() {
    return [
        { id: criarId('categoria'), nome: 'Saúde', cor: CORES_PADRAO[1] },
        { id: criarId('categoria'), nome: 'Estudo', cor: CORES_PADRAO[2] },
        { id: criarId('categoria'), nome: 'Pessoal', cor: CORES_PADRAO[0] }
    ];
}

function normalizarCategorias(raw, usarPadrao) {
    if (!Array.isArray(raw)) return usarPadrao ? criarCategoriasIniciais() : [];

    const ids = new Set();
    return raw.slice(0, LIMITE_CATEGORIAS).reduce((resultado, item, indice) => {
        const nome = nomeSeguro(item?.nome, 'Categoria');
        let id = String(item?.id || '').trim().slice(0, 96);
        if (!id || ids.has(id)) id = criarId('categoria');
        ids.add(id);
        resultado.push({
            id,
            nome,
            cor: corSegura(item?.cor, indice)
        });
        return resultado;
    }, []);
}

function normalizarRegistos(raw, idsCategorias) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const permitidos = new Set(idsCategorias);
    const registos = {};

    Object.entries(raw).forEach(([data, valores]) => {
        if (!dataValida(data) || !valores || typeof valores !== 'object') return;

        // Compatibilidade com a primeira versão: uma lista significava “Feito”.
        const mapa = Array.isArray(valores)
            ? Object.fromEntries(valores.map(categoriaId => [categoriaId, ESTADOS_HABITO.feito]))
            : valores;
        const estados = {};
        Object.entries(mapa).forEach(([categoriaId, estado]) => {
            const id = String(categoriaId || '').trim();
            const estadoSeguro = String(estado || '').trim();
            if (permitidos.has(id) && Object.values(ESTADOS_HABITO).includes(estadoSeguro)) {
                estados[id] = estadoSeguro;
            }
        });
        if (Object.keys(estados).length) registos[data] = estados;
    });

    return registos;
}

export function criarEstadoHabitoInicial() {
    return {
        versao: HABITO_VERSAO,
        categorias: criarCategoriasIniciais(),
        registos: {}
    };
}

export function normalizarEstadoHabito(raw) {
    const existeEstado = Boolean(raw && typeof raw === 'object' && !Array.isArray(raw));
    const categorias = normalizarCategorias(raw?.categorias, !existeEstado);
    return {
        versao: HABITO_VERSAO,
        categorias,
        registos: normalizarRegistos(raw?.registos, categorias.map(categoria => categoria.id))
    };
}

export function criarCategoria(nome, cor, indice = 0) {
    return {
        id: criarId('categoria'),
        nome: nomeSeguro(nome, 'Nova categoria'),
        cor: corSegura(cor, indice)
    };
}

export function obterDataHoje() {
    return dataLocalParaChave(new Date());
}

export function obterMesActual() {
    return mesLocalParaChave(new Date());
}

export function avancarMes(mesRef, deslocacao) {
    const [ano, mes] = String(mesRef || '').split('-').map(Number);
    const data = new Date(
        Number.isFinite(ano) ? ano : new Date().getFullYear(),
        Number.isFinite(mes) ? mes - 1 + deslocacao : deslocacao,
        1
    );
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function obterCalendarioMes(mesRef) {
    const [ano, mes] = String(mesRef).split('-').map(Number);
    const primeiroDia = new Date(ano, mes - 1, 1);
    const deslocacao = (primeiroDia.getDay() + 6) % 7;
    const totalDias = new Date(ano, mes, 0).getDate();
    const dias = [];

    for (let indice = 0; indice < 42; indice += 1) {
        const numero = indice - deslocacao + 1;
        const data = new Date(ano, mes - 1, numero);
        dias.push({
            chave: dataLocalParaChave(data),
            numero: data.getDate(),
            pertenceAoMes: numero >= 1 && numero <= totalDias,
            fimDeSemana: data.getDay() === 0 || data.getDay() === 6
        });
    }

    return dias;
}

export function formatarMesHabito(mesRef) {
    const [ano, mes] = String(mesRef).split('-').map(Number);
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
        .format(new Date(ano, mes - 1, 1));
}

export function formatarDataHabito(dataRef) {
    const [ano, mes, dia] = String(dataRef).split('-').map(Number);
    return new Intl.DateTimeFormat('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(new Date(ano, mes - 1, dia));
}

export function obterSemanaHabito(dataRef = obterDataHoje(), deslocacao = 0) {
    const [ano, mes, dia] = String(dataRef).split('-').map(Number);
    const dataBase = new Date(ano, mes - 1, dia, 12);
    const deslocacaoSegunda = (dataBase.getDay() + 6) % 7;
    const segunda = new Date(ano, mes - 1, dia - deslocacaoSegunda + (deslocacao * 7), 12);

    return Array.from({ length: 7 }, (_, indice) => {
        const data = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + indice, 12);
        return {
            chave: dataLocalParaChave(data),
            numero: data.getDate(),
            diaSemana: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][indice],
            fimDeSemana: indice > 4
        };
    });
}

export function obterDiasHabito(dataRef = obterDataHoje(), deslocacao = 0, diasFuturos = 2) {
    const semana = obterSemanaHabito(dataRef, deslocacao);
    if (deslocacao !== 0 || diasFuturos <= 0) return semana;

    const dataBase = new Date(`${dataRef}T12:00:00`);
    const limite = new Date(dataBase);
    limite.setDate(limite.getDate() + diasFuturos);
    const seguintes = obterSemanaHabito(dataRef, 1);
    const porData = new Map(semana.map(dia => [dia.chave, dia]));
    seguintes.forEach(dia => porData.set(dia.chave, dia));

    return [...porData.values()]
        .filter(dia => new Date(`${dia.chave}T12:00:00`) <= limite)
        .sort((a, b) => a.chave.localeCompare(b.chave));
}

export function formatarSemanaHabito(semana) {
    const primeiro = semana?.[0]?.chave;
    const ultimo = semana?.[6]?.chave;
    if (!primeiro || !ultimo) return '';
    const [anoA, mesA, diaA] = primeiro.split('-').map(Number);
    const [anoB, mesB, diaB] = ultimo.split('-').map(Number);
    const inicio = new Date(anoA, mesA - 1, diaA);
    const fim = new Date(anoB, mesB - 1, diaB);
    const formato = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
    return `${formato.format(inicio)} – ${formato.format(fim)}`;
}

export function actualizarCategoria(estado, categoriaId, alteracoes = {}) {
    const categoria = estado.categorias.find(item => item.id === categoriaId);
    if (!categoria) return false;
    if (typeof alteracoes.nome === 'string') {
        const nome = alteracoes.nome.replace(/\s+/g, ' ').trim().slice(0, LIMITE_NOME_CATEGORIA);
        if (nome) categoria.nome = nome;
    }
    if (typeof alteracoes.cor === 'string' && /^#[0-9a-f]{6}$/i.test(alteracoes.cor)) {
        categoria.cor = alteracoes.cor.toLowerCase();
    }
    return true;
}

export function alternarCategoriaNoDia(estado, dataRef, categoriaId) {
    const estadoActual = obterEstadoNoDia(estado, dataRef, categoriaId);
    definirEstadoNoDia(estado, dataRef, categoriaId, estadoActual === ESTADOS_HABITO.feito ? null : ESTADOS_HABITO.feito);
}

export function obterEstadoNoDia(estado, dataRef, categoriaId) {
    const registo = estado.registos[dataRef];
    if (!registo || typeof registo !== 'object' || Array.isArray(registo)) return null;
    return registo[categoriaId] || null;
}

export function definirEstadoNoDia(estado, dataRef, categoriaId, novoEstado) {
    const estadoSeguro = novoEstado && Object.values(ESTADOS_HABITO).includes(novoEstado) ? novoEstado : null;
    const actual = { ...(estado.registos[dataRef] || {}) };
    if (estadoSeguro) actual[categoriaId] = estadoSeguro;
    else delete actual[categoriaId];

    if (Object.keys(actual).length) estado.registos[dataRef] = actual;
    else delete estado.registos[dataRef];
}

export function contarRegistosDaCategoria(estado, categoriaId) {
    return Object.values(estado.registos).filter(registo => (
        registo && typeof registo === 'object' && registo[categoriaId]
    )).length;
}

function calcularSequenciaFeita(registos, categoriaId, dataHoje) {
    const diasFeitos = new Set(
        Object.entries(registos).filter(([, categorias]) => (
            categorias?.[categoriaId] === ESTADOS_HABITO.feito
        )).map(([data]) => data)
    );
    let cursor = new Date(`${dataHoje}T12:00:00`);
    let sequencia = 0;
    while (diasFeitos.has(dataLocalParaChave(cursor))) {
        sequencia += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    return sequencia;
}

export function obterEstatisticasHabito(estado, dataHoje = obterDataHoje()) {
    const totais = {
        feito: 0,
        nao: 0,
        passo: 0
    };
    const porCategoria = new Map(estado.categorias.map(categoria => [categoria.id, {
        categoria,
        feito: 0,
        nao: 0,
        passo: 0
    }]));
    const datasRegistadas = new Set();

    Object.entries(estado.registos || {}).forEach(([data, categorias]) => {
        if (!categorias || typeof categorias !== 'object') return;
        Object.entries(categorias).forEach(([categoriaId, valor]) => {
            if (!Object.prototype.hasOwnProperty.call(totais, valor)) return;
            const item = porCategoria.get(categoriaId);
            if (!item) return;
            totais[valor] += 1;
            item[valor] += 1;
            datasRegistadas.add(data);
        });
    });

    const total = Object.values(totais).reduce((soma, valor) => soma + valor, 0);
    return {
        ...totais,
        total,
        diasRegistados: datasRegistadas.size,
        taxaFeito: total ? Math.round((totais.feito / total) * 100) : 0,
        categorias: [...porCategoria.values()].map(item => ({
            ...item,
            total: item.feito + item.nao + item.passo,
            sequencia: calcularSequenciaFeita(estado.registos || {}, item.categoria.id, dataHoje)
        }))
    };
}

export function removerCategoriaDoEstado(estado, categoriaId) {
    estado.categorias = estado.categorias.filter(categoria => categoria.id !== categoriaId);
    Object.entries(estado.registos).forEach(([data, categorias]) => {
        const restantes = { ...(categorias || {}) };
        delete restantes[categoriaId];
        if (Object.keys(restantes).length) estado.registos[data] = restantes;
        else delete estado.registos[data];
    });
}

export function limitarCategorias() {
    return LIMITE_CATEGORIAS;
}
