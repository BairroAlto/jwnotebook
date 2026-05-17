// components/biblioteca-brain/biblio-bridge.js
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { abrirEstudoNoBrain } from './biblio-brain-ui.js';

// Importadores de Regras do Codex (Para normalizar os dados)
import { PublicacoesProcessor } from '../editor/modulos/tags/codex-processor-publicacoes.js';
import { LivrosProcessor } from '../editor/modulos/tags/codex-processor-livros.js';
import { MultimediaProcessor } from '../editor/modulos/tags/codex-processor-multimedia.js';

/**
 * FUNÇÃO PRINCIPAL: Processa o clique e abre/cria a Ficha na Biblioteca
 */
export async function estudarReferencia(dados) {
    const db = getFirestore();
    const auth = getAuth();
    
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    console.group(`📖 [BRIDGE] Processando Estudo: ${dados.rawRef}`);

    try {
        let fichaLimpa = {};
        const mapeamentoFake = { 
            oque: dados.oque || "parágrafo", 
            sequencia: [parseInt(dados.sequencia)] 
        };

        const baseParaProcessador = { 
            referencia: dados.rawRef, 
            titulo: dados.tituloConteudo || "",
            sigla: dados.sigla || "",
            capitulo: dados.capitulo || "",
            mes: dados.mes || "",
            ano: dados.ano || "",
            multimediapath: dados.multimediapath || ""
        };

        if (dados.contexto === 'publicacao') {
            fichaLimpa = PublicacoesProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        } else if (dados.contexto === 'livro') {
            fichaLimpa = LivrosProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        } else {
            fichaLimpa = MultimediaProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        }

        const q = query(
            collection(db, "Biblioteca"),
            where("userId", "==", uid),
            where("referencia", "==", fichaLimpa.referencia),
            where("oque", "==", fichaLimpa.oque),
            where("sequencia", "==", fichaLimpa.sequencia[0]),
            where("estado", "==", "ativo")
        );

        const snap = await getDocs(q);
        let docEstudo;

        if (snap.empty) {
            console.log("✨ Criando nova ficha mestre...");
            
            const novaFicha = {
                ...fichaLimpa,
                userId: uid,
                sequencia: fichaLimpa.sequencia[0],
                textoOriginal: dados.textoOriginal || "",
                estado: "ativo",
                timestamp: serverTimestamp(),
                Puzzle: { quadros: [] },
                Fontes: { Links: [], codex: [] },
                Dossie: { mica: {}, Apto: [] },
                anotacoes: ""
            };

            delete novaFicha.groupId;
            delete novaFicha.id; // Removemos o UUID para não colidir com o ID do Firebase

            const docRef = await addDoc(collection(db, "Biblioteca"), novaFicha);
            
            // IMPORTANTE: O ID do objeto deve ser o ID do documento Firestore
            docEstudo = { ...novaFicha, id: docRef.id }; 
        } else {
            console.log("📂 Ficha existente encontrada.");
            const docExistente = snap.docs[0];
            
            // SOLUÇÃO DO ERRO: O ID do Firestore vem por ÚLTIMO para mandar no objeto
            docEstudo = { ...docExistente.data(), id: docExistente.id };
        }

        import('./biblio-brain-ui.js').then(m => m.abrirEstudoNoBrain(docEstudo));

    } catch (error) {
        console.error("❌ [BRIDGE-ERROR]", error);
    } finally {
        console.groupEnd();
    }
}