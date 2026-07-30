import { obterConfigNota } from '../../settings/preferences.js';

const TIPOS_CAIXA = [
    { value: 'questao', label: 'Questão' },
    { value: 'subnota', label: 'Subnota' },
    { value: 'raciocinio', label: 'Raciocínio' },
    { value: 'cartaovisita', label: 'Cartão de visita' },
    { value: 'contentor', label: 'Contentor' },
    { value: 'firmamento', label: 'Firmamento' }
];

const DESTINOS_TEXTO = [
    { value: 'title', label: 'Título' },
    { value: 'content', label: 'Descrição' }
];

function normalizarDestino(tipo, destino) {
    if (tipo === 'contentor' || tipo === 'firmamento') return 'content';
    return DESTINOS_TEXTO.some(opcao => opcao.value === destino) ? destino : 'title';
}

function reconciliarLinhas(anteriores, partes, tipoGlobal, destinoGlobal) {
    const indicesPorTexto = new Map();
    const indicesUsados = new Set();

    anteriores.forEach((linha, indice) => {
        const indices = indicesPorTexto.get(linha.texto) || [];
        indices.push(indice);
        indicesPorTexto.set(linha.texto, indices);
    });

    const correspondencias = partes.map(parte => {
        const indices = indicesPorTexto.get(parte);
        const indice = indices?.find(valor => !indicesUsados.has(valor));
        if (indice === undefined) return null;
        indicesUsados.add(indice);
        return anteriores[indice];
    });

    return partes.map((parte, indice) => {
        let anterior = correspondencias[indice];

        // Se o texto desta linha foi editado, conserva a personalização da
        // mesma posição, desde que essa linha antiga não tenha sido reutilizada.
        if (!anterior && anteriores[indice] && !indicesUsados.has(indice)) {
            anterior = anteriores[indice];
            indicesUsados.add(indice);
        }

        const tipo = anterior?.tipo || tipoGlobal;
        const destino = anterior?.destino || destinoGlobal;
        return {
            texto: parte,
            tipo,
            destino: normalizarDestino(tipo, destino)
        };
    });
}
let contextoAtual = null;
let linhasAtuais = [];
let popupInicializado = false;
let importacaoEmCurso = false;

function textoLimpo(texto) {
    return String(texto || '').replace(/\r\n?/g, '\n').trim();
}

function separarDepoisDe(texto, eDelimitador) {
    const partes = [];
    let inicio = 0;

    for (let indice = 0; indice < texto.length; indice += 1) {
        if (!eDelimitador(texto, indice)) continue;

        const parte = texto.slice(inicio, indice + 1).trim();
        if (parte) partes.push(parte);
        inicio = indice + 1;
    }

    const resto = texto.slice(inicio).trim();
    if (resto) partes.push(resto);
    return partes;
}

function separarPorReticencias(texto) {
    const partes = [];
    let inicio = 0;

    for (let indice = 0; indice < texto.length; indice += 1) {
        const eReticencias = texto[indice] === '…' || texto.slice(indice, indice + 3) === '...';
        if (!eReticencias) continue;

        const comprimento = texto[indice] === '…' ? 1 : 3;
        const parte = texto.slice(inicio, indice + comprimento).trim();
        if (parte) partes.push(parte);
        inicio = indice + comprimento;
        if (comprimento === 3) indice += 2;
    }

    const resto = texto.slice(inicio).trim();
    if (resto) partes.push(resto);
    return partes;
}
function separarPorParagrafoEDelimitador(texto, delimitador) {
    return texto
        .split(/\n\s*\n+/)
        .flatMap(paragrafo => separarDepoisDe(paragrafo, (entrada, indice) => entrada[indice] === delimitador))
        .filter(Boolean);
}

function separarPorNumero(texto) {
    const partes = texto
        .split(/(?=\d+\s*[.):\-]\s+)/)
        .map(parte => parte.trim())
        .filter(Boolean);

    return partes.length > 1 ? partes : texto.split(/\n+/).map(parte => parte.trim()).filter(Boolean);
}

export function separarTextoImportado(texto, modo) {
    const valor = textoLimpo(texto);
    if (!valor) return [];

    switch (modo) {
        case 'paragraph':
            return valor.split(/\n\s*\n+/).map(parte => parte.trim()).filter(Boolean);
        case 'question':
            return separarDepoisDe(valor, (entrada, indice) => entrada[indice] === '?');
        case 'combo-question-parenthesis':
            return separarDepoisDe(valor, (entrada, indice) => entrada[indice] === '?' || entrada[indice] === ')');
        case 'combo-paragraph-parenthesis':
            return separarPorParagrafoEDelimitador(valor, ')');
        case 'combo-paragraph-question':
            return separarPorParagrafoEDelimitador(valor, '?');
        case 'period':
            return separarDepoisDe(valor, (entrada, indice) => entrada[indice] === '.');
        case 'punctuation':
            return separarDepoisDe(valor, (entrada, indice) => /[?!;.]/.test(entrada[indice]));
        case 'ellipsis':
            return separarPorReticencias(valor);
        case 'semicolon':
            return separarDepoisDe(valor, (entrada, indice) => entrada[indice] === ';');
        case 'number':
            return separarPorNumero(valor);
        case 'close-parenthesis':
            return separarDepoisDe(valor, (entrada, indice) => entrada[indice] === ')');
        case 'open-parenthesis':
            return separarDepoisDe(valor, (entrada, indice) => entrada[indice] === '(');
        default:
            return [valor];
    }
}

