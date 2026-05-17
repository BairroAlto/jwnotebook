// components/editor/editor.js
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Importação dos sub-módulos do editor
import { renderizarFeed } from './modulos/editor-render.js';
import { moverCaixa, prepararInsercao } from './modulos/editor-actions.js';
import { LockManager } from './modulos/lock-manager.js';
import { LockUI } from './modulos/lock-ui.js';

// Outros módulos e Popups
import { iniciarSistemaCores, abrirPaleta } from './modulos/paleta-cores.js';
import { iniciarSistemaRecuperacao, abrirCentroRecuperacao } from './modulos/recuperacao.js';
import { iniciarSistemaPartilha, abrirPopupPartilhar } from './modulos/partilhar.js';
import { iniciarSistemaBrowser, carregarAbasDaNota } from './modulos/browser.js';
import { iniciarSistemaTags, abrirPopupTags } from './modulos/tags/tags-controller.js';

import { renderizarIndice, ocultarIndice } from '../direita/indice.js';
import { carregarCaixasAssociadas } from '../direita/caixas-associadas.js';
import { carregarFontesGlobaisDaNota } from '../direita/eye-fontes-nota.js';
import { detectarEExibirTextosBiblicos } from '../direita/eye-textos-biblia.js';
import { iniciarAbaAncora } from '../direita/eye-ancora.js';
import { iniciarArquivo, renderizarModoArquivo } from './modulos/arquivo-controller.js';
import { atualizarIconeLab } from './modulos/lab-status.js';
import { despacharInteligenciaEye } from './modulos/intelligence/dispatcher.js';
import { iniciarShareController, gerirSessaoShare, isEdicaoAtiva } from './modulos/share-controller.js';
import { abrirSelector, iniciarSelectorBiblia } from './modulos/biblia-selector.js';
import { EditorUI } from './modulos/ui-utils.js';
import { SyncLogic } from './modulos/sync-logic.js';
import { ModoManager } from './modulos/modo-manager.js';
import { MobileUI } from '../ui/mobile-manager.js';


// ESTADO GLOBAL DO EDITOR
let timerGravacao = null; 
let notaAbertaId = null;
let notaMaeAtualId = null;
let caixasAtuais = [];
let dadosNotaOriginal = null; 
let dbRef = null;
let authRef = null;
let userLogado = null;
let eventosIniciados = false;
let aCriarCaixa = false;
let caixaParaOcultar = null;
let editandoAtivo = false;
let unsubLock = null;
let timerInatividade = null;
let notaComAlteracoes = false;




const TEMPO_LIMITE_INATIVIDADE = 30 * 60 * 1000;


window.abrirPaletaGlobal = (caixa) => {
    import('./modulos/paleta-cores.js').then(m => m.abrirPaleta(caixa));
};

window.abrirPopupPartilharGlobal = (caixa, id) => {
    import('./modulos/partilhar.js').then(m => m.abrirPopupPartilhar(caixa, id));
};

/**
 * GRAVAÇÃO IMEDIATA (Evita perda de dados ao trocar de nota ou criar nova)
 */
export async function forcarGravacaoImediata() {
    if (timerGravacao) {
        clearTimeout(timerGravacao);
        await guardarNotaNoFirebase();
    }
}

// Adicione este import no topo do editor.js
import { processarAberturaNota, configurarBotaoShare } from './modulos/nota-viewer.js';

// No editor.js, a função abrirNotaNoEditor agora é apenas um "despachante"
export async function abrirNotaNoEditor(notaId, dadosNota, db, auth, idCaixaFoco = null, maeIdOverride = null) {
    
    // Antes de mudar, garante que a nota anterior está salva
    await forcarGravacaoImediata();

    // Envia para o novo módulo lidar com a parte visual
    await processarAberturaNota({
        notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride,
        stateManager: {
            // Esta função interna vai atualizar as variáveis globais do editor.js
            inicializarDadosNota: async (id, dados, maeId) => {
                notaAbertaId = id;
                dadosNotaOriginal = dados;
                window.dadosNotaOriginal = dados;
                caixasAtuais = dados.caixas || [];
                window.caixasAtuais = caixasAtuais;
                notaMaeAtualId = maeId || id;
                dbRef = db; 
                authRef = auth;

                // Inicializa os motores se necessário
                if (!eventosIniciados) {
                    await inicializarMotoresInternos();
                    eventosIniciados = true;
                }

                // Sincroniza abas e share
                await gerirSessaoShare(id, dados);
                configurarBotaoShare(id, dados, auth);
                
                // Redesenha o feed
                return await atualizarFeedEGravar(false);
            }
        }
    });

    // Iniciar subsistemas de inteligência
    import('./modulos/intelligence/dispatcher.js').then(m => {
        m.despacharInteligenciaEye(caixasAtuais, dadosNotaOriginal, db, auth);
    });
}

