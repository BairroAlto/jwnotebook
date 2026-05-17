// components/editor/editor.js
// components/editor/editor.js
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { processarAberturaNota, configurarBotaoShare } from './modulos/nota-viewer.js';

// Sub-módulos (Mantemos os imports para o state manager usar)
import { renderizarFeed } from './modulos/editor-render.js';
import { moverCaixa, prepararInsercao } from './modulos/editor-actions.js';
import { LockManager } from './modulos/lock-manager.js';
import { LockUI } from './modulos/lock-ui.js';
import { iniciarShareController, gerirSessaoShare, isEdicaoAtiva } from './modulos/share-controller.js';
import { abrirSelector, iniciarSelectorBiblia } from './modulos/biblia-selector.js';
import { EditorUI } from './modulos/ui-utils.js';

// ESTADO GLOBAL DO EDITOR (As variáveis que os outros módulos lêem)
export let notaAbertaId = null;
export let caixasAtuais = [];
export let dadosNotaOriginal = null;
let dbRef, authRef, notaMaeAtualId;
let eventosIniciados = false;
let timerGravacao = null;
let notaComAlteracoes = false;

/**
 * FUNÇÃO PRINCIPAL: Agora é apenas um organizador de dados
 */
export async function abrirNotaNoEditor(notaId, dadosNota, db, auth, idCaixaFoco = null, maeIdOverride = null) {
    dbRef = db; 
    authRef = auth;

    // 1. Gravar nota anterior antes de mudar
    await forcarGravacaoImediata();

    // 2. Chamar o Viewer (A parte visual que espera pelo HTML)
    await processarAberturaNota({
        notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride,
        stateManager: {
            inicializarDadosNota: async (id, dados, maeId) => {
                // Atualizar estado interno
                notaAbertaId = id;
                window.notaAbertaId = id;
                dadosNotaOriginal = dados;
                window.dadosNotaOriginal = dados;
                caixasAtuais = dados.caixas || [];
                window.caixasAtuais = caixasAtuais;
                notaMaeAtualId = maeId || id;

                // Motores
                if (!eventosIniciados) {
                    iniciarShareController(db, auth, () => guardarNotaNoFirebase());
                    iniciarSelectorBiblia(() => atualizarFeedEGravar(true));
                    configurarEventosFixos();
                    eventosIniciados = true;
                }

                await gerirSessaoShare(id, dados);
                configurarBotaoShare(id, dados, auth);
                
                return await atualizarFeedEGravar(false);
            }
        }
    });

    // 3. Inteligência em background
    import('./modulos/intelligence/dispatcher.js').then(m => {
        m.despacharInteligenciaEye(caixasAtuais, dadosNotaOriginal, db, auth);
    });
}

/**
 * REDESENHAR FEED
 */
export async function atualizarFeedEGravar(dispararGravacao = true) {
    const feed = document.getElementById('editor-feed');
    if (!feed) return;

    const modos = Array.isArray(dadosNotaOriginal?.modo) ? dadosNotaOriginal.modo : [dadosNotaOriginal?.modo || 'normal'];
    
    // Se estiver no modo arquivo, o arquivo-controller assume
    if (modos.includes('arquivo')) {
        const m = await import('./modulos/arquivo-controller.js');
        m.renderizarModoArquivo(notaAbertaId, dadosNotaOriginal);
    } else {
        renderizarFeed({
            caixasAtuais,
            dadosNota: dadosNotaOriginal,
            feed: feed,
            acionarGravacao: (c) => acionarGravacao(c),
            onApagar: (c) => { window.prepararOcultarGlobal(c); },
            abrirPaleta: (c) => window.abrirPaletaGlobal(c),
            abrirPopupPartilhar: (c) => window.abrirPopupPartilharGlobal(c),
            moverCaixa: (c, dir) => moverCaixa(caixasAtuais, c, dir, () => atualizarFeedEGravar(false)),
            abrirPopupTags: (c) => window.abrirPopupTagsGlobal(c),
            prepararInsercao,
            abrirLupaBiblia: (c) => abrirSelector(c),
            notaAbertaId
        });
    }

    if (dispararGravacao) acionarGravacao();
}

