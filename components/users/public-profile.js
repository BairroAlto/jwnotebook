import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const COLECAO_PERFIS_PUBLICOS = 'PerfisPublicos';

function textoPublico(valor, limite) {
    return typeof valor === 'string'
        ? valor.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limite)
        : '';
}

export async function sincronizarPerfilPublico(db, auth) {
    const utilizador = auth?.currentUser;
    if (!db || !utilizador?.uid || !utilizador.email) return null;

    const privadoSnap = await getDoc(doc(db, 'users', utilizador.uid));
    if (!privadoSnap.exists()) return null;

    const privado = privadoSnap.data() || {};
    if (privado.aceite !== 'on' && privado.aceite !== true) return null;

    const email = textoPublico(utilizador.email, 254).toLowerCase();
    const perfil = {
        uid: utilizador.uid,
        nome: textoPublico(privado.nome || utilizador.displayName || email.split('@')[0], 80),
        email,
        emailNormalizado: email,
        palcoPartilha: privado?.palco?.shareWithFriends === 'on' ? 'on' : 'off',
        actualizadoEm: serverTimestamp()
    };

    await setDoc(doc(db, COLECAO_PERFIS_PUBLICOS, utilizador.uid), perfil);
    return perfil;
}

export async function obterPerfilPublico(db, uid) {
    if (!db || !uid) return null;
    const snap = await getDoc(doc(db, COLECAO_PERFIS_PUBLICOS, String(uid)));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
