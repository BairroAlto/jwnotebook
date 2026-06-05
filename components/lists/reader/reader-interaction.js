// components/lists/reader/reader-interaction.js
export const ReaderInteraction = {
    handleLink: (bloco, obj, dataPai) => {
        let refParaProcessar = "";
        let contextoReal = "publicacao";

        if (dataPai.artigos) {
            refParaProcessar = obj.referencia;
        } else if (dataPai.capitulos) {
            refParaProcessar = `${dataPai.titulo} cap. ${obj.capitulo}`;
            contextoReal = "livro";
        } else if (dataPai.video) {
            refParaProcessar = dataPai.video.referencia;
            contextoReal = "multimedia";
        }

        // 🚀 A CORREÇÃO MESTRE:
        // No JSON o resumo é "1", mas na Biblioteca é "R1". 
        // Precisamos de normalizar aqui para que a busca no Firebase coincida.
        let seqFinal = String(bloco.numero_ref || "0");

        if (bloco.tipo === "resumo") {
            // Se o bloco é resumo e ainda não tem o prefixo R, adicionamos.
            if (!seqFinal.startsWith("R")) {
                seqFinal = "R" + seqFinal;
            }
        }

        console.log(`%c🎯 [READER] Traduzindo para busca: ${bloco.tipo} §${seqFinal}`, "color: #34d399; font-weight: bold;");

        import('../../biblioteca-brain/biblio-bridge.js').then(m => {
            m.estudarReferencia({
                rawRef: refParaProcessar,
                contexto: contextoReal,
                oque: bloco.tipo || "paragrafo",
                sequencia: seqFinal, // Agora envia "R1", "R2", etc.
                textoOriginal: bloco.texto,
                tituloConteudo: obj.titulo || dataPai.video?.titulo || ""
            });
        });
    }
};