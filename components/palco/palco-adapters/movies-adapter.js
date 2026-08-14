import {
    discoverTmdbMovies,
    discoverTmdbTv,
    fetchTmdbMovieDetails,
    fetchTmdbPersonDetails,
    fetchTmdbTvDetails,
    normalizeItunesArtwork,
    searchMovieTerm,
    searchTmdbMovie,
    searchTmdbPerson,
    searchTmdbTv,
    searchTvMazePeople,
    searchTvMazeShows,
    fetchTvMazePersonCastCredits,
    tmdbImageUrl
} from '../palco-api-client.js';

const movieCache = new Map();

const MOVIE_QUERIES = {
    cinema: [
        "dune",
        "wicked",
        "civil war",
        "inside out",
        "furiosa",
        "challengers"
    ],
    brevemente: [
        "superman",
        "avatar",
        "frankenstein",
        "wake up dead man",
        "zootopia",
        "28 years later"
    ],
    filmes: [
        "oppenheimer",
        "barbie",
        "arrival",
        "parasite",
        "poor things",
        "past lives"
    ],
    series: [
        "severance",
        "shogun",
        "the bear",
        "andor",
        "silo",
        "the last of us"
    ],
    atores: [
        "cillian murphy",
        "zendaya",
        "pedro pascal",
        "margot robbie",
        "anya taylor joy"
    ]
};

const FALLBACK_MOVIES = [
    {
        source: "fallback-movie",
        sourceId: "movie-dune",
        kind: "movie",
        categoryTag: "filmes-tv",
        title: "Dune",
        subtitle: "Filme",
        imageUrl: "",
        releaseDate: "2024-03-01",
        year: 2024,
        month: 3,
        description: "Fallback local para quando o catalogo remoto nao responder.",
        genres: ["Sci-Fi"],
        people: [],
        trailerUrl: "https://www.youtube.com/results?search_query=Dune+trailer",
        previewUrl: "",
        externalIds: {},
        badges: ["Fallback"],
        related: []
    }
];

