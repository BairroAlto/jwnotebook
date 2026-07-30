// components/editor/modulos/tags/tags-handlers-codex.js
import { MultimediaProcessor } from './codex-processor-multimedia.js';
import { LivrosProcessor } from './codex-processor-livros.js';
import { PublicacoesProcessor } from './codex-processor-publicacoes.js';
import { renderizarHub } from './tags-ui.js';

import { collection, query, where, getDocs, addDoc, updateDoc, arrayUnion, serverTimestamp, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * 1. ADICIONAR AO CODEX (ORQUESTRADOR)
 */
export async function adicionarItensAoCodex(dadosVindosDoBrowser, ctx) {
    const { caixaAlvo, persistir } = ctx;
    const contexto = dadosVindosDoBrowser.contexto; 
    const uid = ctx.authRef.currentUser.uid;
    const groupId = crypto.randomUUID();

    let especialista;
    if (contexto === 'multimedia') especialista = MultimediaProcessor;
    else if (contexto === 'livro') especialista = LivrosProcessor;
    else especialista = PublicacoesProcessor;

    const novosItens = dadosVindosDoBrowser.mapeamento.map(m => 
        especialista.gerarObjetos(dadosVindosDoBrowser, m, groupId, uid)
    );

    caixaAlvo.codex = [...(caixaAlvo.codex || []), ...novosItens];
    await persistir('codex', caixaAlvo.codex);
    
    for (const item of novosItens) {
        await executarSincronizacaoForcada(item, ctx);
    }

    renderizarCards(ctx);
    renderizarHub(caixaAlvo);
}

/**
 * 2. RENDERIZAR CARDS NO POPUP
 */
export function renderizarCards(ctx) {
    const { caixaAlvo } = ctx;
    const container = document.getElementById('container-codex-cards');
    if (!container) return;

    // Suporte para estrutura antiga e nova (flat)
    const cardsAtivos = (caixaAlvo.codex || []).flat().filter(c => c && c.estado === "on");

    if (cardsAtivos.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.3; font-size:12px;">Clica no + para mapear.</div>`;
        return;
    }

    container.innerHTML = cardsAtivos.map(card => {
        const strSeqs = Array.isArray(card.sequencia) ? card.sequencia.join(', ') : card.sequencia;
        const strPags = Array.isArray(card.paginas) ? card.paginas.join(', ') : (card.paginas || "");
        
        // --- LOGICA DINÂMICA POR CONTEXTO ---
        const isVideo = card.contexto === 'multimedia';
        
        // 1. Definições para a Coluna da Direita (Mês vs ID Vídeo)
        const labelDireita = isVideo ? 'ID VÍDEO' : 'MÊS';
        const valorDireita = isVideo ? (card.multimediapath || "") : (card.mes || "");
        const campoDireita = isVideo ? 'multimediapath' : 'mes';

        // 2. Definições para a Coluna Central (Páginas vs Tempo)
        const labelCentro = isVideo ? 'Tempo' : 'Página(s)';
        const valorCentro = isVideo ? (card.tempo || "") : strPags;
        const placeholderCentro = isVideo ? '00:00:00' : 'Ex: 8-13';
        const handlerCentro = isVideo ? 'updateCodexFieldManual' : 'updateCodexListaManual';
        const onInputCentro = isVideo ? `window.formatarInputTempo(this); window.updateCodexFieldManual('${card.id}', 'tempo', this.value)` : `window.updateCodexListaManual('${card.id}', 'paginas', this.value)`;

        return `
        <div class="codex-card-completo" id="card-${card.id}" style="border-left: 3px solid var(--primary); margin-bottom:15px; position:relative;">
            
            <!-- BOTÃO REMOVER -->
            <button type="button" class="btn-remover-card tags-remove-btn" data-tags-remove="codex" data-remove-id="${encodeURIComponent(String(card.id || ''))}" aria-label="Remover card do codex">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <!-- CABEÇALHO DO ITEM -->
            <div style="font-size: 9px; color: var(--primary); text-transform: uppercase; font-weight: 800; margin-bottom: 8px;">
                <i class="fa-solid fa-bookmark"></i> ${card.tipo} - ${card.oque}
            </div>

            <!-- LINHA 1: REFERÊNCIA E LUPA -->
            <div class="codex-top-inline-row">
                <div class="codex-search-wrapper" style="flex:1;">
                    <input type="text" value="${card.referencia}" readonly style="background:rgba(0,0,0,0.2); font-size:11px;">
                    <button class="btn-trigger-browser" onclick="window.triggerCodexBrowser('${card.id}')">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                </div>
            </div>

            <!-- LINHA 2: GRELHA TÉCNICA ADAPTATIVA -->
            <div class="codex-bottom-grid" style="margin-top:10px;">
                
                <!-- COLUNA 1: SEQUÊNCIA -->
                <div class="field-column">
                    <label>Seq. (${card.oque})</label>
                    <input type="text" value="${strSeqs}" oninput="window.updateCodexListaManual('${card.id}', 'sequencia', this.value)">
                </div>

                <!-- COLUNA 2: PÁGINAS OU TEMPO (DINÂMICO) -->
                <div class="field-column">
                    <label>${labelCentro}</label>
                    <input type="text" 
                       value="${valorCentro}" 
                       placeholder="${placeholderCentro}"
                       oninput="${onInputCentro}">
                </div>

                <!-- COLUNA 3: MÊS/ID E ANO -->
                <div class="field-column">
                    <label>${labelDireita} / ANO</label>
                    <div style="display:flex; gap:2px;">
                        <input type="text" value="${valorDireita}" style="width:35px; text-align:center;" 
                               oninput="window.updateCodexFieldManual('${card.id}', '${campoDireita}', this.value)">
                        <input type="text" value="${card.ano}" 
                               oninput="window.updateCodexFieldManual('${card.id}', 'ano', this.value)">
                    </div>
                </div>

            </div>
        </div>`;
    }).join('');
}

/**
 * 3. SINCRONIZAÇÃO BIBLIOTECA
 */
export async function executarSincronizacaoForcada(subDoc, ctx) {
    const { dbRef, authRef, notaMaeId, caixaAlvo } = ctx;
    if (!authRef.currentUser) return;
    
    const uid = authRef.currentUser.uid;
    const blockId = caixaAlvo.id;
    const seqs = Array.isArray(subDoc.sequencia) ? subDoc.sequencia : [subDoc.sequencia];

    console.group(`📡 [BIBLIA-SYNC] ${subDoc.referencia}`);

    for (const s of seqs) {
        const numSeq = parseInt(String(s).replace(/[^0-9]/g, ''));
        if (isNaN(numSeq)) continue;

        const q = query(
            collection(dbRef, "Biblioteca"),
            where("userId", "==", uid),
            where("referencia", "==", subDoc.referencia),
            where("oque", "==", subDoc.oque),
            where("sequencia", "==", numSeq)
        );

        try {
            const snap = await getDocs(q);
            const vinculo = { caixaId: subDoc.id, notaId: notaMaeId };

            const dadosParaGravar = {
                userId: uid,
                referencia: subDoc.referencia || "",
                sigla: subDoc.sigla || "",
                tipo: subDoc.tipo || "",
                contexto: subDoc.contexto || "",
                oque: subDoc.oque || "",
                sequencia: numSeq,
                paginas: subDoc.paginas || [],
                ano: String(subDoc.ano || ""),
                mes: String(subDoc.mes || ""),
                multimediapath: String(subDoc.multimediapath || ""), 
                tempo: subDoc.tempo || "", 
                titulo: subDoc.titulo || subDoc.artigo || "",
                capitulo: String(subDoc.capitulo || ""),
                estado: "on",
                timestampUpdate: serverTimestamp()
            };

            if (!snap.empty) {
                const docRef = doc(dbRef, "Biblioteca", snap.docs[0].id);
                const data = snap.docs[0].data();

                let caixasPuzzle = Array.isArray(data.Puzzle?.caixas) ? [...data.Puzzle.caixas] : [];
                const idxP = caixasPuzzle.findIndex(c => (typeof c === 'object' ? c.id : c) === blockId);
                const itemExistente = idxP >= 0 ? caixasPuzzle[idxP] : null;
                const ordemVal = caixaAlvo.ordem !== undefined ? caixaAlvo.ordem : (itemExistente?.ordem !== undefined ? itemExistente.ordem : (caixasPuzzle.length + 1));

                const novoItemP = { 
                    id: blockId, 
                    timestamp: caixaAlvo.timestamp || new Date().toISOString(),
                    ordem: ordemVal
                };
                if (idxP >= 0) caixasPuzzle[idxP] = novoItemP;
                else caixasPuzzle.push(novoItemP);

                await updateDoc(docRef, {
                    ...dadosParaGravar,
                    caixas: arrayUnion(vinculo),
                    "Dossie.Apto": arrayUnion(blockId),
                    "Puzzle.caixas": caixasPuzzle
                });
                console.log(`✅ Índice, Dossiê e Puzzle.caixas atualizados: §${numSeq}`);
            } else {
                await addDoc(collection(dbRef, "Biblioteca"), {
                    ...dadosParaGravar,
                    caixas: [vinculo],
                    Dossie: {
                        Apto: [blockId],
                        mica: {}
                    },
                    Puzzle: {
                        caixas: [{ 
                            id: blockId, 
                            timestamp: caixaAlvo.timestamp || new Date().toISOString(),
                            ordem: caixaAlvo.ordem !== undefined ? caixaAlvo.ordem : 1
                        }]
                    },
                    timestamp: serverTimestamp()
                });
                console.log(`🌟 Novo índice, Dossiê e Puzzle criados: §${numSeq}`);
            }
        } catch (e) {
            console.error(`❌ Erro ao sincronizar §${numSeq}:`, e);
        }
    }
    console.groupEnd();
}

/**
 * 4. UTILITÁRIOS
 */
export function adicionarNovoCardCodex(ctx) { if (typeof window.triggerCodexBrowser === 'function') window.triggerCodexBrowser("NEW"); }
export function updateCodexField(cardId, campo, valor, ctx) {
    const { caixaAlvo, persistir } = ctx;
    const subDoc = (caixaAlvo.codex || []).flat().find(c => c.id === cardId);
    if (subDoc) {
        subDoc[campo] = valor;
        persistir('codex', caixaAlvo.codex); 
        executarSincronizacaoForcada(subDoc, ctx);
        dispararUpdateEyeFontes();
    }
}

export function updateCodexLista(cardId, campo, valor, ctx) {
    const { caixaAlvo, persistir } = ctx;
    const partes = valor.split(',');
    let nums = [];
    partes.forEach(p => {
        const item = p.trim();
        if (item.includes('-')) {
            const [i, f] = item.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(i) && !isNaN(f)) for (let x = Math.min(i,f); x <= Math.max(i,f); x++) nums.push(x);
        } else { const n = parseInt(item); if (!isNaN(n)) nums.push(n); }
    });
    const finalArray = [...new Set(nums)].sort((a, b) => a - b);
    caixaAlvo.codex.flat().forEach(c => { if (c.id === cardId) { c[campo] = finalArray; persistir('codex', caixaAlvo.codex); dispararUpdateEyeFontes(); } });
}

