// components/editor/modulos/tags/tags-controller.js
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
    renderizarNeuroniosNoPopup, 
    renderizarHub,
    renderizarAssociados, 
    renderizarResultadosBiblia, 
    renderizarResultadosCosmos,
    renderizarResultadosTopicos,
    renderizarResultadosSubtopicos
} from './tags-ui.js';
import { salvarCampoNaCaixa } from './tags-store.js';
import { pesquisarTextoBiblicoLocal } from './tags-utils.js';
import { renderizarVinculosTopicos } from './tags-ui.js';

// Handlers de Sub-mÃƒÆ’Ã‚Â³dulos
import * as NeuronioHandlers from './tags-handlers-neuronios.js';
import * as TopicoHandlers from './tags-handlers-topicos.js';
import * as CodexHandlers from './tags-handlers-codex.js';
import * as RefHandlers from './tags-handlers-referencias.js';
import * as AssociarHandlers from './tags-handlers-associar.js';
import { abrirPesquisaCodex } from '../codex-browser.js';
import { perguntarRemocaoHub } from './tags-utils.js';

let dbRef, authRef, caixaAlvo, notaMaeId;
let topicoPaiSelecionado = null; // Estado para o filtro de subtÃƒÆ’Ã‚Â³picos
let topicoPaiNotaSelecionado = null; 
let notaAtivaIdLocal = null;
let origemAtual = "Local"; 


/**
 * CONTEXTO DE AUXÃƒÆ’Ã‚ÂLIO
 */
const getCtx = () => ({
    dbRef, authRef, caixaAlvo, notaMaeId,
    // Passamos a origemAtual para a store
    persistir: (f, v) => salvarCampoNaCaixa(dbRef, notaMaeId, caixaAlvo.id, f, v, origemAtual)
});

/**
 * Limpa os campos de pesquisa e esconde os resultados da aba NeurÃƒÆ’Ã‚Â³nios
 */
function resetInputsPesquisaTags() {
    const inBiblia = document.getElementById('search-biblia-neuronios');
    const inCosmos = document.getElementById('search-cosmos-neuronios');
    const resBiblia = document.getElementById('results-biblia-neuronios');
    const resCosmos = document.getElementById('results-cosmos-neuronios');

    if (inBiblia) inBiblia.value = "";
    if (inCosmos) inCosmos.value = "";
    if (resBiblia) { resBiblia.innerHTML = ""; resBiblia.style.display = 'none'; }
    if (resCosmos) { resCosmos.innerHTML = ""; resCosmos.style.display = 'none'; }
}

/**
 * INICIALIZAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO SISTEMA
 */
export function iniciarSistemaTags(db, auth) {
    dbRef = db; authRef = auth;
    configurarRemocoesTags();

    // 1. GestÃƒÆ’Ã‚Â£o de Abas
    document.querySelectorAll('.tab-tags').forEach(tab => {
        tab.onclick = () => {
             resetInputsPesquisaTags(); 
             document.querySelectorAll('.tab-tags').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tags-tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(tab.getAttribute('data-target')).style.display = 'block';
        };
    });
    
    // LÃƒÆ’Ã‚Â³gica do botÃƒÆ’Ã‚Â£o + nos TÃƒÆ’Ã‚Â³picos
const btnToggleTopico = document.getElementById('btn-abrir-form-topico');
if(btnToggleTopico) {
    btnToggleTopico.onclick = () => {
        const area = document.getElementById('area-form-topicos');
        const isHidden = area.style.display === 'none';
        if (isHidden) prepararBuscaTopicosUnificada();
        area.style.display = isHidden ? 'block' : 'none';
        btnToggleTopico.classList.toggle('active', isHidden);
    };
}

 // 2. BotÃƒÆ’Ã‚Â£o Fechar Popup
    const btnFechar = document.getElementById('btn-fechar-tags');
    if(btnFechar) {
        btnFechar.onclick = () => {
            // --- ADICIONADO: Reset ao fechar ---
            resetInputsPesquisaTags(); 
            document.getElementById('popup-tags-overlay').classList.remove('active');
        };
    }

    // 3. ABA ASSOCIAR: BotÃƒÆ’Ã‚Â£o Explorador
    const btnExpAssociar = document.getElementById('btn-mostrar-explorador-associar');
    if(btnExpAssociar) {
        btnExpAssociar.onclick = (e) => {
            const div = document.getElementById('explorador-associar');
            const isVisivel = div.style.display === 'block';
            div.style.display = isVisivel ? 'none' : 'block';
            e.target.innerText = isVisivel ? 'Mostrar Explorador' : 'Ocultar Explorador';
            if (!isVisivel) AssociarHandlers.carregarArvore(getCtx());
        };
    }

    // 4. ABA REFERÃƒÆ’Ã…Â NCIAS
    const btnAddRef = document.getElementById('btn-add-ref-completa');
    if(btnAddRef) btnAddRef.onclick = () => RefHandlers.adicionarReferencia(getCtx(), "completa");

    const btnAddLinks = document.getElementById('btn-add-apenas-links');
    if(btnAddLinks) btnAddLinks.onclick = () => RefHandlers.adicionarReferencia(getCtx(), "link");

    // 5. ABA CODEX
    const btnAddCodexTopo = document.getElementById('btn-add-codex-card');
    if(btnAddCodexTopo) btnAddCodexTopo.onclick = () => CodexHandlers.adicionarNovoCardCodex(getCtx());

    configurarInputsPesquisa();
    exporFuncoesGlobais();
}

/**
 * ABERTURA DO POPUP
 */
