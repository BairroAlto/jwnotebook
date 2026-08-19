import {
    CITACOES_INSPIRADOR_FALLBACK,
    INSPIRADOR_AUTORES,
    INSPIRADOR_TEMAS,
    imagemInspiradorPorTema
} from './quote-library.js';

const WIKIQUOTE_SITES = Object.freeze({
    pt: 'https://pt.wikiquote.org',
    en: 'https://en.wikiquote.org',
    es: 'https://es.wikiquote.org',
    fr: 'https://fr.wikiquote.org',
    it: 'https://it.wikiquote.org'
});

function normalizarIdiomaInspirador(valor) {
    return Object.hasOwn(WIKIQUOTE_SITES, valor) ? valor : 'pt';
}

export { INSPIRADOR_AUTORES, INSPIRADOR_TEMAS };

function normalizarListaInspirador(valor, fallback) {
    const lista = Array.isArray(valor) ? valor : [valor];
    const resultado = [...new Set(lista
        .map(item => String(item || '').trim().slice(0, 80))
        .filter(Boolean))];
    return resultado.length ? resultado.slice(0, 5) : [fallback];
}

export function normalizarPreferenciasInspirador(valor = {}) {
    const modo = ['autor', 'tema', 'aleatorio'].includes(valor.modo) ? valor.modo : 'aleatorio';
    const quantidade = Math.min(5, Math.max(1, Number.parseInt(valor.quantidade, 10) || 1));
    const idioma = normalizarIdiomaInspirador(valor.idioma);
    const autores = normalizarListaInspirador(valor.autores ?? valor.autor, INSPIRADOR_AUTORES[0]);
    const temas = normalizarListaInspirador(valor.temas ?? valor.tema, INSPIRADOR_TEMAS[0].valor)
        .map(item => INSPIRADOR_TEMAS.find(tema => (
            normalizarTema(tema.valor) === normalizarTema(item)
            || normalizarTema(tema.nome) === normalizarTema(item)
        ))?.valor || item);
    return {
        modo,
        autor: autores[0],
        autores,
        tema: temas[0],
        temas,
        idioma,
        quantidade,
        variedade: valor.variedade === 'diferentes' ? 'diferentes' : 'mesmo',
        frequencia: valor.frequencia === 'entrada' ? 'entrada' : 'diaria',
        vista: valor.vista === 'grelha' ? 'grelha' : 'lista'
    };
}

export function obterDiaInspirador(data = new Date()) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

export function obterChaveGeracaoInspirador(caixa, preferencias) {
    const ciclo = preferencias.frequencia === 'entrada'
        ? (window.NotaBookNotaSessao || 'sessao-partilhada')
        : obterDiaInspirador();
    return `${caixa.id || 'sem-id'}|${ciclo}|${JSON.stringify(preferencias)}`;
}

function normalizarTema(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function obterTemaPorTexto(texto = '') {
    const normalizado = normalizarTema(texto);
    return INSPIRADOR_TEMAS.find(tema => normalizarTema(tema.valor) === normalizado || normalizarTema(tema.nome) === normalizado)?.valor || 'esperanca';
}

function substituirLigacoes(texto) {
    return texto
        // As ligações para imagens não fazem parte do texto da citação.
        .replace(/\[\[(?:File|Ficheiro|Image|Imagem|Media):[^\]]+\]\]/gi, '')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\[https?:\/\/[^\s]+\s+([^\]]+)\]/g, '$1');
}