function criarSelectTipo(valor, indice) {
    const select = document.createElement('select');
    select.className = 'importar-texto-row-select';
    select.dataset.indice = String(indice);
    select.setAttribute('aria-label', 'Tipo da caixa ' + (indice + 1));

    TIPOS_CAIXA.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo.value;
        option.textContent = tipo.label;
        option.selected = tipo.value === valor;
        select.appendChild(option);
    });

    select.addEventListener('change', () => {
        const linha = linhasAtuais[Number(select.dataset.indice)];
        if (linha) {
            linha.tipo = select.value;
            linha.destino = normalizarDestino(linha.tipo, linha.destino);
            renderizarPreview();
        }
    });

    return select;
}

function criarSelectDestino(tipo, valor, indice) {
    const select = document.createElement('select');
    select.className = 'importar-texto-row-select';
    select.dataset.indice = String(indice);
    select.setAttribute('aria-label', 'Destino do texto da caixa ' + (indice + 1));

    const destinoNormalizado = normalizarDestino(tipo, valor);
    DESTINOS_TEXTO.forEach(destino => {
        if ((tipo === 'contentor' || tipo === 'firmamento') && destino.value !== 'content') return;

        const option = document.createElement('option');
        option.value = destino.value;
        option.textContent = (tipo === 'contentor' || tipo === 'firmamento') ? 'Descrição' : destino.label;
        option.selected = destino.value === destinoNormalizado;
        select.appendChild(option);
    });

    select.disabled = tipo === 'contentor' || tipo === 'firmamento';
    select.addEventListener('change', () => {
        const linha = linhasAtuais[Number(select.dataset.indice)];
        if (linha) linha.destino = normalizarDestino(linha.tipo, select.value);
    });

    return select;
}
function renderizarPreview() {
    const preview = document.getElementById('importar-texto-preview');
    const tipoGlobal = document.getElementById('importar-texto-tipo-global')?.value || 'questao';
    const destinoGlobal = document.getElementById('importar-texto-destino-global')?.value || 'title';
    if (!preview) return;

    preview.replaceChildren();

    if (!linhasAtuais.length) {
        const vazio = document.createElement('p');
        vazio.className = 'importar-texto-vazio';
        vazio.textContent = 'Cola um texto para veres as caixas que serão criadas.';
        preview.appendChild(vazio);
        return;
    }

    linhasAtuais.forEach((linha, indice) => {
        const row = document.createElement('div');
        row.className = 'importar-texto-row';

        const text = document.createElement('div');
        text.className = 'importar-texto-row-text';

        const number = document.createElement('span');
        number.className = 'importar-texto-row-number';
        number.textContent = String(indice + 1).padStart(2, '0');
        const tipoLinha = linha.tipo || tipoGlobal;
        const destinoLinha = normalizarDestino(tipoLinha, linha.destino || destinoGlobal);
        linha.tipo = tipoLinha;
        linha.destino = destinoLinha;
        row.dataset.tipo = tipoLinha;

        text.append(number, document.createTextNode(linha.texto));
        row.append(
            text,
            criarSelectTipo(tipoLinha, indice),
            criarSelectDestino(tipoLinha, destinoLinha, indice)
        );
        preview.appendChild(row);
    });
}

function actualizarLinhas() {
    const texto = document.getElementById('importar-texto-conteudo')?.value || '';
    const modo = document.getElementById('importar-texto-separador')?.value || 'paragraph';
    const tipoGlobal = document.getElementById('importar-texto-tipo-global')?.value || 'questao';
    const destinoGlobal = document.getElementById('importar-texto-destino-global')?.value || 'title';
    const partes = separarTextoImportado(texto, modo);

    linhasAtuais = reconciliarLinhas(linhasAtuais, partes, tipoGlobal, destinoGlobal);
    renderizarPreview();
}

function fecharPopup() {
    document.getElementById('popup-importar-texto-overlay')?.classList.remove('active');
    contextoAtual = null;
}

