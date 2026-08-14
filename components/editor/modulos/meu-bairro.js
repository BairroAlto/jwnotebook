import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { montarPainelFicheiros } from '../../storage/storage-ui.js';

const MODELOS_MUSICA = {
    piano: {
        label: 'Piano',
        icone: 'fa-solid fa-music',
        campos: [
            { id: 'peca', label: 'Peça ou exercício', tipo: 'text' },
            { id: 'objectivo', label: 'Objectivo', tipo: 'textarea' },
            { id: 'tempoPratica', label: 'Tempo de prática (minutos)', tipo: 'number' },
            { id: 'bpmActual', label: 'BPM actual', tipo: 'number' },
            { id: 'bpmPretendido', label: 'BPM pretendido', tipo: 'number' },
            { id: 'foco', label: 'Foco', tipo: 'select', opcoes: ['Mão direita', 'Mão esquerda', 'Mãos juntas', 'Pedal', 'Articulação'] },
            { id: 'resultado', label: 'Resultado obtido', tipo: 'textarea' },
            { id: 'erro', label: 'Erro ou parte difícil', tipo: 'textarea' },
            { id: 'proximoPasso', label: 'Próximo passo', tipo: 'textarea' },
            { id: 'anexo', label: 'Anexo: partitura, áudio ou vídeo', tipo: 'anexo' }
        ]
    },
    guitarra: {
        label: 'Guitarra',
        icone: 'fa-solid fa-guitar',
        campos: [
            { id: 'peca', label: 'Música, riff, acorde ou exercício', tipo: 'text' },
            { id: 'objectivo', label: 'Objectivo', tipo: 'textarea' },
            { id: 'tempoPratica', label: 'Tempo de prática (minutos)', tipo: 'number' },
            { id: 'bpmActual', label: 'BPM actual', tipo: 'number' },
            { id: 'bpmPretendido', label: 'BPM pretendido', tipo: 'number' },
            { id: 'afinacao', label: 'Afinação', tipo: 'text' },
            { id: 'capotraste', label: 'Capotraste, se existir', tipo: 'text' },
            { id: 'foco', label: 'Foco', tipo: 'select', opcoes: ['Acordes', 'Pestanas', 'Ritmo', 'Palhetada', 'Dedilhado'] },
            { id: 'resultado', label: 'Resultado obtido', tipo: 'textarea' },
            { id: 'erro', label: 'Erro ou parte difícil', tipo: 'textarea' },
            { id: 'proximoPasso', label: 'Próximo passo', tipo: 'textarea' },
            { id: 'anexo', label: 'Anexo: cifra, tablatura, áudio ou vídeo', tipo: 'anexo' }
        ]
    },
    violino: {
        label: 'Violino',
        icone: 'fa-solid fa-music',
        campos: [
            { id: 'peca', label: 'Peça ou exercício', tipo: 'text' },
            { id: 'objectivo', label: 'Objectivo', tipo: 'textarea' },
            { id: 'tempoPratica', label: 'Tempo de prática (minutos)', tipo: 'number' },
            { id: 'bpmActual', label: 'BPM actual', tipo: 'number' },
            { id: 'bpmPretendido', label: 'BPM pretendido', tipo: 'number' },
            { id: 'cordaPosicao', label: 'Corda ou posição', tipo: 'text' },
            { id: 'foco', label: 'Foco', tipo: 'select', opcoes: ['Afinação', 'Arco', 'Dedilhado', 'Vibrato'] },
            { id: 'resultado', label: 'Resultado obtido', tipo: 'textarea' },
            { id: 'erro', label: 'Erro ou parte difícil', tipo: 'textarea' },
            { id: 'proximoPasso', label: 'Próximo passo', tipo: 'textarea' },
            { id: 'anexo', label: 'Anexo: partitura, áudio ou vídeo', tipo: 'anexo' }
        ]
    }
};