export function abrirPopupTags(caixa, notaId, origemNota) {
    // --- 1. RESET DE INPUTS (Garantir limpeza ao abrir conforme solicitado) ---
    resetInputsPesquisaTags(); 

    // --- 2. GESTÃƒÆ’Ã†â€™O DE CONTEXTO (SincronizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o Local vs Share) ---
    // Determinamos a origem real: prioridade para o argumento do editor, 
    // fallback para o campo da caixa ou 'local' por defeito.
    const origemReal = origemNota || caixa.onde || "local";
    
    // Atualiza a variÃƒÆ’Ã‚Â¡vel de estado do mÃƒÆ’Ã‚Â³dulo (usada pela funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o persistir/getCtx)
    origemAtual = (origemReal === "share") ? "Share" : "Local";
    
    caixaAlvo = caixa; 
    notaMaeId = notaId;
    
    console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â [TAGS] Abrindo popup. Contexto: ${origemAtual} | Bloco: ${caixa.id}`);

    // --- 3. EXIBIÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO OVERLAY ---
    const overlay = document.getElementById('popup-tags-overlay');
    if (overlay) overlay.classList.add('active');

    // --- 4. GESTÃƒÆ’Ã†â€™O DE VISIBILIDADE DAS ABAS (Regras de NegÃƒÆ’Ã‚Â³cio) ---
    const isNotaShare = (origemReal === "share");
    const todasAbas = document.querySelectorAll('.tab-tags');
    const abasPrivadas = ['tags-neuronios', 'tags-associar', 'tags-topicos'];

    todasAbas.forEach(aba => {
        const target = aba.getAttribute('data-target');

        // Regra A: Esconde abas de InteligÃƒÆ’Ã‚Âªncia Pessoal se a nota for Share
        if (isNotaShare && abasPrivadas.includes(target)) {
            aba.style.display = 'none';
        } 
        // Regra B: O Elevador apenas tem acesso ÃƒÆ’Ã‚Â  aba de TÃƒÆ’Ã‚Â³picos
        else if (caixa.tipo === "elevador") {
            aba.style.display = (target === 'tags-topicos') ? 'flex' : 'none';
        } 
        else {
            aba.style.display = 'flex';
        }
    });

    // --- 5. SELEÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O AUTOMÃƒÆ’Ã‚ÂTICA DA ABA INICIAL ---
    if (isNotaShare) {
        // Notas Share abrem direto nas ReferÃƒÆ’Ã‚Âªncias/DocumentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const btnRef = document.querySelector('.tab-tags[data-target="tags-referencias"]');
        if (btnRef) btnRef.click();
    } else if (caixa.tipo === "elevador") {
        const btnTop = document.querySelector('.tab-tags[data-target="tags-topicos"]');
        if (btnTop) btnTop.click();
    } else {
        // Notas Locais abrem nos NeurÃƒÆ’Ã‚Â³nios (BÃƒÆ’Ã‚Â­blia/Cosmos)
        const btnDefault = document.querySelector('.tab-tags[data-target="tags-hub"]');
        if (btnDefault) btnDefault.click();
    }

    // --- 6. RENDERIZAR ÃƒÆ’Ã‚ÂCONES DE GENEALOGIA (Coroa / PeÃƒÆ’Ã‚Â£o) ---
    if (typeof renderizarIconesGenealogia === 'function') {
        renderizarIconesGenealogia(caixa);
    }

    // --- 7. RENDERIZAR CONTEÃƒÆ’Ã…Â¡DOS ATUAIS (Pills e Listas) ---
    renderizarHub(caixaAlvo);
    renderizarNeuroniosNoPopup(caixaAlvo);
    renderizarAssociados(caixaAlvo);
    renderizarVinculosTopicos(caixaAlvo);
    prepararBuscaTopicosUnificada();
    
    // --- 8. CARREGAR CARDS DE CODEX E REFERÃƒÆ’Ã…Â NCIAS ---
    // Usamos import dinÃƒÆ’Ã‚Â¢mico para garantir que os handlers estÃƒÆ’Ã‚Â£o prontos
    import('./tags-handlers-codex.js').then(m => m.renderizarCards(getCtx()));
    import('./tags-handlers-referencias.js').then(m => m.renderizarCards(getCtx()));

    // --- 9. SINCRONIZAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O "IN LIVE" COM O PAINEL EYE (DIREITA) ---
    // ForÃƒÆ’Ã‚Â§amos a atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da aba Fontes do EYE mal o popup abre, 
    // garantindo que nÃƒÆ’Ã‚Â£o hÃƒÆ’Ã‚Â¡ discrepÃƒÆ’Ã‚Â¢ncia entre o que vÃƒÆ’Ã‚Âªs no popup e na barra lateral.
    import('../../../direita/eye-fontes-nota.js').then(m => {
        m.carregarFontesGlobaisDaNota(window.caixasAtuais);
    });
}

/**
 * LÃƒÆ’Ã¢â‚¬Å“GICA DE PESQUISA
 */
function configurarInputsPesquisa() {
    // Pesquisa BÃƒÆ’Ã‚Â­blia
    const inBiblia = document.getElementById('search-biblia-neuronios');
    if(inBiblia) {
        inBiblia.oninput = (e) => {
            const resultados = pesquisarTextoBiblicoLocal(e.target.value);
            renderizarResultadosBiblia(resultados, caixaAlvo);
        };
    }

    // Pesquisa Cosmos
    const inCosmos = document.getElementById('search-cosmos-neuronios');
    if(inCosmos) {
        inCosmos.oninput = async (e) => {
            const termo = e.target.value.toLowerCase();
            if(termo.length < 2) return;
            const q = query(collection(dbRef, "Cosmo"), where("userId", "==", authRef.currentUser.uid), where("tipo", "==", "cosmos"), where("estado", "==", "on"));
            const snap = await getDocs(q);
            const resultados = [];
            snap.forEach(d => {
                if(d.data().nome.toLowerCase().includes(termo)) resultados.push({id: d.id, ...d.data()});
            });
            renderizarResultadosCosmos(resultados, caixaAlvo);
        };
    }

    // PESQUISA TÃƒÆ’Ã¢â‚¬Å“PICOS (Pai)
    const inTopico = document.getElementById('search-tags-topico');
    if(inTopico) {
        inTopico.oninput = async (e) => {
            const termo = e.target.value.toLowerCase();
            if(termo.length < 2) return;
            const q = query(collection(dbRef, "Topico"), where("userId", "==", authRef.currentUser.uid), where("tipo", "==", "topico"), where("estado", "==", "on"));
            const snap = await getDocs(q);
            const resultados = [];
            snap.forEach(d => {
                if(d.data().nome.toLowerCase().includes(termo)) resultados.push({docIdFirebase: d.id, ...d.data()});
            });
            renderizarResultadosTopicos(resultados);
        };
    }

    // PESQUISA SUBTÃƒÆ’Ã¢â‚¬Å“PICOS
    const inSubtopico = document.getElementById('search-tags-subtopico');
    if(inSubtopico) {
        inSubtopico.oninput = async (e) => {
            const termo = e.target.value.toLowerCase();
            if(termo.length < 2 || !topicoPaiSelecionado) return;
            const q = query(collection(dbRef, "Topico"), 
                where("userId", "==", authRef.currentUser.uid), 
                where("tipo", "==", "subtopico"), 
                where("estado", "==", "on"),
                where("topicospai", "array-contains", topicoPaiSelecionado.id)
            );
            const snap = await getDocs(q);
            const resultados = [];
            snap.forEach(d => {
                if(d.data().nome.toLowerCase().includes(termo)) resultados.push({docIdFirebase: d.id, ...d.data()});
            });
            renderizarResultadosSubtopicos(resultados);
        };
    }
}

/**
 * EXPOSIÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE FUNÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES AO WINDOW
 */
/**
 * EXPOSIÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE FUNÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES AO WINDOW (Eventos de Clique do HTML)
 */
function exporFuncoesGlobais() {
    
    
    // --- TÃƒÆ’Ã¢â‚¬Å“PICOS E SUBTÃƒÆ’Ã¢â‚¬Å“PICOS ---
 window.setTopicoPai = (id, nome) => {
    topicoPaiSelecionado = { id, nome };
    document.getElementById('search-tags-topico').value = "";
    document.getElementById('results-tags-topico').style.display = 'none';
    document.getElementById('selected-tags-topico-display').innerHTML = `
        <div class="neuronio-pill" style="border-color:var(--primary); background:rgba(99, 102, 241, 0.1); margin-bottom:10px;">
            <i class="fa-solid fa-check"></i> <span>TÃƒÆ’Ã‚Â³pico: ${nome}</span>
            <i class="fa-solid fa-xmark" style="margin-left:10px; cursor:pointer;" onclick="window.limparTopicoFiltro()"></i>
        </div>`;
    
    // Ativa a secÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de subtÃƒÆ’Ã‚Â³picos
    const secSub = document.getElementById('section-tags-subtopico');
    secSub.style.opacity = "1";
    secSub.style.pointerEvents = "auto";
};

window.formatarInputTempo = (input) => {
    let val = input.value.replace(/\D/g, ''); // Remove lixo
    if (val.length > 6) val = val.substring(0, 6); // Limite de 6 dÃƒÆ’Ã‚Â­gitos

    let formatado = "";
    if (val.length > 0) formatado += val.substring(0, 2);
    if (val.length > 2) formatado += ":" + val.substring(2, 4);
    if (val.length > 4) formatado += ":" + val.substring(4, 6);

    input.value = formatado;
};

    window.limparTopicoFiltro = () => {
        topicoPaiSelecionado = null;
        document.getElementById('selected-tags-topico-display').innerHTML = "";
        const secSub = document.getElementById('section-tags-subtopico');
        secSub.style.opacity = "0.3";
        secSub.style.pointerEvents = "none";
        document.getElementById('search-tags-subtopico').value = "";
    };

 window.vincularSubtopicoFinal = async (docIdFirebase, uuid, nome) => {
        await TopicoHandlers.vincularAoSubtopico(docIdFirebase, uuid, nome, getCtx());
        
        // UI Feedback
        document.getElementById('results-tags-subtopico').style.display = 'none';
        document.getElementById('search-tags-subtopico').value = "";
        document.getElementById('area-form-topicos').style.display = 'none';
        document.getElementById('btn-abrir-form-topico').classList.remove('active');
        window.limparTopicoFiltro();
    };

    // Remover VÃƒÆ’Ã‚Â­nculo
    window.removerVincTopico = (uuid) => {
        TopicoHandlers.desvincularTopico(uuid, getCtx());
    };

    // --- NEURÃƒÆ’Ã¢â‚¬Å“NIOS (BÃƒÆ’Ã‚ÂBLIA E COSMOS) ---
    window.vincularBiblia = (ref) => {
    NeuronioHandlers.vincularBiblia(ref, getCtx());
    
    // RESET UI BÃƒÆ’Ã‚ÂBLIA
    const inBiblia = document.getElementById('search-biblia-neuronios');
    const resBiblia = document.getElementById('results-biblia-neuronios');
    if (inBiblia) inBiblia.value = "";
    if (resBiblia) { 
        resBiblia.innerHTML = ""; 
        resBiblia.style.display = 'none'; 
    }
};


    window.desvincularBiblia = (ref) => NeuronioHandlers.desvincularBiblia(ref, getCtx());
    
    window.vincularCosmos = (id, nome) => {
    // Executa a lÃƒÆ’Ã‚Â³gica de gravaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o no Firebase e RAM
    NeuronioHandlers.vincularCosmos(id, nome, getCtx());

    // RESET UI COSMOS (O que pediste)
    const inCosmos = document.getElementById('search-cosmos-neuronios');
    const resCosmos = document.getElementById('results-cosmos-neuronios');
    
    if (inCosmos) {
        inCosmos.value = ""; // Limpa o texto "sd" ou qualquer outro
    }
    if (resCosmos) {
        resCosmos.innerHTML = ""; 
        resCosmos.style.display = 'none'; // Esconde a lista de resultados
    }
    
    console.log("ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â¹ [TAGS] Pesquisa Cosmos reiniciada apÃƒÆ’Ã‚Â³s seleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.");
};


    window.desvincularCosmos = (id) => NeuronioHandlers.desvincularCosmos(id, getCtx());

    // --- ASSOCIAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES (NOTAS E CAIXAS) ---
    window.vincularAoAssociado = (id, tit, tipo) => AssociarHandlers.vincular(id, tit, tipo, getCtx());
    window.removerAssociado = (id) => AssociarHandlers.remover(id, getCtx());
    window.abrirNoBrowserExterno = async (id) => {
        try {
            const browser = await import('../browser.js');
            const res = await browser.buscarNotaHibrida(id);
            if (!res) return;

            const editor = await import('../../editor.js');
            await editor.abrirNotaNoEditor(id, res.dados, dbRef || window.db, authRef || window.auth, null, notaAtivaIdLocal);
        } catch (error) {
            console.error('Erro ao abrir nota no browser externo:', error);
        }
    };
    
    // Abre a nota no sistema de abas do editor
    window.abrirNoBrowserExternoLegacy = (id) => {
        if (window.abrirNoBrowserExterno) {
            // Esta funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© injetada pelo browser.js
            window.abrirNoBrowserExterno(id);
        }
    };

    // --- CODEX (MAPEAMENTO BIBLIOGRÃƒÆ’Ã‚ÂFICO) ---
    window.updateCodexLista = (cardId, campo, valor) => {
        const card = caixaAlvo.codex.find(c => c.id === cardId);
        if (card) {
            const partes = valor.split(',');
            let numerosFinais = [];
            partes.forEach(p => {
                const item = p.trim();
                if (item.includes('-')) {
                    const [inicio, fim] = item.split('-').map(n => parseInt(n.trim()));
                    if (!isNaN(inicio) && !isNaN(fim)) {
                        for (let i = Math.min(inicio, fim); i <= Math.max(inicio, fim); i++) {
                            numerosFinais.push(i);
                        }
                    }
                } else {
                    const num = parseInt(item);
                    if (!isNaN(num)) numerosFinais.push(num);
                }
            });
            // Grava array de nÃƒÆ’Ã‚Âºmeros limpo e ordenado
            card[campo] = [...new Set(numerosFinais)].sort((a, b) => a - b);
            getCtx().persistir('codex', caixaAlvo.codex);
        }
    };

    window.updateCodexFieldManual = (id, campo, valor) => {
    CodexHandlers.updateCodexField(id, campo, valor, getCtx());
};

window.updateCodexListaManual = (id, campo, valor) => {
    CodexHandlers.updateCodexLista(id, campo, valor, getCtx());
};

    window.toggleCodexInput = (cardId, tipo) => {
        const el = document.getElementById(`in-${tipo}-${cardId}`);
        if (el) el.classList.toggle('hidden');
    };

window.confirmarRemoverCodex = (cardId) => {
    const overlay = document.getElementById('popup-confirmar-remover-overlay');
    const btnSim = document.getElementById('btn-confirmar-remover-final');
    const btnNao = document.getElementById('btn-cancelar-remover');

    if (!overlay) return;

    // --- 1. RESET DOS BOTÃƒÆ’Ã¢â‚¬Â¢ES (Garante que abrem ativos) ---
    [btnSim, btnNao].forEach(btn => {
        btn.disabled = false;
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
    });
    btnSim.innerText = "Sim, Remover";

    overlay.classList.add('active');

    btnSim.onclick = async () => {
        // --- 2. TRANCA TOTAL (Sim e Cancelar ficam inacessÃƒÆ’Ã‚Â­veis) ---
        [btnSim, btnNao].forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = "none";
        });
        
        btnNao.style.opacity = "0.3"; // O cancelar fica quase invisÃƒÆ’Ã‚Â­vel
        btnSim.style.opacity = "0.7";
        btnSim.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A eliminar...';

        console.group("ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â [CODEX-ACTION] REMOVER CARD");
        
        try {
            const cardParaRemover = caixaAlvo.codex.find(c => c.id === cardId);

            if (cardParaRemover) {
                // A) AtualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o na Nota (Soft Delete)
                cardParaRemover.estado = "off";
                cardParaRemover.timedelete = new Date().toISOString();
                await getCtx().persistir('codex', caixaAlvo.codex);

                // B) Limpeza na Biblioteca Global (Ocorre em segundo plano)
                const m = await import('./tags-handlers-codex.js');
                await m.removerVinculoBibliotecaGlobal(cardParaRemover, getCtx());

                // C) Sincronizar RAM do Editor
                if (window.caixasAtuais) {
                    const idx = window.caixasAtuais.findIndex(c => c.id === caixaAlvo.id);
                    if (idx !== -1) window.caixasAtuais[idx].codex = caixaAlvo.codex;
                }

                // D) Atualizar UI das Tags e do EYE (Direita)
                m.renderizarCards(getCtx());
                const mEye = await import('../../../direita/eye-fontes-nota.js');
                mEye.carregarFontesGlobaisDaNota(window.caixasAtuais);
            }
        } catch (error) {
            console.error("Erro na remoÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:", error);
        } finally {
            console.groupEnd();
            overlay.classList.remove('active');
        }
    };

    // O botÃƒÆ’Ã‚Â£o Cancelar sÃƒÆ’Ã‚Â³ funciona se o "Sim" ainda nÃƒÆ’Ã‚Â£o tiver sido clicado
    btnNao.onclick = () => {
        overlay.classList.remove('active');
    };
};


    window.updateCodexReferencia = (cardId, valor) => {
    const card = caixaAlvo.codex.find(c => c.id === cardId);
    if (card) {
        card.referencia = valor;
        
        // Chamar a inteligÃƒÆ’Ã‚Âªncia de identificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        const info = CodexHandlers.identificarSiglaETipo(valor);
        card.sigla = info.sigla;
        card.tipo = info.tipo;

        // Persistir e atualizar apenas o texto do tipo sem redesenhar o card todo (opcional, para performance)
        // Ou simplesmente redesenhar:
        CodexHandlers.renderizarCards(getCtx());
        getCtx().persistir('codex', caixaAlvo.codex);
    }
};

// ATUALIZAR TAMBÃƒÆ’Ã¢â‚¬Â°M O BROWSER PARA IDENTIFICAR AO SELECIONAR NO EXPLORADOR
window.triggerCodexBrowser = (cardId) => {
    const isNovo = (!cardId || cardId === "NEW");

    import('../codex-browser.js').then(mBrowser => {
        mBrowser.abrirPesquisaCodex(async (dadosReferencia) => {
            import('./tags-handlers-codex.js').then(async (mHandler) => {

                if (isNovo) {
                    await mHandler.adicionarItensAoCodex(dadosReferencia, getCtx());
                } else {
                    // SUBSTITUIÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O NO ARRAY PLANO COM LIMPEZA
                    const cardAlvo = caixaAlvo.codex.find(c => c.id === cardId);
                    if (cardAlvo && cardAlvo.groupId) {
                        const gId = cardAlvo.groupId;
                        const itensAntigos = caixaAlvo.codex.filter(c => c.groupId === gId);

                        // 1. Limpar antigos na Biblioteca
                        for (const old of itensAntigos) {
                            await mHandler.removerVinculoBibliotecaGlobal(old, getCtx());
                        }

                        // 2. Criar novos itens
                        const novosItens = mHandler.prepararGrupoSemantico(dadosReferencia, getCtx());
                        
                        // 3. Substituir no array da nota
                        caixaAlvo.codex = [
                            ...caixaAlvo.codex.filter(c => c.groupId !== gId),
                            ...novosItens
                        ];
                        
                        await getCtx().persistir('codex', caixaAlvo.codex);

                        // 4. Indexar novos itens na Biblioteca
                        for (const itemNovo of novosItens) {
                            await mHandler.executarSincronizacaoForcada(itemNovo, getCtx());
                        }

                        mHandler.renderizarCards(getCtx());
                    }
                }

                // Sincronizar RAM e EYE
                if (window.caixasAtuais) {
                    const idx = window.caixasAtuais.findIndex(c => c.id === caixaAlvo.id);
                    if (idx !== -1) window.caixasAtuais[idx].codex = caixaAlvo.codex;
                }
                import('../../../direita/eye-fontes-nota.js').then(m => m.carregarFontesGlobaisDaNota(window.caixasAtuais));
            });
        });
    });
};

    // --- REFERÃƒÆ’Ã…Â NCIAS EXTERNAS ---
    window.updateRef = (id, campo, valor) => {
        const idx = caixaAlvo.referencias.findIndex(r => r.id === id);
        if(idx !== -1) {
            caixaAlvo.referencias[idx][campo] = valor;
            getCtx().persistir('referencias', caixaAlvo.referencias);
        }
    };

    window.removerRef = (id) => {
        caixaAlvo.referencias = (caixaAlvo.referencias || []).filter(r => r.id !== id);
        getCtx().persistir('referencias', caixaAlvo.referencias);
        RefHandlers.renderizarCards(getCtx());
    };
}


/**
 * ABERTURA DO POPUP DE TAGS DA NOTA (Global)
 */
export async function abrirPopupTagsNota(notaId, db, auth) {
    // GUARDAR PARA USO POSTERIOR
    notaAtivaIdLocal = notaId;
    dbRef = db; 
    authRef = auth;

    const overlay = document.getElementById('popup-tags-nota-overlay');
    overlay.classList.add('active');
    
    // Reset de estado e campos
    topicoPaiNotaSelecionado = null;
    document.getElementById('search-tags-nota-topico').value = "";
    document.getElementById('search-tags-nota-subtopico').value = "";
    document.getElementById('selected-tags-nota-topico-display').innerHTML = "";
    document.getElementById('section-tags-nota-subtopico').style.opacity = "0.3";
    document.getElementById('section-tags-nota-subtopico').style.pointerEvents = "none";

    // 1. Carregar Vinculos Atuais da Nota
    const notaRef = doc(db, "Local", notaId);
    const notaSnap = await getDoc(notaRef);
    if (notaSnap.exists()) {
        renderizarVinculosNotaUI(notaSnap.data().vincTopicos || []);
    }

    // 2. Evento de fecho
    document.getElementById('btn-fechar-tags-nota').onclick = () => overlay.classList.remove('active');

    // 3. PESQUISA DE TÃƒÆ’Ã¢â‚¬Å“PICO PAI (NOTA)
    const inTopico = document.getElementById('search-tags-nota-topico');
    inTopico.oninput = async (e) => {
        const termo = e.target.value.toLowerCase();
        if(termo.length < 2) return;
        
        const q = query(collection(db, "Topico"), 
            where("userId", "==", auth.currentUser.uid), 
            where("tipo", "==", "topico"), 
            where("estado", "==", "on")
        );
        const snap = await getDocs(q);
        const resultados = [];
        snap.forEach(d => {
            if(d.data().nome.toLowerCase().includes(termo)) {
                resultados.push({ docIdFirebase: d.id, ...d.data() });
            }
        });
        
        renderizarResultadosPesquisaNota(resultados, 'results-tags-nota-topico', 'setTopicoPaiNota');
    };

    // 4. PESQUISA DE SUBTÃƒÆ’Ã¢â‚¬Å“PICO (NOTA)
    const inSubtopico = document.getElementById('search-tags-nota-subtopico');
    inSubtopico.oninput = async (e) => {
        const termo = e.target.value.toLowerCase();
        if(termo.length < 2 || !topicoPaiNotaSelecionado) return;

        const q = query(collection(db, "Topico"), 
            where("userId", "==", auth.currentUser.uid), 
            where("tipo", "==", "subtopico"), 
            where("estado", "==", "on"),
            where("topicospai", "array-contains", topicoPaiNotaSelecionado.id)
        );
        const snap = await getDocs(q);
        const resultados = [];
        snap.forEach(d => {
            if(d.data().nome.toLowerCase().includes(termo)) {
                resultados.push({ docIdFirebase: d.id, ...d.data() });
            }
        });

        renderizarResultadosPesquisaNota(resultados, 'results-tags-nota-subtopico', 'vincularSubtopicoANotaFinal');
    };
}

/**
 * FUNÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES AUXILIARES DE RENDERIZAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O E CLIQUE (Expostas ao Window)
 */

// Renderiza a lista de resultados (Dropdown)
function renderizarResultadosPesquisaNota(lista, containerId, funcaoClique) {
    const div = document.getElementById(containerId);
    
    // PROTEÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O: Se a div nÃƒÆ’Ã‚Â£o existir no HTML, avisa mas nÃƒÆ’Ã‚Â£o bloqueia o site
    if (!div) {
        console.error(`Erro: Contentor #${containerId} nÃƒÆ’Ã‚Â£o encontrado no HTML.`);
        return;
    }

    div.innerHTML = lista.map(item => `
        <div class="neuronio-result-item" onclick="window.${funcaoClique}('${item.docIdFirebase}', '${item.id}', '${item.nome}')">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="result-icon-box biblia"><i class="fa-solid fa-layer-group"></i></div>
                <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${item.nome}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="opacity:0.3; font-size:12px;"></i>
        </div>
    `).join('') || '<div style="padding:15px; font-size:11px; color:gray; text-align:center;">Sem resultados.</div>';
    
    div.style.display = 'block';
}

