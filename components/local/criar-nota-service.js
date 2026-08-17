import { guardarCaixasDaNota } from './caixas-repository.js';
import { collection, addDoc, getDoc, getDocs, query, where, serverTimestamp, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function criarNotaLocal(db, auth, { pastapai = 'root' } = {}) {
    const userId = auth?.currentUser?.uid;
    if (!db || !userId) throw new Error('É necessário iniciar sessão para criar uma nota.');

    const localRef = collection(db, 'Local');
    const q = query(localRef, where('pastapai', '==', pastapai), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const ordem = 1;

    if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach(item => {
            batch.update(doc(db, 'Local', item.id), {
                ordem: (item.data().ordem || 0) + 1
            });
        });
        await batch.commit();
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
    const docRef = await addDoc(localRef, {
        ...dadosNotaSemCaixas,
        timestamp: serverTimestamp()
    });

    await guardarCaixasDaNota({
        db,
        userId,
        notaId: docRef.id,
        caixas: caixasNovas,
        removerLegacy: true
    });

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
