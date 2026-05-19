// components/editor/modulos/sentinela-manager.js
import { 
    collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { SentinelaLoader } from '../../ui/loading-sentinela.js';

// Auxiliar para limpar espaços e garantir match exato de strings
const limparRef = (txt) => String(txt).trim().replace(/\s+/g, ' ');

export const SentinelaManager = {

    /**
     * 1. VERIFICAÇÃO DE EXISTÊNCIA
     * Evita criar notas duplicadas para o mesmo estudo.
     */
    verificarSeJaExiste: async (db, uid, referenciaArtigo) => {
        const refLimpa = limparRef(referenciaArtigo);
        const q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "on"));
        const snap = await getDocs(q);
        
        let notaExistenteId = null;
        snap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.caixas && Array.isArray(d.caixas)) {
                // Se alguma caixa desta nota já referencia este artigo, ela é a nota de estudo
                const temReferencia = d.caixas.some(c => 
                    c.referenciacodex && c.referenciacodex[0] === refLimpa
                );
                if (temReferencia) notaExistenteId = docSnap.id;
            }
        });
        return notaExistenteId;
    },

    /**
     * 2. CONFIGURAÇÃO AUTOMÁTICA DO ESTUDO
     * Gera as caixas na nota local e as fichas mestre na Biblioteca.
     */
    configurarNota: async (json, artigoIdx, ctx) => {
        const { db, auth, notaId } = ctx;
        const artigo = json.artigos[artigoIdx];
        const refArtigoLimpa = limparRef(artigo.referencia);
        const uid = auth.currentUser.uid;

        // Mostrar animação de carregamento
        SentinelaLoader.show(artigo.titulo);

        try {
            // A) Atualizar o nome da nota local para o título do artigo
            await updateDoc(doc(db, "Local", notaId), { nome: artigo.titulo });

            const novasCaixas = [];
            let contadorOrdem = 1;

            // B) REGRA DE OURO: Filtrar apenas Perguntas e Resumos para a nota e para a Biblioteca
            const blocosExpostos = artigo.conteudo.filter(b => b.tipo === "pergunta" || b.tipo === "resumo");

            for (const bloco of blocosExpostos) {
                // Definir a sequência (ID único dentro do artigo)
                // Perguntas usam o número do parágrafo; Resumos usam R1, R2...
                const seqString = (bloco.tipo === "pergunta") ? String(bloco.numero_ref) : `R${contadorOrdem}`;

                // C) SINCRONIZAÇÃO COM FIREBASE -> BIBLIOTECA
                // Procuramos se já existe uma ficha mestre para este parágrafo específico
                const qBiba = query(collection(db, "Biblioteca"), 
                    where("userId", "==", uid),
                    where("referencia", "==", refArtigoLimpa),
                    where("sequencia", "==", seqString)
                );

                const snapBiba = await getDocs(qBiba);
                let dadosBiba = null;

                if (!snapBiba.empty) {
                    // Se já existir na Biblioteca, reaproveitamos os dados (conteúdo, foco, etc)
                    dadosBiba = snapBiba.docs[0].data().anotacaoEspecial;
                } else {
                    // Se não existir, criamos a Ficha Mestre APENAS para este bloco
                    await addDoc(collection(db, "Biblioteca"), {
                        userId: uid,
                        referencia: refArtigoLimpa,
                        sequencia: seqString,
                        titulo: artigo.titulo,
                        oque: bloco.tipo,
                        estado: "on",
                        timestamp: serverTimestamp(),
                        anotacaoEspecial: { 
                            id: crypto.randomUUID(), 
                            tipo: (bloco.tipo === "pergunta" ? "questao" : "contentor"), 
                            titulo: bloco.texto, // O texto original do JSON serve de título à caixa
                            conteudo: "", 
                            estado: "on", 
                            foco: (bloco.tipo === "pergunta" ? "original" : "revisao") 
                        }
                    });
                }

                // D) GERAR A CAIXA PARA A NOTA LOCAL
                novasCaixas.push({
                    id: crypto.randomUUID(),
                    tipo: (bloco.tipo === "pergunta" ? "questao" : "contentor"),
                    titulo: bloco.texto,
                    conteudo: dadosBiba?.conteudo || "", // Puxa o que já escreveste antes, se existir
                    foco: dadosBiba?.foco || (bloco.tipo === "pergunta" ? "original" : "revisao"),
                    estado: "on",
                    ordem: contadorOrdem++,
                    // CHAVE DE MATCH: [Referência do Artigo, Número/Sequência do Bloco]
                    referenciacodex: [refArtigoLimpa, seqString], 
                    timestamp: new Date().toISOString()
                });
            }

            // E) Persistir as caixas geradas na nota local
            await updateDoc(doc(db, "Local", notaId), { caixas: novasCaixas });
            
            SentinelaLoader.hide();
            location.reload(); // Recarregar para aplicar as proteções de UI do modo Sentinela

        } catch (error) {
            console.error("❌ [SENTINELA] Erro ao configurar estudo:", error);
            SentinelaLoader.hide();
            alert("Erro ao gerar o estudo. Verifica a tua ligação.");
        }
    },

    /**
     * 3. SINCRONIZAÇÃO LIVE: EDITOR -> BIBLIOTECA
     * Atualiza a ficha mestre sempre que escreves na nota em modo Sentinela.
     */
    sincronizarParaBiblioteca: async (caixa, db, uid) => {
        if (!caixa.referenciacodex) return;
        
        const [ref, seq] = caixa.referenciacodex;

        const q = query(collection(db, "Biblioteca"), 
            where("userId", "==", uid),
            where("referencia", "==", limparRef(ref)),
            where("sequencia", "==", String(seq))
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
            // Atualiza o documento mestre na Biblioteca com o novo conteúdo e estilo
            await updateDoc(snap.docs[0].ref, {
                "anotacaoEspecial.conteudo": caixa.conteudo,
                "anotacaoEspecial.titulo": caixa.titulo,
                "anotacaoEspecial.foco": caixa.foco,
                "anotacaoEspecial.tipo": caixa.tipo,
                "anotacaoEspecial.estado": caixa.estado,
                "timestampUpdate": serverTimestamp()
            });
            console.log(`📡 [SYNC] Biblioteca atualizada: §${seq}`);
        }
    }
};