// Renderiza as "Pills" da Nota no topo do popup
function renderizarVinculosNotaUI(lista) {
    const cont = document.getElementById('lista-vinc-topicos-nota');
    if(!cont) return;
    cont.innerHTML = lista.map(t => `
        <div class="neuronio-pill" style="background: rgba(99, 102, 241, 0.1); color: var(--primary); border-color: rgba(99, 102, 241, 0.3);">
            <i class="fa-solid fa-hashtag"></i>
            <span>${t.nome}</span>
            <button type="button" class="tags-remove-btn remove-icon" data-tags-remove="topico-nota" data-remove-id="${encodeURIComponent(String(t.id || ''))}" aria-label="Remover tópico da nota">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </div>
    `).join('');
}

// Em components/editor/modulos/tags/tags-controller.js

export function renderizarIconesGenealogia(caixa) {
    const popupHeader = document.querySelector('#popup-tags-overlay .popup-header');
    if (!popupHeader) return;

    let containerIcon = document.getElementById('genealogia-status');
    if (!containerIcon) {
        containerIcon = document.createElement('div');
        containerIcon.id = 'genealogia-status';
        containerIcon.style.cssText = "margin-left: auto; margin-right: 15px; font-size: 18px; display: flex; align-items: center;";
        const btnFechar = document.getElementById('btn-fechar-tags');
        popupHeader.insertBefore(containerIcon, btnFechar);
    }

    containerIcon.innerHTML = "";

    // LÃƒÆ’Ã¢â‚¬Å“GICA SIMPLIFICADA
    if (caixa.origem === "original") {
        containerIcon.innerHTML = `<i class="fa-solid fa-crown" style="color: #fbbf24;" title="Original"></i>`;
    } 
    else if (caixa.origem === "copia") {
        containerIcon.innerHTML = `<i class="fa-solid fa-chess-pawn" style="color: #94a3b8;" title="CÃƒÆ’Ã‚Â³pia"></i>`;
    }
}