function inicializarPopup() {
    if (popupInicializado) return;

    const popup = document.getElementById('popup-importar-texto-overlay');
    const texto = document.getElementById('importar-texto-conteudo');
    const separador = document.getElementById('importar-texto-separador');
    const tipoGlobal = document.getElementById('importar-texto-tipo-global');
    const destinoGlobal = document.getElementById('importar-texto-destino-global');
const btnImportar = document.getElementById('btn-confirmar-importar-texto');

    if (!popup || !texto || !separador || !tipoGlobal || !destinoGlobal || !btnImportar) return;

    popupInicializado = true;

    document.getElementById('btn-fechar-importar-texto')?.addEventListener('click', fecharPopup);
    document.getElementById('btn-cancelar-importar-texto')?.addEventListener('click', fecharPopup);
    texto.addEventListener('input', actualizarLinhas);
    separador.addEventListener('change', actualizarLinhas);

    tipoGlobal.addEventListener('change', () => {
        if (tipoGlobal.value === 'contentor' || tipoGlobal.value === 'firmamento') {
            destinoGlobal.value = 'content';
            destinoGlobal.disabled = true;
        } else {
            destinoGlobal.disabled = false;
        }

        linhasAtuais.forEach(linha => {
            linha.tipo = tipoGlobal.value;
            linha.destino = normalizarDestino(linha.tipo, destinoGlobal.value);
        });
        renderizarPreview();
    });

    destinoGlobal.addEventListener('change', () => {
        linhasAtuais.forEach(linha => {
            linha.destino = normalizarDestino(linha.tipo, destinoGlobal.value);
        });
        renderizarPreview();
    });

    btnImportar.addEventListener('click', importarCaixas);
}

async function importarCaixas() {
    if (importacaoEmCurso) return;

    const estado = document.getElementById('importar-texto-estado');
    const btnImportar = document.getElementById('btn-confirmar-importar-texto');

    if (!contextoAtual || !linhasAtuais.length) {
        if (estado) {
            estado.className = 'importar-texto-estado erro';
            estado.textContent = 'Cola primeiro um texto válido.';
        }
        return;
    }

    importacaoEmCurso = true;
    if (btnImportar) {
        btnImportar.disabled = true;
        btnImportar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A criar...';
    }

    try {
        const { dadosNotaOriginal, caixasAtuais, authRef, atualizarFeedEGravar } = contextoAtual;
        const noteConfig = obterConfigNota(dadosNotaOriginal, authRef?.currentUser?.uid);

        const modosAtivos = Array.isArray(dadosNotaOriginal?.modo)
            ? dadosNotaOriginal.modo
            : [dadosNotaOriginal?.modo || 'normal'];
        const isModoPost = modosAtivos.includes('post');

        // Mantém a mesma base de ordenação utilizada ao criar caixas individualmente.
        caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        const novasCaixas = linhasAtuais.map(linha => {
            const caixa = {
                id: crypto.randomUUID(),
                tipo: linha.tipo,
                conteudo: linha.destino === 'content' ? linha.texto : '',
                estado: 'on',
                timestamp: new Date().toISOString(),
                protecao: 'fechado'
            };

            if (linha.destino === 'title') caixa.titulo = linha.texto;
            if (linha.tipo === 'firmamento') {
                caixa.foco = 'original';
                caixa.corFirmamento = '#050505';
                caixa.textoFirmamento = '#ffffff';
            } else if (noteConfig.defaultFocos?.[linha.tipo]) {
                caixa.foco = noteConfig.defaultFocos[linha.tipo];
            }
            return caixa;
        });

        // No Modo Post o feed é apresentado por ordem decrescente. Inverter apenas
        // a inserção conserva, no ecrã, a sequência definida na pré-visualização.
        const caixasNaOrdemDeGravacao = isModoPost
            ? [...novasCaixas].reverse()
            : novasCaixas;

        caixasAtuais.push(...caixasNaOrdemDeGravacao);
        caixasAtuais.forEach((caixa, indice) => {
            caixa.ordem = indice + 1;
        });

        if (dadosNotaOriginal.onde === 'share') {
            const uid = authRef?.currentUser?.uid;
            const nome = authRef?.currentUser?.displayName || authRef?.currentUser?.email || 'Utilizador';
            dadosNotaOriginal.shareNovidades = {
                ...(dadosNotaOriginal.shareNovidades || {}),
                ...Object.fromEntries(novasCaixas.map(caixa => [caixa.id, {
                    tipo: 'criado',
                    by: uid,
                    byName: nome,
                    viewedBy: uid ? [uid] : [],
                    timestamp: new Date().toISOString()
                }]))
            };
        }

        await atualizarFeedEGravar(true);
        fecharPopup();
    } catch (erro) {
        console.error('[IMPORTAR-TEXTO] Erro ao criar caixas:', erro);
        if (estado) {
            estado.className = 'importar-texto-estado erro';
            estado.textContent = 'Não foi possível criar as caixas. Tenta novamente.';
        }
    } finally {
        importacaoEmCurso = false;
        if (btnImportar) {
            btnImportar.disabled = false;
            btnImportar.innerHTML = '<i class="fa-solid fa-layer-group"></i> Criar caixas';
        }
    }
}

export function abrirPopupImportarTexto(ctx) {
    contextoAtual = ctx;
    inicializarPopup();

    const popup = document.getElementById('popup-importar-texto-overlay');
    const texto = document.getElementById('importar-texto-conteudo');
    const estado = document.getElementById('importar-texto-estado');

    if (!popup || !texto) return;

    texto.value = '';
    linhasAtuais = [];
    if (estado) {
        estado.className = 'importar-texto-estado';
        estado.textContent = '';
    }

    renderizarPreview();
    popup.classList.add('active');
    setTimeout(() => texto.focus(), 80);
}