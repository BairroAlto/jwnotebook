// components/editor/modulos/tags/tags-controller.js
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
    renderizarNeuroniosNoPopup, 
    renderizarAssociados, 
    renderizarResultadosBiblia, 
    renderizarResultadosCosmos,
    renderizarResultadosTopicos,
    renderizarResultadosSubtopicos
} from './tags-ui.js';
import { salvarCampoNaCaixa } from './tags-store.js';
import { pesquisarTextoBiblicoLocal } from './tags-utils.js';
import { renderizarVinculosTopicos } from './tags-ui.js';

// Handlers de Sub-módulos
import * as NeuronioHandlers from './tags-handlers-neuronios.js';
import * as TopicoHandlers from './tags-handlers-topicos.js';
import * as CodexHandlers from './tags-handlers-codex.js';
import * as RefHandlers from './tags-handlers-referencias.js';
import * as AssociarHandlers from './tags-handlers-associar.js';
import { abrirPesquisaCodex } from '../codex-browser.js';

let dbRef, authRef, caixaAlvo, notaMaeId;
let topicoPaiSelecionado = null; // Estado para o filtro de subtópicos
let topicoPaiNotaSelecionado = null; 
let notaAtivaIdLocal = null;
let origemAtual = "Local"; 


/**
 * CONTEXTO DE AUXÍLIO
 */
const getCtx = () => ({
    dbRef, authRef, caixaAlvo, notaMaeId,
    // Passamos a origemAtual para a store
    persistir: (f, v) => salvarCampoNaCaixa(dbRef, notaMaeId, caixaAlvo.id, f, v, origemAtual)
});

/**
 * Limpa os campos de pesquisa e esconde os resultados da aba Neurónios
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
 * INICIALIZAÇÃO DO SISTEMA
 */