// Crie esta função auxiliar para organizar os disparos de boot
async function inicializarMotoresInternos() {
    iniciarShareController(dbRef, authRef, () => guardarNotaNoFirebase());
    iniciarSelectorBiblia(() => atualizarFeedEGravar(true));
    iniciarSistemaRecuperacao(dbRef, authRef); 
    await iniciarSistemaCores(dbRef, authRef.currentUser, () => atualizarFeedEGravar(true));
    iniciarSistemaTags(dbRef, authRef); 
    iniciarSistemaBrowser(dbRef, authRef);
    configurarEventosFixos(); 
}

/**
 * GESTOR DE GRAVAÇÃO (ADAPTADO)
 */
function acionarGravacao(caixa = null) {
    const info = document.getElementById('editor-info-text');
    if (!info) return;

    // 1. MARCAR ALTERAÇÃO
    notaComAlteracoes = true; 

    if (caixa && typeof caixa === 'object') {
        caixa.timestamp = new Date().toISOString();
    }

    // --- NOVO: DISPARO DA INTELIGÊNCIA "IN LIVE" ---
    // Isto faz com que o Índice e o Detetor Bíblico atualizem enquanto digitas
    import('./modulos/intelligence/dispatcher.js').then(m => {
        m.despacharInteligenciaEye(caixasAtuais, dadosNotaOriginal, dbRef, authRef);
    });

    // 2. VERIFICAÇÃO DE PERMISSÃO E GRAVAÇÃO (DEBOUNCE)
    const isLocal = (dadosNotaOriginal.onde !== "share");
    const podeGravarNoShare = (dadosNotaOriginal.onde === "share" && isEdicaoAtiva());

    if (isLocal || podeGravarNoShare) {
        info.innerText = "A guardar...";
        
        clearTimeout(timerGravacao);
        timerGravacao = setTimeout(() => {
            guardarNotaNoFirebase();
        }, 1500); 
    } else {
        info.innerHTML = `<i class="fa-solid fa-lock"></i> Modo Leitura`;
        info.style.color = "#ef4444";
    }
}

/**
 * PONTE GLOBAL PARA AS FERRAMENTAS
 * Permite que os ficheiros das ferramentas (contentor.js, subnota.js, etc.) 
 * chamem o auto-save passando a referência da própria caixa.
 */
window.acionarGravacaoGlobal = (caixa) => {
    acionarGravacao(caixa);
};


// ADICIONA ESTA FUNÇÃO ANTES DO desenhar()
const abrirLupaBiblia = (caixa) => {
    console.log("🔍 [BRIDGE] Abrindo selector para:", caixa.id);
    abrirSelector(caixa);
};

/**
 * RENDERIZAÇÃO DO FEED
 */
function desenhar() {
    renderizarFeed({
        caixasAtuais,
        dadosNota: dadosNotaOriginal,
        feed: document.getElementById('editor-feed'),
        acionarGravacao,
        onApagar: (c) => { 
            caixaParaOcultar = c; 
            document.getElementById('popup-confirmar-overlay').classList.add('active'); 
        },
        abrirPaleta,
        
        // CORREÇÃO AQUI: 
        // Injetamos o notaAbertaId diretamente, sem esperar que a ferramenta o envie
        abrirPopupPartilhar: (c) => {
            import('./modulos/partilhar.js').then(m => {
                m.abrirPopupPartilhar(c, notaAbertaId, atualizarFeedEGravar);
            });
        },

        moverCaixa: (c, dir) => moverCaixa(caixasAtuais, c, dir, atualizarFeedEGravar),
        abrirPopupTags: (c) => {
            import('./modulos/tags/tags-controller.js').then(m => {
                m.abrirPopupTags(c, notaMaeAtualId, dadosNotaOriginal.onde);
            });
        },
        prepararInsercao,
        abrirLupaBiblia: abrirLupaBiblia, 
        notaAbertaId // Mantém este se necessário para outros módulos
    });
}

/**
 * INSERIR NOVA FERRAMENTA
 * Aqui definimos os campos padrão de cada tipo de bloco
 */
