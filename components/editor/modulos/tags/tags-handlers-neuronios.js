// components/editor/modulos/tags/tags-handlers-neuronios.js
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    updateDoc, 
    addDoc, 
    arrayUnion, 
    arrayRemove, 
    serverTimestamp, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { confirmarRemocaoBrain } from './tags-utils.js';
import { renderizarNeuroniosNoPopup } from './tags-ui.js';

/**
 * ==========================================
 * LÓGICA PARA BÍBLIA (TextosBiblia)
 * ==========================================
 */

/**
 * VINCULAR TEXTO BÍBLICO (NEURÓNIO BÍBLIA)
 */
export async function vincularBiblia(referencia, ctx) {
    const { dbRef, caixaAlvo, persistir, authRef } = ctx;
    
    if (!caixaAlvo.neuroniosBiba) caixaAlvo.neuroniosBiba = [];
    if (caixaAlvo.neuroniosBiba.includes(referencia)) return;

    // 1. Extrair Livro, Capítulo e Versículo da string (ex: "Êxodo 4:3")
    const regex = /(.*)\s(\d+):(\d+)/;
    const match = referencia.match(regex);
    
    if (!match) {
        console.error("Referência bíblica mal formatada:", referencia);
        return;
    }

    const livroIsolado = match[1].trim();
    const capituloIsolado = match[2];
    const versiculoIsolado = match[3];
    const uid = authRef.currentUser.uid;
    const agora = new Date().toISOString();

    console.group("📖 VINCULAR NEURÓNIO BÍBLIA");

    // 2. Gravar na Nota Local
    caixaAlvo.neuroniosBiba.push(referencia);
    await persistir('neuroniosBiba', caixaAlvo.neuroniosBiba);

    // 3. Lógica no Firebase (Coleção TextosBiblia)
    try {
        const q = query(
            collection(dbRef, "TextosBiblia"),
            where("userId", "==", uid),
            where("nome", "==", referencia),
            where("estado", "==", "ativo")
        );

        const snap = await getDocs(q);

        if (snap.empty) {
            // SCENARIO 1: CRIAR DOCUMENTO NOVO
            const idUnicoDoc = crypto.randomUUID();
            
            // Criar quadro inicial de texto (para a aba Puzzle no Brain)
            const quadroInicial = {
                id: crypto.randomUUID(),
                userId: uid,
                timestamp: agora,
                estado: "ativo",
                tipo: "caixatexto",
                protecao: "fechado",
                conteudo: "" 
            };

            await addDoc(collection(dbRef, "TextosBiblia"), {
                id: idUnicoDoc,
                nome: referencia,                // "Êxodo 4:3"
                timestamp: serverTimestamp(),
                userId: uid,
                livro: livroIsolado,             // "Êxodo"
                capitulo: capituloIsolado,       // "4"
                versiculo: versiculoIsolado,     // "3"
                estado: "ativo",
                tipo: "textobiblico",
                // Registar a ferramenta atual para Mirroring no Puzzle
                caixas: [{ id: caixaAlvo.id, timestamp: agora }],
                // Registar no Puzzle os quadros de texto manuais
                Puzzle: { quadros: [quadroInicial] },
                // Marcar como Apto no Dossiê
                Dossie: { Apto: [caixaAlvo.id] }
            });
            console.log("🌟 TEXTOSBIBLIA: Novo registo bíblico e dossiê criados.");

        } else {
            // SCENARIO 2: JÁ EXISTE - ADICIONAR VÍNCULOS AO EXISTENTE
            const docRef = snap.docs[0].ref;
            
            await updateDoc(docRef, {
                // Adiciona ao Puzzle (Ação B)
                "caixas": arrayUnion({ id: caixaAlvo.id, timestamp: agora }),
                // Adiciona como Apto no Dossiê (para aparecer no popup da Mica)
                "Dossie.Apto": arrayUnion(caixaAlvo.id)
            });
            console.log("✅ TEXTOSBIBLIA: Vínculos (Puzzle e Dossiê) adicionados.");
        }
    } catch (e) {
        console.error("Erro ao sincronizar com TextosBiblia:", e);
    }

    console.groupEnd();
    document.getElementById('results-biblia-neuronios').style.display = 'none';
    renderizarNeuroniosNoPopup(caixaAlvo);
}

/**
 * DESVINCULAR TEXTO BÍBLICO (REMOÇÃO BIDIRECIONAL)
 */
