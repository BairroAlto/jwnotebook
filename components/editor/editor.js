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

/**
 * FUNÇÃO AUXILIAR: Ajusta todos os campos de texto automáticos (Títulos e Conteúdos)
 * Esta função só funciona se o container NÃO estiver em 'display: none'
 */
function ajustarAlturasDinamicamente() {
    const campos = document.querySelectorAll('.tool-title-input, #editor-feed textarea');
    campos.forEach(el => {
        el.style.height = 'auto'; // Reseta
        el.style.height = el.scrollHeight + 'px'; // Aplica altura real baseada no texto
    });
}

/**
 * FUNÇÃO AUXILIAR: Configura o comportamento do ícone de partilha (roldana/partilha)
 * Coloca isto no final do teu ficheiro editor.js
 */
/**
 * Configura o comportamento do ícone de partilha no cabeçalho do editor.
 * Notas Locais -> Abrem o sistema de envio de cópias/clonagem (V2).
 * Notas Share -> Abrem a gestão de amigos/colaboradores.
 */
function configurarBotaoShare(notaId, dadosNota, auth) {
    // Localiza o ícone de partilha (o avião de papel/nodos no topo direito)
    const btnShareNota = document.querySelector('i[title="Partilhar"]');
    if (!btnShareNota) return;

    // Limpar eventos anteriores para evitar execuções duplicadas
    btnShareNota.onclick = null;

    if (dadosNota.onde === "share") {
        // --- CENÁRIO A: NOTA JÁ PARTILHADA (Colaborativa) ---
        // Apenas o dono da nota pode gerir quem tem acesso.
        const souDono = dadosNota.userId === auth.currentUser.uid;
        
        if (souDono) {
            btnShareNota.style.display = "block";
            btnShareNota.style.color = "#ef4444"; // Destaque vermelho para modo Share
            btnShareNota.onclick = () => {
                console.log("👥 Abrindo Gestão de Colaboradores (Tempo Real)...");
                import('../share/gestao-share.js').then(m => m.abrirGestaoPartilha(notaId, auth));
            };
        } else {
            // Se for convidado, não pode gerir acessos de outros
            btnShareNota.style.display = "none";
        }
    } else {
        // --- CENÁRIO B: NOTA LOCAL (Novo Sistema de Clonagem V2) ---
        // Permite enviar uma cópia seletiva para amigos ou gerar link.
        btnShareNota.style.display = "block";
        btnShareNota.style.color = "var(--text-muted)"; // Cor padrão do editor
        
        btnShareNota.onclick = () => {
            console.log("🚀 Abrindo Sistema de Partilha V2 (Clonagem e OUT)...");
            
            // Importa o novo módulo V2 que criámos
            import('./modulos/partilhar-v2.js').then(m => {
                // Inicializa o motor se necessário e abre o popup
                m.iniciarPartilhaV2(dbRef, authRef);
                m.abrirPopupPartilharV2(dadosNota);
            }).catch(err => {
                console.error("Erro ao carregar o motor de partilha V2:", err);
            });
        };
    }
}

/**
 * ABRIR UMA NOTA NO EDITOR
 */
