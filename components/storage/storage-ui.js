import {
    apagarFicheiro,
    enviarFicheiro,
    listarFicheiros,
    obterUsoArmazenamento,
    abrirSeparadorFicheiro
} from './storage-client.js';

const QUOTA_BYTES = 3 * 1024 * 1024 * 1024;

function mensagemDeErro(erro) {
    if (/failed to fetch|networkerror/i.test(erro?.message || '')) {
        return 'Não foi possível contactar o armazenamento. Confirma o CORS do Worker para esta origem local.';
    }
    return erro?.message || 'Não foi possível carregar os ficheiros.';
}

function formatarTamanho(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatarQuota(bytes) {
    const valor = Number(bytes || QUOTA_BYTES);
    if (valor >= 1024 * 1024 * 1024) {
        const gigabytes = valor / (1024 * 1024 * 1024);
        return `${Number.isInteger(gigabytes) ? gigabytes : gigabytes.toFixed(2)} GB`;
    }
    return formatarTamanho(valor);
}

function iconeParaTipo(contentType = '') {
    if (contentType.includes('pdf')) return 'fa-solid fa-file-pdf';
    if (contentType.startsWith('image/')) return 'fa-solid fa-file-image';
    if (contentType.includes('word') || contentType.includes('document')) return 'fa-solid fa-file-word';
    if (contentType.includes('sheet') || contentType.includes('excel')) return 'fa-solid fa-file-excel';
    return 'fa-solid fa-file';
}

function criarBotao(icon, title, onClick, extraClass = '') {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `ficheiro-item__acao ${extraClass}`.trim();
    botao.title = title;
    botao.setAttribute('aria-label', title);
    botao.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
    botao.addEventListener('click', event => {
        event.stopPropagation();
        onClick(event);
    });
    return botao;
}

function confirmarRemocaoFicheiro(nome) {
    return new Promise(resolve => {
        const overlay = document.getElementById('popup-confirmar-remover-overlay');
        const titulo = document.getElementById('titulo-confirmar-remover');
        const mensagem = document.getElementById('msg-confirmar-remover');
        const cancelar = document.getElementById('btn-cancelar-remover');
        const confirmar = document.getElementById('btn-confirmar-remover-final');

        if (!overlay || !titulo || !mensagem || !cancelar || !confirmar) {
            resolve(false);
            return;
        }

        titulo.textContent = 'Remover ficheiro?';
        mensagem.textContent = `Queres remover “${nome}” do armazenamento?`;
        confirmar.textContent = 'Sim, remover';
        overlay.style.zIndex = '11100';

        const fechar = resultado => {
            overlay.classList.remove('active');
            cancelar.onclick = null;
            confirmar.onclick = null;
            resolve(resultado);
        };

        cancelar.onclick = () => fechar(false);
        confirmar.onclick = () => fechar(true);
        overlay.classList.add('active');
    });
}

function criarLinhaFicheiro(ficheiro, { permitirRemover, focoContexto, atualizar, aoAbrir }) {
    const linha = document.createElement('div');
    linha.className = 'ficheiro-item';
    if (focoContexto && ficheiro.context_id === focoContexto) linha.classList.add('is-foco');

    const icone = document.createElement('span');
    icone.className = 'ficheiro-item__icone';
    icone.innerHTML = `<i class="${iconeParaTipo(ficheiro.content_type)}" aria-hidden="true"></i>`;

    const dados = document.createElement('div');
    dados.className = 'ficheiro-item__dados';
    const nome = document.createElement('span');
    nome.className = 'ficheiro-item__nome';
    nome.textContent = ficheiro.file_name;
    const meta = document.createElement('span');
    meta.className = 'ficheiro-item__meta';
    meta.textContent = `${formatarTamanho(Number(ficheiro.size_bytes || 0))}${ficheiro.context_type ? ` · ${ficheiro.context_type}` : ''}`;
    dados.append(nome, meta);

    const abrirDocumento = async () => {
        try {
            if (aoAbrir) await aoAbrir(ficheiro);
            else await abrirSeparadorFicheiro(ficheiro.id);
        } catch (erro) {
            window.alert(erro.message);
        }
    };
    const abrir = criarBotao('fa-solid fa-arrow-up-right-from-square', 'Abrir documento', abrirDocumento);
    linha.tabIndex = 0;
    linha.title = 'Abrir documento num novo separador';
    linha.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        abrirDocumento();
    });
    linha.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            abrirDocumento();
        }
    });
    linha.append(icone, dados, abrir);

    if (permitirRemover) {
        linha.appendChild(criarBotao('fa-solid fa-trash', 'Remover ficheiro', async () => {
            if (!(await confirmarRemocaoFicheiro(ficheiro.file_name))) return;
            try {
                await apagarFicheiro(ficheiro.id);
                await atualizar();
                window.dispatchEvent(new Event('ficheiros:alterados'));
            } catch (erro) {
                window.alert(erro.message);
            }
        }, 'ficheiro-item__acao--remover'));
    }

    return linha;
}

