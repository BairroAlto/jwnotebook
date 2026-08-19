const IMAGENS_POR_TEMA = Object.freeze({
    coragem: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80',
    foco: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=80',
    criatividade: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80',
    esperanca: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=900&q=80',
    mudanca: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    sabedoria: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80'
});

export const CITACOES_INSPIRADOR_FALLBACK = Object.freeze([
    { texto: 'Mudam-se os tempos, mudam-se as vontades.', autor: 'Luís de Camões', tema: 'Mudança', chaveTema: 'mudanca' },
    { texto: 'Tudo vale a pena se a alma não é pequena.', autor: 'Fernando Pessoa', tema: 'Coragem', chaveTema: 'coragem' },
    { texto: 'O que não me mata torna-me mais forte.', autor: 'Friedrich Nietzsche', tema: 'Coragem', chaveTema: 'coragem' },
    { texto: 'Uma viagem de mil léguas começa com o primeiro passo.', autor: 'Lao-Tsé', tema: 'Mudança', chaveTema: 'mudanca' },
    { texto: 'A felicidade da tua vida depende da qualidade dos teus pensamentos.', autor: 'Marco Aurélio', tema: 'Sabedoria', chaveTema: 'sabedoria' },
    { texto: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que são difíceis.', autor: 'Séneca', tema: 'Coragem', chaveTema: 'coragem' },
    { texto: 'Saber não é suficiente; temos de aplicar. Querer não é suficiente; temos de fazer.', autor: 'Goethe', tema: 'Foco', chaveTema: 'foco' },
    { texto: 'Nós somos feitos da matéria de que são feitos os sonhos.', autor: 'William Shakespeare', tema: 'Criatividade', chaveTema: 'criatividade' },
    { texto: 'A melhor maneira de prever o futuro é criá-lo.', autor: 'Peter Drucker', tema: 'Criatividade', chaveTema: 'criatividade' },
    { texto: 'A esperança é um sonho acordado.', autor: 'Aristóteles', tema: 'Esperança', chaveTema: 'esperanca' },
    { texto: 'A persistência é o caminho do êxito.', autor: 'Charles Chaplin', tema: 'Foco', chaveTema: 'foco' },
    { texto: 'A coragem não é a ausência do medo, mas o triunfo sobre ele.', autor: 'Nelson Mandela', tema: 'Coragem', chaveTema: 'coragem' },
    { texto: 'O começo é a parte mais importante do trabalho.', autor: 'Platão', tema: 'Foco', chaveTema: 'foco' },
    { texto: 'A mente que se abre a uma nova ideia jamais volta ao seu tamanho original.', autor: 'Albert Einstein', tema: 'Criatividade', chaveTema: 'criatividade' },
    { texto: 'A mudança é a lei da vida.', autor: 'John F. Kennedy', tema: 'Mudança', chaveTema: 'mudanca' },
    { texto: 'O silêncio é uma fonte de grande força.', autor: 'Lao-Tsé', tema: 'Sabedoria', chaveTema: 'sabedoria' },
    { texto: 'A sabedoria começa na reflexão.', autor: 'Sócrates', tema: 'Sabedoria', chaveTema: 'sabedoria' },
    { texto: 'Depois da noite mais escura nasce uma nova manhã.', autor: 'NotaBook', tema: 'Esperança', chaveTema: 'esperanca' }
].map(citacao => ({
    ...citacao,
    imagem: IMAGENS_POR_TEMA[citacao.chaveTema]
})));

export const INSPIRADOR_TEMAS = Object.freeze([
    { valor: 'coragem', nome: 'Coragem' },
    { valor: 'criatividade', nome: 'Criatividade' },
    { valor: 'esperanca', nome: 'Esperança' },
    { valor: 'foco', nome: 'Foco' },
    { valor: 'mudanca', nome: 'Mudança' },
    { valor: 'sabedoria', nome: 'Sabedoria' }
]);

export const INSPIRADOR_AUTORES = Object.freeze(
    [...new Set(CITACOES_INSPIRADOR_FALLBACK.map(citacao => citacao.autor))]
        .sort((a, b) => a.localeCompare(b, 'pt-PT'))
);

export function imagemInspiradorPorTema(tema = '') {
    const chave = String(tema || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return IMAGENS_POR_TEMA[chave] || IMAGENS_POR_TEMA.esperanca;
}
