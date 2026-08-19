import {
    and,
    collection,
    doc,
    getDocs,
    getDoc,
    or,
    query,
    serverTimestamp,
    updateDoc,
    writeBatch,
    where
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { notaEstaVisivel } from '../../notes/note-visibility.js';

function criarCaixaInicial() {
    return {
        id: crypto.randomUUID(),
        tipo: 'contentor',
        conteudo: '',
        timestamp: new Date().toISOString(),
        protecao: 'fechado',
        estado: 'on',
        foco: 'original',
        ordem: 1
    };
}

function nomeDaNota(filho) {
    const tarefa = String(filho?.nome || '').trim();
    return tarefa ? `Notas · ${tarefa}` : 'Notas · Tarefa';
}

export function obterPastaPaiDaNotaActual(contextoNota, auth) {
    const dadosNota = contextoNota?.dadosNota || {};
    const uid = auth?.currentUser?.uid || contextoNota?.auth?.currentUser?.uid;
    const onde = dadosNota?.onde === 'share' ? 'share' : 'local';

    if (onde === 'share') return dadosNota?.[uid]?.pastapai || 'home';
    return dadosNota?.pastapai || 'root';
}

function obterPastaDaNotaActual(contextoNota, onde, uid, pastaPaiForcada) {
    if (pastaPaiForcada !== undefined && pastaPaiForcada !== null && String(pastaPaiForcada).trim()) {
        return String(pastaPaiForcada);
    }

    const dadosNota = contextoNota?.dadosNota || {};
    if (onde === 'share') return dadosNota?.[uid]?.pastapai || 'home';
    return dadosNota?.pastapai || 'root';
}

function prepararCaixaParaEscrita(caixa, userId, campoNota, notaId) {
    return Object.fromEntries(Object.entries({
        ...caixa,
        id: undefined,
        userId,
        [campoNota]: notaId,
        estado: caixa.estado || 'on'
    }).filter(([, valor]) => valor !== undefined));
}

export async function listarItensParaAnexar({ db, auth, onde }) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return [];

    let consulta;
    if (onde === 'share') {
        consulta = query(
            collection(db, 'Share'),
            and(
                where('estado', '==', 'on'),
                where('tipo', 'in', ['nota', 'pasta']),
                or(where('userId', '==', uid), where('aprovado', 'array-contains', uid))
            )
        );
    } else {
        consulta = query(
            collection(db, 'Local'),
            where('userId', '==', uid),
            where('estado', '==', 'on')
        );
    }

    const snapshot = await getDocs(consulta);
    return snapshot.docs
        .map(documento => ({ id: documento.id, ...documento.data(), onde }))
        .filter(notaEstaVisivel);
}

export async function criarNotaOcultaDaTarefa({ db, auth, contextoNota, bairro, filho, pastaPai }) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || !bairro?.id || !filho?.id) {
        console.error('[BAIRRO-NOTAS][CRIAR][FIREBASE] Contexto insuficiente:', {
            temDb: Boolean(db),
            userId: uid || null,
            bairroId: bairro?.id || null,
            tarefaId: filho?.id || null
        });
        throw new Error('Contexto insuficiente para criar a nota.');
    }

    const onde = contextoNota?.dadosNota?.onde === 'share' ? 'share' : 'local';
    const pastaPaiDaCriacao = obterPastaDaNotaActual(contextoNota, onde, uid, pastaPai);
    const colecao = onde === 'share' ? 'Share' : 'Local';
    console.info('[BAIRRO-NOTAS][CRIAR][FIREBASE] A criar nota:', {
        colecao,
        userId: uid,
        bairroId: bairro.id,
        tarefaId: filho.id,
        pastaPai: pastaPaiDaCriacao,
        nome: nomeDaNota(filho)
    });
    const caixaInicial = criarCaixaInicial();
    const base = {
        userId: uid,
        tipo: 'nota',
        estado: 'on',
        nome: nomeDaNota(filho),
        browser: [],
        Anexado: [bairro.id],
        Oculto: true
    };

    if (onde === 'share') {
        const dados = {
            ...base,
            onde: 'share',
            modo: ['normal'],
            aprovado: [],
            convidado: [],
            vistoPor: [uid],
            [uid]: { pastapai: pastaPaiDaCriacao, ordem: 1 }
        };
        const referencia = doc(collection(db, 'Share'));
        const idsCaixas = [String(caixaInicial.id)];
        const batchCriacao = writeBatch(db);
        batchCriacao.set(doc(db, 'Share', referencia.id), {
            ...dados,
            timestamp: serverTimestamp(),
            caixas: [caixaInicial],
            CaixasOut: idsCaixas,
            caixaIds: idsCaixas,
            caixasMigradas: true
        });
        batchCriacao.set(
            doc(db, 'ShareCaixas', String(caixaInicial.id)),
            prepararCaixaParaEscrita(caixaInicial, uid, 'shareId', referencia.id),
            { merge: true }
        );
        await batchCriacao.commit();
        console.info('[BAIRRO-NOTAS][CRIAR][FIREBASE] Documento Share criado:', { id: referencia.id });
        return {
            id: referencia.id,
            onde,
            nome: dados.nome,
            dados: {
                ...dados,
                caixas: [caixaInicial],
                CaixasOut: [caixaInicial.id],
                caixaIds: [caixaInicial.id],
                caixasMigradas: true,
                timestamp: new Date().toISOString()
            }
        };
    }

    const dados = {
        ...base,
        modo: 'normal',
        pastapai: pastaPaiDaCriacao,
        ordem: 1
    };
    const referencia = doc(collection(db, 'Local'));
    const idsCaixas = [String(caixaInicial.id)];
    const batchCriacao = writeBatch(db);
    batchCriacao.set(doc(db, 'Local', referencia.id), {
        ...dados,
        timestamp: serverTimestamp(),
        caixas: [caixaInicial],
        CaixasOut: idsCaixas,
        caixaIds: idsCaixas,
        caixasMigradas: true
    });
    batchCriacao.set(
        doc(db, 'LocalCaixas', String(caixaInicial.id)),
        prepararCaixaParaEscrita(caixaInicial, uid, 'localDocId', referencia.id),
        { merge: true }
    );
    await batchCriacao.commit();
    console.info('[BAIRRO-NOTAS][CRIAR][FIREBASE] Documento Local criado:', { id: referencia.id });
    return {
        id: referencia.id,
        onde,
        nome: dados.nome,
        dados: {
            ...dados,
            onde: 'local',
            caixas: [caixaInicial],
            CaixasOut: [caixaInicial.id],
            caixaIds: [caixaInicial.id],
            caixasMigradas: true,
            timestamp: new Date().toISOString()
        }
    };
}

