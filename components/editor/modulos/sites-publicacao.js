import { doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const COLECAO_SITES = 'sites';
const COLECAO_SITES_LEGACY = 'SitesPublicos';
const LOG_PREFIX = '[SITES]';

function registar(mensagem, dados = {}) {
    console.debug(`${LOG_PREFIX} ${mensagem}`, dados);
}

function registarErro(mensagem, erro, dados = {}) {
    console.error(`${LOG_PREFIX} ${mensagem}`, {
        ...dados,
        code: erro?.code || null,
        message: erro?.message || String(erro),
        name: erro?.name || null
    }, erro);
}

function textoSeguro(valor, limite = 12000) {
    return typeof valor === 'string' ? valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, limite) : '';
}

function numeroSeguro(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function criarSnapshotBairro(caixa) {
    const mostrarDatas = caixa.mostrarDataTarefa === true;
    const mostrarDatasRealizacao = caixa.mostrarDataRealizacaoTarefa === true;
    const grupos = (Array.isArray(caixa.pastapai) ? caixa.pastapai : [])
        .filter(pai => pai && pai.oculto !== true)
        .slice(0, 200)
        .map(pai => {
            const tarefas = (Array.isArray(pai.pastafilho) ? pai.pastafilho : [])
                .filter(filho => filho && filho.oculto !== true && textoSeguro(filho.nome, 500).trim() && !(pai.ocultarJaChecados === true && filho.concluido === true))
                .slice(0, 1000)
                .map(filho => ({
                    nome: textoSeguro(filho.nome, 500),
                    concluido: filho.concluido === true,
                    criadaEm: mostrarDatas ? numeroSeguro(filho.criadaEm || filho.timestamp) : null,
                    realizadaEm: mostrarDatasRealizacao ? numeroSeguro(filho.timestampRealizacao) : null
                }));

            return {
                nome: textoSeguro(pai.nome, 500),
                tarefas
            };
        });

    return {
        grupos,
        mostrarDataTarefa: mostrarDatas,
        mostrarDataRealizacaoTarefa: mostrarDatasRealizacao
    };
}

function criarSnapshotPublico(ctx, configuracao) {
    const browserIds = configuracao.mostrarBrowser
        ? (Array.isArray(ctx.dadosNotaOriginal?.browser) ? ctx.dadosNotaOriginal.browser : [])
            .map(item => typeof item === 'string' ? item : item?.id)
            .filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))
            .slice(0, 20)
        : [];
    const caixas = (ctx.caixasAtuais || [])
        .filter(caixa => caixa?.estado !== 'off')
        .map((caixa, indice) => {
            const resultado = {
                id: textoSeguro(caixa.id, 120),
                tipo: textoSeguro(caixa.tipo, 40),
                titulo: textoSeguro(caixa.titulo || caixa.nome, 500),
                conteudo: textoSeguro(caixa.conteudo || caixa.texto, 12000),
                ordem: Number.isFinite(Number(caixa.ordem)) ? Number(caixa.ordem) : indice
            };
            if (caixa.tipo === 'bairro') resultado.bairro = criarSnapshotBairro(caixa);
            return resultado;
        });

    return {
        estado: 'on',
        userId: ctx.authRef.currentUser.uid,
        notaId: ctx.notaAbertaId,
        titulo: textoSeguro(ctx.dadosNotaOriginal?.nome || 'Nota', 500),
        capaUrl: configuracao.capaUrl,
        capaFileId: typeof configuracao.capaFileId === 'string' ? configuracao.capaFileId.slice(0, 80) : '',
        capaAltura: ['pequena', 'media', 'grande'].includes(configuracao.capaAltura) ? configuracao.capaAltura : 'grande',
        largura: configuracao.largura,
        mostrarBrowser: Boolean(configuracao.mostrarBrowser),
        browserIds,
        caixas,
        actualizadoEm: new Date().toISOString()
    };
}

