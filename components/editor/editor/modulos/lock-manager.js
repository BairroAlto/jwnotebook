// components/editor/modulos/lock-manager.js
import { doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const LockManager = {
    verificarStatus: async (db, notaId) => {
        try {
            const snap = await getDoc(doc(db, "Share", notaId));
            return snap.exists() ? snap.data().editando : null;
        } catch (e) { return null; }
    },

    vigiarLock: (db, notaId, callback) => {
        const docRef = doc(db, "Share", notaId);
        return onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                callback(snap.data().editando);
            }
        }, (error) => {
            console.warn("⚠️ [LOCK] Sem permissão para vigiar esta nota.");
        });
    },

   bloquearParaMim: async (db, notaId, userId, userNome) => {
    const docRef = doc(db, "Share", notaId);
    return await updateDoc(docRef, { 
        editando: { uid: userId, nome: userNome } 
    });
},

    libertar: async (db, notaId) => {
        const docRef = doc(db, "Share", notaId);
        return await updateDoc(docRef, { editando: "" });
    }
};