function renderizarUso(contentor, uso) {
    if (!uso) return;
    const usado = Number(uso.usedBytes || 0);
    const percentagem = Math.min(100, (usado / Number(uso.quotaBytes || QUOTA_BYTES)) * 100);
    contentor.innerHTML = `
        <span>Uso: ${formatarTamanho(usado)} / ${formatarQuota(uso.quotaBytes)}</span>
        <span class="ficheiros-painel__uso-barra" aria-hidden="true"><span style="width:${percentagem}%"></span></span>
    `;
}

export async function montarPainelFicheiros(contentor, {
    noteId,
    contextType,
    contextId,
    titulo = 'Ficheiros',
    permitirUpload = true,
    permitirRemover = true,
    focoContexto = null,
    abrirNoBrowser = false
} = {}) {
    if (!contentor || !noteId) return;
    contentor.replaceChildren();
    contentor.className = `${contentor.className} ficheiros-painel`.trim();

    const cabecalho = document.createElement('div');
    cabecalho.className = 'ficheiros-painel__cabecalho';
    const tituloEl = document.createElement('p');
    tituloEl.className = 'ficheiros-painel__titulo';
    tituloEl.textContent = titulo;
    const acoes = document.createElement('div');
    acoes.className = 'ficheiros-painel__acoes';
    cabecalho.append(tituloEl, acoes);

    const uso = document.createElement('div');
    uso.className = 'ficheiros-painel__uso';
    const lista = document.createElement('div');
    lista.className = 'ficheiros-lista';
    contentor.append(cabecalho, uso, lista);

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.className = 'ficheiros-input-oculto';
    input.accept = '*/*';
    contentor.appendChild(input);

    const recarregar = async () => {
        lista.replaceChildren();
        try {
            const [ficheiros, usoAtual] = await Promise.all([
                listarFicheiros({ noteId, contextType, contextId }),
                obterUsoArmazenamento()
            ]);
            renderizarUso(uso, usoAtual);
            if (!ficheiros.length) {
                const vazio = document.createElement('p');
                vazio.className = 'ficheiros-vazio';
                vazio.textContent = permitirUpload ? 'Ainda não há ficheiros anexados.' : 'Esta nota ainda não tem ficheiros.';
                lista.appendChild(vazio);
                return;
            }
            ficheiros.forEach(ficheiro => lista.appendChild(criarLinhaFicheiro(ficheiro, {
                permitirRemover,
                focoContexto,
                atualizar: recarregar
            })));

            if (abrirNoBrowser && window._ficheirosAbrirContexto) {
                const ficheiroInicial = ficheiros.find(item => item.context_id === window._ficheirosAbrirContexto);
                const separador = window._ficheirosSeparador || null;
                window._ficheirosAbrirContexto = null;
                window._ficheirosSeparador = null;
                if (ficheiroInicial) {
                    await abrirSeparadorFicheiro(ficheiroInicial.id, separador);
                }
            }
        } catch (erro) {
            const mensagem = document.createElement('p');
            mensagem.className = 'ficheiros-erro';
            mensagem.textContent = mensagemDeErro(erro);
            lista.appendChild(mensagem);
        }
    };

    if (permitirUpload) {
        const upload = document.createElement('button');
        upload.type = 'button';
        upload.className = 'ficheiros-upload-btn';
        upload.title = 'Anexar ficheiro';
        upload.setAttribute('aria-label', 'Anexar ficheiro');
        upload.innerHTML = '<i class="fa-solid fa-upload" aria-hidden="true"></i>';
        upload.addEventListener('click', () => input.click());
        acoes.appendChild(upload);
        input.addEventListener('change', async () => {
            const ficheiros = [...input.files];
            if (!ficheiros.length) return;
            upload.disabled = true;
            try {
                for (const ficheiro of ficheiros) {
                    await enviarFicheiro(ficheiro, { noteId, contextType, contextId });
                }
                await recarregar();
                window.dispatchEvent(new Event('ficheiros:alterados'));
            } catch (erro) {
                window.alert(erro.message);
            } finally {
                upload.disabled = false;
                input.value = '';
            }
        });
    }

    await recarregar();
}

