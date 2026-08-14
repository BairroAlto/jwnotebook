export const BookState = {
    db: null,
    auth: null,
    notaId: null,
    dadosNota: null,
    caixas: [],
    unsubscribe: null,
    settings: {
        fontSize: 17,
        fontSizeDesktop: 17,
        fontSizeMobile: 17,
        viewMode: "cards",
        tagPosition: "bottom",
        marginStyle: "solid",
        speechRate: 1,
        teleprompterRate: 1,
        aiFloating: false,
        selectedVoiceId: null
    },
    activeTab: "feed",
    archiveNav: {
        view: "raiz",
        gavetaId: null,
        prateleiraId: null
    },
    highlightNames: {},
    teleprompterTimer: null
};

export function setBookState(partial) {
    Object.assign(BookState, partial);
    window.bookNotaAtual = BookState.dadosNota;
    window.bookCaixasAtuais = BookState.caixas;
    window.caixasAtuais = BookState.caixas;
}