async function abrirListaRelacoes(lista, titulo) {
    // Aqui podes criar um pequeno popup ou usar o "area-popup-aviso"
    // para listar as notas. Ao clicar numa, chamas:
    // abrirNotaNoEditor(link.idnota, dados, db, auth, link.idcaixa);
}

/**
 * MOSTRA A LISTA DE NOTAS VINCULADAS E PERMITE O SALTO
 */
window.mostrarListaRelacoes = async (lista, titulo) => {
    const overlay = document.getElementById('popup-aviso-overlay');
    const texto = document.getElementById('msg-aviso-texto');
    const btn = document.getElementById('btn-fechar-aviso');

    if (!overlay) return;

    // --- FILTRO CRUCIAL AQUI ---
    // Apenas mostramos os links cujo estado NÃƒÆ’Ã†â€™O seja 'desativo'
    const listaAtiva = lista.filter(link => link.estado !== 'off');

    if (listaAtiva.length === 0) {
        // Se todos os vÃƒÆ’Ã‚Â­nculos foram apagados, podemos avisar ou nem mostrar a Coroa/PeÃƒÆ’Ã‚Â£o
        texto.innerHTML = `<p style="color:gray; font-size:12px; padding:20px;">A nota de origem deste bloco jÃƒÆ’Ã‚Â¡ nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ disponÃƒÆ’Ã‚Â­vel.</p>`;
    } else {
        let html = `<p style="font-weight:800; color:var(--primary); margin-bottom:15px; text-transform:uppercase; font-size:10px;">${titulo}</p>`;
        
        for (const link of listaAtiva) {
            html += `
                <div class="menu-item-list" style="background:rgba(255,255,255,0.05); margin-bottom:5px; justify-content:space-between;" 
                     onclick="window.viajarParaRelacao('${link.idnota}', '${link.idcaixa}', '${link.onde}')">
                    <span style="font-size:12px;">Nota: ${link.idnota.substring(0,8)}...</span>
                    <i class="fa-solid fa-arrow-right-to-bracket" style="color:var(--primary); font-size:12px;"></i>
                </div>`;
        }
        texto.innerHTML = html;
    }

    overlay.classList.add('active');
    btn.innerText = "Fechar Lista";
};

