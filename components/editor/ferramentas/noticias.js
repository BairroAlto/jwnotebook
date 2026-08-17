import {
    abrirConfiguradorNoticias,
    carregarNoticias,
    normalizarPreferenciasNoticias
} from '../../news/news-service.js';
import {
    ATRASO_REPETICAO_NOTICIAS_MS,
    cacheNoticiasEstaAtualizada,
    ordenarNoticiasMaisRecentes,
    tempoAteAtualizarNoticias
} from '../../news/news-freshness.js';
import { iniciarSelecaoFerramentas } from './tool-selection.js';

const COR_NOTICIAS = '#5b3824';
const COR_NOTICIAS_MUITO_ESCURA = '#24140d';
const COR_NOTICIAS_CLARA = '#a56a43';
const GRADIENTE_NOTICIAS = `linear-gradient(135deg, ${COR_NOTICIAS_MUITO_ESCURA} 0%, ${COR_NOTICIAS} 100%)`;

function criarMensagem(texto, cor = 'var(--text-muted)') {
    const mensagem = document.createElement('div');
    mensagem.textContent = texto;
    mensagem.style.cssText = `padding:18px; text-align:center; color:${cor}; font-size:11px; font-style:italic;`;
    return mensagem;
}

function criarAvisoAtualizacao(texto, aoAtualizar) {
    const aviso = document.createElement('div');
    aviso.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px; border:1px solid rgba(214,164,127,.28); border-radius:9px; background:rgba(36,20,13,.24);';

    const mensagem = document.createElement('span');
    mensagem.textContent = texto;
    mensagem.style.cssText = 'color:#d6a47f; font-size:11px; line-height:1.4;';

    if (aoAtualizar) {
        const atualizar = document.createElement('button');
        atualizar.type = 'button';
        atualizar.title = 'Atualizar notícias';
        atualizar.setAttribute('aria-label', 'Atualizar notícias');
        atualizar.innerHTML = '<i class="fa-solid fa-rotate"></i>';
        atualizar.style.cssText = 'display:flex; align-items:center; justify-content:center; flex:0 0 auto; width:30px; height:30px; border:1px solid rgba(214,164,127,.35); border-radius:7px; background:rgba(91,56,36,.35); color:#d6a47f; cursor:pointer;';
        atualizar.onclick = aoAtualizar;
        aviso.append(mensagem, atualizar);
    } else {
        aviso.append(mensagem);
    }
    return aviso;
}

function formatarData(valor) {
    const data = new Date(valor);
    return Number.isNaN(data.getTime())
        ? ''
        : new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(data);
}

function agruparNoticiasPorTema(noticias) {
    const grupos = new Map();
    ordenarNoticiasMaisRecentes(noticias).forEach(noticia => {
        const tema = String(noticia.tema || 'Notícias').trim() || 'Notícias';
        if (!grupos.has(tema)) grupos.set(tema, []);
        grupos.get(tema).push(noticia);
    });
    return [...grupos.entries()];
}

function criarGrupoTema(tema, noticias, vista, temSeparador) {
    const grupo = document.createElement('section');
    grupo.style.cssText = `
        grid-column:1 / -1;
        padding-top:${temSeparador ? '14px' : '0'};
        border-top:${temSeparador ? '1px solid rgba(214,164,127,.28)' : 'none'};
    `;

    const titulo = document.createElement('h4');
    titulo.textContent = tema;
    titulo.style.cssText = 'margin:0 0 9px; color:#d6a47f; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em;';

    const artigos = document.createElement('div');
    artigos.style.cssText = vista === 'grelha'
        ? 'display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:8px;'
        : 'display:flex; flex-direction:column; gap:8px;';
    artigos.append(...noticias.map(noticia => criarArtigo(noticia)));

    grupo.append(titulo, artigos);
    return grupo;
}