export function iniciarSistemaTags(db, auth) {
    dbRef = db; authRef = auth;

    // 1. Gestão de Abas
    document.querySelectorAll('.tab-tags').forEach(tab => {
        tab.onclick = () => {
             resetInputsPesquisaTags(); 
             document.querySelectorAll('.tab-tags').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tags-tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(tab.getAttribute('data-target')).style.display = 'block';
        };
    });
    
    // Lógica do botão + nos Tópicos
const btnToggleTopico = document.getElementById('btn-abrir-form-topico');
if(btnToggleTopico) {
    btnToggleTopico.onclick = () => {
        const area = document.getElementById('area-form-topicos');
        const isHidden = area.style.display === 'none';
        area.style.display = isHidden ? 'block' : 'none';
        btnToggleTopico.classList.toggle('active', isHidden);
    };
}

 // 2. Botão Fechar Popup
    const btnFechar = document.getElementById('btn-fechar-tags');
    if(btnFechar) {
        btnFechar.onclick = () => {
            // --- ADICIONADO: Reset ao fechar ---
            resetInputsPesquisaTags(); 
            document.getElementById('popup-tags-overlay').classList.remove('active');
        };
    }

    // 3. ABA ASSOCIAR: Botão Explorador
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

    // 4. ABA REFERÊNCIAS
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

    // --- 2. GESTÃO DE CONTEXTO (Sincronização Local vs Share) ---
    // Determinamos a origem real: prioridade para o argumento do editor, 
    // fallback para o campo da caixa ou 'local' por defeito.
    const origemReal = origemNota || caixa.onde || "local";
    
    // Atualiza a variável de estado do módulo (usada pela função persistir/getCtx)
    origemAtual = (origemReal === "share") ? "Share" : "Local";
    
    caixaAlvo = caixa; 
    notaMaeId = notaId;
    
    console.log(`🛠️ [TAGS] Abrindo popup. Contexto: ${origemAtual} | Bloco: ${caixa.id}`);

    // --- 3. EXIBIÇÃO DO OVERLAY ---
    const overlay = document.getElementById('popup-tags-overlay');
    if (overlay) overlay.classList.add('active');

    // --- 4. GESTÃO DE VISIBILIDADE DAS ABAS (Regras de Negócio) ---
    const isNotaShare = (origemReal === "share");
    const todasAbas = document.querySelectorAll('.tab-tags');
    const abasPrivadas = ['tags-neuronios', 'tags-associar', 'tags-topicos'];

    todasAbas.forEach(aba => {
        const target = aba.getAttribute('data-target');

        // Regra A: Esconde abas de Inteligência Pessoal se a nota for Share
        if (isNotaShare && abasPrivadas.includes(target)) {
            aba.style.display = 'none';
        } 
        // Regra B: O Elevador apenas tem acesso à aba de Tópicos
        else if (caixa.tipo === "elevador") {
            aba.style.display = (target === 'tags-topicos') ? 'flex' : 'none';
        } 
        else {
            aba.style.display = 'flex';
        }
    });

    // --- 5. SELEÇÃO AUTOMÁTICA DA ABA INICIAL ---
    if (isNotaShare) {
        // Notas Share abrem direto nas Referências/Documentação
        const btnRef = document.querySelector('.tab-tags[data-target="tags-referencias"]');
        if (btnRef) btnRef.click();
    } else if (caixa.tipo === "elevador") {
        const btnTop = document.querySelector('.tab-tags[data-target="tags-topicos"]');
        if (btnTop) btnTop.click();
    } else {
        // Notas Locais abrem nos Neurónios (Bíblia/Cosmos)
        const btnDefault = document.querySelector('.tab-tags[data-target="tags-neuronios"]');
        if (btnDefault) btnDefault.click();
    }

    // --- 6. RENDERIZAR ÍCONES DE GENEALOGIA (Coroa / Peão) ---
    if (typeof renderizarIconesGenealogia === 'function') {
        renderizarIconesGenealogia(caixa);
    }

    // --- 7. RENDERIZAR CONTEÚDOS ATUAIS (Pills e Listas) ---
    renderizarNeuroniosNoPopup(caixaAlvo);
    renderizarAssociados(caixaAlvo);
    renderizarVinculosTopicos(caixaAlvo);
    
    // --- 8. CARREGAR CARDS DE CODEX E REFERÊNCIAS ---
    // Usamos import dinâmico para garantir que os handlers estão prontos
    import('./tags-handlers-codex.js').then(m => m.renderizarCards(getCtx()));
    import('./tags-handlers-referencias.js').then(m => m.renderizarCards(getCtx()));

    // --- 9. SINCRONIZAÇÃO "IN LIVE" COM O PAINEL EYE (DIREITA) ---
    // Forçamos a atualização da aba Fontes do EYE mal o popup abre, 
    // garantindo que não há discrepância entre o que vês no popup e na barra lateral.
    import('../../../direita/eye-fontes-nota.js').then(m => {
        m.carregarFontesGlobaisDaNota(window.caixasAtuais);
    });
}

/**
 * LÓGICA DE PESQUISA
 */
