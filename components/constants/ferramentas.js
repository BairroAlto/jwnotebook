const DEFINICOES_FERRAMENTAS = [
    { id: "contentor", nome: "Contentor", icon: "fa-solid fa-box", cor: "#ea580c", featureKey: "contentor" },
    { id: "subnota", nome: "SubNota", icon: "fa-solid fa-box", cor: "#3b82f6" },
    { id: "questao", nome: "Questão", icon: "fa-solid fa-box", cor: "#10b981", featureKey: "questao" },
    { id: "raciocinio", nome: "Raciocínio", icon: "fa-solid fa-box", cor: "#f59e0b" },
    { id: "elevador", nome: "Elevador", icon: "fa-solid fa-elevator", cor: "#ef4444" },
    { id: "cartaovisita", nome: "Cartão Visita", icon: "fa-solid fa-address-card", cor: "#d4af37" },
    { id: "citacaobiblica", nome: "Citação Bíblica", icon: "fa-solid fa-book-open", cor: "#94a3b8" },
    { id: "webcard", nome: "WebCard", icon: "fa-solid fa-globe", cor: "#8b5cf6" },
    { id: "galeria", nome: "Imagens", icon: "fa-solid fa-panorama", cor: "#ec4899" },
    { id: "sumariar", nome: "Sumariar", icon: "fa-brands fa-mailchimp", cor: "#6366f1" },
    { id: "firmamento", nome: "Firmamento", icon: "fa-solid fa-aquarius", cor: "#d4af37" },
    { id: "bairro", nome: "Bairro Tarefas", icon: "fa-solid fa-city", cor: "#c084fc" },
    { id: "noticias", nome: "Notícias", icon: "fa-solid fa-square-rss", cor: "#d6a47f", featureKey: "ferramenta_noticias", disponivelNaLoja: true, descricao: "Cria um feed de notícias a partir dos temas, país e idioma escolhidos pelo utilizador." },
    { id: "tempo", nome: "Tempo", icon: "fa-solid fa-cloud-sun", cor: "#7dd3fc", featureKey: "ferramenta_tempo", disponivelNaLoja: true, descricao: "Mostra o estado do tempo da cidade escolhida e actualiza uma vez por dia." },
    { id: "inspirador", nome: "Inspirador", icon: "fa-solid fa-quote-left", cor: "#86efac", featureKey: "ferramenta_inspirador", disponivelNaLoja: true, descricao: "Mostra citações da Wikiquote por autor, tema ou de forma aleatória." },
    { id: "gmail", nome: "Gmail", icon: "fa-solid fa-envelope", cor: "#f87171", featureKey: "ferramenta_gmail", disponivelNaLoja: true, descricao: "Mostra os emails recentes da conta Google ligada, em modo somente leitura." },
    { id: "habito", nome: "Hábito", icon: "fa-solid fa-calendar-check", cor: "#a78bfa", featureKey: "ferramenta_habito", disponivelNaLoja: true, descricao: "Organiza hábitos por categorias e regista o progresso num calendário mensal." }
];

export const FERRAMENTAS_REGISTO = Object.freeze(
    DEFINICOES_FERRAMENTAS.map(ferramenta => Object.freeze({ ...ferramenta }))
);

export const IDENTIDADE_FERRAMENTAS = Object.freeze(
    Object.fromEntries(FERRAMENTAS_REGISTO.map(ferramenta => [ferramenta.id, ferramenta]))
);

export function obterFerramenta(tipo) {
    return IDENTIDADE_FERRAMENTAS[tipo] || null;
}
