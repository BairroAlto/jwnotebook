import {
    addDoc,
    and,
    collection,
    doc,
    getDocs,
    getDoc,
    or,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { guardarCaixasDaNota } from '../../local/caixas-repository.js';
import { guardarCaixasShareDaNota } from '../../share/share-caixas-repository.js';
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

export async function criarNotaOcultaDaTarefa({ db, auth, contextoNota, bairro, filho }) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || !bairro?.id || !filho?.id) throw new Error('Contexto insuficiente para criar a nota.');

    const onde = contextoNota?.dadosNota?.onde === 'share' ? 'share' : 'local';
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
            [uid]: { pastapai: 'home', ordem: 1 }
        };
        const referencia = await addDoc(collection(db, 'Share'), { ...dados, timestamp: serverTimestamp() });
        await guardarCaixasShareDaNota({
            db,
            ownerId: uid,
            notaId: referencia.id,
            caixas: [caixaInicial],
            removerLegacy: true
        });
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
        pastapai: 'root',
        ordem: 1
    };
    const referencia = await addDoc(collection(db, 'Local'), { ...dados, timestamp: serverTimestamp() });
    await guardarCaixasDaNota({
        db,
        userId: uid,
        notaId: referencia.id,
        caixas: [caixaInicial],
        removerLegacy: true
    });
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
    if (!db || !nota?.id) return null;
    const colecao = nota.onde === 'share' ? 'Share' : 'Local';
    const snapshot = await getDoc(doc(db, colecao, String(nota.id)));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