function configurarInputsPesquisa() {
    // Pesquisa Bíblia
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

    // PESQUISA TÓPICOS (Pai)
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

    // PESQUISA SUBTÓPICOS
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
 * EXPOSIÇÃO DE FUNÇÕES AO WINDOW
 */
/**
 * EXPOSIÇÃO DE FUNÇÕES AO WINDOW (Eventos de Clique do HTML)
 */
function exporFuncoesGlobais() {
    
    
    // --- TÓPICOS E SUBTÓPICOS ---
 window.setTopicoPai = (id, nome) => {
    topicoPaiSelecionado = { id, nome };
    document.getElementById('search-tags-topico').value = "";
    document.getElementById('results-tags-topico').style.display = 'none';
    document.getElementById('selected-tags-topico-display').innerHTML = `
        <div class="neuronio-pill" style="border-color:var(--primary); background:rgba(99, 102, 241, 0.1); margin-bottom:10px;">
            <i class="fa-solid fa-check"></i> <span>Tópico: ${nome}</span>
            <i class="fa-solid fa-xmark" style="margin-left:10px; cursor:pointer;" onclick="window.limparTopicoFiltro()"></i>
        </div>`;
    
    // Ativa a secção de subtópicos
    const secSub = document.getElementById('section-tags-subtopico');
    secSub.style.opacity = "1";
    secSub.style.pointerEvents = "auto";
};

window.formatarInputTempo = (input) => {
    let val = input.value.replace(/\D/g, ''); // Remove lixo
    if (val.length > 6) val = val.substring(0, 6); // Limite de 6 dígitos

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

    // Remover Vínculo
    window.removerVincTopico = (uuid) => {
        TopicoHandlers.desvincularTopico(uuid, getCtx());
    };

    // --- NEURÓNIOS (BÍBLIA E COSMOS) ---
    window.vincularBiblia = (ref) => {
    NeuronioHandlers.vincularBiblia(ref, getCtx());
    
    // RESET UI BÍBLIA
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
    // Executa a lógica de gravação no Firebase e RAM
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
    
    console.log("🧹 [TAGS] Pesquisa Cosmos reiniciada após seleção.");
};


    window.desvincularCosmos = (id) => NeuronioHandlers.desvincularCosmos(id, getCtx());

    // --- ASSOCIAÇÕES (NOTAS E CAIXAS) ---
    window.vincularAoAssociado = (id, tit, tipo) => AssociarHandlers.vincular(id, tit, tipo, getCtx());
    window.removerAssociado = (id) => AssociarHandlers.remover(id, getCtx());
    
    // Abre a nota no sistema de abas do editor
    window.abrirNoBrowserExterno = (id) => {
        if (window.abrirNoBrowserExterno) {
            // Esta função é injetada pelo browser.js
            window.abrirNoBrowserExterno(id);
        }
    };

    // --- CODEX (MAPEAMENTO BIBLIOGRÁFICO) ---
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
            // Grava array de números limpo e ordenado
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

    // --- 1. RESET DOS BOTÕES (Garante que abrem ativos) ---
    [btnSim, btnNao].forEach(btn => {
        btn.disabled = false;
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
    });
    btnSim.innerText = "Sim, Remover";

    overlay.classList.add('active');

    btnSim.onclick = async () => {
        // --- 2. TRANCA TOTAL (Sim e Cancelar ficam inacessíveis) ---
        [btnSim, btnNao].forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = "none";
        });
        
        btnNao.style.opacity = "0.3"; // O cancelar fica quase invisível
        btnSim.style.opacity = "0.7";
        btnSim.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A eliminar...';

        console.group("🗑️ [CODEX-ACTION] REMOVER CARD");
        
        try {
            const cardParaRemover = caixaAlvo.codex.find(c => c.id === cardId);

            if (cardParaRemover) {
                // A) Atualização na Nota (Soft Delete)
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
            console.error("Erro na remoção:", error);
        } finally {
            console.groupEnd();
            overlay.classList.remove('active');
        }
    };

    // O botão Cancelar só funciona se o "Sim" ainda não tiver sido clicado
    btnNao.onclick = () => {
        overlay.classList.remove('active');
    };
};


    window.updateCodexReferencia = (cardId, valor) => {
    const card = caixaAlvo.codex.find(c => c.id === cardId);
    if (card) {
        card.referencia = valor;
        
        // Chamar a inteligência de identificação
        const info = CodexHandlers.identificarSiglaETipo(valor);
        card.sigla = info.sigla;
        card.tipo = info.tipo;

        // Persistir e atualizar apenas o texto do tipo sem redesenhar o card todo (opcional, para performance)
        // Ou simplesmente redesenhar:
        CodexHandlers.renderizarCards(getCtx());
        getCtx().persistir('codex', caixaAlvo.codex);
    }
};

// ATUALIZAR TAMBÉM O BROWSER PARA IDENTIFICAR AO SELECIONAR NO EXPLORADOR
window.triggerCodexBrowser = (cardId) => {
    const isNovo = (!cardId || cardId === "NEW");

    import('../codex-browser.js').then(mBrowser => {
        mBrowser.abrirPesquisaCodex(async (dadosReferencia) => {
            import('./tags-handlers-codex.js').then(async (mHandler) => {

                if (isNovo) {
                    await mHandler.adicionarItensAoCodex(dadosReferencia, getCtx());
                } else {
                    // SUBSTITUIÇÃO NO ARRAY PLANO COM LIMPEZA
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

    // --- REFERÊNCIAS EXTERNAS ---
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

    // 3. PESQUISA DE TÓPICO PAI (NOTA)
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

    // 4. PESQUISA DE SUBTÓPICO (NOTA)
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
 * FUNÇÕES AUXILIARES DE RENDERIZAÇÃO E CLIQUE (Expostas ao Window)
 */

// Renderiza a lista de resultados (Dropdown)
function renderizarResultadosPesquisaNota(lista, containerId, funcaoClique) {
    const div = document.getElementById(containerId);
    
    // PROTEÇÃO: Se a div não existir no HTML, avisa mas não bloqueia o site
    if (!div) {
        console.error(`Erro: Contentor #${containerId} não encontrado no HTML.`);
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
            <i class="fa-solid fa-circle-xmark remove-icon" onclick="window.removerTopicoDaNota('${t.id}')"></i>
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

    // LÓGICA SIMPLIFICADA
    if (caixa.origem === "original") {
        containerIcon.innerHTML = `<i class="fa-solid fa-crown" style="color: #fbbf24;" title="Original"></i>`;
    } 
    else if (caixa.origem === "copia") {
        containerIcon.innerHTML = `<i class="fa-solid fa-chess-pawn" style="color: #94a3b8;" title="Cópia"></i>`;
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
    // Apenas mostramos os links cujo estado NÃO seja 'desativo'
    const listaAtiva = lista.filter(link => link.estado !== 'off');

    if (listaAtiva.length === 0) {
        // Se todos os vínculos foram apagados, podemos avisar ou nem mostrar a Coroa/Peão
        texto.innerHTML = `<p style="color:gray; font-size:12px; padding:20px;">A nota de origem deste bloco já não está disponível.</p>`;
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
    // Usamos o dbRef e authRef que já estão definidos no topo do teu ficheiro
    if (!dbRef || !authRef) {
        console.error("❌ Erro: Referências do Firebase não encontradas no módulo de Tags.");
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
            // dbRef / authRef: as instâncias do Firebase
            // caixaId: o ID do bloco para fazer o scroll automático
            import('../../editor.js').then(m => {
                m.abrirNotaNoEditor(notaId, snap.data(), dbRef, authRef, caixaId);
            });

        } else {
            alert("A nota de destino já não existe no banco de dados.");
        }
    } catch (e) {
        console.error("❌ Erro ao tentar viajar para a nota vinculada:", e);
        alert("Ocorreu um erro ao aceder à nota vinculada.");
    }
};

/**
 * EXPOSIÇÃO GLOBAL PARA CLIQUES NO HTML
 */
window.setTopicoPaiNota = (docId, idUuid, nome) => {
    topicoPaiNotaSelecionado = { docId, id: idUuid, nome };
    document.getElementById('search-tags-nota-topico').value = "";
    document.getElementById('results-tags-nota-topico').style.display = 'none';
    document.getElementById('selected-tags-nota-topico-display').innerHTML = `
        <div class="neuronio-pill" style="border-color:var(--primary); background:rgba(99, 102, 241, 0.1); margin-bottom:10px;">
            <i class="fa-solid fa-check"></i> <span>Tópico Pai: ${nome}</span>
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
    // USAR A VARIÁVEL LOCAL notaAtivaIdLocal
    const notaId = notaAtivaIdLocal; 
    const db = dbRef;

    try {
        // 1. Gravar no Tópico (Firebase -> Topico -> notas)
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
    // USAR A VARIÁVEL LOCAL notaAtivaIdLocal
    const notaId = notaAtivaIdLocal;
    const db = dbRef;

    if (confirm("Remover este tópico da nota?")) {
        try {
            const notaRef = doc(db, "Local", notaId);
            const notaSnap = await getDoc(notaRef);
            if (notaSnap.exists()) {
                const vincs = notaSnap.data().vincTopicos || [];
                const alvo = vincs.find(v => v.id === uuid);
                
                if (alvo) {
                    // 1. Remover ID da nota do documento do Tópico
                    const subRef = doc(db, "Topico", alvo.firebaseId);
                    await updateDoc(subRef, { notas: arrayRemove(notaId) });

                    // 2. Remover objeto do array da Nota
                    const novosVincs = vincs.filter(v => v.id !== uuid);
                    await updateDoc(notaRef, { vincTopicos: novosVincs });
                    
                    renderizarVinculosNotaUI(novosVincs);
                }
            }
        } catch (e) {
            console.error("Erro ao remover tópico:", e);
        }
    }
};

window.updateRefManual = (id, campo, valor) => {
    RefHandlers.updateRef(id, campo, valor, getCtx());
};

window.removerRefManual = (id) => {
    if(confirm("Remover esta referência?")) {
        RefHandlers.removerRef(id, getCtx());
    }
};