// components/editor/modulos/tags/codex-processor-multimedia.js
import { SIGLAS_PUBLICACOES } from '../../../lists/siglas-data.js';

export const MultimediaProcessor = {
    /**
     * GERA O OBJETO DE GRAVAÇÃO PARA CONTEÚDO MULTIMÉDIA (VÍDEOS)
     */
    gerarObjetos: (dadosBrutos, m, groupId, uid) => {
        const ref = dadosBrutos.referencia || "";
        
        // 1. EXTRAÇÃO DA SIGLA (jwb, jwbvod, etc.)
        const matchSigla = ref.match(/^[a-z]+/i);
        const sigla = matchSigla ? matchSigla[0].toLowerCase() : "jwbvod";
        const tipoDescricao = SIGLAS_PUBLICACOES[sigla] || "Vídeo";

        // 2. CAPTURA DO ID DO VÍDEO (multimediapath)
        // O explorador envia o nome do ficheiro (ex: "42") no campo 'mes'
        const idVideoReal = String(dadosBrutos.mes || "");

        return {
            id: crypto.randomUUID(),
            groupId: groupId,
            userId: uid,
            timestamp: new Date().toISOString(),
            estado: "ativo",
            favorito: "nao",
            contexto: "multimedia",

            // Identidade
            sigla: sigla,
            tipo: tipoDescricao,
            referencia: ref,
            titulo: dadosBrutos.titulo || "", // Título do Vídeo (ex: Robert Ciranko...)
            
            // Metadados de Localização
            multimediapath: String(dadosBrutos.multimediapath || ""), 
            ano: String(dadosBrutos.ano || ""),
            mes: "",                        // Limpo para não confundir com revistas
            paginas: [],                    // Vídeos não têm páginas
            
            // Dados Semânticos da Linha
            oque: m.oque,                   // ex: "discurso", "video", "musical"
            sequencia: m.sequencia,         // ex: [1]

            // Limpeza de campos de outros especialistas
            artigo: "",
            capitulo: ""
        };
    }
};