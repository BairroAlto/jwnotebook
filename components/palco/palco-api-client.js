import { palcoApiConfig } from './palco-api-config.js';

const API_ENDPOINTS = {
    agendaLxApi: "https://agendalx.pt/api/",
    agendaLxWpJson: "https://agendalx.pt/wp-json/agendalx/v1/events",
    coverArtArchive: "https://coverartarchive.org",
    deezer: "https://api.deezer.com",
    geniusSearch: "https://api.genius.com/search",
    googleBooks: "https://www.googleapis.com/books/v1",
    gutendex: "https://gutendex.com",
    itunesSearch: "https://itunes.apple.com/search",
    lyricsOvh: "https://api.lyrics.ovh/v1",
    musicBrainz: "https://musicbrainz.org/ws/2",
    openLibraryAuthors: "https://openlibrary.org/search/authors.json",
    openLibrarySearch: "https://openlibrary.org/search.json",
    setlistFm: "https://api.setlist.fm/1.0",
    ticketmaster: "https://app.ticketmaster.com/discovery/v2",
    tmdb: "https://api.themoviedb.org/3",
    tvMazePeople: "https://api.tvmaze.com/search/people",
    tvMazePersonCast: "https://api.tvmaze.com/people",
    tvMazeShows: "https://api.tvmaze.com/search/shows"
};

let googleBooksDisabled = false;
let googleBooksWarned = false;

export function buildUrl(base, params = {}) {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

export async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} @ ${url}`);
    }
    return response.json();
}

function isGoogleBooksForbidden(error) {
    return error instanceof Error
        && error.message.includes("HTTP 403")
        && error.message.includes(API_ENDPOINTS.googleBooks);
}

function disableGoogleBooks(error) {
    googleBooksDisabled = true;
    if (googleBooksWarned) return;
    googleBooksWarned = true;
    console.warn("PALCO Google Books desativado nesta sessao por erro 403.", error);
}

export async function safeFetchJson(url, options = {}, fallback = null) {
    try {
        return await fetchJson(url, options);
    } catch (error) {
        console.warn("PALCO API fetch falhou:", url, error);
        return fallback;
    }
}

export function normalizeItunesArtwork(url = "", size = 600) {
    return url ? url.replace(/\/[0-9]+x[0-9]+bb\./, `/${size}x${size}bb.`) : "";
}

export async function searchMovieTerm(query, limit = 6) {
    return fetchJson(buildUrl(API_ENDPOINTS.itunesSearch, {
        attribute: "movieTerm",
        country: "us",
        limit,
        media: "all",
        term: query
    }));
}

export async function searchItunesEntity(query, entity, limit = 6) {
    return fetchJson(buildUrl(API_ENDPOINTS.itunesSearch, {
        country: "us",
        entity,
        limit,
        term: query
    }));
}

export async function fetchItunesLookup(id, entity = "", limit = 25) {
    return fetchJson(buildUrl("https://itunes.apple.com/lookup", {
        country: "us",
        entity,
        id,
        limit
    }));
}

export async function searchDeezerResource(type, query, limit = 6) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.deezer}/search/${type}`, {
        limit,
        q: query
    }));
}

export async function fetchDeezerArtistTopTracks(artistId, limit = 8) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.deezer}/artist/${artistId}/top`, { limit }));
}

export async function fetchDeezerArtistAlbums(artistId, limit = 8) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.deezer}/artist/${artistId}/albums`, { limit }));
}

export async function fetchDeezerAlbumTracks(albumId, limit = 8) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.deezer}/album/${albumId}/tracks`, { limit }));
}

export async function searchMusicBrainz(type, query, limit = 6) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.musicBrainz}/${type}`, {
        dismax: "true",
        fmt: "json",
        limit,
        query
    }));
}

export async function fetchCoverArtReleaseGroup(mbid) {
    return fetchJson(`${API_ENDPOINTS.coverArtArchive}/release-group/${mbid}`);
}

export async function searchSetlistArtists(artistName, page = 1) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.setlistFm}/search/artists`, {
        artistName,
        p: page
    }), {
        headers: {
            "x-api-key": palcoApiConfig.setlistFmApiKey
        }
    });
}

export async function fetchSetlistsByArtist(mbid, page = 1) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.setlistFm}/artist/${mbid}/setlists`, {
        p: page
    }), {
        headers: {
            "x-api-key": palcoApiConfig.setlistFmApiKey
        }
    });
}

export async function searchGenius(query) {
    return fetchJson(buildUrl(API_ENDPOINTS.geniusSearch, { q: query }), {
        headers: {
            Authorization: `Bearer ${palcoApiConfig.geniusAccessToken}`
        }
    });
}

