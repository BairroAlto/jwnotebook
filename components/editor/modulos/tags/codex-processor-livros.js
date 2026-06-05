// components/editor/modulos/tags/codex-processor-livros.js
import { SIGLAS_PUBLICACOES } from '../../../lists/siglas-data.js';

export const LivrosProcessor = {
    gerarObjetos: (dadosBrutos, m, groupId, uid) => {
        const sigla = String(dadosBrutos.sigla || "").toLowerCase();
        const tipoDescricao = SIGLAS_PUBLICACOES[sigla] || "Livro";

        return {
            id: crypto.randomUUID(),
            groupId: groupId,
            userId: uid,
            timestamp: new Date().toISOString(),
            estado: "on",
            favorito: "nao",
            contexto: "livro",
            tipo: tipoDescricao,
            sigla: sigla,
            capitulo: String(dadosBrutos.capitulo || ""),
            titulo: dadosBrutos.titulo || "", // Título do capítulo
            referencia: tipoDescricao, // Nome longo do livro
            oque: m.oque,
            sequencia: m.sequencia,
            // Campos vazios
            mes: "", ano: "", multimediapath: "", artigo: "", paginas: []
        };
    }
};