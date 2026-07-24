import {
    addDoc,
    collection,
    doc,
    deleteDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    query,
    setDoc,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let dbRef = null;
let authRef = null;

export function initPalcoStore(db, auth) {
    dbRef = db;
    authRef = auth;
}

function getDb() {
    return dbRef || getFirestore();
}

function getUid() {
    return authRef?.currentUser?.uid || window.auth?.currentUser?.uid || null;
}

function monthFromDate(dateStr, fallback) {
    if (!dateStr) return fallback || null;
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? (fallback || null) : date.getUTCMonth() + 1;
}

function normalizeKindLabel(kind = "") {
    const map = {
        album: "Album",
        artist: "Artista",
        track: "Musica",
        movie: "Filme",
        series: "Serie",
        book: "Livro",
        author: "Autor",
        event: "Evento"
    };
    return map[kind] || kind || "Item";
}

function inferCodice(item) {
    const ids = item.externalIds || {};
    return ids.codice
        || ids.musicbrainzReleaseGroupId
        || ids.musicbrainzArtistId
        || ids.deezerTrackId
        || ids.deezerAlbumId
        || ids.deezerArtistId
        || ids.itunes
        || ids.imdb
        || "";
}

function inferAlbumName(item) {
    return item.albumName || item.album || item.subtitleAlbum || item.collectionName || "";
}

function inferTrackNumber(item) {
    return Number(item.trackNumber || item.trackNo || item.numeroFaixa || 0) || null;
}

function buildBaseDoc(item, tag) {
    const uid = getUid();
    return {
        userId: uid,
        estado: "on",
        tag,
        oque: normalizeKindLabel(item.kind),
        nome: item.title,
        source: item.source,
        sourceId: item.sourceId,
        imageurl: item.imageUrl || "",
        releaseDate: item.releaseDate || "",
        ano: item.year || null,
        mes: item.month || monthFromDate(item.releaseDate, item.month),
        rating: null,
        wishlist: "off",
        watched: "off",
        favorito: "off",
        caixas: [],
        vistoem: null,
        ordem: 1,
        timestamp: serverTimestamp(),
        imdb: item.externalIds?.imdb || "",
        codice: inferCodice(item),
        album: inferAlbumName(item),
        artistasmusica: Array.isArray(item.people) ? item.people : [],
        numerofaixa: inferTrackNumber(item),
        nomesaga: item.nomesaga || "",
        autoreslivro: item.autoreslivro || [],
        trailerUrl: item.trailerUrl || "",
        previewUrl: item.previewUrl || "",
        palcoMeta: {
            title: item.title,
            subtitle: item.subtitle || "",
            imageUrl: item.imageUrl || "",
            route: {
                category: inferCategoryFromTag(tag),
                sourceId: item.sourceId
            }
        }
    };
}

function inferCategoryFromTag(tag) {
    if (tag === "filmes-tv") return "movies";
    if (tag === "musicas") return "music";
    if (tag === "eventos") return "events";
    return "books";
}

function buildReleaseDate(item) {
    if (item?.releaseDate) return String(item.releaseDate);
    if (!item?.ano) return "";
    const mes = String(item.mes || 1).padStart(2, "0");
    return `${item.ano}-${mes}-01`;
}

function isOfficiallyAvailable(item) {
    const releaseDate = buildReleaseDate(item);
    if (!releaseDate) return false;
    const parsed = new Date(releaseDate);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return parsed <= today;
}

function formatOfficialDate(item) {
    const releaseDate = buildReleaseDate(item);
    if (releaseDate) {
        const parsed = new Date(releaseDate);
        if (!Number.isNaN(parsed.getTime())) {
            return new Intl.DateTimeFormat("pt-PT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }).format(parsed);
        }
    }
    return item?.ano ? String(item.ano) : "";
}

function getWishlistNotificationId(item) {
    return `wishlist-${item.id}`;
}

export async function sincronizarNotificacoesWishlist(items) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return;

    const ativos = (items || []).filter(item => {
        if (!item || item.userId !== uid) return false;
        if (item.estado !== "on") return false;
        return item.wishlist === "on" && isOfficiallyAvailable(item);
    });

    const sourceIdsAtivos = new Set(ativos.map(item => item.id));

    await Promise.allSettled(ativos.map(item => {
        const docId = getWishlistNotificationId(item);
        return setDoc(doc(db, "PalcoNotificacoes", docId), {
            id: docId,
            userId: uid,
            tipo: "wishlist-oficial",
            estado: "on",
            sourceDocId: item.id,
            source: item.source || "",
            sourceId: item.sourceId || "",
            tag: item.tag || "",
            titulo: item.nome || "Disponível oficialmente",
            nome: item.nome || "Disponível oficialmente",
            imageurl: item.imageurl || "",
            dataOficial: formatOfficialDate(item),
            data: formatOfficialDate(item),
            texto: `${item.nome || "Este conteúdo"} já está disponível oficialmente.`,
            releaseDate: buildReleaseDate(item),
            timestamp: serverTimestamp()
        }, { merge: true });
    }));

    const existentes = await getDocs(query(
        collection(getDb(), "PalcoNotificacoes"),
        where("userId", "==", uid),
        where("tipo", "==", "wishlist-oficial")
    ));

    await Promise.allSettled(existentes.docs.map(async notifDoc => {
        const data = notifDoc.data();
        if (!sourceIdsAtivos.has(data.sourceDocId)) {
            await deleteDoc(notifDoc.ref);
        }
    }));
}

export async function ensurePalcoDoc(item, tag) {
    const existing = await loadPalcoDoc(item, tag);
    if (existing) return existing;

    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return null;

    const ordem = await getNextOrder(uid);
    const base = {
        ...buildBaseDoc(item, tag),
        ordem
    };
    const ref = await addDoc(collection(db, "Palco"), base);
    await updateDoc(doc(db, "Palco", ref.id), { id: ref.id });
    return { id: ref.id, ...base };
}

export async function loadPalcoDoc(item, tag) {
    const db = getDb();
    const uid = getUid();
    if (!db || !uid) return null;

    const q = query(
        collection(db, "Palco"),
        where("userId", "==", uid),
        where("source", "==", item.source),
        where("sourceId", "==", item.sourceId),
        where("tag", "==", tag),
        limit(1)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
    return null;
}

async function getNextOrder(uid) {
    const db = getDb();
    const q = query(collection(db, "Palco"), where("userId", "==", uid));
    const snap = await getDocs(q);
    return snap.size + 1;
}

export async function updatePalcoFlags(item, tag, partial = {}) {
    const existing = await ensurePalcoDoc(item, tag);
    if (!existing?.id) return null;
    const payload = {
        ...partial,
        nome: item.title,
        oque: normalizeKindLabel(item.kind),
        imageurl: item.imageUrl || existing.imageurl || "",
        releaseDate: item.releaseDate || existing.releaseDate || "",
        ano: item.year || existing.ano || null,
        mes: item.month || existing.mes || null,
        codice: inferCodice(item) || existing.codice || "",
        album: inferAlbumName(item) || existing.album || "",
        artistasmusica: Array.isArray(item.people) && item.people.length ? item.people : (existing.artistasmusica || []),
        numerofaixa: inferTrackNumber(item) || existing.numerofaixa || null,
        timestamp: serverTimestamp()
    };
    if (partial.watched === "on") {
        payload.vistoem = new Date().toISOString();
    }
    await updateDoc(doc(getDb(), "Palco", existing.id), payload);
    return { ...existing, ...payload };
}

export async function savePalcoRating(item, tag, rating) {
    return updatePalcoFlags(item, tag, { rating, watched: "on" });
}

export async function savePalcoNote(item, tag, noteBox) {
    const existing = await ensurePalcoDoc(item, tag);
    if (!existing?.id) return null;
    const mergedBox = {
        ...noteBox,
        palco: existing.id,
        palcoMeta: {
            ...(noteBox.palcoMeta || {}),
            route: noteBox.palcoMeta?.route || {
                category: inferCategoryFromTag(tag),
                sourceId: item.sourceId
            }
        }
    };
    await updateDoc(doc(getDb(), "Palco", existing.id), {
        caixas: [mergedBox],
        nome: item.title,
        oque: normalizeKindLabel(item.kind),
        imageurl: item.imageUrl || existing.imageurl || "",
        releaseDate: item.releaseDate || existing.releaseDate || "",
        ano: item.year || existing.ano || null,
        mes: item.month || existing.mes || null,
        codice: inferCodice(item) || existing.codice || "",
        album: inferAlbumName(item) || existing.album || "",
        artistasmusica: Array.isArray(item.people) && item.people.length ? item.people : (existing.artistasmusica || []),
        numerofaixa: inferTrackNumber(item) || existing.numerofaixa || null,
        timestamp: serverTimestamp()
    });
    return existing.id;
}

export function watchPalcoByUser(callback) {
    const uid = getUid();
    if (!uid) return () => {};
    const q = query(collection(getDb(), "Palco"), where("userId", "==", uid));
    return onSnapshot(q, snap => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        callback(items);
        sincronizarNotificacoesWishlist(items).catch(() => {});
    });
}

export function watchPalcoNotifications(callback) {
    const uid = getUid();
    if (!uid) return () => {};
    const q = query(
        collection(getDb(), "PalcoNotificacoes"),
        where("userId", "==", uid),
        where("estado", "==", "on"),
        where("tipo", "==", "wishlist-oficial")
    );
    return onSnapshot(q, snap => {
        callback(
            snap.docs
                .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
        );
    });
}

export async function removerNotificacaoPalco(notificationId) {
    if (!notificationId) return;
    await deleteDoc(doc(getDb(), "PalcoNotificacoes", notificationId));
}

export async function marcarNotificacaoPalcoComoVista(notification) {
    if (!notification?.sourceDocId) {
        await removerNotificacaoPalco(notification?.id);
        return;
    }

    await updateDoc(doc(getDb(), "Palco", notification.sourceDocId), {
        watched: "on",
        wishlist: "off",
        vistoem: new Date().toISOString(),
        timestamp: serverTimestamp()
    });

    await removerNotificacaoPalco(notification.id);
}
