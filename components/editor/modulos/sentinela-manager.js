// components/editor/modulos/sentinela-manager.js
import { 
    collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, getDoc 
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
                const temReferencia = d.caixas.some(c => 
                    c.referenciacodex && c.referenciacodex[0] === refLimpa
                );
                if (temReferencia) notaExistenteId = docSnap.id;
            }
        });
        return notaExistenteId;
    },

    /**
     * 2. CONFIGURAÇÃO AUTOMÁTICA DO ESTUDO (COM FUSÃO DE DADOS)
     * Adiciona o estudo à nota preservando o conteúdo existente.
     */
    configurarNota: async (json, artigoIdx, ctx) => {
        const { db, auth, notaId } = ctx;
        const artigo = json.artigos[artigoIdx];
        const refArtigoLimpa = limparRef(artigo.referencia);
        const uid = auth.currentUser.uid;

        SentinelaLoader.show(artigo.titulo);

        try {
            // 🚀 PASSO A: LER CONTEÚDO ATUAL DA NOTA PARA PRESERVAR
            const notaRef = doc(db, "Local", notaId);
            const snapNota = await getDoc(notaRef);
            const caixasAnteriores = snapNota.exists() ? (snapNota.data().caixas || []) : [];

            // B) Atualizar o nome da nota para o título do artigo
            await updateDoc(notaRef, { nome: artigo.titulo });

            const novasCaixasEstudo = [];
            // A ordem começa depois do último bloco existente
            let contadorOrdem = caixasAnteriores.length + 1; 

            // C) Filtrar apenas Perguntas e Resumos
            const blocosExpostos = artigo.conteudo.filter(b => b.tipo === "pergunta" || b.tipo === "resumo");

            for (const bloco of blocosExpostos) {
                // Sequência com prefixo "R" para resumos
                const seqString = (bloco.tipo === "pergunta") ? String(bloco.numero_ref) : `R${bloco.numero_ref}`;

                // D) SINCRONIZAÇÃO COM BIBLIOTECA
                const qBiba = query(collection(db, "Biblioteca"), 
                    where("userId", "==", uid),
                    where("referencia", "==", refArtigoLimpa),
                    where("sequencia", "==", seqString)
                );

                const snapBiba = await getDocs(qBiba);

                if (snapBiba.empty) {
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
                            tipo: "questao", 
                            titulo: bloco.texto, 
                            conteudo: "", 
                            estado: "on", 
                            foco: (bloco.tipo === "pergunta" ? "original" : "revisao") 
                        }
                    });
                }

                // E) GERAR A CAIXA PARA A NOTA LOCAL
                novasCaixasEstudo.push({
                    id: crypto.randomUUID(),
                    tipo: "questao",
                    titulo: bloco.texto,
                    conteudo: "", 
                    foco: (bloco.tipo === "pergunta" ? "original" : "revisao"),
                    estado: "on",
                    ordem: contadorOrdem++,
                    referenciacodex: [refArtigoLimpa, seqString], 
                    timestamp: new Date().toISOString(),
                    protecao: "fechado"
                });
            }

            // 🚀 PASSO F: FUNDIR OS ARRAYS (DADOS ANTIGOS + NOVOS)
            const listaFinal = [...caixasAnteriores, ...novasCaixasEstudo];

            // G) Gravar a fusão final no Firestore
            await updateDoc(notaRef, { caixas: listaFinal });
            
            SentinelaLoader.hide();
            location.reload(); 

        } catch (error) {
            console.error("❌ [SENTINELA] Erro ao configurar estudo:", error);
            SentinelaLoader.hide();
            alert("Erro ao gerar o estudo.");
        }
    },

    /**
     * 3. SINCRONIZAÇÃO LIVE: EDITOR -> BIBLIOTECA
     */
    sincronizarParaBiblioteca: async (caixa, db, uid) => {
        if (!caixa.referenciacodex) return;
        
        const [ref, seq] = caixa.referenciacodex;

        const q = query(collection(db, "Biblioteca"), 
            where("userId", "==", uid),
            where("referencia", "==", ref),
            where("sequencia", "==", String(seq))
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
            await updateDoc(snap.docs[0].ref, {
                "anotacaoEspecial.conteudo": caixa.conteudo || "",
                "anotacaoEspecial.titulo": caixa.titulo || "",
                "anotacaoEspecial.foco": caixa.foco || "original",
                "anotacaoEspecial.tipo": caixa.tipo || "questao",
                "anotacaoEspecial.destaques": caixa.destaques || "",
                "timestampUpdate": serverTimestamp()
            });
        }
    }
};
