// components/biblioteca-brain/biblio-bridge.js
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { abrirEstudoNoBrain } from './biblio-brain-ui.js';

// Importadores de Regras do Codex para normalização de dados técnicos
import { PublicacoesProcessor } from '../editor/modulos/tags/codex-processor-publicacoes.js';
import { LivrosProcessor } from '../editor/modulos/tags/codex-processor-livros.js';
import { MultimediaProcessor } from '../editor/modulos/tags/codex-processor-multimedia.js';

/**
 * MOTOR DE SALTO PARA A BIBLIOTECA (BRIDGE)
 * Localiza ou cria a ficha mestre baseada no clique do utilizador.
 */
export async function estudarReferencia(dados) {
    const db = getFirestore();
    const auth = getAuth();
    
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // 1. NORMALIZAÇÃO DE DADOS
    const refLimpa = String(dados.rawRef || "").trim().replace(/\s+/g, ' ');
    const seqLimpa = String(dados.sequencia || "").trim();
    const oqueLimpo = String(dados.oque || "parágrafo");
    const tituloLimpo = String(dados.tituloConteudo || "").trim();

    console.log(`%cBridge: 🌉 Sintonizando: ${refLimpa} | §${seqLimpa} (${oqueLimpo})`, "color: #818cf8; font-weight: bold;");

    try {
        // 2. GERAR METADADOS TÉCNICOS VIA PROCESSADORES CODEX
        const mapeamentoFake = { 
            oque: oqueLimpo, 
            sequencia: [seqLimpa] 
        };

        const baseParaProcessador = { 
            referencia: refLimpa, 
            titulo: tituloLimpo,
            sigla: dados.sigla || "",
            capitulo: dados.capitulo || "",
            mes: dados.mes || "",
            ano: dados.ano || "",
            multimediapath: dados.multimediapath || ""
        };

        let fichaTecnica = {};
        if (dados.contexto === 'publicacao') {
            fichaTecnica = PublicacoesProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        } else if (dados.contexto === 'livro') {
            fichaTecnica = LivrosProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        } else {
            fichaTecnica = MultimediaProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        }

        // 3. CONSULTA DE PRECISÃO NO FIRESTORE
        // 🚀 CORREÇÃO: Removemos o "titulo" da query para evitar falhas de match semântico.
        // O parágrafo é identificado unicamente pela referência + sequência + tipo.
        const q = query(
            collection(db, "Biblioteca"),
            where("userId", "==", uid),
            where("referencia", "==", refLimpa),
            where("sequencia", "==", seqLimpa),
            where("oque", "==", oqueLimpo),
            where("estado", "==", "on")
        );

        const snap = await getDocs(q);
        let estudoFinal;

        if (snap.empty) {
            // ========================================================
            // ✨ CENÁRIO: CRIANDO FICHA MESTRE NOVA (INÉDITA)
            // ========================================================
            console.log("%c✨ Bridge: Criando ficha mestre inédita.", "color: #34d399;");
            
            const { id, groupId, ...dadosPuros } = fichaTecnica;

            const novaFicha = {
                ...dadosPuros,
                referencia: refLimpa,
                sequencia: seqLimpa,
                oque: oqueLimpo,
                titulo: tituloLimpo, // Gravamos o título do artigo para organização
                userId: uid,
                textoOriginal: dados.textoOriginal || "",
                estado: "on",
                timestamp: serverTimestamp(),
                // Inicialização das estruturas do Brain
                Puzzle: { quadros: [] },
                Fontes: { Links: [], codex: [] },
                Dossie: { mica: {}, Apto: [] },
                // Define como null para o biblio-tabs.js mostrar o seletor de criação
                anotacaoEspecial: null
            };

            const docRef = await addDoc(collection(db, "Biblioteca"), novaFicha);
            estudoFinal = { ...novaFicha, id: docRef.id }; 

        } else {
            // ========================================================
            // 📂 CENÁRIO: CARREGAR FICHA EXISTENTE
            // ========================================================
            const docExistente = snap.docs[0];
            console.log(`%c📂 Bridge: Ficha localizada (ID: ${docExistente.id})`, "color: #fbbf24;");
            estudoFinal = { ...docExistente.data(), id: docExistente.id };
        }

        // 4. ABRIR INTERFACE NO BRAIN
        import('./biblio-brain-ui.js').then(m => m.abrirEstudoNoBrain(estudoFinal));

    } catch (error) {
        console.error("❌ [BRIDGE-ERROR] Falha na transição:", error);
    }
}