function limparLinhaWiki(linha) {
    const linhaLimpa = String(linha || '')
        .replace(/<ref[\s\S]*?<\/ref>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\{\{[^{}]*\}\}/g, '')
        .replace(/'{2,5}/g, '')
        .replace(/^\s*[*#:;]+\s*/, '')
        .replace(/\s+/g, ' ');
    return substituirLigacoes(linhaLimpa).trim();
}

export function limparTextoCitacaoInspirador(texto) {
    const textoLimpo = limparLinhaWiki(texto);
    return /^(?:thumb|right|left|center|frame|frameless)\|/i.test(textoLimpo)
        ? ''
        : textoLimpo;
}

function extrairCitacoesWikitext(wikitext, titulo, idioma, autorPreferido = '', temaPreferido = '') {
    const linhas = String(wikitext || '').split(/\r?\n/);
    const resultados = [];
    const vistos = new Set();

    linhas.forEach(linha => {
        const limpa = limparLinhaWiki(linha);
        if (limpa.length < 28 || limpa.length > 320) return;
        if (/^(==+|categoria:|referências|ver também|ligações externas|bibliografia)/i.test(limpa)) return;
        if (/https?:\/\//i.test(limpa) || /\bISBN\b/i.test(limpa)) return;
        const texto = limpa.replace(/^[-–—]\s*/, '').trim();
        const chave = texto.toLocaleLowerCase('pt-PT');
        if (vistos.has(chave)) return;
        vistos.add(chave);
        resultados.push({
            texto,
            autor: autorPreferido || titulo,
            tema: temaPreferido || obterTemaPorTexto(`${titulo} ${texto}`),
            imagem: imagemInspiradorPorTema(temaPreferido || obterTemaPorTexto(`${titulo} ${texto}`)),
            fonte: 'Wikiquote',
            url: `${WIKIQUOTE_SITES[idioma]}/wiki/${encodeURIComponent(String(titulo || '').replace(/ /g, '_'))}`
        });
    });
    return resultados;
}

async function pedirWikiquote(parametros, idioma = 'pt') {
    const url = new URL(`${WIKIQUOTE_SITES[normalizarIdiomaInspirador(idioma)]}/w/api.php`);
    Object.entries({ ...parametros, format: 'json', formatversion: '2', origin: '*' }).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(chave, valor);
    });
    const resposta = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resposta.ok) throw new Error(`A Wikiquote respondeu com o estado ${resposta.status}.`);
    const dados = await resposta.json();
    if (dados.error) throw new Error(dados.error.info || 'A Wikiquote não conseguiu concluir a pesquisa.');
    return dados;
}

export async function pesquisarAutoresInspirador(termo, idioma = 'pt') {
    const pesquisa = String(termo || '').trim();
    if (pesquisa.length < 2) return [];

    try {
        const dados = await pedirWikiquote({
            action: 'query',
            generator: 'search',
            gsrsearch: pesquisa,
            gsrnamespace: 0,
            gsrlimit: 8,
            prop: 'pageimages',
            piprop: 'thumbnail',
            pithumbsize: 72
        }, idioma);
        const paginas = Array.isArray(dados.query?.pages)
            ? dados.query.pages
            : Object.values(dados.query?.pages || {});
        return paginas
            .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
            .map(pagina => ({
                nome: pagina.title,
                imagem: pagina.thumbnail?.source || imagemInspiradorPorTema('sabedoria')
            }))
            .filter(resultado => resultado.nome);
    } catch (erro) {
        console.info('[INSPIRADOR][AUTORES] Pesquisa indisponível:', erro.message);
        const normalizada = normalizarTema(pesquisa);
        return INSPIRADOR_AUTORES
            .filter(nome => normalizarTema(nome).includes(normalizada))
            .slice(0, 8)
            .map(nome => ({ nome, imagem: imagemInspiradorPorTema('sabedoria') }));
    }
}

export async function pesquisarTemasInspirador(termo) {
    const pesquisa = normalizarTema(termo);
    if (pesquisa.length < 2) return [];
    return INSPIRADOR_TEMAS
        .filter(item => normalizarTema(item.nome).includes(pesquisa) || normalizarTema(item.valor).includes(pesquisa))
        .map(item => ({
            nome: item.nome,
            imagem: imagemInspiradorPorTema(item.valor)
        }));
}

async function obterTitulosWikiquote(preferencias, termoEscolhido = '') {
    if (preferencias.modo === 'aleatorio') {
        const dados = await pedirWikiquote({
            action: 'query',
            list: 'random',
            rnnamespace: 0,
            rnlimit: Math.max(8, preferencias.quantidade * 3)
        }, preferencias.idioma);
        return (dados.query?.random || []).map(item => item.title).filter(Boolean);
    }

    const termo = termoEscolhido || (preferencias.modo === 'autor' ? preferencias.autor : preferencias.tema);
    const dados = await pedirWikiquote({
        action: 'query',
        list: 'search',
        srsearch: termo,
        srnamespace: 0,
        srlimit: Math.max(8, preferencias.quantidade * 3)
    }, preferencias.idioma);
    return (dados.query?.search || []).map(item => item.title).filter(Boolean);
}

async function obterWikitextWikiquote(titulo, idioma) {
    const dados = await pedirWikiquote({ action: 'parse', page: titulo, prop: 'wikitext' }, idioma);
    const wikitext = dados.parse?.wikitext;
    if (typeof wikitext === 'string') return wikitext;
    return wikitext?.['*'] || wikitext?.content || '';
}

async function pesquisarWikiquote(preferencias) {
    const termos = preferencias.modo === 'autor' ? preferencias.autores : preferencias.temas;
    const pesquisas = preferencias.modo === 'aleatorio' || preferencias.variedade !== 'diferentes'
        ? ['']
        : termos;
    const resultados = await Promise.all(pesquisas.map(async termo => {
        const titulos = await obterTitulosWikiquote(preferencias, termo);
        const autorPreferido = preferencias.modo === 'autor' ? (termo || preferencias.autor) : '';
        const temaPreferido = preferencias.modo === 'tema' ? (termo || preferencias.tema) : '';
        const paginas = await Promise.all(titulos.slice(0, 10).map(async titulo => {
            try {
                return extrairCitacoesWikitext(
                    await obterWikitextWikiquote(titulo, preferencias.idioma),
                    titulo,
                    preferencias.idioma,
                    autorPreferido,
                    temaPreferido
                );
            } catch (erro) {
                console.info('[INSPIRADOR][WIKIQUOTE] Página ignorada:', titulo, erro.message);
                return [];
            }
        }));
        return paginas.flat();
    }));
    return resultados.flat();
}

function baralhar(lista) {
    return [...lista].sort(() => Math.random() - 0.5);
}

function selecionarDaLista(lista, quantidade, variedade, modo = 'autor') {
    if (!lista.length) return [];
    const resultados = [];
    const candidatos = baralhar(lista);
    const grupos = [...new Set(candidatos.map(item => (
        modo === 'tema' ? item.tema : item.autor
    ) || 'geral'))];

    if (variedade === 'mesmo' && grupos.length) {
        const grupo = grupos[Math.floor(Math.random() * grupos.length)];
        const doGrupo = candidatos.filter(item => ((modo === 'tema' ? item.tema : item.autor) || 'geral') === grupo);
        for (let indice = 0; indice < quantidade; indice += 1) {
            resultados.push(doGrupo[indice % doGrupo.length]);
        }
        return resultados.filter(Boolean);
    }

    for (let indice = 0; indice < quantidade; indice += 1) {
        if (variedade === 'diferentes' && grupos.length > 1) {
            const grupo = grupos[indice % grupos.length];
            const doGrupo = candidatos.filter(item => ((modo === 'tema' ? item.tema : item.autor) || 'geral') === grupo);
            resultados.push(doGrupo[indice % doGrupo.length]);
        } else {
            resultados.push(candidatos[indice % candidatos.length]);
        }
    }
    return resultados.filter(Boolean);
}

function filtrarFallback(preferencias) {
    let lista = [...CITACOES_INSPIRADOR_FALLBACK];
    if (preferencias.modo === 'autor') lista = lista.filter(item => preferencias.autores.includes(item.autor));
    if (preferencias.modo === 'tema') lista = lista.filter(item => preferencias.temas.includes(item.chaveTema));
    if (!lista.length) lista = [...CITACOES_INSPIRADOR_FALLBACK];
    return lista;
}

export async function obterCitacoesInspirador(valor) {
    const preferencias = normalizarPreferenciasInspirador(valor);
    let lista = [];
    try {
        lista = await pesquisarWikiquote(preferencias);
        if (preferencias.modo === 'autor') {
            lista = lista.filter(item => preferencias.autores.some(autor => (
                item.autor === autor || item.url?.toLowerCase().includes(normalizarTema(autor))
            )));
        }
        if (preferencias.modo === 'tema') {
            const temas = preferencias.temas.map(normalizarTema);
            const filtradas = lista.filter(item => temas.some(tema => (
                normalizarTema(item.tema).includes(tema) || normalizarTema(item.texto).includes(tema)
            )));
            if (filtradas.length) lista = filtradas;
        }
    } catch (erro) {
        console.info('[INSPIRADOR] Wikiquote indisponível; a usar colecção de segurança:', erro.message);
    }

    if (!lista.length) lista = filtrarFallback(preferencias);
    return selecionarDaLista(lista, preferencias.quantidade, preferencias.variedade, preferencias.modo);
}

export function obterImagemCitacaoInspirador(citacao) {
    return citacao?.imagem || imagemInspiradorPorTema(citacao?.tema);
}

export function criarPreferenciasInspiradorIniciais() {
    return normalizarPreferenciasInspirador({
        modo: 'aleatorio',
        quantidade: 1,
        variedade: 'mesmo',
        frequencia: 'diaria',
        vista: 'lista'
    });
}

export function abrirConfiguradorInspirador(caixa) {
    return new Promise(resolve => {
        const overlay = document.getElementById('popup-inspirador-overlay');
        const modo = document.getElementById('inspirador-modo');
        const autor = document.getElementById('inspirador-autor');
        const tema = document.getElementById('inspirador-tema');
        const idioma = document.getElementById('inspirador-idioma');
        const quantidade = document.getElementById('inspirador-quantidade');
        const variedade = document.getElementById('inspirador-variedade');
        const frequencia = document.getElementById('inspirador-frequencia');
        const vista = document.getElementById('inspirador-vista');
        const multiplosCampos = document.getElementById('inspirador-multiplos-campos');
        const multiplosLabel = document.getElementById('inspirador-multiplos-label');
        const multiplosLista = document.getElementById('inspirador-multiplos-lista');
        const adicionarValor = document.getElementById('btn-adicionar-inspirador-valor');
        const confirmar = document.getElementById('btn-confirmar-inspirador');
        const cancelar = document.getElementById('btn-cancelar-inspirador');
        if (!overlay || !modo || !autor || !tema || !idioma || !quantidade || !variedade || !frequencia || !vista || !multiplosCampos || !multiplosLabel || !multiplosLista || !adicionarValor || !confirmar || !cancelar) {
            resolve(null);
            return;
        }

        const atual = normalizarPreferenciasInspirador(caixa.inspiradorPreferencias);
        const autores = document.getElementById('inspirador-autores-list');
        const temas = document.getElementById('inspirador-temas-list');
        autores?.replaceChildren(...INSPIRADOR_AUTORES.map(nome => {
            const opcao = document.createElement('option');
            opcao.value = nome;
            return opcao;
        }));
        temas?.replaceChildren(...INSPIRADOR_TEMAS.map(item => {
            const opcao = document.createElement('option');
            opcao.value = item.valor;
            return opcao;
        }));

        const prepararPesquisaCampo = (input, anfitriao, tipo) => {
            if (!input || !anfitriao) return;
            anfitriao.style.position = 'relative';
            let sugestoes = anfitriao.querySelector('[data-inspirador-sugestoes]');
            if (!sugestoes) {
                sugestoes = document.createElement('div');
                sugestoes.className = 'inspirador-popup__sugestoes';
                sugestoes.dataset.inspiradorSugestoes = '';
                sugestoes.hidden = true;
                anfitriao.appendChild(sugestoes);
            }

            let pedido = 0;
            let temporizador = null;
            const esconder = () => {
                sugestoes.hidden = true;
                sugestoes.replaceChildren();
            };
            const mostrar = resultados => {
                sugestoes.replaceChildren();
                if (!resultados.length) {
                    esconder();
                    return;
                }
                resultados.forEach(resultado => {
                    const botao = document.createElement('button');
                    botao.type = 'button';
                    botao.className = 'inspirador-popup__sugestao';
                    const avatar = document.createElement('span');
                    avatar.className = 'inspirador-popup__sugestao-avatar';
                    if (resultado.imagem) {
                        const imagem = document.createElement('img');
                        imagem.src = resultado.imagem;
                        imagem.alt = '';
                        imagem.loading = 'lazy';
                        imagem.onerror = () => {
                            imagem.remove();
                            avatar.textContent = String(resultado.nome || '?').trim().charAt(0).toUpperCase();
                        };
                        avatar.appendChild(imagem);
                    } else {
                        avatar.textContent = String(resultado.nome || '?').trim().charAt(0).toUpperCase();
                    }
                    const nome = document.createElement('span');
                    nome.className = 'inspirador-popup__sugestao-nome';
                    nome.textContent = resultado.nome;
                    botao.append(avatar, nome);
                    botao.onclick = () => {
                        input.value = resultado.nome;
                        esconder();
                        input.focus();
                    };
                    sugestoes.appendChild(botao);
                });
                sugestoes.hidden = false;
            };

            input.oninput = () => {
                window.clearTimeout(temporizador);
                const valor = input.value.trim();
                if (valor.length < 2) {
                    esconder();
                    return;
                }
                sugestoes.replaceChildren();
                const estado = document.createElement('div');
                estado.className = 'inspirador-popup__sugestoes-estado';
                    estado.textContent = `A procurar ${tipo === 'autor' ? 'autores' : 'temas'}…`;
                sugestoes.appendChild(estado);
                sugestoes.hidden = false;
                const meuPedido = ++pedido;
                temporizador = window.setTimeout(async () => {
                    const resultados = tipo === 'autor'
                        ? await pesquisarAutoresInspirador(valor, idioma.value)
                        : await pesquisarTemasInspirador(valor);
                    if (meuPedido === pedido && input.value.trim() === valor) mostrar(resultados);
                }, 220);
            };
            input.onkeydown = evento => {
                if (evento.key === 'Escape') esconder();
            };
            input.onblur = () => window.setTimeout(esconder, 180);
        };

        prepararPesquisaCampo(autor, autor.closest('[data-inspirador-campo="autor"]'), 'autor');
        prepararPesquisaCampo(tema, tema.closest('[data-inspirador-campo="tema"]'), 'tema');
        modo.value = atual.modo;
        autor.value = atual.autor;
        tema.value = atual.tema;
        idioma.value = atual.idioma;
        quantidade.value = String(atual.quantidade);
        variedade.value = atual.variedade;
        frequencia.value = atual.frequencia;
        vista.value = atual.vista;

        const recolherMultiplos = () => [...multiplosLista.querySelectorAll('input')]
            .map(input => input.value.trim())
            .filter(Boolean);

        const criarCampoMultiplo = (valor, indice, total) => {
            const linha = document.createElement('div');
            linha.className = 'inspirador-popup__multiple-linha';
            const input = document.createElement('input');
            input.className = 'inspirador-popup__input';
            // Nos campos múltiplos evitamos os controlos nativos do search/datalist
            // para não duplicar o botão de remoção da linha.
            input.type = 'text';
            input.autocomplete = 'off';
            input.value = valor;
            input.placeholder = modo.value === 'autor' ? 'Nome do autor' : 'Tema';
            const remover = document.createElement('button');
            remover.className = 'inspirador-popup__remove';
            remover.type = 'button';
            remover.title = 'Remover';
            remover.setAttribute('aria-label', 'Remover');
            remover.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
            remover.disabled = total <= 1;
            remover.onclick = () => {
                linha.remove();
                actualizarMultiplos();
            };
            linha.append(input, remover);
            prepararPesquisaCampo(input, linha, modo.value);
            return linha;
        };

        const actualizarMultiplos = () => {
            const activo = variedade.value === 'diferentes'
                && Number.parseInt(quantidade.value, 10) > 1
                && modo.value !== 'aleatorio';
            const campoAutor = autor.closest('[data-inspirador-campo="autor"]');
            const campoTema = tema.closest('[data-inspirador-campo="tema"]');
            campoAutor.hidden = modo.value !== 'autor' || activo;
            campoTema.hidden = modo.value !== 'tema' || activo;
            multiplosCampos.hidden = !activo;
            if (!activo) return;

            const listaAtual = modo.value === 'autor' ? atual.autores : atual.temas;
            const mudouModo = multiplosLista.dataset.modo !== modo.value;
            const valores = mudouModo ? [] : recolherMultiplos();
            const iniciais = valores.length ? valores : listaAtual;
            if (!multiplosLista.children.length || mudouModo) {
                multiplosLista.replaceChildren(...iniciais.slice(0, 5).map((valor, indice, lista) => criarCampoMultiplo(valor, indice, lista.length)));
                multiplosLista.dataset.modo = modo.value;
            }
            const limite = Number.parseInt(quantidade.value, 10);
            while (multiplosLista.children.length > limite) multiplosLista.lastElementChild?.remove();
            multiplosLabel.textContent = modo.value === 'autor' ? 'Autores' : 'Temas';
            adicionarValor.innerHTML = `<i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar ${modo.value === 'autor' ? 'autor' : 'tema'}`;
            adicionarValor.disabled = multiplosLista.children.length >= limite;
            [...multiplosLista.querySelectorAll('.inspirador-popup__remove')].forEach(botao => {
                botao.disabled = multiplosLista.children.length <= 1;
            });
        };
        const fechar = valor => {
            overlay.classList.remove('active');
            modo.onchange = null;
            quantidade.onchange = null;
            variedade.onchange = null;
            adicionarValor.onclick = null;
            confirmar.onclick = null;
            cancelar.onclick = null;
            resolve(valor);
        };
        actualizarMultiplos();
        modo.onchange = actualizarMultiplos;
        quantidade.onchange = actualizarMultiplos;
        variedade.onchange = actualizarMultiplos;
        adicionarValor.onclick = () => {
            const total = multiplosLista.children.length;
            if (total >= Number.parseInt(quantidade.value, 10)) return;
            multiplosLista.appendChild(criarCampoMultiplo('', total, total + 1));
            actualizarMultiplos();
            multiplosLista.lastElementChild?.querySelector('input')?.focus();
        };
        overlay.classList.add('active');
        confirmar.onclick = () => fechar(normalizarPreferenciasInspirador({
            modo: modo.value,
            autor: modo.value === 'autor' && variedade.value === 'diferentes' ? recolherMultiplos()[0] || autor.value : autor.value,
            autores: modo.value === 'autor' && variedade.value === 'diferentes' ? recolherMultiplos() : [autor.value],
            tema: modo.value === 'tema' && variedade.value === 'diferentes' ? recolherMultiplos()[0] || tema.value : tema.value,
            temas: modo.value === 'tema' && variedade.value === 'diferentes' ? recolherMultiplos() : [tema.value],
            idioma: idioma.value,
            quantidade: quantidade.value,
            variedade: variedade.value,
            frequencia: frequencia.value,
            vista: vista.value
        }));
        cancelar.onclick = () => fechar(null);
    });
}