export function inserirFerramentaNoEditor(tipo) {
    // 1. BLOQUEIO DE SEGURANÇA: Evita que múltiplos cliques criem várias caixas
    if (aCriarCaixa) return;
    aCriarCaixa = true;
    notaComAlteracoes = true; 

    console.log(`➕ [EDITOR] Criando nova ferramenta: ${tipo}`);

    // 2. CAPTURAR POSIÇÃO ATUAL: Evita que o scroll salte para o topo
    const scrollContainer = document.querySelector('.center-col');
    const posicaoOriginal = scrollContainer ? scrollContainer.scrollTop : 0;

    // 3. CONGELAR ALTURA: Evita o "flicker" visual durante o render
    const feed = document.getElementById('editor-feed');
    if (feed) feed.style.minHeight = feed.offsetHeight + 'px';

    // 4. PREPARAR DADOS
    // Ordenar primeiro para garantir que a nova ordem faz sentido
    caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const novaCaixa = { 
        id: crypto.randomUUID(), 
        tipo: tipo, 
        conteudo: "", 
        estado: "ativa", 
        timestamp: new Date().toISOString(), 
        protecao: "fechado" 
    };

    // Inicializar campos específicos conforme o tipo
    if (["subnota", "questao", "raciocinio", "cartaovisita"].includes(tipo)) novaCaixa.titulo = "";
    if (tipo === "elevador") novaCaixa.pastapai = [];
    if (tipo === "cartaovisita") { 
        novaCaixa.url = ""; 
        novaCaixa.urldimensao = "pequena"; 
    }
    if (tipo === "citacaobiblica") novaCaixa.textosanexados = [];

    // 5. INSERIR NA POSIÇÃO CORRETA
    if (window.idReferenciaInsercao) {
        // Se foi usado o botão "+" entre dois blocos
        const idxAlvo = caixasAtuais.findIndex(c => c.id === window.idReferenciaInsercao);
        caixasAtuais.splice(idxAlvo + 1, 0, novaCaixa);
        window.idReferenciaInsercao = null; // Limpar referência de inserção
    } else {
        // Caso contrário, adiciona ao fim da lista
        caixasAtuais.push(novaCaixa);
    }

    // 6. RE-INDEXAR ORDENS: Garante que o Firebase recebe uma sequência limpa (1, 2, 3...)
    caixasAtuais.forEach((c, i) => { c.ordem = i + 1; });

    // 7. ATUALIZAR E GRAVAR
    // A função atualizarFeedEGravar(true) vai disparar a gravação no Firebase.
    // Graças ao "hasPendingWrites" que adicionámos ao nota-watcher.js, 
    // o sistema não vai duplicar a caixa ao receber o eco do servidor.
    atualizarFeedEGravar(true);

    // 8. FECHAR POPUP DE FERRAMENTAS
    const popup = document.getElementById('popup-ferramentas-inline');
    if (popup) popup.classList.remove('active');

    // 9. LIMPEZA FINAL E FOCO
    setTimeout(() => {
        // Restaurar scroll original
        if (scrollContainer) scrollContainer.scrollTop = posicaoOriginal;
        
        // Libertar altura mínima
        if (feed) feed.style.minHeight = '';

        // Tentar focar no novo bloco criado
        const elNovo = document.getElementById(`bloco-${novaCaixa.id}`);
        if (elNovo) {
            elNovo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const input = elNovo.querySelector('textarea, input');
            if (input) input.focus({ preventScroll: true });
        }

        // Libertar o bloqueio para permitir novas criações
        aCriarCaixa = false;
    }, 150);
}

/**
 * ATUALIZAÇÃO E PERSISTÊNCIA
 */
