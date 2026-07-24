import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

function getDb() {
    return window.db || getFirestore();
}

function getUid() {
    return window.auth?.currentUser?.uid || null;
}

async function getFriendIds() {
    const uid = getUid();
    if (!uid) return [];
    const q = query(collection(getDb(), "Amigos"), where("usuarios", "array-contains", uid), where("status", "==", "aceite"));
    const snap = await getDocs(q);
    const friendIds = [];
    snap.forEach(docSnap => {
        const data = docSnap.data();
        const otherId = data.remetenteId === uid ? data.destinatarioId : data.remetenteId;
        if (otherId) friendIds.push({
            uid: otherId,
            email: data.remetenteId === uid ? data.emailDestinatario : data.emailRemetente
        });
    });
    return friendIds;
}

async function friendAllowsPalco(friendUid) {
    const prefSnap = await getDoc(doc(getDb(), "users", friendUid));
    const prefs = prefSnap.exists() ? prefSnap.data() : {};
    return prefs?.palco?.shareWithFriends === "on";
}

export async function carregarFeedAmigosPalco() {
    const friendIds = await getFriendIds();
    if (!friendIds.length) return [];

    const resultado = [];
    for (const friend of friendIds) {
        if (!await friendAllowsPalco(friend.uid)) continue;

        const qPalco = query(collection(getDb(), "Palco"), where("userId", "==", friend.uid));
        const palcoSnap = await getDocs(qPalco);
        palcoSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.estado !== "on") return;
            if (data.watched !== "on" && data.wishlist !== "on" && data.favorito !== "on" && !data.rating) return;
            resultado.push({
                friend: friend.email,
                friendId: friend.uid,
                itemId: docSnap.id,
                title: data.nome,
                tag: data.tag,
                watched: data.watched,
                wishlist: data.wishlist,
                favorito: data.favorito,
                rating: data.rating,
                imageurl: data.imageurl,
                timestamp: data.timestamp
            });
        });
    }

    return resultado.sort((a, b) => {
        const at = a.timestamp?.seconds || 0;
        const bt = b.timestamp?.seconds || 0;
        return bt - at;
    });
}

export async function carregarAtividadeAmigosNoItem(source, sourceId) {
    const friendIds = await getFriendIds();
    if (!friendIds.length) return [];
    const resultado = [];
    for (const friend of friendIds) {
        if (!await friendAllowsPalco(friend.uid)) continue;
        const q = query(
            collection(getDb(), "Palco"),
            where("userId", "==", friend.uid),
            where("source", "==", source),
            where("sourceId", "==", sourceId)
        );
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const data = docSnap.data();
            resultado.push({
                friend: friend.email,
                watched: data.watched,
                wishlist: data.wishlist,
                favorito: data.favorito,
                rating: data.rating
            });
        });
    }
    return resultado;
}
