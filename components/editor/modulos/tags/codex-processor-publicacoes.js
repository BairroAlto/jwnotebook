// components/editor/modulos/tags/codex-processor-publicacoes.js
import { SIGLAS_PUBLICACOES } from '../../../lists/siglas-data.js';

const MESES_MAP = { 
    "janeiro": "1", "fevereiro": "2", "março": "3", "marco": "3", "abril": "4", 
    "maio": "5", "junho": "6", "julho": "7", "agosto": "8", "setembro": "9", 
    "outubro": "10", "novembro": "11", "dezembro": "12" 
};

export const PublicacoesProcessor = {
    gerarObjetos: (dadosBrutos, m, groupId, uid) => {
        const rawRef = dadosBrutos.referencia || "";
        const rawRefLower = rawRef.toLowerCase();

        // 1. EXTRAÇÃO DA SIGLA REAL (Início da string: w, mwb, wp...)
        const matchSigla = rawRef.match(/^[a-z]+/i);
        const sigla = matchSigla ? matchSigla[0].toLowerCase() : "w";
        const tipoDescricao = SIGLAS_PUBLICACOES[sigla] || "Publicação";

        // 2. EXTRAÇÃO DO MÊS (Inteligência de Fração Dia/Mês)
        let mesFinal = "";
        
        // A) Tenta encontrar pelo nome do mês escrito (ex: "janeiro")
        for (const [nome, num] of Object.entries(MESES_MAP)) {
            if (rawRefLower.includes(nome)) {
                mesFinal = num;
                break;
            }
        }
        
        // B) Tenta encontrar por fração (Ex: "1/3" ou "15/2")
        // REGRA: O segundo número (após a barra) é o MÊS.
        if (!mesFinal) {
            const matchFracao = rawRefLower.match(/(\d{1,2})\/(\d{1,2})/);
            if (matchFracao && matchFracao[2]) {
                mesFinal = String(parseInt(matchFracao[2])); // Pega o segundo grupo
            }
        }

        // C) Fallback: usa o que veio do nome do ficheiro (ex: "01")
        if (!mesFinal) {
            mesFinal = String(dadosBrutos.mes || "").split('_')[0];
        }

        // 3. EXTRAÇÃO E EXPANSÃO DE PÁGINAS (Ex: "pp. 2-7" -> [2, 3, 4, 5, 6, 7])
        let listaPaginas = [];
        const matchPags = rawRef.match(/(?:pp?|pág|pag)\.?\s*([\d\s,-]+)/i);
        
        if (matchPags) {
            const trechoNumeros = matchPags[1];
            const partes = trechoNumeros.split(/[,;]/);
            
            partes.forEach(p => {
                const range = p.trim().split('-');
                if (range.length === 2) {
                    const inicio = parseInt(range[0]);
                    const fim = parseInt(range[1]);
                    if (!isNaN(inicio) && !isNaN(fim)) {
                        for (let i = inicio; i <= fim; i++) {
                            listaPaginas.push(i);
                        }
                    }
                } else {
                    const n = parseInt(p.trim());
                    if (!isNaN(n)) listaPaginas.push(n);
                }
            });
        }

        // 4. RETORNO DO OBJETO ESTRUTURADO PARA O FIREBASE
        return {
            id: crypto.randomUUID(),
            groupId: groupId,
            userId: uid,
            timestamp: new Date().toISOString(),
            estado: "on",
            favorito: "nao",
            contexto: "publicacao",

            // Identidade
            sigla: sigla,               // ex: "mwb"
            tipo: tipoDescricao,        // ex: "Manual de Atividades"
            referencia: rawRef,         // ex: "mwb26 janeiro pp. 2-16"
            artigo: dadosBrutos.artigo || "",

            // Metadados de Localização
            mes: mesFinal,              // ex: "1"
            ano: String(dadosBrutos.ano || ""),
            paginas: [...new Set(listaPaginas)].sort((a, b) => a - b), // Array [2, 3, 4...]

            // Dados Semânticos da Linha
            oque: m.oque,               // ex: "paragrafo", "subtema"
            sequencia: m.sequencia,     // ex: [1] ou [1, 2]

            // Limpeza de campos de outros especialistas
            capitulo: "",
            multimediapath: "",
            titulo: ""
        };
    }
};