/**
 * GESTÃO DE GRAVAÇÃO
 */
function acionarGravacao(caixa = null) {
    notaComAlteracoes = true;
    if (caixa) caixa.timestamp = new Date().toISOString();
    
    document.getElementById('editor-info-text').innerText = "A guardar...";
    clearTimeout(timerGravacao);
    timerGravacao = setTimeout(() => guardarNotaNoFirebase(), 1500);
}

export async function forcarGravacaoImediata() {
    if (timerGravacao) {
        clearTimeout(timerGravacao);
        await guardarNotaNoFirebase();
    }
}

async function guardarNotaNoFirebase() {
    if (!notaAbertaId || !notaComAlteracoes) return;
    const colecao = (dadosNotaOriginal.onde === "share") ? "Share" : "Local";
    const notaRef = doc(dbRef, colecao, notaAbertaId);
    
    try {
        await updateDoc(notaRef, { 
            nome: document.getElementById('editor-titulo').innerText,
            caixas: caixasAtuais 
        });
        notaComAlteracoes = false;
        document.getElementById('editor-info-text').innerText = "Sincronizado";
    } catch (e) { console.error("Erro ao gravar:", e); }
}

function configurarEventosFixos() {
    
    // ========================================================
    // 1. LÓGICA DO POPUP DE CONFIRMAÇÃO (LIXEIRA/OCULTAR)
    // ========================================================
    const btnSimOcultar = document.getElementById('btn-confirmar-ocultar');
    const btnNaoOcultar = document.getElementById('btn-cancelar-ocultar');
    const popupOcultar = document.getElementById('popup-confirmar-overlay');

   if (btnSimOcultar) {
btnSimOcultar.onclick = async () => {
    if (caixaParaOcultar) {
        // 1. Marcar como desativa localmente
        caixaParaOcultar.estado = "desativa";
        
        // 2. ADICIONAR O REGISTO DE QUANDO FOI OCULTADA (Novo campo)
        caixaParaOcultar.timedelete = new Date().toISOString();
    

        if (popupOcultar) popupOcultar.classList.remove('active');

        // 3. Gravar no Firebase e redesenhar o feed
        await atualizarFeedEGravar();
        
        caixaParaOcultar = null;
    }
};
    }

    if (btnNaoOcultar) {
        btnNaoOcultar.onclick = () => {
            if (popupOcultar) popupOcultar.classList.remove('active');
            caixaParaOcultar = null;
        };
    }

    // ========================================================
    // 2. BOTÕES DA BARRA SUPERIOR DO EDITOR
    // ========================================================

    // Botão Histórico / Restauro (Relógio)
   const btnRestaurar = document.getElementById('btn-editor-restaurar');
    if (btnRestaurar) {
        btnRestaurar.onclick = () => {
            import('./modulos/recuperacao.js').then(m => {
                // PASSAMOS dbRef e authRef NO FINAL
                m.abrirCentroRecuperacao(caixasAtuais, dadosNotaOriginal, notaAbertaId, atualizarFeedEGravar, dbRef, authRef);
            });
        };
    }

    // Botão Laboratório de Modos (Frasco)
const btnLab = document.getElementById('btn-editor-lab');
if (btnLab) {
    btnLab.onclick = () => {
        // 1. VERIFICAÇÃO DE SEGURANÇA (Modo Leitura)
        const feed = document.getElementById('editor-feed');
        if (feed && feed.style.pointerEvents === "none") {
            console.warn("🚫 [LAB] Bloqueado: Nota em modo leitura.");
            return; 
        }

        const overlay = document.getElementById('popup-lab-overlay');
        
        // 2. DEFINIR modosAtivos (O que estava a faltar e causava o erro!)
        const modosAtivos = Array.isArray(dadosNotaOriginal?.modo) 
            ? dadosNotaOriginal.modo 
            : [dadosNotaOriginal?.modo || 'normal'];

        // 3. Sincronizar visual dos botões no Lab
        overlay.querySelectorAll('.lab-item').forEach(card => {
            const m = card.getAttribute('data-mode');
            if (modosAtivos.includes(m)) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        // 4. Abrir o Popup
        overlay.classList.add('active');
    };
}

    // Botão Tags / Conexões
const btnTagsGeral = document.getElementById('btn-editor-tags');
if (btnTagsGeral) {
    btnTagsGeral.onclick = () => {
        // SEGURANÇA EXTRA: Se for nota Share, a função nem sequer executa
        if (window.dadosNotaOriginal && window.dadosNotaOriginal.onde === "share") {
            return; 
        }

        const feed = document.getElementById('editor-feed');
        if (feed && feed.style.pointerEvents === "none") return;

        import('./modulos/tags/tags-controller.js').then(m => {
            m.abrirPopupTagsNota(notaAbertaId, dbRef, authRef);
        });
    };
}

    // Auto-save do Título da Nota
    const inputTitulo = document.getElementById('editor-titulo');
    if (inputTitulo) {
        inputTitulo.oninput = () => acionarGravacao();
    }

    // ========================================================
    // 3. FUNÇÕES GLOBAIS (PONTES PARA OUTROS MÓDULOS)
    // ========================================================



    // Atalhos para os Handlers das ferramentas chamarem funções do Editor
    window.acionarGravacaoGlobal = () => acionarGravacao();
    window.abrirPaletaGlobal = (caixa) => abrirPaleta(caixa);
    window.moverCaixaGlobal = (caixa, dir) => moverCaixa(caixasAtuais, caixa, dir, atualizarFeedEGravar);
    window.prepararInsercaoGlobal = (idCaixa) => prepararInsercao(idCaixa);
window.abrirPopupPartilharGlobal = (caixa, id) => abrirPopupPartilhar(caixa, id, atualizarFeedEGravar);
window.abrirPopupTagsGlobal = (caixa) => {
    import('./modulos/tags/tags-controller.js').then(m => {
        // Garantir que passamos os 3 parâmetros
        m.abrirPopupTags(caixa, notaMaeAtualId, dadosNotaOriginal.onde);
    });
};

window.alterarModoNota = async (novoModo) => {
    if (!notaAbertaId || !dbRef) return;

 // 📖 PONTE GLOBAL PARA O SELETOR BÍBLICO (COLA AQUI!)
    window.abrirSeletorBibliaGlobal = (caixa) => {
        console.log("🔍 [EDITOR] Chamando Seletor Bíblico para a caixa:", caixa.id);
        
        import('./modulos/biblia-selector.js').then(m => {
            if (typeof m.abrirSelector === 'function') {
                m.abrirSelector(caixa);
            } else {
                console.error("❌ Erro: Função 'abrirSelector' não encontrada.");
            }
        }).catch(err => {
            console.error("❌ Erro ao carregar o módulo biblia-selector.js:", err);
        });
    };
    
    // ============================================================
    // 1. CASO ESPECIAL: PESQUISA GLOBAL (Ação não persistente)
    // ============================================================
    if (novoModo === 'global') {
        console.log("📡 [SISTEMA] Gatilho Global: Iniciando varredura de rede sem gravar no banco.");

        // A) Fechar o popup do Laboratório imediatamente
        const popupLab = document.getElementById('popup-lab-overlay');
        if (popupLab) popupLab.classList.remove('active');

        // B) Recolher o texto de todas as caixas ativas
        const caixasParaVarrer = caixasAtuais.filter(c => c.estado === 'ativa');

        if (caixasParaVarrer.length > 0) {
            const superTextoGlobal = caixasParaVarrer
                .map(c => `${c.titulo || ""} ${c.conteudo || ""}`)
                .join(" [BLOCK_SYNC] ");

            // C) Disparar o X-SAT (Modo Global = true)
            if (typeof window.dispararPesquisaParabolica === 'function') {
                window.dispararPesquisaParabolica(superTextoGlobal, true);
            }
        }

        // D) SAÍDA ANTECIPADA: Não mudamos o campo 'modo' no Firebase nem no objeto local
        return; 
    }

    // ============================================================
    // 2. MODOS PERSISTENTES (Normal, Arquivo, Post, etc.)
    // ============================================================
    const colecaoAlvo = (dadosNotaOriginal.onde === "share") ? "Share" : "Local";
    const notaRef = doc(dbRef, colecaoAlvo, notaAbertaId);

    let modosAtuais = Array.isArray(dadosNotaOriginal.modo) 
        ? [...dadosNotaOriginal.modo] 
        : [dadosNotaOriginal.modo || 'normal'];

    // Lógica de Toggle
    if (novoModo === 'normal') {
        modosAtuais = ["normal"];
    } else {
        if (modosAtuais.includes(novoModo)) {
            modosAtuais = modosAtuais.filter(m => m !== novoModo);
            if (modosAtuais.length === 0) modosAtuais = ["normal"];
        } else {
            modosAtuais.push(novoModo);
            modosAtuais = modosAtuais.filter(m => m !== 'normal');
        }
    }

    // Atualização Visual do Popup (para os modos que ficam ativos)
    const cardsLab = document.querySelectorAll('.lab-item');
    cardsLab.forEach(card => {
        const m = card.getAttribute('data-mode');
        card.classList.toggle('active', modosAtuais.includes(m));
    });

    // Atualizar Memória Local e Ícone do Topo
    dadosNotaOriginal.modo = modosAtuais;
    if (typeof atualizarIconeLab === 'function') {
        atualizarIconeLab(modosAtuais);
    }

    // Redesenhar o Editor (Troca entre Feed e Arquivo)
    if (typeof atualizarFeedEGravar === 'function') {
        await atualizarFeedEGravar(false); 
    }

    // Persistir no Firestore apenas para os outros modos
    try {
        await updateDoc(notaRef, { modo: modosAtuais });
        console.log(`✅ [MODO] Configuração salva: [${modosAtuais.join(', ')}]`);
    } catch (e) {
        console.error("❌ [MODO] Erro ao gravar no Firebase:", e);
    }
};

window.prepararOcultarGlobal = (caixa) => {
    caixaParaOcultar = caixa; 
    const popup = document.getElementById('popup-confirmar-overlay'); 
    if (popup) popup.classList.add('active');
};
}



// Expor função para o escopo global (usada nos botões onclick do HTML)
window.inserirFerramentaNoEditor = inserirFerramentaNoEditor;


// Dentro de editor.js

window.switchEyeTab = (tabNome) => {
    const ids = [
        'indice-nota-container', 
        'textos-container', 
        'ancora-nota-container', 
        'fontes-nota-container', 
        'caixas-associadas-container'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    document.querySelectorAll('#sub-tabs-eye i').forEach(i => i.classList.remove('active'));

    const map = { 
        'indice': 'indice-nota-container', 
        'textos': 'textos-container', 
        'ancora': 'ancora-nota-container', 
        'fontes': 'fontes-nota-container', 
        'caixas': 'caixas-associadas-container' 
    };

    const targetId = map[tabNome];
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.display = 'flex';

    const btnIcon = document.getElementById(`btn-tab-${tabNome}`);
    if (btnIcon) btnIcon.classList.add('active');

    // --- CORREÇÃO 2: DISPARAR DETETOR BÍBLICO AO CLICAR NA ABA ---
    if (tabNome === 'textos' && window.caixasAtuais) {
        import('../direita/eye-textos-biblia.js').then(m => {
            m.detectarEExibirTextosBiblicos(window.caixasAtuais);
        });
    }
};

window.addEventListener('beforeunload', () => {
    if (editandoAtivo && dadosNotaOriginal.onde === "share") {
        LockManager.libertar(dbRef, notaAbertaId);
    }
});





