// components/xray/xray-state.js
export const state = {
    projetoAtivo: null,
    resultadosCache: null,      // Resultados Bíblicos
    resultadosPalavrasCache: {}, // NOVO: { "Família": [resultados], "Lealdade": [...] }
    textosBiblicosCache: {},
    palavrasDetetadas: [],       // NOVO: Lista de palavras limpas
    modoResumo: "linhas", 
    config: {
         silenciados: new Set(),         // Versículos (ex: "Jó 1:1")
        silenciadosPalavras: new Set(), // Termos (ex: "batismo")
        fontesOcultas: new Set(),       // Fontes (ex: "w_2024_01")
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