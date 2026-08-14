/**
 * Abas do Painel de Utilizador que podem ser condicionadas pelo plano.
 * A aba Administração é deliberadamente omitida: é exclusiva do administrador.
 */
export const PAINEL_UTILIZADOR_ABAS = [
    {
        key: 'painel_geral',
        target: 'set-geral',
        label: 'Geral',
        description: 'Perfil, avatar e identidade visual.'
    },
    {
        key: 'painel_planos',
        target: 'set-planos',
        label: 'Planos',
        description: 'Consulta e gestão dos planos da conta.'
    },
    {
        key: 'painel_loja',
        target: 'set-loja',
        label: 'Loja',
        description: 'Ferramentas adicionais para instalar na nota.'
    },
    {
        key: 'painel_amigos',
        target: 'set-amigos',
        label: 'Amigos',
        description: 'Convites e gestão de amizades.'
    },
    {
        key: 'painel_definicoes',
        target: 'set-fontes',
        label: 'Definições',
        description: 'Preferências da aplicação e da interface.'
    },
    {
        key: 'painel_pesquisa',
        target: 'set-search',
        label: 'Pesquisa',
        description: 'Definições da procura inteligente.'
    },
    {
        key: 'painel_manual',
        buttonId: 'btn-abrir-manual',
        label: 'Manual',
        description: 'Manual de utilização do NotaBook.'
    },
    {
        key: 'painel_fusiveis',
        target: 'set-fuseis',
        label: 'Fusíveis',
        description: 'Interruptores das funcionalidades de Lists.'
    },
    {
        key: 'painel_reciclagem',
        target: 'set-reciclagem',
        label: 'Reciclagem',
        description: 'Recuperação e eliminação de conteúdos.'
    },
    {
        key: 'painel_sair',
        target: 'set-logout',
        label: 'Sair',
        description: 'Terminar a sessão da conta.'
    }
];