/**
 * EXECUTA O SALTO PARA A NOTA VINCULADA
 */
window.viajarParaRelacao = async (notaId, caixaId, onde) => {
    // Usamos o dbRef e authRef que jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â£o definidos no topo do teu ficheiro
    if (!dbRef || !authRef) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Erro: ReferÃƒÆ’Ã‚Âªncias do Firebase nÃƒÆ’Ã‚Â£o encontradas no mÃƒÆ’Ã‚Â³dulo de Tags.");
        return;
    }

    try {
        const docRef = doc(dbRef, onde, notaId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            // 1. Fechar os popups abertos
            const popupAviso = document.getElementById('popup-aviso-overlay');
            const popupTags = document.getElementById('popup-tags-overlay');
            
            if (popupAviso) popupAviso.classList.remove('active');
            if (popupTags) popupTags.classList.remove('active');
            
            // 2. Abrir a nota alvo no editor central com foco na caixa
            // notaId: CnWCKX...
            // snap.data(): os dados da nota
            // dbRef / authRef: as instÃƒÆ’Ã‚Â¢ncias do Firebase
            // caixaId: o ID do bloco para fazer o scroll automÃƒÆ’Ã‚Â¡tico
            import('../../editor.js').then(m => {
                m.abrirNotaNoEditor(notaId, snap.data(), dbRef, authRef, caixaId);
            });

        } else {
            alert("A nota de destino jÃƒÆ’Ã‚Â¡ nÃƒÆ’Ã‚Â£o existe no banco de dados.");
        }
    } catch (e) {
        console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao tentar viajar para a nota vinculada:", e);
        alert("Ocorreu um erro ao aceder ÃƒÆ’Ã‚Â  nota vinculada.");
    }
};

