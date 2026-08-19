export const FERRAMENTAS_MANUAL = Object.freeze([
    {
        id: 'contentor', nome: 'Contentor', icone: 'fa-solid fa-box', cor: '#ea580c', grupo: 'Texto',
        descricao: 'Um bloco de conteúdo livre, sem campo de título. É útil para notas, factos e apontamentos rápidos.',
        nota: 'A animação mostra escrita, crescimento automático e um destaque de foco.'
    },
    {
        id: 'subnota', nome: 'SubNota', icone: 'fa-solid fa-box', cor: '#3b82f6', grupo: 'Texto',
        descricao: 'Uma nota azul com título e conteúdo, adequada para desenvolver uma ideia dentro da nota principal.',
        nota: 'Título e corpo são campos separados e ambos crescem enquanto escreves.'
    },
    {
        id: 'questao', nome: 'Questão', icone: 'fa-solid fa-box', cor: '#10b981', grupo: 'Texto',
        descricao: 'Uma caixa verde para formular uma pergunta, hipótese, paradoxo ou dilema.',
        nota: 'O exemplo separa a pergunta no título do desenvolvimento no conteúdo.'
    },
    {
        id: 'raciocinio', nome: 'Raciocínio', icone: 'fa-solid fa-box', cor: '#f59e0b', grupo: 'Texto',
        descricao: 'Uma caixa amarela para construir uma linha de pensamento, com título e conteúdo.',
        nota: 'O número é automático e acompanha a posição dos raciocínios na nota.'
    },
    {
        id: 'elevador', nome: 'Elevador', icone: 'fa-solid fa-elevator', cor: '#ef4444', grupo: 'Estrutura',
        descricao: 'Uma estrutura hierárquica com barras pai, filhos e ligações para referências.',
        nota: 'A animação demonstra a expansão de um pai, um filho e duas ligações.'
    },
    {
        id: 'cartaovisita', nome: 'Cartão Visita', icone: 'fa-solid fa-address-card', cor: '#d4af37', grupo: 'Misto',
        descricao: 'Um cartão com imagem, título e descrição para apresentar uma pessoa, lugar ou tema.',
        nota: 'A imagem é ilustrada localmente para manter o Manual leve e sem assets externos.'
    },
    {
        id: 'citacaobiblica', nome: 'Citação Bíblica', icone: 'fa-solid fa-book-open', cor: '#94a3b8', grupo: 'Fontes',
        descricao: 'Anexa textos bíblicos escolhidos através da lupa, sem título ou conteúdo editável no bloco.',
        nota: 'A animação mostra a seleção e a chegada de uma referência com o texto.'
    },
    {
        id: 'webcard', nome: 'WebCard', icone: 'fa-solid fa-globe', cor: '#8b5cf6', grupo: 'Fontes',
        descricao: 'Recebe URLs e transforma os seus metadados em cartões visuais.',
        nota: 'Primeiro aparece o estado de carregamento; depois surgem título, site e imagem.'
    },
    {
        id: 'galeria', nome: 'Imagens', icone: 'fa-solid fa-panorama', cor: '#ec4899', grupo: 'Fontes',
        descricao: 'Anexa imagens e apresenta-as numa grelha com vários tamanhos.',
        nota: 'As imagens aparecem em sequência e a grelha muda de escala.'
    },
    {
        id: 'sumariar', nome: 'Sumariar', icone: 'fa-brands fa-mailchimp', cor: '#a855f7', grupo: 'Inteligência',
        descricao: 'Gera um resumo da nota através do configurador de sumarização.',
        nota: 'Está disponível no selector de ferramentas; a lista de Modelos ainda não o inclui.'
    },
    {
        id: 'firmamento', nome: 'Firmamento', icone: 'fa-solid fa-aquarius', cor: '#d4af37', grupo: 'Texto',
        descricao: 'Um bloco de subtópico visual, apenas com conteúdo e uma paleta própria.',
        nota: 'Não tem título: o exemplo mostra linhas, cor de fundo, cor de texto e destaque.'
    },
    {
        id: 'bairro', nome: 'Bairro Tarefas', icone: 'fa-solid fa-city', cor: '#c084fc', grupo: 'Estrutura',
        descricao: 'Organiza grupos e tarefas com marcação de conclusão e ocultação de tarefas terminadas.',
        nota: 'A tarefa concluída fica marcada antes de desaparecer como acontece no Bairro configurado.'
    }
]);

export const MANUAL_CATEGORIAS = Object.freeze([
    { id: 'caixas', nome: 'Caixas conectoras' },
    { id: 'ligacao', nome: 'Centro de Conexões' },
    { id: 'personalizacao', nome: 'Central de personalização' }
]);
