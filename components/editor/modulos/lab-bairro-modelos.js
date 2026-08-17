import { TIPO_CHECK_BAIRRO } from '../../constants/bairro.js';
import { obterCampos, obterModelo } from './meu-bairro.js';

const CHECKS = [
    { id: TIPO_CHECK_BAIRRO.NENHUM, nome: 'Nenhum' },
    { id: TIPO_CHECK_BAIRRO.BOLA, nome: 'Bola' },
    { id: TIPO_CHECK_BAIRRO.QUADRADO, nome: 'Quadrado' },
    { id: TIPO_CHECK_BAIRRO.SETA, nome: 'Seta' }
];

const MODOS_DATA = [
    { id: 'dia', nome: 'Dias' },
    { id: 'semana', nome: 'Semanas' },
    { id: 'mes', nome: 'Meses' }
];

function gerarId(prefixo) {
    return `${prefixo}-${crypto.randomUUID()}`;
}

function normalizarCheck(valor) {
    return CHECKS.some(opcao => opcao.id === valor) ? valor : TIPO_CHECK_BAIRRO.NENHUM;
}

function normalizarModoData(valor) {
    return MODOS_DATA.some(opcao => opcao.id === valor) ? valor : 'dia';
}

const PREFERENCIAS_MEU_BAIRRO = {
    mostrarDiaAtual: true,
    mostrarUltimaLicao: false,
    interligarCalendarioDay: true
};

function normalizarMeuBairro(valor) {
    if (!valor?.categoria || !valor?.modelo) return null;
    const categoria = valor.categoria === 'cozinha' ? 'cozinha' : 'musica';
    const modelo = categoria === 'cozinha'
        ? 'cozinha'
        : ['piano', 'guitarra', 'violino'].includes(valor.modelo) ? valor.modelo : 'piano';
    const campos = obterCampos(categoria, modelo);
    const idsValidos = new Set(campos.map(campo => campo.id));
    const camposAtivos = Array.isArray(valor.camposAtivos)
        ? valor.camposAtivos.filter(id => idsValidos.has(id))
        : campos.map(campo => campo.id);
    return {
        categoria,
        modelo,
        camposAtivos: camposAtivos.length ? camposAtivos : campos.map(campo => campo.id),
        preferencias: { ...PREFERENCIAS_MEU_BAIRRO, ...(valor.preferencias || {}) },
        semanas: {}
    };
}

function normalizarFilho(filho) {
    const dados = typeof filho === 'string' ? { nome: filho } : (filho || {});
    return {
        id: dados.id || gerarId('casa'),
        nome: String(dados.nome || ''),
        check: normalizarCheck(dados.check),
        oculto: false,
        concluido: false,
        timestampRealizacao: null,
        'ligaçãoBairro': [],
        actas: [],
        notasAnexadas: [],
        notaCriadaId: null
    };
}

function normalizarPai(pai) {
    const dados = pai || {};
    const check = normalizarCheck(dados.check);
    return {
        id: dados.id || gerarId('pai'),
        nome: String(dados.nome || ''),
        check,
        oculto: false,
        ocultarJaChecados: Boolean(dados.ocultarJaChecados),
        meuBairro: normalizarMeuBairro(dados.meuBairro),
        pastafilho: (Array.isArray(dados.pastafilho) ? dados.pastafilho : (dados.filhos || []))
            .map(filho => ({ ...normalizarFilho(filho), check: normalizarCheck(filho?.check || check) }))
    };
}

export function normalizarBairroModelo(modelo = {}) {
    return {
        corBairro: /^#[0-9a-f]{6}$/i.test(modelo.corBairro || '') ? modelo.corBairro : '#c084fc',
        direcaoCriacao: modelo.direcaoCriacao === 'cima' ? 'cima' : 'baixo',
        mostrarDataTarefa: Boolean(modelo.mostrarDataTarefa),
        mostrarDataRealizacaoTarefa: Boolean(modelo.mostrarDataRealizacaoTarefa),
        organizarPorData: Boolean(modelo.organizarPorData),
        agruparDataModo: normalizarModoData(modelo.agruparDataModo),
        pastapai: (Array.isArray(modelo.pastapai) ? modelo.pastapai : []).map(normalizarPai),
        ligaçãoBairro: []
    };
}

function criarCampoRotulo(texto) {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'lab-bairro-modelo-campo';
    const titulo = document.createElement('span');
    titulo.textContent = texto;
    etiqueta.appendChild(titulo);
    return { etiqueta, titulo };
}

