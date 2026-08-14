import {
    fetchCoverArtReleaseGroup,
    fetchDeezerAlbumTracks,
    fetchDeezerArtistAlbums,
    fetchDeezerArtistTopTracks,
    fetchItunesLookup,
    fetchSetlistsByArtist,
    normalizeItunesArtwork,
    searchItunesEntity,
    searchSetlistArtists,
    safeFetchJson
} from '../palco-api-client.js';

const musicCache = new Map();
const RECENT_WINDOW_MONTHS = 18;
const ENABLE_BROWSER_DEEZER = false;

const MUSIC_QUERIES = {
    novidades: ["billie eilish", "charli xcx", "kendrick lamar", "fka twigs"],
    brevemente: ["lorde", "dua lipa", "olivia rodrigo", "the weeknd"],
    albuns: ["brat", "hit me hard and soft", "cowboy carter", "short n sweet"],
    musicas: ["espresso", "birds of a feather", "good luck babe", "not like us"],
    artistas: ["billie eilish", "charli xcx", "fka twigs", "kendrick lamar"]
};

const FALLBACK_MUSIC = [
    {
        source: "fallback-music",
        sourceId: "album-hit-me-hard-and-soft",
        kind: "album",
        categoryTag: "musicas",
        title: "Hit Me Hard and Soft",
        subtitle: "Album",
        imageUrl: "",
        releaseDate: "2024-05-17",
        year: 2024,
        month: 5,
        description: "Fallback local para quando o catalogo musical remoto nao responder.",
        genres: ["Pop"],
        people: ["Billie Eilish"],
        trailerUrl: "",
        previewUrl: "",
        externalIds: {},
        externalLinks: [],
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["Fallback"],
        related: []
    }
];