export async function atualizarIndicadorFicheiros(noteId) {
    const botao = document.getElementById('btn-tab-ficheiros');
    if (!botao || !noteId) return;
    try {
        const ficheiros = await listarFicheiros({ noteId });
        botao.style.display = ficheiros.length ? 'inline-flex' : 'none';
        botao.dataset.hasFiles = String(ficheiros.length > 0);
    } catch (erro) {
        botao.style.display = 'none';
        console.warn('[FICHEIROS] Não foi possível atualizar o indicador:', erro);
    }
}

export function focarFicheirosDaNota(contextId, abrirDocumento = false) {
    window._ficheirosFocoContexto = contextId || null;
    window._ficheirosAbrirContexto = abrirDocumento ? contextId || null : null;
    window._ficheirosSeparador = abrirDocumento ? window.open('', '_blank') : null;
    if (abrirDocumento && !window._ficheirosSeparador) {
        window._ficheirosAbrirContexto = null;
    }
    if (typeof window.switchEyeTab === 'function') window.switchEyeTab('ficheiros');
}

export function criarControloFicheiros({ noteId, contextType, contextId, onChanged } = {}) {
    const grupo = document.createElement('span');
    grupo.className = 'bairro-control--ficheiros';
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.className = 'ficheiros-input-oculto';
    const upload = document.createElement('button');
    upload.type = 'button';
    upload.className = 'bairro-control bairro-control--ficheiros';
    upload.title = 'Anexar ficheiro à tarefa';
    upload.setAttribute('aria-label', 'Anexar ficheiro à tarefa');
    upload.innerHTML = '<i class="fa-solid fa-upload" aria-hidden="true"></i>';
    upload.addEventListener('mousedown', event => event.preventDefault());
    upload.addEventListener('click', event => {
        event.stopPropagation();
        input.click();
    });
    input.addEventListener('change', async () => {
        try {
            for (const ficheiro of [...input.files]) {
                await enviarFicheiro(ficheiro, { noteId, contextType, contextId });
            }
            await atualizarIndicador();
            onChanged?.();
            window.dispatchEvent(new Event('ficheiros:alterados'));
        } catch (erro) {
            window.alert(erro.message);
        } finally {
            input.value = '';
        }
    });
    grupo.append(upload, input);

    async function atualizarIndicador() {
        const ficheiros = await listarFicheiros({ noteId, contextType, contextId });
        if (!ficheiros.length) return;
        const abrir = document.createElement('button');
        abrir.type = 'button';
        abrir.className = 'bairro-control bairro-control--link';
        abrir.title = 'Abrir ficheiros da tarefa';
        abrir.setAttribute('aria-label', 'Abrir ficheiros da tarefa');
        abrir.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span class="ficheiros-badge"></span>';
        abrir.addEventListener('mousedown', event => event.preventDefault());
        abrir.addEventListener('click', event => {
            event.stopPropagation();
            focarFicheirosDaNota(contextId, true);
        });
        grupo.appendChild(abrir);
    }

    atualizarIndicador().catch(() => {});
    return grupo;
}