export async function removerNotaOcultaCriada({ db, nota }) {
    const notaId = nota?.id;
    if (!db || !notaId) return;

    const dados = nota.dados || {};
    const idsCaixas = new Set([
        ...(Array.isArray(dados.CaixasOut) ? dados.CaixasOut : []),
        ...(Array.isArray(dados.caixaIds) ? dados.caixaIds : []),
        ...(Array.isArray(dados.caixas) ? dados.caixas.map(caixa => caixa?.id) : [])
    ].filter(Boolean).map(String));
    const colecao = nota.onde === 'share' ? 'Share' : 'Local';
    const colecaoCaixas = nota.onde === 'share' ? 'ShareCaixas' : 'LocalCaixas';

    const batchRemocao = writeBatch(db);
    batchRemocao.delete(doc(db, colecao, notaId));
    idsCaixas.forEach(caixaId => batchRemocao.delete(doc(db, colecaoCaixas, caixaId)));
    await batchRemocao.commit();
}

export async function enviarNotaParaReciclagem({ db, auth, nota }) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || !nota?.id) throw new Error('Contexto insuficiente para enviar a nota para a reciclagem.');

    const colecao = nota.onde === 'share' ? 'Share' : 'Local';
    const referencia = doc(db, colecao, String(nota.id));
    const snapshot = await getDoc(referencia);
    if (!snapshot.exists()) throw new Error('A nota já não existe.');

    const dados = snapshot.data();
    if (dados.userId && dados.userId !== uid) {
        throw new Error('A nota não pertence ao utilizador autenticado.');
    }

    const timedelete = new Date().toISOString();
    await updateDoc(referencia, {
        estado: 'off',
        timedelete
    });

    return { ...nota, estado: 'off', timedelete };
}

export async function obterNotaPorId({ db, nota }) {
    if (!db || !nota?.id) {
        console.warn('[BAIRRO-NOTAS][FIREBASE][CONSULTA] Consulta ignorada por falta de contexto:', {
            temDb: Boolean(db),
            id: nota?.id || null,
            onde: nota?.onde || null
        });
        return null;
    }
    const colecao = nota.onde === 'share' ? 'Share' : 'Local';
    const id = String(nota.id);
    console.info('[BAIRRO-NOTAS][FIREBASE][CONSULTA] A consultar documento:', { colecao, id });
    const snapshot = await getDoc(doc(db, colecao, id));
    const dados = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    console.info('[BAIRRO-NOTAS][FIREBASE][CONSULTA] Documento consultado:', {
        colecao,
        id,
        existe: Boolean(dados),
        estado: dados?.estado ?? null,
        tipo: dados?.tipo ?? null,
        nome: dados?.nome ?? null,
        userId: dados?.userId ?? null
    });
    return dados;
}
