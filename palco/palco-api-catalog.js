const SECTOR_META = {
    filmes: {
        label: "Filmes",
        icon: "fa-film",
        copy: "Catalogos, detalhes, trailers, busca e obras de arquivo."
    },
    series: {
        label: "Series",
        icon: "fa-tv",
        copy: "Series, episodios, elencos, agenda e stream."
    },
    eventos: {
        label: "Eventos",
        icon: "fa-masks-theater",
        copy: "Agenda cultural, bilhetes, pesquisa por cidade e programação local."
    },
    livros: {
        label: "Livros",
        icon: "fa-book-open",
        copy: "Busca bibliografica, dominio publico, previews e acervos."
    },
    musica: {
        label: "Musica",
        icon: "fa-music",
        copy: "Metadados, capas, previews, letras e concertos."
    }
};

const API_CATALOG = [
    {
        id: "tvmaze",
        name: "TVMaze",
        sectors: ["series"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Series, episodios, cast, agenda TV e web schedule.",
        bestFor: "Series mainstream, calendario e lookup por IMDb.",
        caveat: "Foco quase total em TV, nao em cinema.",
        docsUrl: "https://www.tvmaze.com/api"
    },
    {
        id: "tmdb",
        name: "TMDb",
        sectors: ["filmes", "series"],
        freeAccess: "Gratis com conta",
        auth: "API key / bearer token",
        coverage: "Filmes, series, trending, discover, people, imagens e videos.",
        bestFor: "UI principal do Palco para cinema e TV.",
        caveat: "Precisa registo e token.",
        docsUrl: "https://developer.themoviedb.org/docs/getting-started"
    },
    {
        id: "omdb",
        name: "OMDb",
        sectors: ["filmes", "series"],
        freeAccess: "Gratis com chave",
        auth: "API key",
        coverage: "Titulo, ano, ratings, IMDb ID, plot e pesquisa direta.",
        bestFor: "Lookup rapido, pesquisa simples e fallback leve.",
        caveat: "Poster API completa e paga; melhor para metadata.",
        docsUrl: "https://www.omdbapi.com/"
    },
    {
        id: "itunes-media",
        name: "iTunes Search API",
        sectors: ["filmes", "series", "livros", "musica"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Movies, TV shows, music, audiobooks, iBooks e previews.",
        bestFor: "Previews rapidos, artwork e pesquisa transversal.",
        caveat: "Uso promocional e dependente do ecossistema Apple.",
        docsUrl: "https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html"
    },
    {
        id: "anilist",
        name: "AniList GraphQL",
        sectors: ["filmes", "series"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa para leitura",
        coverage: "Anime series, filmes anime, personagens, staff e airing.",
        bestFor: "Subset anime com GraphQL forte.",
        caveat: "Cobre anime/manga, nao cinema geral.",
        docsUrl: "https://anilist.gitbook.io/anilist-apiv2-docs"
    },
    {
        id: "jikan",
        name: "Jikan REST API",
        sectors: ["filmes", "series"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Anime, manga, temporadas, top charts e personagens.",
        bestFor: "Fallback REST para ecosistema MyAnimeList.",
        caveat: "API comunitaria sobre dados MAL; nao e uma API oficial da MAL.",
        docsUrl: "https://docs.api.jikan.moe/"
    },
    {
        id: "ticketmaster",
        name: "Ticketmaster Discovery API",
        sectors: ["eventos"],
        freeAccess: "Gratis com chave",
        auth: "API key",
        coverage: "Eventos, venues, attractions, pesquisa por data e localizacao.",
        bestFor: "Bilhetes e eventos internacionais com filtros fortes.",
        caveat: "Requer chave de API e tem limite diário.",
        docsUrl: "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/"
    },
    {
        id: "agendalx",
        name: "AgendaLX",
        sectors: ["eventos"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Agenda cultural de Lisboa, teatro, exposicoes, musica e mais.",
        bestFor: "Programacao local e eventos de Lisboa.",
        caveat: "Foco regional; cobertura concentrada em Lisboa.",
        docsUrl: "https://agendalx.pt/"
    },
    {
        id: "loc",
        name: "Library of Congress API",
        sectors: ["filmes", "livros"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Books, printed material, films, videos, audio e imagens.",
        bestFor: "Acervo historico, editorial e institucional.",
        caveat: "Nao e pensado para catalogo pop moderno.",
        docsUrl: "https://www.loc.gov/apis/"
    },
    {
        id: "internet-archive",
        name: "Internet Archive APIs",
        sectors: ["filmes", "livros"],
        freeAccess: "Aberta sem chave para leitura",
        auth: "Opcional para escrita",
        coverage: "Livros, videos, audio e metadata de itens digitais.",
        bestFor: "Dominio publico, obras digitalizadas e fontes long tail.",
        caveat: "Estrutura de dados varia por colecao.",
        docsUrl: "https://archive.org/developers/index.html"
    },
    {
        id: "open-library",
        name: "Open Library APIs",
        sectors: ["livros"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Edicoes, obras, autores, capas, subjects e leitura.",
        bestFor: "Motor principal de livros e autores.",
        caveat: "Qualidade depende da comunidade e da edicao.",
        docsUrl: "https://openlibrary.org/developers/api"
    },
    {
        id: "google-books",
        name: "Google Books API",
        sectors: ["livros"],
        freeAccess: "Gratis com conta Google Cloud",
        auth: "API key",
        coverage: "Full-text search, metadata, availability e previews.",
        bestFor: "Pesquisa ampla e embed de previews.",
        caveat: "Requer setup no Google Cloud.",
        docsUrl: "https://developers.google.com/books"
    },
    {
        id: "gutendex",
        name: "Gutendex",
        sectors: ["livros"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Metadata JSON do Project Gutenberg.",
        bestFor: "Dominio publico, classicos e leitura livre.",
        caveat: "Foco em obras do Gutenberg.",
        docsUrl: "https://gutendex.com/"
    },
    {
        id: "openalex",
        name: "OpenAlex",
        sectors: ["livros"],
        freeAccess: "Gratis com chave gratuita",
        auth: "Free API key",
        coverage: "Works, books academicos, autores, fontes e topicos.",
        bestFor: "Livros academicos e bibliografia de pesquisa.",
        caveat: "Melhor para acervo cientifico do que literatura pop.",
        docsUrl: "https://developers.openalex.org/"
    },
    {
        id: "musicbrainz",
        name: "MusicBrainz API",
        sectors: ["musica"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa para leitura",
        coverage: "Artists, releases, release groups, recordings e works.",
        bestFor: "Base canonica de IDs e metadata musical.",
        caveat: "Artwork vem melhor quando combinada com Cover Art Archive.",
        docsUrl: "https://musicbrainz.org/doc/MusicBrainz_API"
    },
    {
        id: "cover-art-archive",
        name: "Cover Art Archive",
        sectors: ["musica"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Capas front/back e thumbnails por MBID.",
        bestFor: "Artwork de albuns para a grid do Palco.",
        caveat: "Depende de IDs do MusicBrainz para ficar redondo.",
        docsUrl: "https://musicbrainz.org/doc/Cover_Art_Archive/API"
    },
    {
        id: "lastfm",
        name: "Last.fm API",
        sectors: ["musica"],
        freeAccess: "Gratis com chave",
        auth: "API key",
        coverage: "Artists, albums, tracks, tags, similares e charts.",
        bestFor: "Descoberta, recomendacao e contexto social.",
        caveat: "Algumas operacoes pedem autenticacao do utilizador.",
        docsUrl: "https://www.last.fm/api"
    },
    {
        id: "deezer",
        name: "Deezer API",
        sectors: ["musica"],
        freeAccess: "Gratis com conta",
        auth: "Login para aceitar termos",
        coverage: "Artists, albums, tracks, charts e previews.",
        bestFor: "Previews curtos e catalogo pop rapido.",
        caveat: "Portal de dev pede login e aceitacao de termos.",
        docsUrl: "https://developers.deezer.com/api"
    },
    {
        id: "jamendo",
        name: "Jamendo API",
        sectors: ["musica"],
        freeAccess: "Gratis com conta",
        auth: "Client credentials",
        coverage: "Tracks, albums, artists, playlists, radios e lyrics.",
        bestFor: "Musica livre e projetos nao comerciais.",
        caveat: "Plano gratis documentado para apps nao comerciais.",
        docsUrl: "https://developer.jamendo.com/v3.0"
    },
    {
        id: "audiodb",
        name: "TheAudioDB",
        sectors: ["musica"],
        freeAccess: "Gratis para dev/teste",
        auth: "Test key publica",
        coverage: "Artists, albums, tracks e artwork musical.",
        bestFor: "Prototipagem rapida e enriquecimento visual.",
        caveat: "A propria doc limita o uso gratis a test/development.",
        docsUrl: "https://www.theaudiodb.com/api_guide.php"
    },
    {
        id: "lyricsovh",
        name: "Lyrics.ovh",
        sectors: ["musica"],
        freeAccess: "Aberta sem chave",
        auth: "Nao precisa",
        coverage: "Letras por artista e musica.",
        bestFor: "Caixa lateral de letras ou lookup simples.",
        caveat: "Escopo bem mais estreito que os catalogos musicais.",
        docsUrl: "https://lyricsovh.docs.apiary.io/"
    },
    {
        id: "setlistfm",
        name: "setlist.fm API",
        sectors: ["musica"],
        freeAccess: "Gratis para nao comercial",
        auth: "API key",
        coverage: "Setlists, venues, cidades, tours e concertos.",
        bestFor: "Camada live da musica e memoria de shows.",
        caveat: "Uso comercial exige contacto proprio.",
        docsUrl: "https://api.setlist.fm/docs/1.0/index.html"
    }
];

export function getApiSectorMeta(sector) {
    return SECTOR_META[sector] || null;
}

export function getApiSectors() {
    return Object.entries(SECTOR_META).map(([id, meta]) => ({ id, ...meta }));
}

export function getApisForSector(sector) {
    return API_CATALOG.filter(api => api.sectors.includes(sector));
}

export function getApiSectorSummary() {
    return getApiSectors().map(sector => ({
        ...sector,
        total: getApisForSector(sector.id).length
    }));
}

export function getApiTotalCount() {
    return API_CATALOG.length;
}
