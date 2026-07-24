const PREFIXO_ID = 'bairro';

export const TIPO_CHECK_BAIRRO = Object.freeze({
    NENHUM: 'nenhum',
    BOLA: 'bola',
    QUADRADO: 'quadrado',
    SETA: 'seta'
});

export function criarIdBairro(prefixo = PREFIXO_ID) {
    return prefixo + '-' + crypto.randomUUID();
}

export function criarFilhoBairro(nome = '') {
    return {
        id: criarIdBairro('casa'),
        nome,
        oculto: false,
        check: TIPO_CHECK_BAIRRO.NENHUM,
        concluido: false,
        'ligaçãoBairro': [],
        timestamp: Date.now()
    };
}

export function criarPaiBairro(nome = '') {
    return {
        id: criarIdBairro('pai'),
        nome,
        oculto: false,
        check: TIPO_CHECK_BAIRRO.NENHUM,
        pastafilho: [],
        timestamp: Date.now(),
        ocultarJaChecados: false
    };
}

export function garantirEstruturaBairro(caixa) {
    if (!caixa || caixa.tipo !== 'bairro') return caixa;
    if (!Array.isArray(caixa.pastapai)) caixa.pastapai = [];
    caixa.pastapai.forEach(pai => {
        if (!pai.id) pai.id = criarIdBairro('pai');
        if (!pai.timestamp) pai.timestamp = Date.now();
        if (typeof pai.ocultarJaChecados !== 'boolean') pai.ocultarJaChecados = false;
        if (typeof pai.nome !== 'string') pai.nome = '';
        if (typeof pai.oculto !== 'boolean') pai.oculto = false;
        if (!pai.check) pai.check = TIPO_CHECK_BAIRRO.NENHUM;
        if (!Array.isArray(pai.pastafilho)) pai.pastafilho = [];
        pai.pastafilho.forEach(filho => {
            if (!filho.id) filho.id = criarIdBairro('casa');
            if (!filho.timestamp) filho.timestamp = Date.now();
            if (typeof filho.nome !== 'string') filho.nome = '';
            if (typeof filho.oculto !== 'boolean') filho.oculto = false;
            if (!filho.check) filho.check = TIPO_CHECK_BAIRRO.NENHUM;
            if (typeof filho.concluido !== 'boolean') filho.concluido = false;
            if (!Array.isArray(filho['ligaçãoBairro'])) filho['ligaçãoBairro'] = [];
        });
    });
    if (!Array.isArray(caixa['ligaçãoBairro'])) caixa['ligaçãoBairro'] = [];
    if (typeof caixa.oculto !== 'boolean') caixa.oculto = false;
    if (!caixa.corBairro) caixa.corBairro = '#c084fc';
    if (!caixa.direcaoCriacao) caixa.direcaoCriacao = 'baixo';
    return caixa;
}

export function moverItemBairro(lista, index, deslocamento) {
    const destino = index + deslocamento;
    if (!Array.isArray(lista) || destino < 0 || destino >= lista.length) return false;
    const [item] = lista.splice(index, 1);
    lista.splice(destino, 0, item);
    return true;
}