export async function removerVinculoBibliotecaGlobal(card, ctx) {
    const { dbRef, authRef, caixaAlvo } = ctx;
    if (!authRef.currentUser) return;

    const uid = authRef.currentUser.uid;
    const caixaIdParaLimpar = caixaAlvo.id;
    const seqs = Array.isArray(card.sequencia) ? card.sequencia : [card.sequencia];

    console.group(`🗑️ [BIBLIOTECA-CLEAN] Removendo vínculos de: ${card.referencia}`);

    for (const s of seqs) {
        const numSeq = parseInt(String(s).replace(/[^0-9]/g, ''));
        if (isNaN(numSeq)) continue;

        const q = query(
            collection(dbRef, "Biblioteca"),
            where("userId", "==", uid),
            where("referencia", "==", card.referencia),
            where("oque", "==", card.oque),
            where("sequencia", "==", numSeq)
        );

        try {
            const snap = await getDocs(q);
            
            for (const docSnap of snap.docs) {
                const data = docSnap.data();
                const docRef = docSnap.ref;

                const novasCaixasVinc = (data.caixas || []).filter(v => (v.caixaId || v) !== caixaIdParaLimpar);
                const novosAptos = (data.Dossie?.Apto || []).filter(id => id !== caixaIdParaLimpar);
                const caixasPuzzle = (data.Puzzle?.caixas || []).filter(c => (typeof c === 'object' ? c.id : c) !== caixaIdParaLimpar);

                let micasAlteradas = false;
                const micas = data.Dossie?.mica || {};
                
                for (const mId in micas) {
                    if (micas[mId].caixas && micas[mId].caixas.includes(caixaIdParaLimpar)) {
                        micas[mId].caixas = micas[mId].caixas.filter(id => id !== caixaIdParaLimpar);
                        micasAlteradas = true;
                    }
                }

                const updatePayload = {
                    caixas: novasCaixasVinc,
                    "Dossie.Apto": novosAptos,
                    "Puzzle.caixas": caixasPuzzle,
                    timestampUpdate: serverTimestamp()
                };

                if (micasAlteradas) {
                    updatePayload["Dossie.mica"] = micas;
                }

                await updateDoc(docRef, updatePayload);
                console.log(`✅ [CLEAN] §${numSeq} limpo com sucesso do Puzzle.`);
            }
        } catch (e) {
            console.error(`❌ Erro ao limpar §${numSeq}:`, e);
        }
    }
    console.groupEnd();
}

function dispararUpdateEyeFontes() { import('../../../direita/eye-fontes-nota.js').then(m => m.carregarFontesGlobaisDaNota(window.caixasAtuais)); }
export function prepararGrupoSemantico(dados, ctx) {
    let especialista = PublicacoesProcessor;
    if (dados.contexto === 'multimedia') especialista = MultimediaProcessor;
    else if (dados.contexto === 'livro') especialista = LivrosProcessor;
    
    const groupId = crypto.randomUUID();
    
    // --- SEGURANÇA REFORÇADA AQUI ---
    // Tentamos obter o UID de várias fontes para não crashar
    const uid = ctx.uid || 
                (ctx.authRef && ctx.authRef.currentUser ? ctx.authRef.currentUser.uid : null) || 
                (window.authInstance && window.authInstance.currentUser ? window.authInstance.currentUser.uid : null);

    if (!uid) {
        console.error("❌ [CODEX] Falha crítica: UID do utilizador não encontrado.");
        return [];
    }

    return dados.mapeamento.map(m => 
        especialista.gerarObjetos(dados, m, groupId, uid)
    );
}
