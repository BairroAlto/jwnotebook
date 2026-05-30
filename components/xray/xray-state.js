// components/xray/xray-state.js
export const state = {
    projetoAtivo: null,
    resultadosCache: null,
    resultadosPalavrasCache: {},
    textosBiblicosCache: {},
    palavrasDetetadas: [],
    modoResumo: "linhas",
    // 🚀 NOVO: Persistência da Aba AI
    aiStatus: {
        loading: false,
        alvo: null,
        tipo: null,
        modo: null,
        resposta: null
    },
    config: {
        silenciados: new Set(),
        silenciadosPalavras: new Set(),
        fontesOcultas: new Set(),
        leituraDireita: false
    }
};

// Dicionário para transformar siglas em nomes amigáveis nos Piccards
export const NOMES_SIGLAS = {
    "w": "Sentinela",
    "g": "Despertai!",
    "mwb": "Apostila",
    "cl": "Achegue-se",
    "bt": "Testemunho Cabal",
    "rr": "Adoração Pura",
    "jy": "Jesus o Caminho"
    // O sistema usará a sigla bruta se não encontrar no dicionário
};