export async function desvincularBiblia(referencia, ctx) {
    const { dbRef, caixaAlvo, persistir, authRef } = ctx;

    if (await confirmarRemocaoBrain()) {
        // 1. Limpar Local
        caixaAlvo.neuroniosBiba = (caixaAlvo.neuroniosBiba || []).filter(r => r !== referencia);
        await persistir('neuroniosBiba', caixaAlvo.neuroniosBiba);

        // 2. Limpar Firebase
        try {
            const uid = authRef.currentUser.uid;
            const q = query(collection(dbRef, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", referencia));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                const docRef = snap.docs[0].ref;
                const dados = snap.docs[0].data();

                // Filtrar para remover o ID da caixa das duas localizações
                const novasCaixas = (dados.caixas || []).filter(c => (typeof c === 'string' ? c : c.id) !== caixaAlvo.id);
                const novosAptos = (dados.Dossie?.Apto || []).filter(id => id !== caixaAlvo.id);

                await updateDoc(docRef, { 
                    caixas: novasCaixas,
                    "Dossie.Apto": novosAptos
                });
                console.log("✅ TEXTOSBIBLIA: Vínculos removidos.");
            }
        } catch (e) {
            console.error("Erro ao desvincular:", e);
        }
        renderizarNeuroniosNoPopup(caixaAlvo);
    }
}

/**
 * ==========================================
 * LÓGICA PARA COSMOS (Temas)
 * ==========================================
 */

export async function vincularCosmos(temaIdInterno, temaNome, ctx) {
    const { dbRef, caixaAlvo, persistir } = ctx;
    if (!caixaAlvo.neuroniosCosmos) caixaAlvo.neuroniosCosmos = [];
    if (caixaAlvo.neuroniosCosmos.some(t => t.id === temaIdInterno)) return;

    const agora = new Date().toISOString();

    const novoVinculoLocal = { 
        id: temaIdInterno, 
        nome: temaNome,
        idcosmo: temaIdInterno 
    };
    
    caixaAlvo.neuroniosCosmos.push(novoVinculoLocal);
    await persistir('neuroniosCosmos', caixaAlvo.neuroniosCosmos);

    const q = query(collection(dbRef, "Cosmo"), where("id", "==", temaIdInterno));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
        const temaDocRef = snap.docs[0].ref;
        await updateDoc(temaDocRef, { 
            "Puzzle.caixas": arrayUnion({ id: caixaAlvo.id, timestamp: agora }), 
            "Dossie.Apto": arrayUnion(caixaAlvo.id),
            "caixas": arrayUnion(caixaAlvo.id) 
        });
        console.log("✅ COSMO: Vínculos sincronizados.");
    }
    
    document.getElementById('results-cosmos-neuronios').style.display = 'none';
    renderizarNeuroniosNoPopup(caixaAlvo);
}

export async function desvincularCosmos(temaIdInterno, ctx) {
    const { dbRef, caixaAlvo, persistir } = ctx;
    if (await confirmarRemocaoBrain()) {
        try {
            caixaAlvo.neuroniosCosmos = (caixaAlvo.neuroniosCosmos || []).filter(t => t.id !== temaIdInterno);
            await persistir('neuroniosCosmos', caixaAlvo.neuroniosCosmos);

            const q = query(collection(dbRef, "Cosmo"), where("id", "==", temaIdInterno));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const temaDocRef = snap.docs[0].ref;
                const data = (await getDoc(temaDocRef)).data();
                const updates = {};

                if (data.Puzzle?.caixas) updates["Puzzle.caixas"] = data.Puzzle.caixas.filter(i => (typeof i === 'object' ? i.id : i) !== caixaAlvo.id);
                if (data.Dossie?.Apto) updates["Dossie.Apto"] = data.Dossie.Apto.filter(id => id !== caixaAlvo.id);
                
                // Limpeza profunda nas Micas do Dossiê
                if (data.Dossie?.mica) {
                    const micas = { ...data.Dossie.mica };
                    for (const mId in micas) {
                        if (micas[mId].caixas) micas[mId].caixas = micas[mId].caixas.filter(id => id !== caixaAlvo.id);
                    }
                    updates["Dossie.mica"] = micas;
                }

                await updateDoc(temaDocRef, updates);
                console.log("✅ COSMO: Limpeza profunda concluída.");
            }
            renderizarNeuroniosNoPopup(caixaAlvo);
        } catch (e) {
            console.error("Erro na desvinculação profunda Cosmos:", e);
        }
    }
}