function criarSelect(opcoes, valor, aoAlterar) {
    const select = document.createElement('select');
    select.className = 'lab-bairro-modelo-select';
    opcoes.forEach(opcao => select.appendChild(new Option(opcao.nome, opcao.id)));
    select.value = valor;
    select.addEventListener('change', () => aoAlterar?.(select.value));
    return select;
}

function criarToggle(texto, valor, aoAlterar) {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'lab-bairro-modelo-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(valor);
    input.addEventListener('change', () => aoAlterar?.(input.checked));
    const textoEl = document.createElement('span');
    textoEl.textContent = texto;
    etiqueta.append(input, textoEl);
    return etiqueta;
}

function criarNomeInput(valor, placeholder, aoAlterar) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lab-bairro-modelo-input';
    input.value = valor || '';
    input.placeholder = placeholder;
    input.addEventListener('input', () => aoAlterar?.(input.value));
    return input;
}

function criarFilhoEditor(filho, aoRemover) {
    const linha = document.createElement('div');
    linha.className = 'lab-bairro-modelo-filho';
    const nome = criarNomeInput(filho.nome, 'Nome da tarefa...', valor => { filho.nome = valor; });
    const check = criarSelect(CHECKS, filho.check, valor => { filho.check = valor; });
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'lab-bairro-modelo-remover';
    remover.title = 'Remover tarefa do modelo';
    remover.setAttribute('aria-label', 'Remover tarefa do modelo');
    remover.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    remover.addEventListener('click', () => {
        linha.remove();
        aoRemover?.(filho);
    });
    linha.append(nome, check, remover);
    return linha;
}

function criarEditorMeuBairro(pai) {
    const exterior = document.createElement('div');
    exterior.className = 'lab-bairro-modelo-meu-bairro';
    const activar = criarToggle('Activar Meu Bairro neste grupo', Boolean(pai.meuBairro), valor => {
        pai.meuBairro = valor ? normalizarMeuBairro({ categoria: 'musica', modelo: 'piano' }) : null;
        actualizar();
    });
    const corpo = document.createElement('div');
    corpo.className = 'lab-bairro-modelo-meu-bairro-corpo';

    const actualizar = () => {
        corpo.replaceChildren();
        if (!pai.meuBairro) return;

        const escolha = document.createElement('div');
        escolha.className = 'lab-bairro-modelo-meu-bairro-escolha';
        const area = criarCampoRotulo('Área');
        const areaSelect = criarSelect([
            { id: 'musica', nome: 'Música' },
            { id: 'cozinha', nome: 'Cozinha' }
        ], pai.meuBairro.categoria, valor => {
            pai.meuBairro = normalizarMeuBairro({ categoria: valor, modelo: valor === 'cozinha' ? 'cozinha' : 'piano' });
            actualizar();
        });
        area.etiqueta.appendChild(areaSelect);
        const modeloCampo = criarCampoRotulo('Modelo');
        const modelos = pai.meuBairro.categoria === 'cozinha'
            ? [{ id: 'cozinha', nome: obterModelo('cozinha', 'cozinha').label }]
            : ['piano', 'guitarra', 'violino'].map(id => ({ id, nome: obterModelo('musica', id).label }));
        const modeloSelect = criarSelect(modelos, pai.meuBairro.modelo, valor => {
            pai.meuBairro = normalizarMeuBairro({ ...pai.meuBairro, modelo: valor });
            actualizar();
        });
        modeloCampo.etiqueta.appendChild(modeloSelect);
        escolha.append(area.etiqueta, modeloCampo.etiqueta);

        const campos = document.createElement('div');
        campos.className = 'lab-bairro-modelo-meu-bairro-campos';
        const camposTitulo = document.createElement('small');
        camposTitulo.textContent = 'Campos activos no registo diário';
        campos.appendChild(camposTitulo);
        const activos = new Set(pai.meuBairro.camposAtivos);
        obterCampos(pai.meuBairro.categoria, pai.meuBairro.modelo).forEach(campo => {
            const item = document.createElement('label');
            item.className = 'lab-bairro-modelo-toggle';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = activos.has(campo.id);
            input.addEventListener('change', () => {
                const ids = new Set(pai.meuBairro.camposAtivos);
                if (input.checked) ids.add(campo.id);
                else ids.delete(campo.id);
                pai.meuBairro.camposAtivos = [...ids];
            });
            const texto = document.createElement('span');
            texto.textContent = campo.label;
            item.append(input, texto);
            campos.appendChild(item);
        });

        const preferencias = document.createElement('div');
        preferencias.className = 'lab-bairro-modelo-meu-bairro-preferencias';
        preferencias.append(
            criarToggle('Abrir no dia actual', pai.meuBairro.preferencias.mostrarDiaAtual, valor => {
                pai.meuBairro.preferencias.mostrarDiaAtual = valor;
                if (valor) pai.meuBairro.preferencias.mostrarUltimaLicao = false;
            }),
            criarToggle('Abrir na última lição', pai.meuBairro.preferencias.mostrarUltimaLicao, valor => {
                pai.meuBairro.preferencias.mostrarUltimaLicao = valor;
                if (valor) pai.meuBairro.preferencias.mostrarDiaAtual = false;
            }),
            criarToggle('Ligar ao Calendário Day', pai.meuBairro.preferencias.interligarCalendarioDay, valor => {
                pai.meuBairro.preferencias.interligarCalendarioDay = valor;
            })
        );
        corpo.append(escolha, campos, preferencias);
    };

    exterior.append(activar, corpo);
    actualizar();
    return exterior;
}