/**
 * EXPOSIÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O GLOBAL PARA CLIQUES NO HTML
 */
window.setTopicoPaiNota = (docId, idUuid, nome) => {
    topicoPaiNotaSelecionado = { docId, id: idUuid, nome };
    document.getElementById('search-tags-nota-topico').value = "";
    document.getElementById('results-tags-nota-topico').style.display = 'none';
    document.getElementById('selected-tags-nota-topico-display').innerHTML = `
        <div class="neuronio-pill" style="border-color:var(--primary); background:rgba(99, 102, 241, 0.1); margin-bottom:10px;">
            <i class="fa-solid fa-check"></i> <span>TÃƒÆ’Ã‚Â³pico Pai: ${nome}</span>
            <i class="fa-solid fa-xmark" style="margin-left:10px; cursor:pointer;" onclick="window.limparFiltroNotaPai()"></i>
        </div>`;
    
    const secSub = document.getElementById('section-tags-nota-subtopico');
    secSub.style.opacity = "1";
    secSub.style.pointerEvents = "auto";
};

window.limparFiltroNotaPai = () => {
    topicoPaiNotaSelecionado = null;
    document.getElementById('selected-tags-nota-topico-display').innerHTML = "";
    document.getElementById('section-tags-nota-subtopico').style.opacity = "0.3";
    document.getElementById('section-tags-nota-subtopico').style.pointerEvents = "none";
};

