// js/utils.js

/**
 * Limpa o HTML de código malicioso, mantendo os atributos necessários para a app.
 * @param {string} dirtyContent - O HTML vindo da base de dados.
 * @returns {string} - HTML seguro para inserir no ecrã.
 */
export function sanitizeHTML(dirtyContent) {
    // Verifica se a biblioteca foi carregada
    if (typeof DOMPurify === 'undefined') {
        console.error("DOMPurify não foi carregado! A retornar conteúdo original (PERIGO).");
        return dirtyContent;
    }

    return DOMPurify.sanitize(dirtyContent, {
        // Permitir tags que normalmente seriam removidas mas que a tua app usa
        ADD_TAGS: ['details', 'summary', 'iframe'], 
        
        // Permitir atributos específicos que a tua lógica de JS procura
        ADD_ATTR: [
            'contenteditable', 
            'target', 
            'data-id', 
            'data-type', 
            'data-note-id', 
            'data-parent-id', 
            'data-highlight', 
            'data-topics', 
            'data-shared', 
            'data-box-links', 
            'data-entity-type', 
            'data-entity-name', 
            'data-anexo-id',
            'data-original-url',
            'draggable',
            'spellcheck'
        ],
        
        // Garantir que links abrem noutra aba (opcional, mas boa segurança)
        // ADD_ATTR: ['target'] já permite, mas podes forçar rel="noopener" se quiseres.
    });
}

/**
 * Função para limitar a frequência com que uma função é executada (útil para pesquisa/scroll)
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Remove acentos de uma string (ex: "João" -> "Joao")
 */
export function removeAccents(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Escapa caracteres especiais para usar numa Expressão Regular.
 * Ex: converte "." para "\."
 */

export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}