function criarPaiEditor(pai, aoRemover) {
    const cartao = document.createElement('section');
    cartao.className = 'lab-bairro-modelo-pai';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'lab-bairro-modelo-pai-cabecalho';
    const nome = criarNomeInput(pai.nome, 'Nome do grupo...', valor => { pai.nome = valor; });
    const check = criarSelect(CHECKS, pai.check, valor => {
        pai.check = valor;
        pai.pastafilho.forEach(filho => {
            if (filho.check === TIPO_CHECK_BAIRRO.NENHUM) filho.check = valor;
        });
    });
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'lab-bairro-modelo-remover';
    remover.title = 'Remover grupo do modelo';
    remover.setAttribute('aria-label', 'Remover grupo do modelo');
    remover.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
    remover.addEventListener('click', () => {
        cartao.remove();
        aoRemover?.(pai);
    });
    cabecalho.append(nome, check, remover);

    const opcoes = document.createElement('div');
    opcoes.className = 'lab-bairro-modelo-pai-opcoes';
    opcoes.appendChild(criarToggle('Ocultar tarefas concluídas deste grupo', pai.ocultarJaChecados, valor => {
        pai.ocultarJaChecados = valor;
    }));

    opcoes.appendChild(criarEditorMeuBairro(pai));

    const lista = document.createElement('div');
    lista.className = 'lab-bairro-modelo-filhos';
    const adicionar = document.createElement('button');
    adicionar.type = 'button';
    adicionar.className = 'lab-bairro-modelo-adicionar';
    adicionar.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Tarefa';
    adicionar.addEventListener('click', () => {
        const filho = normalizarFilho({ check: pai.check });
        pai.pastafilho.push(filho);
        lista.insertBefore(criarFilhoEditor(filho, removido => {
            pai.pastafilho = pai.pastafilho.filter(item => item !== removido);
        }), adicionar);
    });
    pai.pastafilho.forEach(filho => lista.appendChild(criarFilhoEditor(filho, removido => {
        pai.pastafilho = pai.pastafilho.filter(item => item !== removido);
    })));
    lista.appendChild(adicionar);
    cartao.append(cabecalho, opcoes, lista);
    return cartao;
}

