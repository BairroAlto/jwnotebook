import {
    anexarNotaAoFilho,
    garantirHistoricoNotas,
    garantirNotasAnexadas,
    LIMITE_NOTAS_POR_TAREFA,
    reanexarNotaDoHistorico,
    registarNotaNoHistorico,
    removerNotaDoFilho,
    temNotaCriadaNoFilho
} from './bairro-notas-model.js';
import { abrirExploradorNotasBairro } from './bairro-notas-explorer.js';
import { criarNotaOcultaDaTarefa, enviarNotaParaReciclagem, obterNotaPorId } from './bairro-notas-repository.js';
// O sufixo evita que uma sessão com hot-reload reutilize uma versão antiga
// de browser.js sem as exportações específicas das notas do Bairro.
import { abrirNotaEmAbaBrowser, verificarEspacoNasAbasBrowser } from './browser.js?bairro-notas=v3';

function criarIcone(classe) {
    const icone = document.createElement('i');
    icone.className = classe;
    icone.setAttribute('aria-hidden', 'true');
    return icone;
}

function mostrarLimiteAbas(estado) {
    window.alert(`O Browser já tem ${estado?.limite || 15} abas abertas. Fecha uma aba antes de continuar.`);
}

function confirmarEnviarNotaParaReciclagem(nomeNota) {
    const overlay = document.getElementById('popup-confirmar-remover-overlay');
    const titulo = document.getElementById('titulo-confirmar-remover');
    const mensagem = document.getElementById('msg-confirmar-remover');
    const cancelar = document.getElementById('btn-cancelar-remover');
    const confirmar = document.getElementById('btn-confirmar-remover-final');

    if (!overlay || !titulo || !mensagem || !cancelar || !confirmar) {
        console.error('[BAIRRO-NOTAS] Popup de confirmação da reciclagem não está disponível.');
        return Promise.resolve(false);
    }

    return new Promise(resolve => {
        const fechar = resultado => {
            overlay.classList.remove('active');
            cancelar.onclick = null;
            confirmar.onclick = null;
            resolve(resultado);
        };

        titulo.textContent = 'Enviar nota para a Reciclagem?';
        mensagem.textContent = `A nota "${nomeNota || 'sem título'}" ficará oculta e poderá ser restaurada no painel de Reciclagem.`;
        cancelar.textContent = 'Cancelar';
        confirmar.textContent = 'Sim, enviar';
        cancelar.onclick = () => fechar(false);
        confirmar.onclick = () => fechar(true);
        overlay.classList.add('active');
    });
}

export async function abrirNotaAnexadaNoBrowser(nota, aoResolver = null) {
    console.info('[BAIRRO-NOTAS][ABRIR] Pedido para abrir nota anexada:', {
        id: nota?.id,
        onde: nota?.onde,
        origem: nota?.origem,
        nome: nota?.nome,
        contexto: window.notaAtualContext ? {
            notaId: window.notaAtualContext.notaId,
            maeId: window.notaAtualContext.maeId,
            onde: window.notaAtualContext.dadosNota?.onde
        } : null
    });
    const resultado = await abrirNotaEmAbaBrowser(nota?.id, nota?.onde);
    console.info('[BAIRRO-NOTAS][ABRIR] Resultado do Browser:', resultado);
    if (resultado?.ok && resultado.notaId && resultado.notaId !== nota?.id) {
        const idAnterior = nota.id;
        nota.id = resultado.notaId;
        if (resultado.onde) nota.onde = resultado.onde;
        console.info('[BAIRRO-NOTAS][ABRIR] Anexação actualizada para o ID Firestore:', {
            idAnterior,
            idFirestore: resultado.notaId,
            onde: nota.onde
        });
        aoResolver?.(resultado);
    }
    if (!resultado?.ok && resultado?.motivo === 'limite') mostrarLimiteAbas(resultado);
    if (!resultado?.ok && resultado?.motivo === 'nota-inexistente') {
        window.alert('Esta nota já não está disponível em Local nem em Share. Podes remover a anexação desta tarefa.');
    }
    if (!resultado?.ok && resultado?.motivo === 'sem-contexto') {
        window.alert('Não foi possível abrir a nota no Browser. Volta a abrir a nota actual e tenta novamente.');
    }
    return resultado;
}