function criarArtigo(noticia, mostrarTema = false) {
    const artigo = document.createElement('a');
    artigo.href = noticia.link;
    artigo.target = '_blank';
    artigo.rel = 'noopener noreferrer';
    artigo.style.cssText = 'display:block; overflow:hidden; border:1px solid rgba(165,106,67,.25); border-radius:9px; background:rgba(91,56,36,.12); color:inherit; text-decoration:none;';

    const imagemUrl = String(noticia.imagem || '').trim();
    if (/^https?:\/\//i.test(imagemUrl)) {
        const imagem = document.createElement('img');
        imagem.src = imagemUrl;
        imagem.alt = '';
        imagem.loading = 'lazy';
        imagem.referrerPolicy = 'no-referrer';
        imagem.style.cssText = 'display:block; width:100%; height:108px; object-fit:cover; background:rgba(15,23,42,.55);';
        imagem.onerror = () => imagem.remove();
        artigo.appendChild(imagem);
    }

    const conteudo = document.createElement('div');
    conteudo.style.cssText = 'padding:11px 12px;';

    const titulo = document.createElement('strong');
    titulo.textContent = noticia.titulo;
    titulo.style.cssText = 'display:block; color:var(--text-main); font-size:12px; line-height:1.45;';

    const meta = document.createElement('small');
    meta.textContent = [noticia.fonte, formatarData(noticia.publicadoEm)].filter(Boolean).join(' · ');
    meta.style.cssText = 'display:block; margin-top:5px; color:var(--text-muted); font-size:9px;';
    if (mostrarTema && noticia.tema) meta.textContent = `${noticia.tema} · ${meta.textContent}`;

    conteudo.append(titulo, meta);
    artigo.appendChild(conteudo);
    return artigo;
}