export function criarEditorBairroModelo(modelo = {}) {
    const estado = normalizarBairroModelo(modelo);
    const raiz = document.createElement('div');
    raiz.className = 'lab-bairro-modelo-editor';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'lab-bairro-modelo-cabecalho';
    const titulo = document.createElement('strong');
    titulo.textContent = 'Configuração moderna do BairroTarefas';
    const detalhe = document.createElement('small');
    detalhe.textContent = 'Estas definições serão usadas quando o modelo for aplicado.';
    cabecalho.append(titulo, detalhe);

    const definicoes = document.createElement('div');
    definicoes.className = 'lab-bairro-modelo-definicoes';

    const corCampo = criarCampoRotulo('Cor do Bairro');
    const cor = document.createElement('input');
    cor.type = 'color';
    cor.value = estado.corBairro;
    cor.addEventListener('input', () => { estado.corBairro = cor.value; });
    corCampo.etiqueta.appendChild(cor);

    const direcaoCampo = criarCampoRotulo('Direcção de criação');
    direcaoCampo.etiqueta.appendChild(criarSelect([
        { id: 'baixo', nome: 'Para baixo' },
        { id: 'cima', nome: 'Para cima' }
    ], estado.direcaoCriacao, valor => { estado.direcaoCriacao = valor; }));

    const agrupamentoCampo = criarCampoRotulo('Agrupamento por data');
    agrupamentoCampo.etiqueta.appendChild(criarSelect(MODOS_DATA, estado.agruparDataModo, valor => { estado.agruparDataModo = valor; }));

    definicoes.append(corCampo.etiqueta, direcaoCampo.etiqueta, agrupamentoCampo.etiqueta);
    const toggles = document.createElement('div');
    toggles.className = 'lab-bairro-modelo-toggles';
    toggles.append(
        criarToggle('Mostrar Data Tarefa', estado.mostrarDataTarefa, valor => { estado.mostrarDataTarefa = valor; }),
        criarToggle('Mostrar Data Realização da Tarefa', estado.mostrarDataRealizacaoTarefa, valor => { estado.mostrarDataRealizacaoTarefa = valor; }),
        criarToggle('Organizar Bairro por Data', estado.organizarPorData, valor => { estado.organizarPorData = valor; })
    );

    const gruposTitulo = document.createElement('div');
    gruposTitulo.className = 'lab-bairro-modelo-secao-titulo';
    const gruposTexto = document.createElement('strong');
    gruposTexto.textContent = 'Grupos e tarefas';
    const adicionarGrupo = document.createElement('button');
    adicionarGrupo.type = 'button';
    adicionarGrupo.className = 'lab-bairro-modelo-adicionar';
    adicionarGrupo.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Grupo';
    gruposTitulo.append(gruposTexto, adicionarGrupo);
    const grupos = document.createElement('div');
    grupos.className = 'lab-bairro-modelo-grupos';
    const adicionarPai = () => {
        grupos.querySelector('.lab-bairro-modelo-vazio')?.remove();
        const pai = normalizarPai({ check: TIPO_CHECK_BAIRRO.NENHUM });
        estado.pastapai.push(pai);
        grupos.appendChild(criarPaiEditor(pai, removido => {
            estado.pastapai = estado.pastapai.filter(item => item !== removido);
        }));
    };
    adicionarGrupo.addEventListener('click', adicionarPai);
    estado.pastapai.forEach(pai => grupos.appendChild(criarPaiEditor(pai, removido => {
        estado.pastapai = estado.pastapai.filter(item => item !== removido);
    })));
    if (!estado.pastapai.length) grupos.appendChild(criarMensagemModelo('Ainda não existem grupos. Clica em “Grupo” para começar.'));

    raiz.append(cabecalho, definicoes, toggles, gruposTitulo, grupos);
    raiz.obterModelo = () => ({
        ...normalizarBairroModelo(estado),
        pastapai: estado.pastapai.map(pai => ({
            ...normalizarPai(pai),
            pastafilho: pai.pastafilho.map(filho => normalizarFilho(filho))
        }))
    });
    return raiz;
}

function criarMensagemModelo(texto) {
    const mensagem = document.createElement('p');
    mensagem.className = 'lab-bairro-modelo-vazio';
    mensagem.textContent = texto;
    return mensagem;
}

export function criarCaixaBairroDoModelo(config = {}) {
    const modelo = normalizarBairroModelo(config);
    return {
        corBairro: modelo.corBairro,
        direcaoCriacao: modelo.direcaoCriacao,
        mostrarDataTarefa: modelo.mostrarDataTarefa,
        mostrarDataRealizacaoTarefa: modelo.mostrarDataRealizacaoTarefa,
        organizarPorData: modelo.organizarPorData,
        agruparDataModo: modelo.agruparDataModo,
        pastapai: modelo.pastapai.map(pai => {
            const paiId = gerarId('pai');
            const meuBairro = normalizarMeuBairro(pai.meuBairro);
            return {
                id: paiId,
                nome: pai.nome,
                oculto: false,
                check: pai.check,
                ocultarJaChecados: pai.ocultarJaChecados,
                timestamp: Date.now(),
                meuBairro: meuBairro ? { ...meuBairro, bairroId: paiId } : null,
                pastafilho: pai.pastafilho.map(filho => ({
                    id: gerarId('casa'),
                    nome: filho.nome,
                    oculto: false,
                    check: filho.check || pai.check,
                    concluido: false,
                    timestampRealizacao: null,
                    'ligaçãoBairro': [],
                    actas: [],
                    notasAnexadas: [],
                    notaCriadaId: null,
                    timestamp: Date.now()
                }))
            };
        }),
        'ligaçãoBairro': []
    };
}
