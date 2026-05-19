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
    // Limpar espaços e garantir que a sequência é tratada como String
    const refLimpa = String(dados.rawRef || "").trim().replace(/\s+/g, ' ');
    const seqLimpa = String(dados.sequencia || "").trim();
    const tituloLimpo = String(dados.tituloConteudo || "").trim();

    console.log(`%cBridge: 🌉 Abrindo Estudo: ${refLimpa} | §${seqLimpa}`, "color: #818cf8; font-weight: bold;");

    try {
        // 2. GERAR METADADOS TÉCNICOS VIA PROCESSADORES CODEX
        const mapeamentoFake = { 
            oque: dados.oque || "parágrafo", 
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
        const q = query(
            collection(db, "Biblioteca"),
            where("userId", "==", uid),
            where("referencia", "==", refLimpa),
            where("titulo", "==", tituloLimpo),
            where("sequencia", "==", seqLimpa),
            where("estado", "==", "on")
        );

        const snap = await getDocs(q);
        let estudoFinal;

        if (snap.empty) {
            // ========================================================
            // ✨ CENÁRIO: CRIANDO FICHA MESTRE NOVA (VAZIA)
            // ========================================================
            console.log("%c✨ Bridge: Criando ficha mestre sem caixa fixa (Mostra Seletor).", "color: #34d399;");
            
            const { id, groupId, ...dadosPuros } = fichaTecnica;

            const novaFicha = {
                ...dadosPuros,
                referencia: refLimpa,
                sequencia: seqLimpa,
                titulo: tituloLimpo,
                userId: uid,
                textoOriginal: dados.textoOriginal || "",
                estado: "on",
                timestamp: serverTimestamp(),
                // Inicialização das estruturas do Brain
                Puzzle: { quadros: [] },
                Fontes: { Links: [], codex: [] },
                Dossie: { mica: {}, Apto: [] },
                // 🚀 O SEGREDO: Definir como null para o biblio-tabs.js mostrar as 3 opções de escolha
                anotacaoEspecial: null 
            };

            const docRef = await addDoc(collection(db, "Biblioteca"), novaFicha);
            estudoFinal = { ...novaFicha, id: docRef.id }; 

        } else {
            // ========================================================
            // 📂 CENÁRIO: CARREGAR FICHA EXISTENTE
            // ========================================================
            console.log(`%c📂 Bridge: Ficha existente localizada (ID: ${snap.docs[0].id})`, "color: #fbbf24;");
            const docExistente = snap.docs[0];
            estudoFinal = { ...docExistente.data(), id: docExistente.id };
        }

        // 4. ABRIR INTERFACE NO BRAIN
        import('./biblio-brain-ui.js').then(m => m.abrirEstudoNoBrain(estudoFinal));

    } catch (error) {
        console.error("❌ [BRIDGE-ERROR] Falha na transição:", error);
    }
}