export function criarNoticias(caixa, onAlterar, onApagar, onMover, onAddAbaixo) {
    iniciarSelecaoFerramentas();
    caixa.noticiasPreferencias = normalizarPreferenciasNoticias(caixa.noticiasPreferencias);
    const caixaDiv = document.createElement('section');
    caixaDiv.className = 'tool-interativa';
    caixaDiv.style.cssText = `
        margin-bottom:15px; overflow:hidden; position:relative;
        border:1px solid ${COR_NOTICIAS_CLARA}66; border-radius:14px;
        background:linear-gradient(145deg, rgba(36,20,13,.35) 0%, rgba(91,56,36,.16) 100%);
        transition:.3s;
    `;
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = '0 4px 20px rgba(91,56,36,.4)';
        caixaDiv.style.transform = 'translateY(-1px)';
        caixaDiv.style.borderColor = COR_NOTICIAS_CLARA;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = 'none';
        caixaDiv.style.transform = 'translateY(0)';
        caixaDiv.style.borderColor = `${COR_NOTICIAS_CLARA}66`;
    };

    const header = document.createElement('div');
    header.className = 'tool-barra';
    header.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${GRADIENTE_NOTICIAS}; color:white;`;
    header.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center; font-size:13px;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity:.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity:.7;"></i>
            <div style="width:1px; height:14px; background:rgba(255,255,255,.18); margin:0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color:#34d399; font-size:15px;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar notícias" style="cursor:pointer; color:white; font-size:13px; margin-left:5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer; opacity:.8; font-size:12px; color:#fca5a5;"></i>
    `;

    const corpo = document.createElement('div');
    corpo.style.cssText = 'display:flex; flex-direction:column; gap:8px; padding:14px;';
    let renderizacao = 0;

    const aplicarVista = vista => {
        corpo.style.display = vista === 'grelha' ? 'grid' : 'flex';
        corpo.style.flexDirection = vista === 'grelha' ? '' : 'column';
        corpo.style.gridTemplateColumns = vista === 'grelha' ? 'repeat(auto-fit, minmax(190px, 1fr))' : '';
    };

    let atualizacaoEmCurso = false;
    let temporizadorAtualizacao = null;

    const agendarAtualizacao = atraso => {
        clearTimeout(temporizadorAtualizacao);
        temporizadorAtualizacao = setTimeout(() => {
            if (!caixaDiv.isConnected) return;
            atualizarNoticias();
        }, Math.max(1000, atraso));
    };

    const renderizarCache = () => {
        const preferencias = normalizarPreferenciasNoticias(caixa.noticiasPreferencias);
        aplicarVista(preferencias.vista);
        corpo.replaceChildren();
        if (!preferencias.temas.length) {
            corpo.appendChild(criarMensagem('Clica na lupa para escolher os temas das notícias…', COR_NOTICIAS_CLARA));
            return { temTemas: false, estaAtualizada: false };
        }

        const cache = Array.isArray(caixa.noticiasCache) ? caixa.noticiasCache : [];
        const estaAtualizada = cache.length > 0
            && cacheNoticiasEstaAtualizada(caixa.noticiasAtualizadasEm);
        if (!estaAtualizada || !cache.length) {
            const mensagem = estaAtualizada
                ? 'Ainda não existem notícias carregadas nesta ferramenta.'
                : 'A procurar as notícias mais recentes…';
            corpo.appendChild(criarAvisoAtualizacao(mensagem, atualizarNoticias));
        }
        if (cache.length) {
            const grupos = agruparNoticiasPorTema(cache);
            corpo.append(...grupos.map(([tema, noticias], indice) => (
                criarGrupoTema(tema, noticias, preferencias.vista, indice > 0)
            )));
        }
        return { temTemas: true, estaAtualizada };
    };

    const atualizarNoticias = async () => {
        if (atualizacaoEmCurso) return;
        atualizacaoEmCurso = true;
        const preferencias = normalizarPreferenciasNoticias(caixa.noticiasPreferencias);
        aplicarVista(preferencias.vista);
        corpo.replaceChildren(criarMensagem('A carregar notícias…', COR_NOTICIAS_CLARA));
        let atualizada = false;
        try {
            const auth = window.notaAtualContext?.auth || window.auth;
            const noticias = await carregarNoticias(preferencias, auth);
            caixa.noticiasCache = ordenarNoticiasMaisRecentes(noticias);
            caixa.noticiasAtualizadasEm = new Date().toISOString();
            atualizada = true;
            onAlterar(caixa);
            renderizarCache();
        } catch (erro) {
            corpo.replaceChildren(criarAvisoAtualizacao(erro.message, atualizarNoticias));
        } finally {
            atualizacaoEmCurso = false;
            agendarAtualizacao(atualizada
                ? tempoAteAtualizarNoticias(caixa.noticiasAtualizadasEm)
                : ATRASO_REPETICAO_NOTICIAS_MS);
        }
    };

    const renderizar = async () => {
        const estado = renderizarCache();
        if (!estado.temTemas) return;
        if (!estado.estaAtualizada) {
            await atualizarNoticias();
            return;
        }
        agendarAtualizacao(tempoAteAtualizarNoticias(caixa.noticiasAtualizadasEm));
        return;
        /*
        const versao = ++renderizacao;
        const preferencias = normalizarPreferenciasNoticias(caixa.noticiasPreferencias);
        aplicarVista(preferencias.vista);
        corpo.replaceChildren();
        if (!preferencias.temas.length) {
            corpo.appendChild(criarMensagem('Clica na lupa para escolher os temas das notícias…', COR_NOTICIAS_CLARA));
            return;
        }

        corpo.appendChild(criarMensagem('A carregar notícias…', COR_NOTICIAS_CLARA));
        try {
            const auth = window.notaAtualContext?.auth || window.auth;
            const noticias = await carregarNoticias(preferencias, auth);
            if (versao !== renderizacao) return;
            corpo.replaceChildren();
            if (!noticias.length) {
                corpo.appendChild(criarMensagem('Não foram encontradas notícias para estes temas.'));
                return;
            }
            corpo.append(...noticias.map(criarArtigo));
        } catch (erro) {
            if (versao !== renderizacao) return;
            corpo.replaceChildren(criarMensagem(erro.message, '#fca5a5'));
        }
        */
    };

    header.querySelector('.btn-lupa').onclick = async () => {
        const preferencias = await abrirConfiguradorNoticias(caixa, atualizarNoticias);
        if (!preferencias) return;
        caixa.noticiasPreferencias = preferencias;
        caixa.noticiasCache = [];
        caixa.noticiasAtualizadasEm = null;
        onAlterar(caixa);
        await renderizar();
    };
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, 'cima');
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, 'baixo');
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    caixaDiv.append(header, corpo);
    caixaDiv.refreshNoticias = atualizarNoticias;
    renderizar();
    return caixaDiv;
}