function normalizeText(value = "") {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function uniqBy(items, keyFn) {
    const seen = new Set();
    return items.filter(item => {
        const key = keyFn(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function signatureFor(item) {
    return [
        item.kind || "",
        normalizeText(item.title),
        normalizeText(item.people?.[0] || ""),
        item.year || ""
    ].join("|");
}

function sortByNewest(items) {
    return [...items].sort((a, b) => {
        const aDate = a.releaseDate || `${a.year || 0}-01-01`;
        const bDate = b.releaseDate || `${b.year || 0}-01-01`;
        return bDate.localeCompare(aDate);
    });
}

function isRecentEnough(item, windowMonths = RECENT_WINDOW_MONTHS) {
    if (!item?.releaseDate) return false;
    const release = new Date(item.releaseDate);
    if (Number.isNaN(release.getTime())) return false;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - windowMonths);
    return release >= cutoff;
}

function buildLinks(seed = {}) {
    return Object.entries(seed)
        .filter(([, url]) => typeof url === "string" && url.startsWith("http"))
        .map(([label, url]) => ({
            label: ({
                deezer: "Deezer",
                genius: "Genius",
                musicbrainz: "MusicBrainz",
                setlistfm: "setlist.fm",
                itunes: "Apple Music"
            })[label] || label,
            url
        }));
}

function remember(item) {
    musicCache.set(item.sourceId, item);
    return item;
}

function sameAlbumTitle(a = "", b = "") {
    return normalizeText(a) === normalizeText(b);
}

function buildAlbumFromItunes(item) {
    const sourceId = `itunes-album-${item.collectionId || item.trackId || item.collectionName?.toLowerCase().replace(/\W+/g, "-")}`;
    return remember({
        source: "itunes-album",
        sourceId,
        kind: "album",
        categoryTag: "musicas",
        title: item.collectionName || "Album",
        subtitle: "Album",
        imageUrl: normalizeItunesArtwork(item.artworkUrl100),
        releaseDate: item.releaseDate || "",
        year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
        month: item.releaseDate ? Number(item.releaseDate.slice(5, 7)) : null,
        description: `${item.artistName || "Artista"} · ${item.primaryGenreName || "Musica"}`,
        genres: [item.primaryGenreName].filter(Boolean),
        people: [item.artistName].filter(Boolean),
        trailerUrl: "",
        previewUrl: item.collectionViewUrl || "",
        externalIds: {
            artistId: String(item.artistId || ""),
            itunes: String(item.collectionId || "")
        },
        externalLinks: buildLinks({ itunes: item.collectionViewUrl || "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["iTunes"],
        related: []
    });
}

function buildTrackFromItunes(item) {
    const sourceId = `itunes-track-${item.trackId || item.trackName?.toLowerCase().replace(/\W+/g, "-")}`;
    return remember({
        source: "itunes-track",
        sourceId,
        kind: "track",
        categoryTag: "musicas",
        title: item.trackName || "Musica",
        subtitle: "Musica",
        imageUrl: normalizeItunesArtwork(item.artworkUrl100),
        releaseDate: item.releaseDate || "",
        year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
        month: item.releaseDate ? Number(item.releaseDate.slice(5, 7)) : null,
        description: `${item.artistName || "Artista"} · ${item.collectionName || "Single"}`,
        genres: [item.primaryGenreName].filter(Boolean),
        people: [item.artistName].filter(Boolean),
        trailerUrl: "",
        previewUrl: item.previewUrl || item.trackViewUrl || "",
        externalIds: {
            artistId: String(item.artistId || ""),
            itunes: String(item.trackId || ""),
            itunesCollectionId: String(item.collectionId || "")
        },
        externalLinks: buildLinks({ itunes: item.trackViewUrl || "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        lyricsText: "",
        albumTitle: item.collectionName || "",
        albumSourceId: item.collectionId ? `itunes-album-${item.collectionId}` : "",
        albumPreviewUrl: item.collectionViewUrl || "",
        badges: ["iTunes"],
        related: []
    });
}

function buildArtistFromItunes(item) {
    const sourceId = `itunes-artist-${item.artistId || item.amgArtistId || item.artistName.toLowerCase().replace(/\W+/g, "-")}`;
    return remember({
        source: "itunes-artist",
        sourceId,
        kind: "artist",
        categoryTag: "musicas",
        title: item.artistName || "Artista",
        subtitle: "Artista",
        imageUrl: "",
        releaseDate: "",
        year: null,
        month: null,
        description: item.primaryGenreName || "Artista encontrado via iTunes Search API.",
        genres: [item.primaryGenreName].filter(Boolean),
        people: [],
        trailerUrl: "",
        previewUrl: item.artistLinkUrl || "",
        externalIds: {
            artistId: String(item.artistId || "")
        },
        externalLinks: buildLinks({ itunes: item.artistLinkUrl || "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["iTunes"],
        related: []
    });
}

function buildAlbumFromDeezer(item) {
    const album = item.album?.id ? item.album : item;
    const artistName = item.artist?.name || album.artist?.name || "";
    const sourceId = `deezer-album-${album.id || normalizeText(album.title)}`;
    return remember({
        source: "deezer-album",
        sourceId,
        kind: "album",
        categoryTag: "musicas",
        title: album.title || "Album",
        subtitle: "Album",
        imageUrl: album.cover_xl || album.cover_big || album.cover_medium || album.cover || "",
        releaseDate: album.release_date || "",
        year: album.release_date ? Number(album.release_date.slice(0, 4)) : null,
        month: album.release_date ? Number(album.release_date.slice(5, 7)) : null,
        description: `${artistName || "Artista"} · Deezer`,
        genres: [],
        people: [artistName].filter(Boolean),
        trailerUrl: "",
        previewUrl: album.link || "",
        externalIds: {
            deezerAlbumId: String(album.id || ""),
            deezerArtistId: String(item.artist?.id || album.artist?.id || "")
        },
        externalLinks: buildLinks({ deezer: album.link || "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["Deezer"],
        related: []
    });
}

function buildTrackFromDeezer(item) {
    const sourceId = `deezer-track-${item.id || normalizeText(item.title)}`;
    return remember({
        source: "deezer-track",
        sourceId,
        kind: "track",
        categoryTag: "musicas",
        title: item.title || "Musica",
        subtitle: "Musica",
        imageUrl: item.album?.cover_xl || item.album?.cover_big || item.album?.cover_medium || item.album?.cover || "",
        releaseDate: item.release_date || "",
        year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
        month: item.release_date ? Number(item.release_date.slice(5, 7)) : null,
        description: `${item.artist?.name || "Artista"} · ${item.album?.title || "Single"}`,
        genres: [],
        people: [item.artist?.name].filter(Boolean),
        trailerUrl: "",
        previewUrl: item.preview || item.link || "",
        externalIds: {
            deezerTrackId: String(item.id || ""),
            deezerArtistId: String(item.artist?.id || ""),
            deezerAlbumId: String(item.album?.id || "")
        },
        externalLinks: buildLinks({ deezer: item.link || "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        lyricsText: "",
        albumTitle: item.album?.title || "",
        albumSourceId: item.album?.id ? `deezer-album-${item.album.id}` : "",
        albumPreviewUrl: item.album?.link || "",
        badges: ["Deezer"],
        related: []
    });
}

function buildArtistFromDeezer(item) {
    const sourceId = `deezer-artist-${item.id || normalizeText(item.name)}`;
    return remember({
        source: "deezer-artist",
        sourceId,
        kind: "artist",
        categoryTag: "musicas",
        title: item.name || "Artista",
        subtitle: "Artista",
        imageUrl: item.picture_xl || item.picture_big || item.picture_medium || item.picture || "",
        releaseDate: "",
        year: null,
        month: null,
        description: `Artista encontrado via Deezer${item.nb_fan ? ` · ${item.nb_fan} fas` : ""}.`,
        genres: [],
        people: [],
        trailerUrl: "",
        previewUrl: item.link || "",
        externalIds: {
            deezerArtistId: String(item.id || "")
        },
        externalLinks: buildLinks({ deezer: item.link || "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["Deezer"],
        related: []
    });
}

function buildAlbumFromMusicBrainz(item) {
    const sourceId = `musicbrainz-album-${item.id}`;
    return remember({
        source: "musicbrainz-album",
        sourceId,
        kind: "album",
        categoryTag: "musicas",
        title: item.title || "Album",
        subtitle: "Album",
        imageUrl: "",
        releaseDate: item["first-release-date"] || "",
        year: item["first-release-date"] ? Number(item["first-release-date"].slice(0, 4)) : null,
        month: item["first-release-date"] ? Number(item["first-release-date"].slice(5, 7)) : null,
        description: `${item["artist-credit"]?.map(entry => entry.name).join(", ") || "Artista"} · MusicBrainz`,
        genres: [],
        people: item["artist-credit"]?.map(entry => entry.name).filter(Boolean) || [],
        trailerUrl: "",
        previewUrl: item.id ? `https://musicbrainz.org/release-group/${item.id}` : "",
        externalIds: {
            musicbrainzReleaseGroupId: String(item.id || "")
        },
        externalLinks: buildLinks({ musicbrainz: item.id ? `https://musicbrainz.org/release-group/${item.id}` : "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["MusicBrainz"],
        related: []
    });
}

function buildArtistFromMusicBrainz(item) {
    const sourceId = `musicbrainz-artist-${item.id}`;
    return remember({
        source: "musicbrainz-artist",
        sourceId,
        kind: "artist",
        categoryTag: "musicas",
        title: item.name || "Artista",
        subtitle: "Artista",
        imageUrl: "",
        releaseDate: "",
        year: null,
        month: null,
        description: item.disambiguation || item.country || "Artista encontrado via MusicBrainz.",
        genres: [],
        people: [],
        trailerUrl: "",
        previewUrl: item.id ? `https://musicbrainz.org/artist/${item.id}` : "",
        externalIds: {
            musicbrainzArtistId: String(item.id || "")
        },
        externalLinks: buildLinks({ musicbrainz: item.id ? `https://musicbrainz.org/artist/${item.id}` : "" }),
        liveMoments: [],
        awards: [],
        lyricsUrl: "",
        badges: ["MusicBrainz"],
        related: []
    });
}

async function fetchItunes(entity, queries, mapper) {
    const results = await Promise.all(
        queries.map(async query => {
            const data = await searchItunesEntity(query, entity, 6);
            return (data.results || []).map(mapper);
        })
    );
    return results.flat();
}

async function fetchDeezer(entity, queries, mapper) {
    if (!ENABLE_BROWSER_DEEZER) return [];
    const results = await Promise.all(
        queries.map(async query => {
            const data = await safeFetchJson(
                `https://api.deezer.com/search/${entity}?q=${encodeURIComponent(query)}&limit=6`,
                {},
                { data: [] }
            );
            return (data?.data || []).map(mapper);
        })
    );
    return results.flat();
}

async function fetchMusicBrainzArtists(queries) {
    const results = await Promise.all(
        queries.map(async query => {
            const data = await safeFetchJson(
                `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json&limit=6&dismax=true`,
                {},
                { artists: [] }
            );
            return (data?.artists || []).map(buildArtistFromMusicBrainz);
        })
    );
    return results.flat();
}

async function fetchMusicBrainzReleaseGroups(queries) {
    const results = await Promise.all(
        queries.map(async query => {
            const data = await safeFetchJson(
                `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(`artist:"${query}" AND primarytype:album`)}&fmt=json&limit=6&dismax=true`,
                {},
                { "release-groups": [] }
            );
            return (data?.["release-groups"] || []).map(buildAlbumFromMusicBrainz);
        })
    );
    return results.flat();
}

function dedupeMusicItems(items, limit = 18) {
    return uniqBy(items, signatureFor).slice(0, limit);
}

async function fetchRecentAlbums(queries) {
    const items = sortByNewest(dedupeMusicItems([
        ...(await fetchItunes("album", queries, buildAlbumFromItunes)),
        ...(await fetchDeezer("album", queries, buildAlbumFromDeezer)),
        ...(await fetchMusicBrainzReleaseGroups(queries))
    ], 36));
    const recent = items.filter(item => isRecentEnough(item));
    return (recent.length ? recent : items).slice(0, 18);
}

async function searchMusic(term) {
    if (!term || term.trim().length < 2) return [];
    const [albums, songs, artists, deezerAlbums, deezerTracks, deezerArtists, mbArtists] = await Promise.all([
        searchItunesEntity(term, "album", 8),
        searchItunesEntity(term, "song", 8),
        searchItunesEntity(term, "musicArtist", 8),
        ENABLE_BROWSER_DEEZER ? safeFetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(term)}&limit=8`, {}, { data: [] }) : Promise.resolve({ data: [] }),
        ENABLE_BROWSER_DEEZER ? safeFetchJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(term)}&limit=8`, {}, { data: [] }) : Promise.resolve({ data: [] }),
        ENABLE_BROWSER_DEEZER ? safeFetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(term)}&limit=8`, {}, { data: [] }) : Promise.resolve({ data: [] }),
        safeFetchJson(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(term)}&fmt=json&limit=8&dismax=true`, {}, { artists: [] })
    ]);

    return dedupeMusicItems([
        ...(albums.results || []).map(buildAlbumFromItunes),
        ...(songs.results || []).map(buildTrackFromItunes),
        ...(artists.results || []).map(buildArtistFromItunes),
        ...(deezerAlbums.data || []).map(buildAlbumFromDeezer),
        ...(deezerTracks.data || []).map(buildTrackFromDeezer),
        ...(deezerArtists.data || []).map(buildArtistFromDeezer),
        ...(mbArtists.artists || []).map(buildArtistFromMusicBrainz)
    ], 24);
}

function mergeExternalLinks(...groups) {
    return uniqBy(groups.flat().filter(Boolean), link => `${link.label}|${link.url}`);
}

async function enrichWithCoverArt(item, releaseGroupId) {
    if (!releaseGroupId || item.imageUrl) return item;
    const cover = await fetchCoverArtReleaseGroup(releaseGroupId).catch(() => null);
    const candidate = cover?.images?.[0];
    if (!candidate) return item;
    return {
        ...item,
        imageUrl: candidate.thumbnails?.large || candidate.thumbnails?.small || candidate.image || item.imageUrl
    };
}

function buildGeniusSearchUrl(item) {
    const query = [item.people?.[0], item.title].filter(Boolean).join(" ").trim();
    return query ? `https://genius.com/search?q=${encodeURIComponent(query)}` : "";
}

async function enrichArtistDetails(base) {
    const deezerArtistId = base.externalIds?.deezerArtistId || "";
    const mbArtistId = base.externalIds?.musicbrainzArtistId || "";

    const deezerArtistData = deezerArtistId
        ? {
            albums: await fetchDeezerArtistAlbums(deezerArtistId, 8).catch(() => ({ data: [] })),
            tracks: await fetchDeezerArtistTopTracks(deezerArtistId, 8).catch(() => ({ data: [] }))
        }
        : { albums: { data: [] }, tracks: { data: [] } };
    const artistData = ENABLE_BROWSER_DEEZER ? deezerArtistData : { albums: { data: [] }, tracks: { data: [] } };

    const resolvedMbArtist = mbArtistId
        ? { id: mbArtistId }
        : (await safeFetchJson(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(base.title)}&fmt=json&limit=1&dismax=true`, {}, { artists: [] }))?.artists?.[0] || null;

    const releaseGroups = await safeFetchJson(
        `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(`artist:"${base.title}" AND primarytype:album`)}&fmt=json&limit=8&dismax=true`,
        {},
        { "release-groups": [] }
    );

    const setlistArtist = resolvedMbArtist?.id
        ? { mbid: resolvedMbArtist.id, name: base.title }
        : (await searchSetlistArtists(base.title).catch(() => ({ artist: [] })))?.artist?.[0] || null;

    const setlists = setlistArtist?.mbid
        ? await fetchSetlistsByArtist(setlistArtist.mbid).catch(() => ({ setlist: [] }))
        : { setlist: [] };

    const related = dedupeMusicItems([
        ...(artistData.albums.data || []).map(buildAlbumFromDeezer),
        ...(releaseGroups["release-groups"] || []).map(buildAlbumFromMusicBrainz),
        ...(artistData.tracks.data || []).map(buildTrackFromDeezer)
    ], 8);

    const liveMoments = (setlists.setlist || []).slice(0, 6).map(entry => ({
        title: entry.eventDate || "Concerto",
        subtitle: [entry.venue?.name, entry.venue?.city?.name, entry.tour?.name].filter(Boolean).join(" · "),
        url: entry.url || ""
    }));

    return {
        ...base,
        description: base.description || resolvedMbArtist?.disambiguation || "Artista enriquecido com Deezer, MusicBrainz e setlist.fm.",
        related,
        liveMoments,
        awards: base.awards || [],
        externalIds: {
            ...base.externalIds,
            musicbrainzArtistId: resolvedMbArtist?.id || mbArtistId || "",
            setlistArtistMbid: setlistArtist?.mbid || ""
        },
        externalLinks: mergeExternalLinks(
            base.externalLinks || [],
            resolvedMbArtist?.id ? [{ label: "MusicBrainz", url: `https://musicbrainz.org/artist/${resolvedMbArtist.id}` }] : [],
            setlistArtist?.mbid ? [{ label: "setlist.fm", url: `https://www.setlist.fm/search?artist=${encodeURIComponent(base.title)}` }] : []
        )
    };
}

async function enrichAlbumDetails(base) {
    const mbAlbum = base.externalIds?.musicbrainzReleaseGroupId
        ? { id: base.externalIds.musicbrainzReleaseGroupId }
        : (await safeFetchJson(
            `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(`release:"${base.title}" AND artist:"${base.people?.[0] || ""}" AND primarytype:album`)}&fmt=json&limit=1&dismax=true`,
            {},
            { "release-groups": [] }
        ))?.["release-groups"]?.[0] || null;

    const withCover = await enrichWithCoverArt(base, mbAlbum?.id || base.externalIds?.musicbrainzReleaseGroupId || "");
    const itunesTracks = base.externalIds?.itunes
        ? await fetchItunesLookup(base.externalIds.itunes, "song", 25).catch(() => ({ results: [] }))
        : await searchItunesEntity(`${base.people?.[0] || ""} ${base.title}`, "song", 25).catch(() => ({ results: [] }));
    const deezerTracks = ENABLE_BROWSER_DEEZER && base.externalIds?.deezerAlbumId
        ? await fetchDeezerAlbumTracks(base.externalIds.deezerAlbumId, 8).catch(() => ({ data: [] }))
        : { data: [] };
    const albumTracks = dedupeMusicItems([
        ...((itunesTracks.results || [])
            .filter(item => item.wrapperType === "track" && sameAlbumTitle(item.collectionName || "", base.title))
            .map(buildTrackFromItunes)),
        ...((deezerTracks.data || []).map(buildTrackFromDeezer))
    ], 24);

    return {
        ...withCover,
        year: withCover.year || (mbAlbum?.["first-release-date"] ? Number(mbAlbum["first-release-date"].slice(0, 4)) : null),
        releaseDate: withCover.releaseDate || mbAlbum?.["first-release-date"] || "",
        related: albumTracks.slice(0, 8),
        tracks: albumTracks,
        awards: base.awards || [],
        externalIds: {
            ...withCover.externalIds,
            musicbrainzReleaseGroupId: mbAlbum?.id || withCover.externalIds?.musicbrainzReleaseGroupId || ""
        },
        externalLinks: mergeExternalLinks(
            withCover.externalLinks || [],
            mbAlbum?.id ? [{ label: "MusicBrainz", url: `https://musicbrainz.org/release-group/${mbAlbum.id}` }] : []
        )
    };
}

async function enrichTrackDetails(base) {
    const deezerTop = ENABLE_BROWSER_DEEZER && base.externalIds?.deezerArtistId
        ? await fetchDeezerArtistTopTracks(base.externalIds.deezerArtistId, 8).catch(() => ({ data: [] }))
        : { data: [] };

    return {
        ...base,
        lyricsUrl: base.lyricsUrl || buildGeniusSearchUrl(base),
        related: dedupeMusicItems((deezerTop.data || []).map(buildTrackFromDeezer), 8),
        awards: base.awards || []
    };
}

export async function listMusicItems(mode = "novidades", options = {}) {
    try {
        if (mode === "novidades") return await fetchRecentAlbums(MUSIC_QUERIES.novidades);
        if (mode === "brevemente") {
            return dedupeMusicItems([
                ...(await fetchItunes("musicArtist", MUSIC_QUERIES.brevemente, buildArtistFromItunes)),
                ...(await fetchDeezer("artist", MUSIC_QUERIES.brevemente, buildArtistFromDeezer)),
                ...(await fetchMusicBrainzArtists(MUSIC_QUERIES.brevemente))
            ]);
        }
        if (mode === "albuns") {
            return dedupeMusicItems([
                ...(await fetchItunes("album", MUSIC_QUERIES.albuns, buildAlbumFromItunes)),
                ...(await fetchDeezer("album", MUSIC_QUERIES.albuns, buildAlbumFromDeezer)),
                ...(await fetchMusicBrainzReleaseGroups(MUSIC_QUERIES.albuns))
            ]);
        }
        if (mode === "musicas") {
            return dedupeMusicItems([
                ...(await fetchItunes("song", MUSIC_QUERIES.musicas, buildTrackFromItunes)),
                ...(await fetchDeezer("track", MUSIC_QUERIES.musicas, buildTrackFromDeezer))
            ]);
        }
        if (mode === "artistas") {
            return dedupeMusicItems([
                ...(await fetchItunes("musicArtist", MUSIC_QUERIES.artistas, buildArtistFromItunes)),
                ...(await fetchDeezer("artist", MUSIC_QUERIES.artistas, buildArtistFromDeezer)),
                ...(await fetchMusicBrainzArtists(MUSIC_QUERIES.artistas))
            ]);
        }
        if (mode === "pesquisa") return await searchMusic(options.searchTerm || "");
        return await fetchRecentAlbums(MUSIC_QUERIES.albuns);
    } catch (error) {
        console.warn("Palco music adapter fallback:", error);
        return FALLBACK_MUSIC;
    }
}

export async function getMusicDetails(sourceId, fallbackItem = null) {
    const cached = musicCache.get(sourceId) || fallbackItem || FALLBACK_MUSIC.find(item => item.sourceId === sourceId) || null;
    if (!cached) return null;

    if (cached.kind === "artist") return await enrichArtistDetails(cached);
    if (cached.kind === "album") return await enrichAlbumDetails(cached);
    if (cached.kind === "track") return await enrichTrackDetails(cached);
    return cached;
}