window.vincularSubtopicoANotaFinal = async (docIdFirebase, uuid, nome) => {
    // USAR A VARIÃƒÆ’Ã‚ÂVEL LOCAL notaAtivaIdLocal
    const notaId = notaAtivaIdLocal; 
    const db = dbRef;

    try {
        // 1. Gravar no TÃƒÆ’Ã‚Â³pico (Firebase -> Topico -> notas)
        const subRef = doc(db, "Topico", docIdFirebase);
        await updateDoc(subRef, { notas: arrayUnion(notaId) });

        // 2. Gravar na Nota (Firebase -> Local -> vincTopicos)
        const notaRef = doc(db, "Local", notaId);
        const novoVinculo = { firebaseId: docIdFirebase, id: uuid, nome: nome };
        await updateDoc(notaRef, { vincTopicos: arrayUnion(novoVinculo) });

        // UI: Atualizar lista e limpar campos
        const notaSnap = await getDoc(notaRef);
        renderizarVinculosNotaUI(notaSnap.data().vincTopicos || []);
        
        // Fechar dropdowns de resultados
        document.getElementById('results-tags-nota-subtopico').style.display = 'none';
        document.getElementById('search-tags-nota-subtopico').value = "";
        window.limparFiltroNotaPai();
        
    } catch (e) {
        console.error("Erro ao vincular nota:", e);
    }
};

window.removerTopicoDaNota = async (uuid) => {
    // USAR A VARIÃƒÆ’Ã‚ÂVEL LOCAL notaAtivaIdLocal
    const notaId = notaAtivaIdLocal;
    const db = dbRef;

    if (await perguntarRemocaoHub({
        titulo: "Remover Tópico?",
        mensagem: "Desejas remover este tópico da nota?"
    })) {
        try {
            const notaRef = doc(db, "Local", notaId);
            const notaSnap = await getDoc(notaRef);
            if (notaSnap.exists()) {
                const vincs = notaSnap.data().vincTopicos || [];
                const alvo = vincs.find(v => v.id === uuid);
                
                if (alvo) {
                    // 1. Remover ID da nota do documento do TÃƒÆ’Ã‚Â³pico
                    const subRef = doc(db, "Topico", alvo.firebaseId);
                    await updateDoc(subRef, { notas: arrayRemove(notaId) });

                    // 2. Remover objeto do array da Nota
                    const novosVincs = vincs.filter(v => v.id !== uuid);
                    await updateDoc(notaRef, { vincTopicos: novosVincs });
                    
                    renderizarVinculosNotaUI(novosVincs);
                }
            }
        } catch (e) {
            console.error("Erro ao remover tÃƒÆ’Ã‚Â³pico:", e);
        }
    }
};

window.updateRefManual = (id, campo, valor) => {
    RefHandlers.updateRef(id, campo, valor, getCtx());
};

