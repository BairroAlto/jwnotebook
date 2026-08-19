import { FERRAMENTAS_REGISTO } from '../constants/ferramentas.js';

export const FERRAMENTAS_LOJA = Object.freeze(
    FERRAMENTAS_REGISTO
        .filter(ferramenta => ferramenta.disponivelNaLoja)
        .map(({ id, featureKey, nome, descricao, icon, cor }) => Object.freeze({
            id,
            featureKey,
            nome,
            descricao,
            icon,
            corInterface: cor
        }))
);