export async function guardarPublicacaoSites(ctx, configuracao) {
    const user = ctx.authRef?.currentUser;
    registar('Início da publicação.', {
        userId: user?.uid || null,
        notaId: ctx.notaAbertaId || null,
        onde: ctx.dadosNotaOriginal?.onde || null,
        configuracao: {
            largura: configuracao?.largura || null,
            capaFileId: configuracao?.capaFileId || null,
            capaAltura: configuracao?.capaAltura || 'grande',
            mostrarBrowser: configuracao?.mostrarBrowser === true,
            temCapaHttps: /^https:\/\//i.test(configuracao?.capaUrl || '')
        }
    });
    if (!user || !ctx.notaAbertaId || ctx.dadosNotaOriginal?.onde === 'share') {
        registar('Publicação recusada por sessão, nota ou origem inválida.');
        throw new Error('Só o proprietário de uma nota local pode publicar Sites.');
    }
    try {
        registar('A actualizar o documento Local.', { coleccao: 'Local', docId: ctx.notaAbertaId });
        await updateDoc(doc(ctx.dbRef, 'Local', ctx.notaAbertaId), {
            sites: { ...configuracao, estado: 'on', publicacaoId: ctx.notaAbertaId }
        });
        registar('Documento Local actualizado.');
    } catch (erro) {
        registarErro('Falha ao actualizar o documento Local.', erro, { docId: ctx.notaAbertaId });
        throw erro;
    }
    try {
        const payload = criarSnapshotPublico(ctx, configuracao);
        registar('A criar o documento público.', {
            coleccao: COLECAO_SITES,
            docId: ctx.notaAbertaId,
            userId: payload.userId,
            notaId: payload.notaId,
            estado: payload.estado,
            capaAltura: payload.capaAltura,
            caixas: payload.caixas.length,
            tiposCaixas: payload.caixas.map(caixa => caixa.tipo),
            browserIds: payload.browserIds.length
        });
        await setDoc(doc(ctx.dbRef, COLECAO_SITES, ctx.notaAbertaId), payload);
        registar('Documento público criado/actualizado com sucesso.', {
            coleccao: COLECAO_SITES,
            docId: ctx.notaAbertaId
        });
    } catch (erro) {
        registarErro('Falha ao criar o documento público.', erro, {
            coleccao: COLECAO_SITES,
            docId: ctx.notaAbertaId
        });
        try {
            await updateDoc(doc(ctx.dbRef, 'Local', ctx.notaAbertaId), { 'sites.estado': 'off' });
            registar('Publicação revertida no documento Local.');
        } catch (reversao) {
            registarErro('Também falhou a reversão do documento Local.', reversao, {
                docId: ctx.notaAbertaId
            });
        }
        throw erro;
    }
}

export async function guardarConfiguracaoLocalSites(ctx, configuracao) {
    if (!ctx.authRef?.currentUser || !ctx.notaAbertaId) throw new Error('Sessão ou nota inválida.');
    await updateDoc(doc(ctx.dbRef, 'Local', ctx.notaAbertaId), {
        sites: { ...configuracao, estado: 'on', publicacaoId: ctx.notaAbertaId }
    });
}

export async function actualizarPublicacaoSitesAutomatica(ctx) {
    const configuracao = ctx.dadosNotaOriginal?.sites || {};
    if (configuracao.estado !== 'on' || configuracao.modoActualizacao !== 'automatico') return false;

    registar('A actualizar automaticamente o Site depois de guardar a nota.', {
        notaId: ctx.notaAbertaId || null
    });
    await guardarPublicacaoSites(ctx, {
        capaUrl: configuracao.capaUrl || '',
        capaFileId: configuracao.capaFileId || '',
        capaAltura: configuracao.capaAltura || 'grande',
        largura: configuracao.largura || 'centralizada',
        mostrarBrowser: configuracao.mostrarBrowser === true,
        modoActualizacao: 'automatico'
    });
    return true;
}

export async function removerPublicacaoSites(ctx) {
    const user = ctx.authRef?.currentUser;
    registar('Início da remoção da publicação.', {
        userId: user?.uid || null,
        notaId: ctx.notaAbertaId || null
    });
    if (!user || !ctx.notaAbertaId) throw new Error('Sessão inválida.');
    try {
        await Promise.all([
            deleteDoc(doc(ctx.dbRef, COLECAO_SITES, ctx.notaAbertaId)),
            deleteDoc(doc(ctx.dbRef, COLECAO_SITES_LEGACY, ctx.notaAbertaId))
        ]);
        await updateDoc(doc(ctx.dbRef, 'Local', ctx.notaAbertaId), { 'sites.estado': 'off' });
        registar('Publicação removida com sucesso.', { notaId: ctx.notaAbertaId });
    } catch (erro) {
        registarErro('Falha ao remover a publicação.', erro, { notaId: ctx.notaAbertaId });
        throw erro;
    }
}