export async function abrirNotaNoEditor(notaId, dadosNota, db, auth, idCaixaFoco = null, maeIdOverride = null) {

     // --- ADICIONA ESTA LINHA LOGO NO TOPO ---
    if (typeof MobileUI !== 'undefined') {
        MobileUI.fecharColunaEsquerda();
    } else {
        // Fallback caso o módulo não esteja carregado
        document.getElementById('area-esquerda')?.classList.add('closed');
        document.getElementById('mobile-overlay')?.classList.remove('active');
    }
    
    window.itemSelecionadoId = notaId; 
    MobileUI.fecharColunaEsquerda();
    // 1. GESTÃO DE TELAS DE LOADING
    const placeholder = document.getElementById('editor-placeholder');
    const container = document.getElementById('editor-container');
    const loading = document.getElementById('editor-loading');

    if (placeholder) placeholder.style.display = 'none';
    if (container) container.style.display = 'none';
    if (loading) loading.style.display = 'flex';

    // 2. SEGURANÇA: GRAVAR NOTA ANTERIOR
    // Se havia uma gravação pendente da nota que estava aberta antes, forçamos agora.
    await forcarGravacaoImediata(); 

    // 3. ATUALIZAR ESTADO GLOBAL DO EDITOR
    dbRef = db; 
    authRef = auth;
    notaAbertaId = notaId;
    notaComAlteracoes = false; 
    dadosNotaOriginal = dadosNota; 
    window.dadosNotaOriginal = dadosNota; 
    caixasAtuais = dadosNota.caixas || [];
    window.caixasAtuais = caixasAtuais; 
    notaMaeAtualId = maeIdOverride || notaId;

    // 4. INICIALIZAÇÃO ÚNICA DE MOTORES (Apenas na primeira vez que abre qualquer nota)
    if (!eventosIniciados) {
        iniciarShareController(db, auth, () => guardarNotaNoFirebase());
        iniciarSelectorBiblia(() => atualizarFeedEGravar(true));
        iniciarSistemaRecuperacao(db, auth); 
        await iniciarSistemaCores(db, auth.currentUser, () => atualizarFeedEGravar(true));
        iniciarSistemaTags(db, auth); 
        iniciarSistemaBrowser(db, auth);
        configurarEventosFixos(); 
        eventosIniciados = true;
    }

    // 5. GESTÃO DE SESSÃO E LOCKS (Notas Share)
    if (dadosNota.onde === "share") {
        const uid = auth.currentUser.uid;
        window.sessaoUltimaLeitura = dadosNota[uid]?.ultimaLeitura || 0;
        try {
            await updateDoc(doc(db, "Share", notaId), { 
                vistoPor: arrayUnion(uid),
                [`${uid}.ultimaLeitura`]: new Date().toISOString()
            });
        } catch (e) { console.warn("Erro ao atualizar metadados share"); }
    }
    
    // Ativar aba Índice por defeito na coluna EYE (Direita)
    if (window.switchEyeTab) window.switchEyeTab('indice');

    // Ativar vigilância de tranca (Lock Manager)
    await gerirSessaoShare(notaId, dadosNota);

    // 6. CONFIGURAÇÃO DO TÍTULO E MODOS (ARQUIVO / NORMAL)
    const tituloEditor = document.getElementById('editor-titulo');
    if (tituloEditor) tituloEditor.innerText = dadosNota.nome || "Sem Título";

    // --- LÓGICA DE CORREÇÃO DO MODO ARQUIVO ---
    const modosAtivos = Array.isArray(dadosNota.modo) ? dadosNota.modo : [dadosNota.modo || 'normal'];
    const tabsArquivoUI = document.getElementById('arquivo-tabs-container');

    if (modosAtivos.includes('arquivo')) {
        // A) Garantir integridade dos dados (se a nota for antiga e não tiver o objeto Arquivo)
        if (!dadosNota.Arquivo) {
            dadosNota.Arquivo = { gavetas: {} };
        }

        // B) Resetar o Navegador de Arquivo (Garante que abres na Raiz e não dentro de uma gaveta da nota anterior)
        iniciarArquivo(db, auth, () => atualizarFeedEGravar(true));

        // C) Mostrar a barra de abas FEED | ARQUIVO
        if (tabsArquivoUI) tabsArquivoUI.style.display = 'block';
        console.log("📁 Modo Arquivo Ativado para esta nota.");
    } else {
        // Esconder a barra de abas se não for modo arquivo
        if (tabsArquivoUI) tabsArquivoUI.style.display = 'none';
    }

    // 7. RENDERIZAR O CONTEÚDO (FEED OU ARQUIVO)
    // Passamos false para não disparar uma gravação imediata apenas por abrir a nota
    await atualizarFeedEGravar(false); 

    // 8. CARREGAR SUBSISTEMAS DE NOTA
    iniciarAbaAncora(notaId, db, auth); // Temas ancorados (EYE)
    carregarAbasDaNota(notaMaeAtualId, dadosNota, notaId); // Tabs superiores
    configurarBotaoShare(notaId, dadosNota, auth); // Lógica de Clonagem vs Colaboração

    // 9. FINALIZAR CARREGAMENTO E AJUSTAR UI
    container.style.visibility = 'hidden';
    container.style.display = 'block';
    
    // Aguardar o próximo frame para o browser calcular os scrollHeights
    await new Promise(res => requestAnimationFrame(res));
    
    // Ajustar automaticamente a altura de todos os campos de texto
    const campos = document.querySelectorAll('.tool-title-input, #editor-feed textarea');
    campos.forEach(el => { 
        el.style.height = 'auto'; 
        el.style.height = el.scrollHeight + 'px'; 
    });
    
    container.style.visibility = 'visible';
    if (loading) loading.style.display = 'none';

    // 10. SCROLL PARA CAIXA ESPECÍFICA (Se houver um teleporte ativo)
    if (idCaixaFoco) {
        setTimeout(() => {
            const elAlvo = document.getElementById(`bloco-${idCaixaFoco}`);
            if (elAlvo) elAlvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
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

    // 1. Guardar posição do scroll antes de limpar o HTML
    if (window.caixasAtuais) dadosNotaOriginal.caixas = window.caixasAtuais;
    const estadoScroll = EditorUI.capturarEstadoScroll();

    // 2. Determinar Modos Ativos (Garante que é sempre um Array)
    const modosAtivos = Array.isArray(dadosNotaOriginal.modo) 
        ? dadosNotaOriginal.modo 
        : [dadosNotaOriginal.modo || 'normal'];
    
    // Atualiza o ícone do frasco no topo (Verde, Amarelo ou Cinza)
    if (typeof atualizarIconeLab === 'function') atualizarIconeLab(modosAtivos);

    // --- LÓGICA DE VISIBILIDADE DAS ABAS (O QUE ESTAVA A FALTAR) ---
    const tabsArquivoUI = document.getElementById('arquivo-tabs-container');
    if (tabsArquivoUI) {
        if (modosAtivos.includes('arquivo')) {
            tabsArquivoUI.style.display = 'block'; // Força o aparecimento das abas
        } else {
            tabsArquivoUI.style.display = 'none';  // Esconde se voltarmos ao normal
        }
    }

    // 3. Renderização Condicional
    if (modosAtivos.includes('arquivo')) {
        // Carrega o controlador de arquivo e desenha a estrutura de gavetas
        const m = await import('./modulos/arquivo-controller.js');
        m.iniciarArquivo(dbRef, authRef, atualizarFeedEGravar);
        m.renderizarModoArquivo(notaAbertaId, dadosNotaOriginal);
    } else {
        // Ordenação para Feed Normal (b-a para Post, a-b para Normal)
        const isModoPost = modosAtivos.includes('post');
        if (isModoPost) {
            caixasAtuais.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
        } else {
            caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        }
        await desenhar(); // Desenha o feed de blocos padrão
    }

    // 4. Disparar Inteligência da Coluna Direita (Async)
    import('./modulos/intelligence/dispatcher.js').then(m => {
        m.despacharInteligenciaEye(caixasAtuais, dadosNotaOriginal, dbRef, authRef);
    });

    // 5. Salvar no Firebase se necessário
    if (dispararGravacao) acionarGravacao();

    // 6. Restaurar Scroll e Ajustar Alturas de Títulos
    EditorUI.restaurarScroll(estadoScroll);
    requestAnimationFrame(() => {
        EditorUI.ajustarTitulos();
    });

    return Promise.resolve();
}


async function guardarNotaNoFirebase() {
    if (!notaAbertaId || !dbRef || !authRef.currentUser) return;

    // 🛡️ NOVO BLOQUEIO DE SEGURANÇA:
    // Se não houve alterações reais, saímos imediatamente.
    // Isto evita que o updateDoc seja chamado e que os outros vejam o "SHARE" em vermelho.
    if (!notaComAlteracoes) {
        console.log("💤 [SAVE] Nada mudou. Abortando gravação para não notificar colaboradores.");
        const info = document.getElementById('editor-info-text');
        if (info) {
            info.innerText = "Sincronizado";
            info.style.color = "var(--text-muted)";
        }
        return; 
    }

    const uid = authRef.currentUser.uid;
    const isShare = (dadosNotaOriginal.onde === "share");
    const colecaoAlvo = isShare ? "Share" : "Local";
    
    try {
        const novoNome = document.getElementById('editor-titulo').innerText.trim();
        const notaRef = doc(dbRef, colecaoAlvo, notaAbertaId);

        const updateData = { 
            nome: novoNome, 
            caixas: caixasAtuais 
        };

        if (isShare) {
            // Só limpamos o vistoPor se o utilizador realmente mudou conteúdo
            updateData.vistoPor = [uid]; 
            updateData[`${uid}.ultimaLeitura`] = new Date().toISOString();
            console.log("📢 [SHARE] Conteúdo alterado. Notificando colaboradores.");
        }

        await updateDoc(notaRef, updateData);

        // ✅ Resetar a flag apenas após uma gravação bem sucedida
        notaComAlteracoes = false; 

        const info = document.getElementById('editor-info-text');
        if (info) {
            info.innerText = "Sincronizado";
            info.style.color = "var(--text-muted)";
        }

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





