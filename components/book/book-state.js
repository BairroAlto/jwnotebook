export const BookState = {
    db: null,
    auth: null,
    notaId: null,
    dadosNota: null,
    caixas: [],
    unsubscribe: null,
    settings: {
        fontSize: 17,
        viewMode: "cards",
        tagPosition: "bottom",
        marginStyle: "solid",
        speechRate: 1
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