function criarCartaoNota(nota, aoAbrir, aoRemover) {
    const cartao = document.createElement('article');
    cartao.className = `bairro-notas-cartao${nota.origem === 'criada' ? ' bairro-notas-cartao--criada' : ''}`;
    const icone = document.createElement('span');
    icone.className = 'bairro-notas-cartao-icone';
    icone.appendChild(criarIcone(nota.onde === 'share' ? 'fa-solid fa-share-nodes' : 'fa-solid fa-file-lines'));

    const texto = document.createElement('div');
    texto.className = 'bairro-notas-cartao-texto';
    const nome = document.createElement('strong');
    nome.textContent = nota.nome || 'Nota sem título';
    const detalhe = document.createElement('small');
    detalhe.textContent = `${nota.onde === 'share' ? 'Share' : 'Local'}${nota.origem === 'criada' ? ' · Criada nesta tarefa' : ''}`;
    texto.append(nome, detalhe);

    const acoes = document.createElement('div');
    acoes.className = 'bairro-notas-cartao-acoes';
    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.title = 'Abrir nota no Browser';
    abrir.setAttribute('aria-label', `Abrir ${nota.nome || 'nota'} no Browser`);
    abrir.appendChild(criarIcone('fa-solid fa-arrow-up-right-from-square'));
    abrir.addEventListener('click', aoAbrir);
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'bairro-notas-cartao-remover';
    remover.title = 'Remover anexo';
    remover.setAttribute('aria-label', `Remover ${nota.nome || 'nota'} dos anexos`);
    remover.appendChild(criarIcone('fa-solid fa-xmark'));
    remover.addEventListener('click', aoRemover);
    acoes.append(abrir, remover);
    cartao.append(icone, texto, acoes);
    return cartao;
}

function formatarDataHistoricoNota(timestamp) {
    if (!timestamp) return 'Sem data';
    return new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(timestamp));
}

function criarCartaoHistorico(nota, aoReanexar, aoEnviarParaReciclagem) {
    const cartao = document.createElement('article');
    cartao.className = `bairro-notas-cartao bairro-notas-cartao--historico${nota.origem === 'criada' ? ' bairro-notas-cartao--criada' : ''}`;

    const icone = document.createElement('span');
    icone.className = 'bairro-notas-cartao-icone';
    icone.appendChild(criarIcone(nota.onde === 'share' ? 'fa-solid fa-share-nodes' : 'fa-solid fa-file-lines'));

    const texto = document.createElement('div');
    texto.className = 'bairro-notas-cartao-texto';
    const nome = document.createElement('strong');
    nome.textContent = nota.nome || 'Nota sem título';
    const detalhe = document.createElement('small');
    detalhe.textContent = `Removida em ${formatarDataHistoricoNota(nota.removidaEm)}`;
    texto.append(nome, detalhe);

    const acoes = document.createElement('div');
    acoes.className = 'bairro-notas-cartao-acoes';
    const reanexar = document.createElement('button');
    reanexar.type = 'button';
    reanexar.title = 'Anexar novamente';
    reanexar.setAttribute('aria-label', `Anexar novamente ${nota.nome || 'nota'}`);
    reanexar.appendChild(criarIcone('fa-solid fa-link'));
    reanexar.addEventListener('click', aoReanexar);

    const reciclar = document.createElement('button');
    reciclar.type = 'button';
    reciclar.className = 'bairro-notas-cartao-reciclar';
    reciclar.title = 'Enviar nota para a reciclagem';
    reciclar.setAttribute('aria-label', `Enviar ${nota.nome || 'nota'} para a reciclagem`);
    reciclar.appendChild(criarIcone('fa-solid fa-trash-can'));
    reciclar.addEventListener('click', () => aoEnviarParaReciclagem?.(nota, reciclar));
    acoes.append(reanexar, reciclar);

    cartao.append(icone, texto, acoes);
    return cartao;
}