function uniqBy(items, keyFn) {
    const seen = new Set();
    return items.filter(item => {
        const key = keyFn(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function stripHtml(value = "") {
    return String(value).replace(/<[^>]*>/g, "").trim();
}

function youtubeSearchUrl(query) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getLocalDateString(offsetDays = 0) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offsetDays);
    return toIsoDate(date);
}

async function fetchRecentTmdbMovies(limit = 15) {
    const results = [];
    const seen = new Set();
    const maxLookbackDays = 120;

    for (let offset = 0; offset <= maxLookbackDays && results.length < limit; offset += 1) {
        const releaseDate = getLocalDateString(offset);
        const data = await discoverTmdbMovies({
            "primary_release_date.gte": releaseDate,
            "primary_release_date.lte": releaseDate
        }).catch(() => ({ results: [] }));

        for (const item of data.results || []) {
            if (!item?.id) continue;
            const key = String(item.id);
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(buildMovieFromTmdb(item, "TMDB"));
            if (results.length >= limit) break;
        }
    }

    return results.slice(0, limit);
}

function buildMovieFromItunes(item, badgeLabel) {
    const title = item.trackName || item.collectionName || item.artistName || "Filme";
    const sourceId = `movie-${item.trackId || item.collectionId || title.toLowerCase().replace(/\W+/g, "-")}`;
    const year = item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null;
    const mapped = {
        source: "itunes-movie",
        sourceId,
        kind: "movie",
        categoryTag: "filmes-tv",
        title,
        subtitle: "Filme",
        imageUrl: normalizeItunesArtwork(item.artworkUrl100),
        releaseDate: item.releaseDate || "",
        year,
        month: item.releaseDate ? Number(item.releaseDate.slice(5, 7)) : null,
        description: item.longDescription || item.shortDescription || item.primaryGenreName || "Filme encontrado via iTunes.",
        genres: [item.primaryGenreName].filter(Boolean),
        people: [item.artistName].filter(Boolean),
        trailerUrl: youtubeSearchUrl(`${title} trailer`),
        previewUrl: item.previewUrl || item.trackViewUrl || "",
        externalIds: { itunes: String(item.trackId || item.collectionId || "") },
        badges: badgeLabel ? [badgeLabel] : [],
        related: []
    };
    movieCache.set(sourceId, mapped);
    return mapped;
}

function buildMovieFromTmdb(item, badgeLabel = "TMDB") {
    const sourceId = `tmdb-movie-${item.id}`;
    const mapped = {
        source: "tmdb-movie",
        sourceId,
        kind: "movie",
        categoryTag: "filmes-tv",
        title: item.title || item.original_title || "Filme",
        subtitle: "Filme",
        imageUrl: tmdbImageUrl(item.poster_path || item.backdrop_path),
        releaseDate: item.release_date || "",
        year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
        month: item.release_date ? Number(item.release_date.slice(5, 7)) : null,
        description: item.overview || "Filme encontrado via TMDB.",
        genres: [],
        people: [],
        trailerUrl: youtubeSearchUrl(`${item.title || item.original_title || "movie"} trailer`),
        previewUrl: item.id ? `https://www.themoviedb.org/movie/${item.id}` : "",
        externalIds: { tmdb: String(item.id || "") },
        badges: [badgeLabel],
        related: []
    };
    movieCache.set(sourceId, mapped);
    return mapped;
}

function isUsableMovieResult(item) {
    return item?.kind === "feature-movie" && Boolean(item?.trackViewUrl);
}

function buildSeriesFromTvMaze(entry) {
    const show = entry.show || entry;
    const sourceId = `series-${show.id}`;
    const mapped = {
        source: "tvmaze-show",
        sourceId,
        kind: "series",
        categoryTag: "filmes-tv",
        title: show.name || "Serie",
        subtitle: "Serie",
        imageUrl: show.image?.original || show.image?.medium || "",
        releaseDate: show.premiered || "",
        year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
        month: show.premiered ? Number(show.premiered.slice(5, 7)) : null,
        description: stripHtml(show.summary) || "Serie encontrada via TVMaze.",
        genres: Array.isArray(show.genres) ? show.genres : [],
        people: [show.network?.name || show.webChannel?.name].filter(Boolean),
        trailerUrl: youtubeSearchUrl(`${show.name} trailer`),
        previewUrl: show.officialSite || show.url || "",
        externalIds: {
            imdb: show.externals?.imdb || "",
            tvmaze: String(show.id || "")
        },
        badges: ["Series"],
        related: []
    };
    movieCache.set(sourceId, mapped);
    return mapped;
}

function buildSeriesFromTmdb(item, badgeLabel = "TMDB") {
    const sourceId = `tmdb-tv-${item.id}`;
    const mapped = {
        source: "tmdb-tv",
        sourceId,
        kind: "series",
        categoryTag: "filmes-tv",
        title: item.name || item.original_name || "Serie",
        subtitle: "Serie",
        imageUrl: tmdbImageUrl(item.poster_path || item.backdrop_path),
        releaseDate: item.first_air_date || "",
        year: item.first_air_date ? Number(item.first_air_date.slice(0, 4)) : null,
        month: item.first_air_date ? Number(item.first_air_date.slice(5, 7)) : null,
        description: item.overview || "Serie encontrada via TMDB.",
        genres: [],
        people: [],
        trailerUrl: youtubeSearchUrl(`${item.name || item.original_name || "series"} trailer`),
        previewUrl: item.id ? `https://www.themoviedb.org/tv/${item.id}` : "",
        externalIds: { tmdb: String(item.id || "") },
        badges: [badgeLabel],
        related: []
    };
    movieCache.set(sourceId, mapped);
    return mapped;
}

function buildActorFromTvMaze(entry) {
    const person = entry.person || entry;
    const sourceId = `actor-${person.id}`;
    const mapped = {
        source: "tvmaze-person",
        sourceId,
        kind: "actor",
        categoryTag: "filmes-tv",
        title: person.name || "Ator",
        subtitle: "Ator",
        imageUrl: person.image?.original || person.image?.medium || "",
        releaseDate: person.birthday || "",
        year: person.birthday ? Number(person.birthday.slice(0, 4)) : null,
        month: person.birthday ? Number(person.birthday.slice(5, 7)) : null,
        description: person.country?.name ? `Ator ligado a producoes de ${person.country.name}.` : "Perfil de ator encontrado via TVMaze.",
        genres: ["Ator"],
        people: [],
        trailerUrl: "",
        previewUrl: person.url || "",
        externalIds: { tvmaze: String(person.id || "") },
        badges: ["Atores"],
        related: []
    };
    movieCache.set(sourceId, mapped);
    return mapped;
}

function buildActorFromTmdb(item, badgeLabel = "TMDB") {
    const sourceId = `tmdb-person-${item.id}`;
    const mapped = {
        source: "tmdb-person",
        sourceId,
        kind: "actor",
        categoryTag: "filmes-tv",
        title: item.name || "Ator",
        subtitle: "Ator",
        imageUrl: tmdbImageUrl(item.profile_path),
        releaseDate: "",
        year: null,
        month: null,
        description: item.known_for_department ? `Ator ligado a ${item.known_for_department}.` : "Perfil encontrado via TMDB.",
        genres: ["Ator"],
        people: [],
        trailerUrl: "",
        previewUrl: item.id ? `https://www.themoviedb.org/person/${item.id}` : "",
        externalIds: { tmdb: String(item.id || "") },
        badges: [badgeLabel],
        related: []
    };
    movieCache.set(sourceId, mapped);
    return mapped;
}

async function fetchMovieBuckets(queries, badgeLabel) {
    const [itunesResults, tmdbResults] = await Promise.all([
        Promise.all(
        queries.map(async query => {
            const data = await searchMovieTerm(query, 6);
            return (data.results || []).filter(isUsableMovieResult).map(item => buildMovieFromItunes(item, badgeLabel));
        })
        ),
        Promise.all(
            queries.map(async query => {
                const data = await searchTmdbMovie(query, 1).catch(() => ({ results: [] }));
                return (data.results || []).map(item => buildMovieFromTmdb(item, badgeLabel));
            })
        )
    ]);
    return uniqBy([...itunesResults.flat(), ...tmdbResults.flat()], item => item.sourceId).slice(0, 18);
}

async function fetchRecentMovies() {
    const tmdbResults = await fetchRecentTmdbMovies(15);
    if (tmdbResults.length) return tmdbResults;
    return await fetchMovieBuckets(MOVIE_QUERIES.filmes, "Filmes");
}

async function fetchRecentTmdbSeries(limit = 15) {
    const results = [];
    const seen = new Set();
    const maxLookbackDays = 120;

    for (let offset = 0; offset <= maxLookbackDays && results.length < limit; offset += 1) {
        const airDate = getLocalDateString(offset);
        const data = await discoverTmdbTv({
            "first_air_date.gte": airDate,
            "first_air_date.lte": airDate
        }).catch(() => ({ results: [] }));

        for (const item of data.results || []) {
            if (!item?.id) continue;
            const key = String(item.id);
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(buildSeriesFromTmdb(item, "TMDB"));
            if (results.length >= limit) break;
        }
    }

    return results.slice(0, limit);
}

async function fetchShows(queries) {
    const [tvMazeResults, tmdbResults] = await Promise.all([
        Promise.all(
        queries.map(async query => {
            const data = await searchTvMazeShows(query);
            return data.map(buildSeriesFromTvMaze);
        })
        ),
        Promise.all(
            queries.map(async query => {
                const data = await searchTmdbTv(query, 1).catch(() => ({ results: [] }));
                return (data.results || []).map(item => buildSeriesFromTmdb(item));
            })
        )
    ]);
    return uniqBy([...tvMazeResults.flat(), ...tmdbResults.flat()], item => item.sourceId).slice(0, 18);
}

async function fetchRecentSeries() {
    const tmdbResults = await fetchRecentTmdbSeries(15);
    if (tmdbResults.length) return tmdbResults;
    return await fetchShows(MOVIE_QUERIES.series);
}

async function fetchActors(queries) {
    const [tvMazeResults, tmdbResults] = await Promise.all([
        Promise.all(
        queries.map(async query => {
            const data = await searchTvMazePeople(query);
            return data.map(buildActorFromTvMaze);
        })
        ),
        Promise.all(
            queries.map(async query => {
                const data = await searchTmdbPerson(query, 1).catch(() => ({ results: [] }));
                return (data.results || []).map(item => buildActorFromTmdb(item));
            })
        )
    ]);
    return uniqBy([...tvMazeResults.flat(), ...tmdbResults.flat()], item => item.sourceId).slice(0, 18);
}

async function searchEverything(term) {
    if (!term || term.trim().length < 2) return [];
    const [movies, shows, people, tmdbMovies, tmdbShows, tmdbPeople] = await Promise.all([
        searchMovieTerm(term, 8),
        searchTvMazeShows(term),
        searchTvMazePeople(term),
        searchTmdbMovie(term, 1).catch(() => ({ results: [] })),
        searchTmdbTv(term, 1).catch(() => ({ results: [] })),
        searchTmdbPerson(term, 1).catch(() => ({ results: [] }))
    ]);
    return uniqBy([
        ...(movies.results || []).filter(isUsableMovieResult).map(item => buildMovieFromItunes(item, "Pesquisa")),
        ...shows.map(buildSeriesFromTvMaze),
        ...people.map(buildActorFromTvMaze),
        ...(tmdbMovies.results || []).map(item => buildMovieFromTmdb(item, "Pesquisa")),
        ...(tmdbShows.results || []).map(item => buildSeriesFromTmdb(item, "Pesquisa")),
        ...(tmdbPeople.results || []).map(item => buildActorFromTmdb(item, "Pesquisa"))
    ], item => item.sourceId).slice(0, 24);
}

export async function listMovieItems(mode = "cinema", options = {}) {
    try {
        if (mode === "cinema") return await fetchMovieBuckets(MOVIE_QUERIES.cinema, "No Cinema");
        if (mode === "brevemente") return await fetchMovieBuckets(MOVIE_QUERIES.brevemente, "Brevemente");
        if (mode === "filmes") return await fetchRecentMovies();
        if (mode === "series") return await fetchRecentSeries();
        if (mode === "atores") return await fetchActors(MOVIE_QUERIES.atores);
        if (mode === "pesquisa") return await searchEverything(options.searchTerm || "");
        return await fetchRecentMovies();
    } catch (error) {
        console.warn("Palco movies adapter fallback:", error);
        return FALLBACK_MOVIES;
    }
}

export async function getMovieDetails(sourceId, fallbackItem = null) {
    const cached = movieCache.get(sourceId) || fallbackItem || FALLBACK_MOVIES.find(item => item.sourceId === sourceId) || null;
    if (!cached) return null;

    if (cached.source === "tmdb-movie") {
        try {
            const details = await fetchTmdbMovieDetails(cached.externalIds?.tmdb || sourceId.replace("tmdb-movie-", ""));
            const related = (details.recommendations?.results || []).slice(0, 10).map(item => ({
                source: "tmdb-movie",
                sourceId: `tmdb-movie-${item.id}`,
                kind: "movie",
                title: item.title || item.original_title || "Filme",
                subtitle: "Filme",
                imageUrl: tmdbImageUrl(item.poster_path || item.backdrop_path),
                releaseDate: item.release_date || "",
                year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
                description: item.overview || "Filme relacionado via TMDB.",
                externalIds: { tmdb: String(item.id || "") },
                trailerUrl: youtubeSearchUrl(`${item.title || item.original_title || "movie"} trailer`),
                previewUrl: item.id ? `https://www.themoviedb.org/movie/${item.id}` : ""
            }));
            return {
                ...cached,
                description: details.overview || cached.description,
                genres: (details.genres || []).map(genre => genre.name).filter(Boolean),
                people: (details.credits?.cast || []).slice(0, 4).map(person => person.name).filter(Boolean),
                trailerUrl: details.videos?.results?.find(video => video.site === "YouTube" && video.type === "Trailer")?.key
                    ? `https://www.youtube.com/watch?v=${details.videos.results.find(video => video.site === "YouTube" && video.type === "Trailer").key}`
                    : cached.trailerUrl,
                related
            };
        } catch (error) {
            console.warn("Palco TMDB movie details fallback:", error);
        }
    }

    if (cached.source === "tmdb-tv") {
        try {
            const details = await fetchTmdbTvDetails(cached.externalIds?.tmdb || sourceId.replace("tmdb-tv-", ""));
            const related = (details.recommendations?.results || []).slice(0, 10).map(item => ({
                source: "tmdb-tv",
                sourceId: `tmdb-tv-${item.id}`,
                kind: "series",
                title: item.name || item.original_name || "Serie",
                subtitle: "Serie",
                imageUrl: tmdbImageUrl(item.poster_path || item.backdrop_path),
                releaseDate: item.first_air_date || "",
                year: item.first_air_date ? Number(item.first_air_date.slice(0, 4)) : null,
                description: item.overview || "Serie relacionada via TMDB.",
                externalIds: { tmdb: String(item.id || "") },
                trailerUrl: youtubeSearchUrl(`${item.name || item.original_name || "series"} trailer`),
                previewUrl: item.id ? `https://www.themoviedb.org/tv/${item.id}` : ""
            }));
            return {
                ...cached,
                description: details.overview || cached.description,
                genres: (details.genres || []).map(genre => genre.name).filter(Boolean),
                people: (details.credits?.cast || []).slice(0, 4).map(person => person.name).filter(Boolean),
                trailerUrl: details.videos?.results?.find(video => video.site === "YouTube" && video.type === "Trailer")?.key
                    ? `https://www.youtube.com/watch?v=${details.videos.results.find(video => video.site === "YouTube" && video.type === "Trailer").key}`
                    : cached.trailerUrl,
                related
            };
        } catch (error) {
            console.warn("Palco TMDB TV details fallback:", error);
        }
    }

    if (cached.source === "tmdb-person") {
        try {
            const details = await fetchTmdbPersonDetails(cached.externalIds?.tmdb || sourceId.replace("tmdb-person-", ""));
            const related = (details.combined_credits?.cast || []).slice(0, 10).map(item => ({
                source: item.media_type === "tv" ? "tmdb-tv" : "tmdb-movie",
                sourceId: `${item.media_type === "tv" ? "tmdb-tv" : "tmdb-movie"}-${item.id}`,
                kind: item.media_type === "tv" ? "series" : "movie",
                title: item.title || item.name || "Titulo",
                subtitle: item.media_type === "tv" ? "Serie" : "Filme",
                imageUrl: tmdbImageUrl(item.poster_path || item.backdrop_path),
                releaseDate: item.release_date || item.first_air_date || "",
                year: item.release_date ? Number(item.release_date.slice(0, 4)) : (item.first_air_date ? Number(item.first_air_date.slice(0, 4)) : null),
                description: item.overview || "Titulo relacionado via TMDB.",
                externalIds: { tmdb: String(item.id || "") },
                trailerUrl: youtubeSearchUrl(`${item.title || item.name || "title"} trailer`),
                previewUrl: item.id ? `https://www.themoviedb.org/${item.media_type === "tv" ? "tv" : "movie"}/${item.id}` : ""
            }));
            return {
                ...cached,
                description: details.biography || cached.description,
                related
            };
        } catch (error) {
            console.warn("Palco TMDB person details fallback:", error);
        }
    }

    if (cached.kind === "actor") {
        const actorId = cached.externalIds?.tvmaze || sourceId.replace("actor-", "");
        try {
            const credits = await fetchTvMazePersonCastCredits(actorId);
            const related = credits
                .map(item => item._embedded?.show)
                .filter(Boolean)
                .slice(0, 10)
                .map(show => ({
                    title: show.name,
                    subtitle: "Serie",
                    imageUrl: show.image?.medium || "",
                    year: show.premiered ? Number(show.premiered.slice(0, 4)) : null
                }));
            return { ...cached, related };
        } catch (error) {
            console.warn("Palco actor details fallback:", error);
        }
    }

    return cached;
}