const MODELO_COZINHA = {
    label: 'Cozinha',
    icone: 'fa-solid fa-kitchen-set',
    campos: [
        { id: 'receita', label: 'Receita, técnica ou preparação', tipo: 'text' },
        { id: 'objectivo', label: 'Objectivo', tipo: 'textarea' },
        { id: 'tempoPratica', label: 'Tempo de prática (minutos)', tipo: 'number' },
        { id: 'resultado', label: 'Resultado obtido', tipo: 'textarea' },
        { id: 'erro', label: 'Erro ou parte difícil', tipo: 'textarea' },
        { id: 'proximoPasso', label: 'Próximo passo', tipo: 'textarea' },
        { id: 'anexo', label: 'Anexo: receita, áudio ou vídeo', tipo: 'anexo' }
    ]
};

function obterModelo(categoria, modelo) {
    return categoria === 'cozinha' ? MODELO_COZINHA : (MODELOS_MUSICA[modelo] || MODELOS_MUSICA.piano);
}

function obterCampos(categoria, modelo) {
    return obterModelo(categoria, modelo).campos;
}

function obterEstado(bairro) {
    const estado = bairro.meuBairro;
    if (!estado || !estado.categoria || !estado.modelo) return null;
    estado.preferencias = {
        mostrarDiaAtual: true,
        mostrarUltimaLicao: false,
        interligarCalendarioDay: true,
        ...(estado.preferencias || {})
    };
    if (!estado.semanas || typeof estado.semanas !== 'object') estado.semanas = {};
    if (!Array.isArray(estado.camposAtivos)) estado.camposAtivos = obterCampos(estado.categoria, estado.modelo).map(campo => campo.id);
    return estado;
}