export function criarGestorNotasBairro({ bairro, filho, painel, guardar, renderizarBairro }) {
    if (!bairro || !filho || !painel) return null;
    const botaoAnexar = painel.querySelector('#btn-bairro-nota-anexar');
    const botaoCriar = painel.querySelector('#btn-bairro-nota-criar');
    const contador = painel.querySelector('#bairro-posto-notas-contador');
    const lista = painel.querySelector('#bairro-posto-notas-lista');
    const botaoHistorico = painel.querySelector('#btn-bairro-notas-historico');
    const listaHistorico = painel.querySelector('#bairro-posto-notas-historico-lista');
    let reconstruirHistoricoEmCurso = false;

    const persistir = () => {
        guardar?.();
        renderizar();
        renderizarBairro?.();
    };

    const actualizarHistoricoDepoisDaReciclagem = historico => {
        const pendentes = historico.filter(nota => nota.reciclagemPendente || nota.estado === 'off');
        if (!pendentes.length) return;
        const contexto = window.notaAtualContext;
        if (!contexto?.db) return;

        Promise.all(pendentes.map(async nota => ({
            nota,
            dados: await obterNotaPorId({ db: contexto.db, nota })
        }))).then(resultados => {
            let alterou = false;
            resultados.forEach(({ nota, dados }) => {
                if (!dados) return;
                if (dados.estado !== 'off') {
                    delete nota.estado;
                    delete nota.reciclagemPendente;
                    alterou = true;
                }
            });
            if (alterou) {
                guardar?.();
                renderizar();
            }
        }).catch(erro => console.warn('[BAIRRO-NOTAS] Não foi possível actualizar o Histórico:', erro));
    };

    const reconstruirHistoricoNotaCriada = (notas, historico) => {
        const idCriada = filho.notaCriadaId;
        if (!idCriada || notas.some(nota => nota.id === idCriada) || historico.some(nota => nota.id === idCriada)) return;
        if (reconstruirHistoricoEmCurso) return;

        const contexto = window.notaAtualContext;
        if (!contexto?.db) return;
        reconstruirHistoricoEmCurso = true;
        const onde = contexto.dadosNota?.onde === 'share' ? 'share' : 'local';
        obterNotaPorId({ db: contexto.db, nota: { id: idCriada, onde } })
            .then(dados => {
                if (!dados) return;
                const registo = {
                    id: idCriada,
                    onde,
                    nome: dados.nome || 'Nota sem título',
                    origem: 'criada'
                };
                if (dados.estado === 'off') {
                    registo.estado = 'off';
                    registo.reciclagemPendente = true;
                }
                registarNotaNoHistorico(filho, registo);
                guardar?.();
                renderizar();
            })
            .catch(erro => console.warn('[BAIRRO-NOTAS] Não foi possível recuperar a nota criada do Histórico:', erro))
            .finally(() => {
                reconstruirHistoricoEmCurso = false;
            });
    };

    const abrir = async nota => {
        const resultado = await abrirNotaAnexadaNoBrowser(nota, () => persistir());
        if (resultado?.ok) document.getElementById('popup-bairro-posto-overlay')?.classList.remove('active');
    };

    function renderizar() {
        const notas = garantirNotasAnexadas(filho);
        if (contador) contador.textContent = `${notas.length}/${LIMITE_NOTAS_POR_TAREFA}`;
        if (botaoAnexar) botaoAnexar.disabled = notas.length >= LIMITE_NOTAS_POR_TAREFA;
        if (botaoCriar) {
            const jaCriou = temNotaCriadaNoFilho(filho);
            botaoCriar.disabled = jaCriou || notas.length >= LIMITE_NOTAS_POR_TAREFA;
            botaoCriar.title = jaCriou ? 'Esta tarefa já criou uma nota' : 'Criar uma nota ligada à tarefa';
        }

        lista?.replaceChildren();
        if (!notas.length) {
            const vazio = document.createElement('p');
            vazio.className = 'bairro-notas-vazio';
            vazio.textContent = 'Ainda não existem notas anexadas a esta tarefa.';
            lista?.appendChild(vazio);
        } else {
            notas.forEach(nota => lista?.appendChild(criarCartaoNota(
                nota,
                () => abrir(nota),
                () => {
                    if (!removerNotaDoFilho(filho, nota)) return;
                    registarNotaNoHistorico(filho, nota);
                    persistir();
                }
            )));
        }

        const historico = garantirHistoricoNotas(filho);
        listaHistorico?.replaceChildren();
        const historicoVisivel = historico.filter(nota => !nota.reciclagemPendente && nota.estado !== 'off');
        if (!historicoVisivel.length) {
            const vazio = document.createElement('p');
            vazio.className = 'bairro-notas-historico-vazio';
            vazio.textContent = historico.length
                ? 'As notas na Reciclagem reaparecerão aqui depois de serem restauradas.'
                : 'Ainda não existem notas removidas.';
            listaHistorico?.appendChild(vazio);
        } else {
            historicoVisivel.forEach(nota => listaHistorico?.appendChild(criarCartaoHistorico(
                nota,
                () => {
                    if (garantirNotasAnexadas(filho).length >= LIMITE_NOTAS_POR_TAREFA) {
                        window.alert(`Cada tarefa pode ter no máximo ${LIMITE_NOTAS_POR_TAREFA} notas anexadas.`);
                        return;
                    }
                    if (reanexarNotaDoHistorico(filho, nota)) persistir();
                },
                async (nota, botao) => {
                    const contexto = window.notaAtualContext;
                    if (!contexto?.db || !contexto?.auth) return;
                    const confirmou = await confirmarEnviarNotaParaReciclagem(nota.nome);
                    if (!confirmou) return;

                    botao.disabled = true;
                    try {
                        await enviarNotaParaReciclagem({
                            db: contexto.db,
                            auth: contexto.auth,
                            nota
                        });
                        nota.estado = 'off';
                        nota.reciclagemPendente = true;
                        persistir();
                    } catch (erro) {
                        console.error('[BAIRRO-NOTAS] Não foi possível enviar a nota para a reciclagem:', erro);
                        window.alert('Não foi possível enviar a nota para a reciclagem. Tenta novamente.');
                        botao.disabled = false;
                    }
                }
            )));
        }
        reconstruirHistoricoNotaCriada(notas, historico);
        actualizarHistoricoDepoisDaReciclagem(historico);
    }

    if (botaoHistorico && listaHistorico) {
        botaoHistorico.onclick = () => {
            const abrirHistorico = listaHistorico.hidden;
            listaHistorico.hidden = !abrirHistorico;
            botaoHistorico.setAttribute('aria-expanded', String(abrirHistorico));
            botaoHistorico.querySelector('.fa-chevron-down')?.classList.toggle('is-open', abrirHistorico);
        };
    }

    if (botaoAnexar) {
        botaoAnexar.onclick = () => {
            const notas = garantirNotasAnexadas(filho);
            if (notas.length >= LIMITE_NOTAS_POR_TAREFA) {
                window.alert(`Cada tarefa pode ter no máximo ${LIMITE_NOTAS_POR_TAREFA} notas anexadas.`);
                return;
            }
            const contexto = window.notaAtualContext;
            abrirExploradorNotasBairro({
                db: contexto?.db,
                auth: contexto?.auth,
                notaActualId: contexto?.notaId,
                idsExcluidos: notas.map(nota => nota.id),
                aoSeleccionar: nota => {
                    if (anexarNotaAoFilho(filho, { ...nota, origem: 'anexada' })) persistir();
                }
            });
        };
    }

    if (botaoCriar) {
        botaoCriar.onclick = async () => {
            if (temNotaCriadaNoFilho(filho)) {
                window.alert('Só podes criar uma nota por linha de tarefa.');
                return;
            }
            if (garantirNotasAnexadas(filho).length >= LIMITE_NOTAS_POR_TAREFA) {
                window.alert(`Cada tarefa pode ter no máximo ${LIMITE_NOTAS_POR_TAREFA} notas anexadas.`);
                return;
            }

            const espaco = await verificarEspacoNasAbasBrowser();
            if (!espaco.disponivel) {
                if (espaco.motivo === 'sem-contexto') {
                    window.alert('Não foi possível validar as abas do Browser. Volta a abrir a nota e tenta novamente.');
                } else {
                    mostrarLimiteAbas(espaco);
                }
                return;
            }

            const contexto = window.notaAtualContext;
            botaoCriar.disabled = true;
            const conteudoAnterior = botaoCriar.innerHTML;
            botaoCriar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span>A criar...</span>';
            try {
                const criada = await criarNotaOcultaDaTarefa({
                    db: contexto?.db,
                    auth: contexto?.auth,
                    contextoNota: contexto,
                    bairro,
                    filho
                });
                filho.notaCriadaId = criada.id;
                anexarNotaAoFilho(filho, { ...criada, origem: 'criada' });
                guardar?.();
                renderizarBairro?.();
                const resultado = await abrirNotaEmAbaBrowser(criada.id, criada.onde);
                if (!resultado?.ok && resultado?.motivo === 'limite') mostrarLimiteAbas(resultado);
                if (resultado?.ok) document.getElementById('popup-bairro-posto-overlay')?.classList.remove('active');
            } catch (erro) {
                console.error('[BAIRRO-NOTAS] Não foi possível criar a nota:', erro);
                window.alert('Não foi possível criar a nota. Tenta novamente.');
            } finally {
                botaoCriar.innerHTML = conteudoAnterior;
                renderizar();
            }
        };
    }

    renderizar();
    return { renderizar, abrir };
}