export async function fetchLyricsOvh(artist, title) {
    return fetchJson(`${API_ENDPOINTS.lyricsOvh}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
}

export async function searchTvMazeShows(query) {
    return fetchJson(buildUrl(API_ENDPOINTS.tvMazeShows, { q: query }));
}

export async function searchTvMazePeople(query) {
    return fetchJson(buildUrl(API_ENDPOINTS.tvMazePeople, { q: query }));
}

export async function fetchTvMazePersonCastCredits(personId) {
    return fetchJson(`${API_ENDPOINTS.tvMazePersonCast}/${personId}/castcredits?embed=show`);
}

function normalizeAgendaLxEvents(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.events)) return data.events;
    if (Array.isArray(data?._embedded?.events)) return data._embedded.events;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

export async function fetchAgendaLxEvents(limit = 80) {
    const targets = [
        buildUrl(API_ENDPOINTS.agendaLxApi, { per_page: limit, limit }),
        buildUrl(API_ENDPOINTS.agendaLxWpJson, { per_page: limit, limit })
    ];

    let lastError = null;
    for (const url of targets) {
        try {
            const data = await fetchJson(url);
            const events = normalizeAgendaLxEvents(data);
            if (events.length || url === targets[targets.length - 1]) {
                return events.slice(0, limit);
            }
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) {
        throw lastError;
    }
    return [];
}

export async function fetchTicketmasterEvents(options = {}) {
    const apiKey = palcoApiConfig.ticketmasterApiKey || "";
    if (!apiKey) {
        console.warn("PALCO Ticketmaster sem API key configurada.");
        return { _embedded: { events: [] } };
    }

    const {
        city = "",
        countryCode = "PT",
        includeTBA = "yes",
        includeTBD = "yes",
        keyword = "",
        locale = "pt-PT",
        page = 0,
        size = 50,
        sort = "date,asc",
        startDateTime = ""
    } = options;

    const params = {
        apikey: apiKey,
        city,
        countryCode,
        includeTBA,
        includeTBD,
        keyword,
        locale,
        page,
        size,
        sort,
        startDateTime
    };

    return fetchJson(buildUrl(`${API_ENDPOINTS.ticketmaster}/events.json`, params));
}

export async function searchOpenLibraryBooks(query, limit = 6) {
    return fetchJson(buildUrl(API_ENDPOINTS.openLibrarySearch, {
        limit,
        q: query
    }));
}

export async function searchOpenLibraryAuthors(query, limit = 6) {
    return fetchJson(buildUrl(API_ENDPOINTS.openLibraryAuthors, {
        limit,
        q: query
    }));
}

export async function fetchOpenLibraryAuthorWorks(authorKey, limit = 6) {
    return fetchJson(buildUrl(`https://openlibrary.org/authors/${authorKey}/works.json`, {
        limit
    }));
}

export async function searchGoogleBooksVolumes(query, options = {}) {
    if (googleBooksDisabled) {
        return { items: [] };
    }
    const {
        langRestrict = "",
        maxResults = 6,
        orderBy = "relevance",
        printType = "books",
        startIndex = 0
    } = options;
    try {
        return await fetchJson(buildUrl(`${API_ENDPOINTS.googleBooks}/volumes`, {
            key: palcoApiConfig.googleBooksApiKey,
            langRestrict,
            maxResults,
            orderBy,
            printType,
            q: query,
            startIndex
        }));
    } catch (error) {
        if (isGoogleBooksForbidden(error)) {
            disableGoogleBooks(error);
            return { items: [] };
        }
        throw error;
    }
}

export async function fetchGoogleBooksVolume(volumeId) {
    if (googleBooksDisabled) {
        return null;
    }
    try {
        return await fetchJson(buildUrl(`${API_ENDPOINTS.googleBooks}/volumes/${encodeURIComponent(volumeId)}`, {
            key: palcoApiConfig.googleBooksApiKey
        }));
    } catch (error) {
        if (isGoogleBooksForbidden(error)) {
            disableGoogleBooks(error);
            return null;
        }
        throw error;
    }
}

export async function searchGutendexBooks(options = {}) {
    const {
        authorYearEnd,
        authorYearStart,
        copyright,
        ids,
        languages,
        mimeType,
        page = 1,
        search = "",
        sort = "popular",
        topic = ""
    } = options;
    return fetchJson(buildUrl(`${API_ENDPOINTS.gutendex}/books`, {
        author_year_end: authorYearEnd,
        author_year_start: authorYearStart,
        copyright,
        ids: Array.isArray(ids) ? ids.join(",") : ids,
        languages: Array.isArray(languages) ? languages.join(",") : languages,
        mime_type: mimeType,
        page,
        search,
        sort,
        topic
    }));
}

export async function fetchGutendexBook(id) {
    return fetchJson(`${API_ENDPOINTS.gutendex}/books/${encodeURIComponent(id)}`);
}

function tmdbOptions(options = {}) {
    return {
        ...options,
        headers: {
            Authorization: `Bearer ${palcoApiConfig.tmdbAccessToken}`,
            ...(options.headers || {})
        }
    };
}

export function tmdbImageUrl(path, size = "w780") {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

export async function searchTmdbMovie(query, page = 1) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/search/movie`, {
        include_adult: "false",
        language: "en-US",
        page,
        query
    }), tmdbOptions());
}

export async function discoverTmdbMovies(params = {}) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/discover/movie`, {
        include_adult: "false",
        language: "en-US",
        page: 1,
        sort_by: "release_date.desc",
        ...params
    }), tmdbOptions());
}

export async function discoverTmdbTv(params = {}) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/discover/tv`, {
        include_adult: "false",
        language: "en-US",
        page: 1,
        sort_by: "first_air_date.desc",
        ...params
    }), tmdbOptions());
}

export async function searchTmdbTv(query, page = 1) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/search/tv`, {
        include_adult: "false",
        language: "en-US",
        page,
        query
    }), tmdbOptions());
}

export async function searchTmdbPerson(query, page = 1) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/search/person`, {
        include_adult: "false",
        language: "en-US",
        page,
        query
    }), tmdbOptions());
}

export async function fetchTmdbMovieDetails(id) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/movie/${id}`, {
        append_to_response: "credits,recommendations,videos",
        language: "en-US"
    }), tmdbOptions());
}

export async function fetchTmdbTvDetails(id) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/tv/${id}`, {
        append_to_response: "credits,recommendations,videos",
        language: "en-US"
    }), tmdbOptions());
}

export async function fetchTmdbPersonDetails(id) {
    return fetchJson(buildUrl(`${API_ENDPOINTS.tmdb}/person/${id}`, {
        append_to_response: "combined_credits",
        language: "en-US"
    }), tmdbOptions());
}
