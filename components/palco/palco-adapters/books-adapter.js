import {
    fetchGoogleBooksVolume,
    fetchGutendexBook,
    fetchOpenLibraryAuthorWorks,
    searchGoogleBooksVolumes,
    searchGutendexBooks,
    searchOpenLibraryAuthors,
    searchOpenLibraryBooks
} from '../palco-api-client.js';

const bookCache = new Map();

const BOOK_QUERIES = {
    livros: [
        "fiction bestseller",
        "literary fiction",
        "science fiction",
        "fantasy novel"
    ],
    autores: [
        "sally rooney",
        "ursula k le guin",
        "andy weir",
        "madeline miller"
    ],
    classicos: [
        "adventure",
        "philosophy"
    ]
};

const FALLBACK_BOOKS = [
    {
        source: "fallback-book",
        sourceId: "book-project-hail-mary",
        kind: "book",
        categoryTag: "livros",
        title: "Project Hail Mary",
        subtitle: "Livro",
        imageUrl: "",
        releaseDate: "2021-05-04",
        year: 2021,
        month: 5,
        description: "Fallback local para quando o catalogo de livros remoto nao responder.",
        genres: ["Sci-Fi"],
        people: ["Andy Weir"],
        trailerUrl: "",
        previewUrl: "",
        externalIds: {},
        badges: ["Fallback"],
        autoreslivro: ["Andy Weir"],
        nomesaga: "",
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

function normalizeImage(url = "") {
    return url ? url.replace(/^http:\/\//i, "https://") : "";
}

function parseYear(value = "") {
    const match = String(value || "").match(/\b(\d{4})\b/);
    return match ? Number(match[1]) : null;
}

function pickGutendexReadableFormat(formats = {}) {
    const readableKey = Object.keys(formats).find(key => /text\/html/i.test(key))
        || Object.keys(formats).find(key => /text\/plain/i.test(key))
        || Object.keys(formats).find(key => /application\/epub\+zip/i.test(key))
        || Object.keys(formats).find(key => /application\/x-mobipocket-ebook/i.test(key));
    return readableKey ? formats[readableKey] : "";
}

function buildGoogleBook(item, badgeLabel = "Google Books") {
    const info = item?.volumeInfo || {};
    const sourceId = `book-google-${item.id}`;
    const year = parseYear(info.publishedDate);
    const mapped = {
        source: "google-book",
        sourceId,
        kind: "book",
        categoryTag: "livros",
        title: info.title || "Livro",
        subtitle: info.subtitle || "Livro",
        imageUrl: normalizeImage(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ""),
        releaseDate: info.publishedDate || "",
        year,
        month: null,
        description: info.description || (info.categories || []).slice(0, 3).join(" | ") || "Livro encontrado via Google Books.",
        genres: Array.isArray(info.categories) ? info.categories.slice(0, 3) : [],
        people: Array.isArray(info.authors) ? info.authors.slice(0, 3) : [],
        trailerUrl: "",
        previewUrl: info.previewLink || info.infoLink || "",
        externalIds: {
            googleBooks: item.id || "",
            isbn: (info.industryIdentifiers || []).map(identifier => identifier.identifier).filter(Boolean).join(", ")
        },
        badges: [badgeLabel],
        autoreslivro: Array.isArray(info.authors) ? info.authors : [],
        nomesaga: info.seriesInfo?.bookDisplayNumber || "",
        related: []
    };
    bookCache.set(sourceId, mapped);
    return mapped;
}

function buildGutendexBook(item, badgeLabel = "Gutendex") {
    const sourceId = `book-gutendex-${item.id}`;
    const mapped = {
        source: "gutendex-book",
        sourceId,
        kind: "book",
        categoryTag: "livros",
        title: item.title || "Livro",
        subtitle: "Dominio publico",
        imageUrl: item.formats?.["image/jpeg"] || "",
        releaseDate: "",
        year: null,
        month: null,
        description: (item.summaries || []).find(Boolean)
            || (item.subjects || []).slice(0, 3).join(" | ")
            || "Livro encontrado via Gutendex.",
        genres: Array.isArray(item.bookshelves) && item.bookshelves.length
            ? item.bookshelves.slice(0, 3)
            : (item.subjects || []).slice(0, 3),
        people: (item.authors || []).map(author => author.name).filter(Boolean).slice(0, 3),
        trailerUrl: "",
        previewUrl: pickGutendexReadableFormat(item.formats || {}),
        externalIds: { gutendex: String(item.id || "") },
        badges: [badgeLabel],
        autoreslivro: (item.authors || []).map(author => author.name).filter(Boolean),
        nomesaga: "",
        related: []
    };
    bookCache.set(sourceId, mapped);
    return mapped;
}

function buildAuthor(doc) {
    const sourceId = `author-${doc.key}`;
    const mapped = {
        source: "openlibrary-author",
        sourceId,
        kind: "author",
        categoryTag: "livros",
        title: doc.name || "Autor",
        subtitle: "Autor",
        imageUrl: doc.key ? `https://covers.openlibrary.org/a/olid/${doc.key}-L.jpg` : "",
        releaseDate: "",
        year: null,
        month: null,
        description: doc.top_subjects?.slice(0, 3).join(" | ") || `Autor com ${doc.work_count || 0} obras na Open Library.`,
        genres: ["Autor"],
        people: [],
        trailerUrl: "",
        previewUrl: doc.key ? `https://openlibrary.org/authors/${doc.key}` : "",
        externalIds: { openlibrary: doc.key || "" },
        badges: ["Autores"],
        autoreslivro: [doc.name].filter(Boolean),
        nomesaga: "",
        related: []
    };
    bookCache.set(sourceId, mapped);
    return mapped;
}

function buildOpenLibraryBook(doc, badgeLabel = "Open Library") {
    const sourceId = `book-openlibrary-${(doc.key || doc.cover_edition_key || doc.title).replace(/\W+/g, "-").toLowerCase()}`;
    const year = Number(doc.first_publish_year || doc.publish_year?.[0] || 0) || null;
    const mapped = {
        source: "openlibrary-book",
        sourceId,
        kind: "book",
        categoryTag: "livros",
        title: doc.title || "Livro",
        subtitle: "Livro",
        imageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "",
        releaseDate: year ? `${year}-01-01` : "",
        year,
        month: null,
        description: Array.isArray(doc.subject) && doc.subject.length
            ? doc.subject.slice(0, 3).join(" | ")
            : "Livro encontrado via Open Library.",
        genres: Array.isArray(doc.subject) ? doc.subject.slice(0, 3) : [],
        people: (doc.author_name || []).slice(0, 3),
        trailerUrl: "",
        previewUrl: doc.key ? `https://openlibrary.org${doc.key}` : "",
        externalIds: { openlibrary: doc.key || "" },
        badges: [badgeLabel],
        autoreslivro: doc.author_name || [],
        nomesaga: Array.isArray(doc.subject) ? (doc.subject.find(item => /series/i.test(item)) || "") : "",
        related: []
    };
    bookCache.set(sourceId, mapped);
    return mapped;
}

async function attempt(loader, fallback = []) {
    try {
        const result = await loader();
        return Array.isArray(result) ? result : fallback;
    } catch (error) {
        console.warn("Palco books source fallback:", error);
        return fallback;
    }
}

async function fetchGoogleHighlights(queries) {
    const results = await Promise.all(
        queries.map(async query => {
            const data = await searchGoogleBooksVolumes(query, {
                langRestrict: "pt",
                maxResults: 6,
                orderBy: "newest"
            });
            return (data.items || []).map(item => buildGoogleBook(item, "Google Books"));
        })
    );
    return uniqBy(results.flat(), item => item.sourceId);
}

async function fetchOpenLibraryHighlights(queries) {
    const results = await Promise.all(
        queries.map(async query => {
            const data = await searchOpenLibraryBooks(query, 6);
            return (data.docs || []).map(doc => buildOpenLibraryBook(doc, "Open Library"));
        })
    );
    return uniqBy(results.flat(), item => item.sourceId);
}

async function fetchGutendexHighlights() {
    const [popular, classicTopics] = await Promise.all([
        searchGutendexBooks({ languages: ["en"], sort: "popular" }),
        Promise.all(BOOK_QUERIES.classicos.map(topic => searchGutendexBooks({ languages: ["en"], sort: "popular", topic })))
    ]);
    return uniqBy([
        ...((popular?.results || []).map(item => buildGutendexBook(item, "Classicos"))),
        ...classicTopics.flatMap(result => (result?.results || []).map(item => buildGutendexBook(item, "Classicos")))
    ], item => item.sourceId);
}

async function fetchBooksShelf() {
    const [googleBooks, openLibraryBooks, gutendexBooks] = await Promise.all([
        attempt(() => fetchGoogleHighlights(BOOK_QUERIES.livros)),
        attempt(() => fetchOpenLibraryHighlights(BOOK_QUERIES.livros)),
        attempt(() => fetchGutendexHighlights())
    ]);
    const items = uniqBy([...googleBooks, ...openLibraryBooks, ...gutendexBooks], item => item.sourceId).slice(0, 24);
    return items.length ? items : FALLBACK_BOOKS;
}

async function fetchAuthors(queries) {
    const results = await Promise.all(
        queries.map(async query => {
            const data = await searchOpenLibraryAuthors(query, 6);
            return (data.docs || []).map(buildAuthor);
        })
    );
    return uniqBy(results.flat(), item => item.sourceId).slice(0, 18);
}

async function searchBooksAndAuthors(term) {
    if (!term || term.trim().length < 2) return [];
    const [googleBooks, openLibraryBooks, gutendexBooks, authors] = await Promise.all([
        attempt(async () => {
            const data = await searchGoogleBooksVolumes(term, { maxResults: 10, orderBy: "relevance" });
            return (data.items || []).map(item => buildGoogleBook(item, "Pesquisa"));
        }),
        attempt(async () => {
            const data = await searchOpenLibraryBooks(term, 10);
            return (data.docs || []).map(doc => buildOpenLibraryBook(doc, "Open Library"));
        }),
        attempt(async () => {
            const data = await searchGutendexBooks({ search: term, sort: "popular" });
            return (data.results || []).map(item => buildGutendexBook(item, "Gutendex"));
        }),
        attempt(async () => {
            const data = await searchOpenLibraryAuthors(term, 8);
            return (data.docs || []).map(buildAuthor);
        })
    ]);
    const items = uniqBy([
        ...googleBooks,
        ...openLibraryBooks,
        ...gutendexBooks,
        ...authors
    ], item => item.sourceId).slice(0, 24);
    return items;
}

export async function listBookItems(mode = "livros", options = {}) {
    try {
        if (mode === "novidades" || mode === "brevemente" || mode === "livros") return await fetchBooksShelf();
        if (mode === "autores") return await fetchAuthors(BOOK_QUERIES.autores);
        if (mode === "pesquisa") return await searchBooksAndAuthors(options.searchTerm || "");
        return await fetchBooksShelf();
    } catch (error) {
        console.warn("Palco books adapter fallback:", error);
        return FALLBACK_BOOKS;
    }
}

export async function getBookDetails(sourceId, fallbackItem = null) {
    const cached = bookCache.get(sourceId) || fallbackItem || FALLBACK_BOOKS.find(item => item.sourceId === sourceId) || null;
    if (!cached) return null;

    if (cached.kind === "author") {
        const authorKey = cached.externalIds?.openlibrary?.replace("/authors/", "") || sourceId.replace("author-", "");
        try {
            const data = await fetchOpenLibraryAuthorWorks(authorKey, 8);
            const related = (data.entries || []).slice(0, 8).map(entry => ({
                title: entry.title || "Livro",
                subtitle: "Livro",
                imageUrl: "",
                year: entry.first_publish_date ? Number(String(entry.first_publish_date).slice(0, 4)) : null
            }));
            return { ...cached, related };
        } catch (error) {
            console.warn("Palco author details fallback:", error);
            return cached;
        }
    }

    if (cached.source === "google-book" && cached.externalIds?.googleBooks) {
        try {
            const data = await fetchGoogleBooksVolume(cached.externalIds.googleBooks);
            if (!data) return cached;
            return {
                ...buildGoogleBook(data, cached.badges?.[0] || "Google Books"),
                sourceId: cached.sourceId
            };
        } catch (error) {
            console.warn("Palco Google Books details fallback:", error);
            return cached;
        }
    }

    if (cached.source === "gutendex-book" && cached.externalIds?.gutendex) {
        try {
            const data = await fetchGutendexBook(cached.externalIds.gutendex);
            return {
                ...buildGutendexBook(data, cached.badges?.[0] || "Gutendex"),
                sourceId: cached.sourceId
            };
        } catch (error) {
            console.warn("Palco Gutendex details fallback:", error);
            return cached;
        }
    }

    return cached;
}