async function atualizarFeedEGravar(dispararGravacao = true) {
    if (!dadosNotaOriginal) return;

    // 1. Guardar posição do scroll antes de reconstruir o DOM
    if (window.caixasAtuais) dadosNotaOriginal.caixas = window.caixasAtuais;
    const estadoScroll = EditorUI.capturarEstadoScroll();

    // 2. Determinar Modos Ativos (Garante que é sempre um Array)
    const modosAtivos = Array.isArray(dadosNotaOriginal.modo) 
        ? dadosNotaOriginal.modo 
        : [dadosNotaOriginal.modo || 'normal'];
    
    // Atualiza o ícone do frasco (Lab) no topo
    if (typeof atualizarIconeLab === 'function') atualizarIconeLab(modosAtivos);

    // Gestão de visibilidade das abas do Modo Arquivo
    const tabsArquivoUI = document.getElementById('arquivo-tabs-container');
    if (tabsArquivoUI) {
        tabsArquivoUI.style.display = modosAtivos.includes('arquivo') ? 'block' : 'none';
    }

    // 3. Renderização Condicional (Arquivo vs Feed Normal)
    if (modosAtivos.includes('arquivo')) {
        const m = await import('./modulos/arquivo-controller.js');
        m.iniciarArquivo(dbRef, authRef, atualizarFeedEGravar);
        m.renderizarModoArquivo(notaAbertaId, dadosNotaOriginal);
    } else {
        // Ordenação baseada no modo (Post: mais recentes primeiro | Normal: sequência direta)
        const isModoPost = modosAtivos.includes('post');
        if (isModoPost) {
            caixasAtuais.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
        } else {
            caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        }
        await desenhar(); // Desenha os blocos
    }

    // 4. 🚀 SOLUÇÃO DO BUG DE COMPACTAÇÃO (Auto-Resize Inteligente)
    // Forçamos o browser a recalcular as alturas de todos os blocos após a pintura do DOM.
    requestAnimationFrame(() => {
        // Primeiro ajuste imediato
        if (typeof EditorUI.forçarAjusteAlturas === 'function') {
            EditorUI.forçarAjusteAlturas();
        }

        // Segundo ajuste com pequeno delay para garantir que o layout estabilizou (Imagens, Fontes, etc)
        setTimeout(() => {
            if (typeof EditorUI.forçarAjusteAlturas === 'function') {
                EditorUI.forçarAjusteAlturas();
            }
            // Restaurar o scroll apenas depois de as caixas terem a altura final correta
            EditorUI.restaurarScroll(estadoScroll);
        }, 120);
    });

    // 5. Disparar Inteligência da Coluna Direita (Índice, IA, Fontes...)
    import('./modulos/intelligence/dispatcher.js').then(m => {
        m.despacharInteligenciaEye(caixasAtuais, dadosNotaOriginal, dbRef, authRef);
    });

    // 6. Salvar no Firebase se necessário
    if (dispararGravacao) acionarGravacao();

    return Promise.resolve();
}


async function guardarNotaNoFirebase() {
    if (!notaAbertaId || !dbRef || !authRef.currentUser) return;
    if (!notaComAlteracoes) return; 

    const uid = authRef.currentUser.uid;
    const isShare = (dadosNotaOriginal.onde === "share");
    const colecaoAlvo = isShare ? "Share" : "Local";
    
    try {
        const novoNome = document.getElementById('editor-titulo').innerText.trim();
        const notaRef = doc(dbRef, colecaoAlvo, notaAbertaId);

        // GARANTIR QUE NÃO ENVIAMOS UNDEFINED
        const updateData = { 
            nome: novoNome, 
            caixas: caixasAtuais || [],
            // Adicionamos proteção para os metadados
            vincTopicos: dadosNotaOriginal.vincTopicos || [] 
        };

        if (isShare) {
            updateData.vistoPor = [uid]; 
            updateData[`${uid}.ultimaLeitura`] = new Date().toISOString();
        }

        await updateDoc(notaRef, updateData);
        notaComAlteracoes = false; 

        // 🚀 GATILHO DO GPS: Indexar após gravar com sucesso
        import('./modulos/ai-search-indexer.js').then(m => {
            m.dispararIndexacao(dbRef, uid, notaAbertaId, {
                nome: novoNome,
                caixas: caixasAtuais,
                vincTopicos: dadosNotaOriginal.vincTopicos || []
            });
        });

        const info = document.getElementById('editor-info-text');
        if (info) info.innerText = "Sincronizado";

    } catch (e) {
        console.error(`❌ Erro ao gravar:`, e);
    }
}

/**
 * Lógica para o botão NEXO dentro do Laboratório
 */
window.abrirFerramentasDoNexo = () => {
    // 1. Fechar o popup do Laboratório
    const popupLab = document.getElementById('popup-lab-overlay');
    if (popupLab) popupLab.classList.remove('active');

    // 2. Resetar a referência de inserção (para que o novo bloco vá para o fim da lista)
    window.idReferenciaInsercao = null;

    // 3. Abrir o popup de ferramentas inline
    const popupFerramentas = document.getElementById('popup-ferramentas-inline');
    if (popupFerramentas) {
        popupFerramentas.classList.add('active');
    }
    
    console.log("🔗 Nexo: A abrir seletor de ferramentas para nota vazia.");
};

/**
 * CONFIGURAÇÃO DE EVENTOS FIXOS DA UI
 */
/**
 * CONFIGURAÇÃO DE EVENTOS FIXOS DA UI
 * Centraliza os eventos do Lab, Histórico, Tags e expõe funções para o Controlador de Arquivo.
 */
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