function dataParaChave(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function chaveParaData(chave) {
    const [ano, mes, dia] = String(chave).split('-').map(Number);
    return new Date(ano || 2000, (mes || 1) - 1, dia || 1);
}

function inicioSemana(data) {
    const inicio = new Date(data);
    const dia = (inicio.getDay() + 6) % 7;
    inicio.setDate(inicio.getDate() - dia);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
}

function chaveSemana(data) {
    return dataParaChave(inicioSemana(data));
}

function diasDaSemana(data) {
    const inicio = inicioSemana(data);
    return Array.from({ length: 7 }, (_, indice) => {
        const dia = new Date(inicio);
        dia.setDate(inicio.getDate() + indice);
        return dia;
    });
}

function obterRegisto(estado, chaveData) {
    return estado?.semanas?.[chaveSemana(chaveParaData(chaveData))]?.dias?.[chaveData] || null;
}

function obterUltimoRegisto(estado) {
    const registos = Object.values(estado?.semanas || {})
        .flatMap(semana => Object.values(semana?.dias || {}))
        .filter(registo => registo?.data)
        .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return registos[0] || null;
}

function criarIdRegisto(bairroId, modelo, data) {
    return `bairro-pratica-${bairroId}-${modelo}-${data}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatarIntervaloSemana(dias) {
    const inicio = dias[0];
    const fim = dias[6];
    const formatador = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
    return `${formatador.format(inicio)} – ${formatador.format(fim)}`;
}

function criarCampo(campo, valor = '') {
    const etiqueta = document.createElement('label');
    etiqueta.className = `meu-bairro-field${campo.tipo === 'textarea' ? ' meu-bairro-field--wide' : ''}`;
    const titulo = document.createElement('span');
    titulo.textContent = campo.label;
    let controlo;
    if (campo.tipo === 'textarea') {
        controlo = document.createElement('textarea');
        controlo.rows = 3;
    } else if (campo.tipo === 'select') {
        controlo = document.createElement('select');
        controlo.appendChild(new Option('Escolher…', ''));
        campo.opcoes.forEach(opcao => controlo.appendChild(new Option(opcao, opcao)));
    } else {
        controlo = document.createElement('input');
        controlo.type = campo.tipo === 'number' ? 'number' : 'text';
    }
    controlo.dataset.meuBairroCampo = campo.id;
    controlo.value = valor ?? '';
    etiqueta.append(titulo, controlo);
    return etiqueta;
}

function criarOpcaoCampo(campo, ativo) {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'meu-bairro-opcao';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.meuBairroCampoAtivo = campo.id;
    input.checked = ativo;
    const texto = document.createElement('span');
    texto.textContent = campo.label;
    etiqueta.append(input, texto);
    return etiqueta;
}

function criarCabecalho(titulo, descricao) {
    const cabecalho = document.createElement('div');
    cabecalho.className = 'meu-bairro-cabecalho';
    const copy = document.createElement('div');
    const h = document.createElement('h4');
    h.className = 'meu-bairro-titulo';
    h.textContent = titulo;
    const p = document.createElement('p');
    p.className = 'meu-bairro-hint';
    p.textContent = descricao;
    copy.append(h, p);
    cabecalho.appendChild(copy);
    return cabecalho;
}

function montarEstadoConfiguracao({ bairro, estadoAnterior, categoria, modelo, camposAtivos }) {
    return {
        ...(estadoAnterior || {}),
        categoria,
        modelo,
        camposAtivos,
        preferencias: {
            mostrarDiaAtual: true,
            mostrarUltimaLicao: false,
            interligarCalendarioDay: true,
            ...(estadoAnterior?.preferencias || {})
        },
        semanas: estadoAnterior?.semanas || {},
        configuradoEm: estadoAnterior?.configuradoEm || Date.now(),
        bairroId: bairro.id
    };
}

function criarTarefaDoDia({ bairro, caixaId, estado, registo, notaId, userId }) {
    const modelo = obterModelo(estado.categoria, estado.modelo);
    const campos = obterCampos(estado.categoria, estado.modelo)
        .filter(campo => estado.camposAtivos.includes(campo.id) && campo.tipo !== 'anexo')
        .map(campo => ({ id: campo.id, label: campo.label, valor: String(registo.campos?.[campo.id] ?? '') }))
        .filter(campo => campo.valor.trim());
    const caixas = campos.map(campo => ({
        id: `${registo.id}-${campo.id}`,
        tipo: 'contentor',
        titulo: campo.label,
        conteudo: campo.valor,
        ordem: campos.indexOf(campo) + 1
    }));
    const titulo = `${modelo.label} · ${bairro.nome || 'Meu Bairro'}`;
    const nota = campos.map(campo => `${campo.label}: ${campo.valor}`).join('\n');
    return {
        id: registo.id,
        userId,
        tipo: 'tarefa',
        origem: 'bairro',
        origemBairro: true,
        data: registo.data,
        date: registo.data,
        hora: registo.hora || '',
        time: registo.hora || '',
        semHora: !registo.hora,
        noTime: !registo.hora,
        duracao: Number(registo.campos?.tempoPratica) || 0,
        duration: Number(registo.campos?.tempoPratica) || 0,
        titulo,
        title: titulo,
        categoria: 'pessoal',
        category: 'pessoal',
        calendarioId: 'pessoal',
        calendarId: 'pessoal',
        repeticao: 'sem-repeticao',
        repeat: 'sem-repeticao',
        intervaloRepeticao: 1,
        repeatInterval: 1,
        unidadeRepeticao: 'dias',
        repeatUnit: 'dias',
        serieId: null,
        ocorrenciaData: registo.data,
        ocorrenciaPrincipal: true,
        icone: modelo.icone,
        icon: modelo.icone,
        nota,
        caixas,
        concluida: false,
        completed: false,
        bairroNotaId: notaId,
        bairroCaixaId: caixaId || bairro.id,
        bairroModuloId: bairro.id,
        bairroNome: bairro.nome || 'Meu Bairro',
        bairroModelo: modelo.label,
        bairroData: registo.data,
        bairroCampos: campos,
        bairroRegistoId: registo.id,
        bairroTipo: `${modelo.label} - ${registo.data}`,
        actualizadoEm: Date.now()
    };
}

async function sincronizarTarefaDoDia({ db, userId, bairro, caixaId, estado, registo, notaId }) {
    const database = db || window.db;
    const utilizadorId = userId || window.auth?.currentUser?.uid || window.authInstance?.currentUser?.uid;
    console.info('[MEU-BAIRRO][DAY] Preparar gravação:', {
        tarefaId: registo?.id || null,
        data: registo?.data || null,
        userId: utilizadorId || null,
        notaId: notaId || null,
        caixaId: caixaId || null,
        moduloId: bairro?.id || null,
        temDb: Boolean(database)
    });
    if (!database || !utilizadorId || !registo?.id) {
        console.warn('[MEU-BAIRRO] Exercício não enviado para o calendário: contexto incompleto.');
        return;
    }
    const tarefa = criarTarefaDoDia({ bairro, caixaId, estado, registo, notaId, userId: utilizadorId });
    await setDoc(doc(database, 'tarefas', registo.id), tarefa, { merge: true });
    console.info('[MEU-BAIRRO][DAY] Tarefa gravada no Firebase:', {
        colecao: 'tarefas',
        tarefaId: registo.id,
        data: tarefa.data,
        userId: tarefa.userId,
        origemBairro: tarefa.origemBairro
    });
}

function renderizarConfiguracao({ contentor, bairro, estado, aoGuardar }) {
    contentor.replaceChildren();
    const titulo = estado ? 'Editar o Meu Bairro' : 'Construir o Meu Bairro';
    contentor.appendChild(criarCabecalho(titulo, 'Escolhe uma área e define as linhas que queres acompanhar em cada sessão.'));

    const grelha = document.createElement('div');
    grelha.className = 'meu-bairro-form-grid';
    const categoriaLabel = document.createElement('label');
    categoriaLabel.className = 'meu-bairro-field';
    const categoriaTitulo = document.createElement('span');
    categoriaTitulo.textContent = 'Área';
    const categoria = document.createElement('select');
    categoria.append(
        new Option('Selecciona uma área', ''),
        new Option('Música', 'musica'),
        new Option('Cozinha', 'cozinha')
    );
    categoria.value = estado?.categoria || '';
    categoriaLabel.append(categoriaTitulo, categoria);
    grelha.appendChild(categoriaLabel);

    const modeloLabel = document.createElement('label');
    modeloLabel.className = 'meu-bairro-field';
    const modeloTitulo = document.createElement('span');
    modeloTitulo.textContent = 'Modelo';
    const modelo = document.createElement('select');
    modeloLabel.append(modeloTitulo, modelo);
    grelha.appendChild(modeloLabel);

    const opcoesTitulo = document.createElement('p');
    opcoesTitulo.className = 'meu-bairro-section-title';
    opcoesTitulo.textContent = 'Linhas visíveis no exercício';
    const opcoes = document.createElement('div');
    opcoes.className = 'meu-bairro-opcoes';
    const acao = document.createElement('div');
    acao.className = 'meu-bairro-acao';
    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.className = 'meu-bairro-botao';
    guardar.textContent = estado ? 'Guardar definições' : 'Construir o Meu Bairro';
    acao.appendChild(guardar);

    let categoriaRenderizada = '';
    const actualizarOpcoes = () => {
        opcoes.replaceChildren();
        if (!categoria.value || !modelo.value) return;

        const campos = obterCampos(categoria.value, modelo.value);
        const ativos = new Set(estado?.categoria === categoria.value && estado?.modelo === modelo.value
            ? estado.camposAtivos
            : campos.map(campo => campo.id));
        campos.forEach(campo => opcoes.appendChild(criarOpcaoCampo(campo, ativos.has(campo.id))));
    };

    const actualizarModelos = () => {
        modelo.replaceChildren(new Option('Selecciona um modelo', ''));
        modelo.disabled = !categoria.value;
        if (!categoria.value) {
            categoriaRenderizada = '';
            actualizarOpcoes();
            return;
        }

        if (categoria.value === 'musica') {
            Object.entries(MODELOS_MUSICA).forEach(([id, item]) => modelo.appendChild(new Option(item.label, id)));
            modelo.value = !categoriaRenderizada && estado?.categoria === 'musica' && estado?.modelo
                ? estado.modelo
                : '';
        } else {
            modelo.appendChild(new Option('Cozinha', 'cozinha'));
            modelo.value = 'cozinha';
            modelo.disabled = true;
        }

        categoriaRenderizada = categoria.value;
        actualizarOpcoes();
    };

    categoria.addEventListener('change', actualizarModelos);
    modelo.addEventListener('change', actualizarOpcoes);
    guardar.addEventListener('click', () => {
        if (!categoria.value || !modelo.value) return;
        const camposAtivos = [...opcoes.querySelectorAll('input[data-meu-bairro-campo-ativo]:checked')]
            .map(input => input.dataset.meuBairroCampoAtivo);
        aoGuardar(montarEstadoConfiguracao({
            bairro,
            estadoAnterior: estado,
            categoria: categoria.value,
            modelo: modelo.value,
            camposAtivos
        }));
    });

    actualizarModelos();
    contentor.append(grelha, opcoesTitulo, opcoes, acao);
}

function renderizarAnexosDaAba({ contentor, bairro, estado, notaId }) {
    if (!estado.camposAtivos.includes('anexo')) return;

    const data = estado.preferencias?.mostrarUltimaLicao
        ? (obterUltimoRegisto(estado)?.data || dataParaChave(new Date()))
        : dataParaChave(new Date());
    const registo = obterRegisto(estado, data);
    const modelo = obterModelo(estado.categoria, estado.modelo);
    const anexos = document.createElement('section');
    anexos.className = 'meu-bairro-pratica-anexos';
    const titulo = document.createElement('p');
    titulo.className = 'meu-bairro-section-title';
    titulo.textContent = 'Anexos';
    const painel = document.createElement('div');
    anexos.append(titulo, painel);

    if (notaId) {
        montarPainelFicheiros(painel, {
            noteId: notaId,
            contextType: 'bairro-pratica',
            contextId: registo?.id || criarIdRegisto(bairro.id, estado.modelo, data),
            titulo: `Anexo de ${modelo.label}`
        });
    } else {
        const vazio = document.createElement('p');
        vazio.className = 'meu-bairro-vazio';
        vazio.textContent = 'Os anexos ficam disponíveis depois de a nota estar sincronizada.';
        painel.appendChild(vazio);
    }
    contentor.appendChild(anexos);
}

function renderizarDefinicoesAba({ contentor, bairro, estado, notaId, aoGuardar, aoAlterar, aoEscolherData }) {
    contentor.replaceChildren();
    const modelo = obterModelo(estado.categoria, estado.modelo);
    contentor.appendChild(criarCabecalho(
        `Definições de ${modelo.label}`,
        'Estas são as linhas que aparecem no registo exterior deste Bairro.'
    ));

    const opcoes = document.createElement('div');
    opcoes.className = 'meu-bairro-opcoes';
    const ativos = new Set(estado.camposAtivos);
    obterCampos(estado.categoria, estado.modelo).forEach(campo => {
        opcoes.appendChild(criarOpcaoCampo(campo, ativos.has(campo.id)));
    });

    const acao = document.createElement('div');
    acao.className = 'meu-bairro-acao';
    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.className = 'meu-bairro-botao';
    guardar.textContent = 'Guardar definições';
    guardar.onclick = () => aoGuardar({
        ...estado,
        camposAtivos: [...opcoes.querySelectorAll('input[data-meu-bairro-campo-ativo]:checked')]
            .map(input => input.dataset.meuBairroCampoAtivo)
    });
    acao.appendChild(guardar);
    contentor.append(opcoes, acao);

    const preferencias = document.createElement('div');
    preferencias.className = 'meu-bairro-preferencias';
    renderizarPreferencias({
        contentor: preferencias,
        estado,
        aoAlterar,
        aoEscolherData
    });
    contentor.appendChild(preferencias);
    renderizarAnexosDaAba({ contentor, bairro, estado, notaId });
}

function renderizarPreferencias({ contentor, estado, aoAlterar, aoEscolherData }) {
    const titulo = document.createElement('p');
    titulo.className = 'meu-bairro-section-title';
    titulo.textContent = 'Preferências';
    const grupo = document.createElement('div');
    grupo.className = 'meu-bairro-preferencias';
    [
        ['mostrarDiaAtual', 'Mostrar predefinidamente o dia actual'],
        ['interligarCalendarioDay', 'Interligar com meu Calendário em Day'],
        ['mostrarUltimaLicao', 'Mostrar a última lição feita']
    ].forEach(([chave, texto]) => {
        const label = document.createElement('label');
        label.className = 'bairro-posto-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(estado.preferencias?.[chave]);
        input.addEventListener('change', () => {
            estado.preferencias[chave] = input.checked;
            if (chave === 'mostrarDiaAtual' && input.checked) estado.preferencias.mostrarUltimaLicao = false;
            if (chave === 'mostrarUltimaLicao' && input.checked) estado.preferencias.mostrarDiaAtual = false;
            aoAlterar();
            aoEscolherData();
        });
        const track = document.createElement('span');
        track.className = 'bairro-posto-toggle-track';
        const copy = document.createElement('span');
        copy.textContent = texto;
        label.append(input, track, copy);
        grupo.appendChild(label);
    });
    contentor.append(titulo, grupo);
}

function renderizarPratica({
    contentor,
    bairro,
    caixaId,
    estado,
    notaId,
    db,
    aoAlterar,
    dataInicial = null,
    mostrarPreferencias = true,
    mostrarAnexos = true,
    mostrarCabecalho = true
}) {
    contentor.replaceChildren();
    const modelo = obterModelo(estado.categoria, estado.modelo);
    let dataSelecionada = dataInicial || (estado.preferencias?.mostrarUltimaLicao
        ? (obterUltimoRegisto(estado)?.data || dataParaChave(new Date()))
        : dataParaChave(new Date()));

    const aplicarData = (data) => {
        dataSelecionada = dataParaChave(data);
        renderizarPratica({
            contentor,
            bairro,
            caixaId,
            estado,
            notaId,
            db,
            aoAlterar,
            dataInicial: dataSelecionada,
            mostrarPreferencias,
            mostrarAnexos,
            mostrarCabecalho
        });
    };
    const dias = diasDaSemana(chaveParaData(dataSelecionada));
    const registo = obterRegisto(estado, dataSelecionada);
    const cabecalho = criarCabecalho(`${modelo.label} · Meu Bairro`, 'Regista cada sessão e acompanha a evolução ao longo das semanas.');
    const semana = document.createElement('div');
    semana.className = 'meu-bairro-semana';
    const etiquetaSemana = document.createElement('strong');
    etiquetaSemana.className = 'meu-bairro-semana-label';
    etiquetaSemana.textContent = formatarIntervaloSemana(dias);
    const navegacao = document.createElement('div');
    navegacao.className = 'meu-bairro-semana-nav';
    const anterior = document.createElement('button');
    anterior.type = 'button';
    anterior.textContent = '‹';
    anterior.setAttribute('aria-label', 'Semana anterior');
    anterior.onclick = () => { const data = chaveParaData(dataSelecionada); data.setDate(data.getDate() - 7); aplicarData(data); };
    const seguinte = document.createElement('button');
    seguinte.type = 'button';
    seguinte.textContent = '›';
    seguinte.setAttribute('aria-label', 'Semana seguinte');
    seguinte.onclick = () => { const data = chaveParaData(dataSelecionada); data.setDate(data.getDate() + 7); aplicarData(data); };
    navegacao.append(anterior, seguinte);
    semana.append(etiquetaSemana, navegacao);

    const diasEl = document.createElement('div');
    diasEl.className = 'meu-bairro-dias';
    const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    dias.forEach((dia, indice) => {
        const chave = dataParaChave(dia);
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `meu-bairro-dia${chave === dataSelecionada ? ' active' : ''}${obterRegisto(estado, chave) ? ' tem-registo' : ''}`;
        const nome = document.createElement('strong');
        nome.textContent = diasSemana[indice];
        const numero = document.createElement('small');
        numero.textContent = String(dia.getDate());
        botao.append(nome, numero);
        botao.onclick = () => aplicarData(dia);
        diasEl.appendChild(botao);
    });

    const form = document.createElement('div');
    form.className = 'meu-bairro-form-grid';
    const campoHora = criarCampo({ id: 'hora', label: 'Hora', tipo: 'text' }, registo?.hora || '');
    const inputHora = campoHora.querySelector('input');
    inputHora.type = 'time';
    form.appendChild(campoHora);
    estado.camposAtivos
        .map(id => obterCampos(estado.categoria, estado.modelo).find(campo => campo.id === id))
        .filter(Boolean)
        .forEach(campo => {
            if (campo.tipo !== 'anexo') form.appendChild(criarCampo(campo, registo?.campos?.[campo.id] || ''));
        });

    const acao = document.createElement('div');
    acao.className = 'meu-bairro-acao';
    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.className = 'meu-bairro-botao';
    guardar.textContent = registo ? 'Guardar alterações' : 'Guardar exercício';
    guardar.onclick = () => {
        const campos = {};
        form.querySelectorAll('[data-meu-bairro-campo]').forEach(input => {
            if (input.dataset.meuBairroCampo !== 'data' && input.dataset.meuBairroCampo !== 'hora') {
                campos[input.dataset.meuBairroCampo] = input.value;
            }
        });
        const novoRegisto = {
            ...(registo || {}),
            id: registo?.id || criarIdRegisto(bairro.id, estado.modelo, dataSelecionada),
            tipo: `${modelo.label} - ${dataSelecionada}`,
            data: dataSelecionada,
            hora: inputHora.value || '',
            campos,
            actualizadoEm: Date.now()
        };
        const semanaAtual = chaveSemana(chaveParaData(dataSelecionada));
        if (!estado.semanas[semanaAtual]) estado.semanas[semanaAtual] = { dias: {} };
        if (!estado.semanas[semanaAtual].dias) estado.semanas[semanaAtual].dias = {};
        estado.semanas[semanaAtual].dias[dataSelecionada] = novoRegisto;
        aoAlterar();
        console.info('[MEU-BAIRRO][DAY] Preferência de interligação:', {
            ativa: estado.preferencias?.interligarCalendarioDay !== false,
            tarefaId: novoRegisto.id,
            data: novoRegisto.data
        });
        if (estado.preferencias?.interligarCalendarioDay !== false) {
            sincronizarTarefaDoDia({ db, userId: window.auth?.currentUser?.uid, bairro, caixaId, estado, registo: novoRegisto, notaId })
            .catch(erro => console.error('[MEU-BAIRRO] Não foi possível ligar ao calendário:', erro));
        } else {
            console.warn('[MEU-BAIRRO][DAY] Exercício não enviado: interligação desligada.');
        }
        renderizarPratica({
            contentor,
            bairro,
            caixaId,
            estado,
            notaId,
            db,
            aoAlterar,
            dataInicial: dataSelecionada,
            mostrarPreferencias,
            mostrarAnexos,
            mostrarCabecalho
        });
    };
    acao.appendChild(guardar);

    const preferencias = document.createElement('div');
    preferencias.className = 'meu-bairro-preferencias';
    renderizarPreferencias({
        contentor: preferencias,
        estado,
        aoAlterar,
        aoEscolherData: () => renderizarPratica({
            contentor,
            bairro,
            caixaId,
            estado,
            notaId,
            db,
            aoAlterar,
            mostrarPreferencias,
            mostrarAnexos,
            mostrarCabecalho
        })
    });

    const anexos = document.createElement('section');
    anexos.className = 'meu-bairro-pratica-anexos';
    const anexoTitulo = document.createElement('p');
    anexoTitulo.className = 'meu-bairro-section-title';
    anexoTitulo.textContent = 'Anexos';
    const anexosPainel = document.createElement('div');
    anexos.append(anexoTitulo, anexosPainel);
    if (mostrarCabecalho) contentor.appendChild(cabecalho);
    contentor.append(semana, diasEl, form, acao);
    if (mostrarPreferencias) contentor.appendChild(preferencias);
    if (mostrarAnexos && estado.camposAtivos.includes('anexo')) contentor.appendChild(anexos);
    if (notaId && estado.camposAtivos.includes('anexo')) {
        montarPainelFicheiros(anexosPainel, {
            noteId: notaId,
            contextType: 'bairro-pratica',
            contextId: registo?.id || criarIdRegisto(bairro.id, estado.modelo, dataSelecionada),
            titulo: 'Partitura, cifra, áudio ou vídeo'
        });
    } else {
        const vazio = document.createElement('p');
        vazio.className = 'meu-bairro-vazio';
        vazio.textContent = 'Os anexos ficam disponíveis depois de a nota estar sincronizada.';
        anexosPainel.appendChild(vazio);
    }
}

export function renderizarPraticaExterior({ contentor, bairro, caixaId, notaId, db, aoAlterar }) {
    const estado = obterEstado(bairro);
    if (!estado) {
        contentor.replaceChildren();
        contentor.hidden = true;
        return;
    }
    contentor.hidden = false;
    renderizarPratica({
        contentor,
        bairro,
        caixaId,
        estado,
        notaId,
        db,
        aoAlterar,
        mostrarPreferencias: false,
        mostrarAnexos: false,
        mostrarCabecalho: false
    });
}

export function configurarMeuBairro({ bairro, notaId, db, config, pratica, tabConfig, tabPratica, aoAlterar, aoSelecionar, aoConstruir }) {
    let bairroActual = bairro;
    let estado = obterEstado(bairroActual);

    tabPratica.hidden = true;
    tabPratica.textContent = 'Meu Bairro';
    tabPratica.title = '';

    const actualizarTab = () => {
        const modelo = estado ? obterModelo(estado.categoria, estado.modelo) : null;
        tabPratica.hidden = !modelo;
        if (modelo) {
            tabPratica.textContent = modelo.label;
            tabPratica.title = `Abrir ${modelo.label}`;
        }
    };

    const actualizarConfiguracao = () => {
        renderizarConfiguracao({
            contentor: config,
            bairro: bairroActual,
            estado,
            aoGuardar: novoEstado => {
                let criouNovoBairro = false;
                if (!estado && aoConstruir) {
                    const novoBairro = aoConstruir(novoEstado);
                    if (!novoBairro) return;
                    bairroActual = novoBairro;
                    criouNovoBairro = true;
                }
                bairroActual.meuBairro = novoEstado;
                estado = novoEstado;
                aoAlterar();
                if (criouNovoBairro) {
                    document.getElementById('popup-bairro-posto-overlay')?.classList.remove('active');
                    return;
                }
                actualizarTab();
                actualizarConfiguracao();
                actualizarDefinicoes();
                aoSelecionar('meu-bairro-pratica');
            }
        });
    };

    const actualizarDefinicoes = () => {
        if (!estado) {
            pratica.replaceChildren();
            return;
        }
        renderizarDefinicoesAba({
            contentor: pratica,
            bairro: bairroActual,
            estado,
            notaId,
            aoAlterar,
            aoGuardar: novoEstado => {
                bairroActual.meuBairro = novoEstado;
                estado = novoEstado;
                aoAlterar();
                actualizarTab();
                actualizarConfiguracao();
                actualizarDefinicoes();
            },
            aoEscolherData: () => actualizarDefinicoes()
        });
    };

    const seleccionar = alvo => {
        if (alvo === 'meu-bairro-pratica' && estado) {
            actualizarDefinicoes();
        } else if (alvo === 'meu-bairro') {
            actualizarConfiguracao();
        }
    };

    actualizarTab();
    actualizarConfiguracao();
    actualizarDefinicoes();
    tabConfig.onclick = () => aoSelecionar('meu-bairro');
    tabPratica.onclick = () => aoSelecionar('meu-bairro-pratica');
    return { seleccionar, actualizarTab };
}

export { obterCampos, obterModelo };
