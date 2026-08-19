import { collection, getDoc, getDocs, query, where, serverTimestamp, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function criarNotaLocal(db, auth, { pastapai = 'root' } = {}) {
    const userId = auth?.currentUser?.uid;
    if (!db || !userId) throw new Error('É necessário iniciar sessão para criar uma nota.');

    const localRef = collection(db, 'Local');
    const q = query(localRef, where('pastapai', '==', pastapai), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const ordem = 1;

    if (!querySnapshot.empty) {
        const batchOrdens = writeBatch(db);
        querySnapshot.forEach(item => {
            batchOrdens.update(doc(db, 'Local', item.id), {
                ordem: (item.data().ordem || 0) + 1
            });
        });
        await batchOrdens.commit();
    }

    const idNotaUnico = crypto.randomUUID();
    const idBlocoInicial = crypto.randomUUID();
    const dadosNovaNota = {
        id: idNotaUnico,
        userId,
        tipo: 'nota',
        modo: 'normal',
        estado: 'on',
        nome: 'Nova Nota',
        pastapai,
        ordem,
        browser: [],
        caixas: [{
            id: idBlocoInicial,
            tipo: 'contentor',
            conteudo: '',
            timestamp: new Date().toISOString(),
            protecao: 'fechado',
            estado: 'on',
            foco: 'original',
            ordem: 1
        }]
    };

    const { caixas: caixasNovas, ...dadosNotaSemCaixas } = dadosNovaNota;
    const docRef = doc(localRef);
    const idsCaixas = caixasNovas.map(caixa => String(caixa.id));
    const batchCriacao = writeBatch(db);

    // A nota e a primeira caixa são gravadas no mesmo batch. Se alguma
    // escrita falhar, o Firestore não deixa o processo a meio.
    batchCriacao.set(docRef, {
        ...dadosNotaSemCaixas,
        timestamp: serverTimestamp(),
        caixas: caixasNovas,
        CaixasOut: idsCaixas,
        caixaIds: idsCaixas,
        caixasMigradas: true
    });

    caixasNovas.forEach(caixa => {
        const dadosCaixa = Object.fromEntries(Object.entries({
            ...caixa,
            id: undefined,
            userId,
            localDocId: docRef.id,
            estado: caixa.estado || "on"
        }).filter(([, valor]) => valor !== undefined));
        batchCriacao.set(doc(db, "LocalCaixas", String(caixa.id)), dadosCaixa, { merge: true });
    });

    await batchCriacao.commit();

    let dadosNotaCriada = {
        ...dadosNovaNota,
        timestamp: new Date().toISOString()
    };
    try {
        const snapshotCriado = await getDoc(docRef);
        if (snapshotCriado.exists()) dadosNotaCriada = snapshotCriado.data();
    } catch (erroTimestamp) {
        console.warn('[CRIAR-NOTA] Não foi possível reler o timestamp do servidor; será usada a data local.', erroTimestamp);
    }

    return { id: docRef.id, dados: dadosNotaCriada };
}

export async function removerNotaLocalCriada(db, notaCriada) {
    const notaId = notaCriada?.id;
    if (!db || !notaId) return;

    const dados = notaCriada.dados || {};
    const idsCaixas = new Set([
        ...(Array.isArray(dados.CaixasOut) ? dados.CaixasOut : []),
        ...(Array.isArray(dados.caixaIds) ? dados.caixaIds : []),
        ...(Array.isArray(dados.caixas) ? dados.caixas.map(caixa => caixa?.id) : [])
    ].filter(Boolean).map(String));

    const batchRemocao = writeBatch(db);
    batchRemocao.delete(doc(db, 'Local', notaId));
    idsCaixas.forEach(caixaId => batchRemocao.delete(doc(db, 'LocalCaixas', caixaId)));
    await batchRemocao.commit();
}