window.removerRefManual = (id) => {
    perguntarRemocaoHub({
        titulo: "Remover Referência?",
        mensagem: "Desejas remover esta referência?"
    }).then(confirmou => {
        if (!confirmou) return;
        RefHandlers.removerRef(id, getCtx());
    });
};
function prepararBuscaTopicosUnificada() {
    const area = document.getElementById('area-form-topicos');
    if (!area) return;

    area.innerHTML = `
        <label style="display:block; font-size:10px; color:var(--primary); margin-bottom:8px; text-transform:uppercase; font-weight: 700;">Pesquisar T&oacute;picos e Subt&oacute;picos</label>
        <div style="position: relative;">
            <input type="text" id="search-tags-topic-unified" placeholder="Procurar por tudo..." style="width: 100%; padding: 12px; background: #0f172a; border: 1px solid var(--border-color); border-radius: 4px; color: white; outline: none;">
            <div id="results-tags-topic-unified" class="tags-search-results"></div>
        </div>
    `;

    const input = document.getElementById('search-tags-topic-unified');
    const resultados = document.getElementById('results-tags-topic-unified');
    if (!input || !resultados) return;

    input.oninput = async (e) => {
        const termo = e.target.value.toLowerCase().trim();
        if (termo.length < 2) {
            resultados.style.display = 'none';
            resultados.innerHTML = "";
            return;
        }

        const q = query(collection(dbRef, "Topico"), where("userId", "==", authRef.currentUser.uid), where("estado", "==", "on"));
        const snap = await getDocs(q);
        const lista = [];
        snap.forEach(d => {
            const dados = d.data();
            if ((dados.nome || "").toLowerCase().includes(termo)) lista.push({ docIdFirebase: d.id, ...dados });
        });

        resultados.innerHTML = lista.map(item => `
            <div class="neuronio-result-item" onclick="window.vincularTopicoPesquisa('${item.docIdFirebase}', '${item.id}', '${(item.nome || "").replace(/'/g, "\\'")}')">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="result-icon-box ${item.tipo === 'subtopico' ? 'cosmos' : 'biblia'}" style="${item.tipo === 'subtopico' ? 'background:rgba(52, 211, 153, 0.1); color:#34d399;' : ''}">
                        <i class="fa-solid ${item.tipo === 'subtopico' ? 'fa-hashtag' : 'fa-layer-group'}"></i>
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${item.nome}</span>
                        <small style="font-size:9px; color:var(--text-muted); text-transform:uppercase;">${item.tipo === 'subtopico' ? 'Subt&oacute;pico' : 'T&oacute;pico'}</small>
                    </div>
                </div>
                <i class="fa-solid fa-link" style="opacity:0.3; font-size:12px;"></i>
            </div>
        `).join('') || '<div style="padding:15px; font-size:11px; color:gray; text-align:center;">Sem resultados.</div>';
        resultados.style.display = 'block';
    };

window.vincularTopicoPesquisa = async (docIdFirebase, uuid, nome) => {
        await TopicoHandlers.vincularAoSubtopico(docIdFirebase, uuid, nome, getCtx());
        input.value = "";
        resultados.innerHTML = "";
        resultados.style.display = 'none';
        area.style.display = 'none';
        document.getElementById('btn-abrir-form-topico')?.classList.remove('active');
        renderizarHub(caixaAlvo);
        renderizarVinculosTopicos(caixaAlvo);
    };
}

function configurarRemocoesTags() {
    if (window.__tagsRemovalDelegationInstalled) return;
    window.__tagsRemovalDelegationInstalled = true;

    document.addEventListener('click', async (event) => {
        const removerBtn = event.target.closest('[data-tags-remove]');
        if (!removerBtn) return;

        event.preventDefault();
        event.stopPropagation();

        const kind = removerBtn.dataset.tagsRemove;
        const id = decodeURIComponent(removerBtn.dataset.removeId || '');
        const fromHub = Boolean(removerBtn.closest('#tags-hub-list'));

        const pedirConfirmacaoHub = async () => {
            if (!fromHub) return true;

            const itemTitulo = removerBtn
                .closest('div[style*="justify-content:space-between"]')
                ?.querySelector('span[style*="font-size:12px"]')
                ?.textContent
                ?.trim();

            const mensagensHub = {
                biblia: itemTitulo
                    ? `Desejas remover "${itemTitulo}" do Hub?`
                    : "Desejas remover este texto bÃ­blico do Hub?",
                cosmos: itemTitulo
                    ? `Desejas remover "${itemTitulo}" do Hub?`
                    : "Desejas remover este tema do Hub?",
                topico: itemTitulo
                    ? `Desejas remover "${itemTitulo}" do Hub?`
                    : "Desejas remover este tÃ³pico do Hub?"
            };

            if (!mensagensHub[kind]) return true;

            return perguntarRemocaoHub({
                titulo: "Remover do Hub?",
                mensagem: mensagensHub[kind]
            });
        };

        try {
            if (kind === 'biblia' && typeof window.desvincularBiblia === 'function') {
                if (fromHub) {
                    if (!(await pedirConfirmacaoHub())) return;
                    await NeuronioHandlers.desvincularBiblia(id, getCtx(), { skipConfirm: true });
                } else {
                    await window.desvincularBiblia(id);
                }
            } else if (kind === 'cosmos' && typeof window.desvincularCosmos === 'function') {
                if (fromHub) {
                    if (!(await pedirConfirmacaoHub())) return;
                    await NeuronioHandlers.desvincularCosmos(id, getCtx(), { skipConfirm: true });
                } else {
                    await window.desvincularCosmos(id);
                }
            } else if (kind === 'topico' && typeof window.removerVincTopico === 'function') {
                if (fromHub) {
                    if (!(await pedirConfirmacaoHub())) return;
                    await TopicoHandlers.desvincularTopico(id, getCtx(), { skipConfirm: true });
                } else {
                    await window.removerVincTopico(id);
                }
            } else if (kind === 'topico-nota' && typeof window.removerTopicoDaNota === 'function') {
                await window.removerTopicoDaNota(id);
            } else if (kind === 'associado' && typeof window.removerAssociado === 'function') {
                await window.removerAssociado(id);
            } else if (kind === 'referencia' && typeof window.removerRefManual === 'function') {
                await window.removerRefManual(id);
            } else if (kind === 'codex' && typeof window.confirmarRemoverCodex === 'function') {
                await window.confirmarRemoverCodex(id);
            }
        } catch (error) {
            console.error('Erro ao remover item:', error);
        }
    }, true);

    document.addEventListener('click', (event) => {
        const openNoteBtn = event.target.closest('[data-open-note]');
        if (!openNoteBtn) return;

        event.preventDefault();
        event.stopPropagation();

        const id = decodeURIComponent(openNoteBtn.dataset.openNote || '');
        if (typeof window.abrirNoBrowserExterno === 'function') {
            window.abrirNoBrowserExterno(id);
        }
    }, true);
}
