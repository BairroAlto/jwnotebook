// components/editor/modulos/arquivo-controller.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarFeed } from './editor-render.js';
import { ArquivoTemplates } from './arquivo-ui-templates.js';

// CAMINHOS CORRIGIDOS:
import { IDENTIDADE_FERRAMENTAS } from '../../constants/ferramentas.js'; 
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from './paleta-cores.js';

// --- CONFIGURAÇÕES DE CORES ---
const CORES_GAVETA = {
    "Branco": "#ffffff", "Amarelo": "#f59e0b", "Vermelho": "#ef4444", 
    "Laranja": "#ea580c", "Castanho": "#78350f", "Verde": "#10b981", 
    "Azul": "#3b82f6", "Rosa": "#ec4899", "Lilás": "#a855f7", 
    "Cinzento": "#6b7280", "Preto": "#000000"
};

// --- ESTADO PRIVADO DO MÓDULO ---
let navState = { 
    view: 'raiz', // 'raiz', 'gaveta', 'prateleira'
    gavetaId: null, 
    prateleiraId: null,
    subTab: 'feed' // 'feed' ou 'gestao'
};

let notaCache = null;
let idFirestoreNota = null;
let dbRef, authRef, triggerGlobalUpdate;
let modoEdicaoLocal = false;
let corSelecionada = "#ffffff";

/**
 * 1. INICIALIZAÇÃO ÚNICA
 */
export function iniciarArquivo(db, auth, callbackUpdate) {
    dbRef = db; 
    authRef = auth; 
    triggerGlobalUpdate = callbackUpdate;

    configurarCliquesAbasHeader();
}

export function resetNavegacaoArquivo() {
    navState.view = 'raiz';
    navState.gavetaId = null;
    navState.prateleiraId = null;
    navState.subTab = 'feed'; // Opcional: começar sempre no feed
}

/**
 * 2. GESTÃO DE CLIQUES NAS ABAS E BOTÃO EDITAR
 */
function configurarCliquesAbasHeader() {
    const tabsWrapper = document.getElementById('arquivo-tabs-container');
    if (!tabsWrapper) return;

    // Utilizamos delegação de eventos para capturar todos os cliques no cabeçalho do arquivo
    tabsWrapper.onclick = (e) => {
        
        // 1. VERIFICAÇÃO DE SEGURANÇA (Modo Leitura / Lock)
        // Se a nota estiver trancada por outro user, as ações de arquivo são bloqueadas.
        const feed = document.getElementById('editor-feed');
        if (feed && feed.style.pointerEvents === "none") {
            console.warn("🚫 [ARQUIVO] Ações bloqueadas em modo leitura.");
            return; 
        }
        
        // 2. LÓGICA DO BOTÃO VINCULAR (ÍCONE CLIP)
        const btnVincGlobal = e.target.closest('#btn-vincular-arquivo-global');
        if (btnVincGlobal) {
            e.stopPropagation();
            // Dispara o seletor de blocos passando a localização atual
            abrirSeletorVinculo(navState.gavetaId, navState.prateleiraId);
            return;
        }

        // 3. LÓGICA DO BOTÃO EDITAR PASTAS (ÍCONE LÁPIS)
        const btnEditToggle = e.target.closest('#btn-editar-arquivo-toggle');
        if (btnEditToggle) {
            e.stopPropagation();
            modoEdicaoLocal = !modoEdicaoLocal; // Alterna o estado de vibração dos cards
            
            // Atualiza a cor do ícone para dar feedback visual de "On/Off"
            btnEditToggle.style.color = modoEdicaoLocal ? "var(--primary)" : "#94a3b8";
            
            renderizarModoArquivo(idFirestoreNota, notaCache);
            return;
        }

        // 4. LÓGICA DE TROCA DE ABAS (FEED vs ARQUIVO)
        const btnAba = e.target.closest('.aba-item');
        if (!btnAba) return;

        const editIcon = document.getElementById('btn-editar-arquivo-toggle');
        const clipIcon = document.getElementById('btn-vincular-arquivo-global');

        if (btnAba.id === 'tab-arquivo-feed') {
            // MUDAR PARA ABA FEED
            navState.subTab = 'feed';
            modoEdicaoLocal = false; // Desativa edição ao sair da gestão
            
            // Esconde os ícones de gestão
            if (editIcon) { editIcon.style.display = "none"; editIcon.style.color = "#94a3b8"; }
            if (clipIcon) clipIcon.style.display = "none";

            document.querySelectorAll('.aba-item').forEach(el => el.classList.remove('active'));
            btnAba.classList.add('active');
        } 
        else if (btnAba.id === 'tab-arquivo-gestao') {
            // MUDAR PARA ABA ARQUIVO / ADICIONAR ITEM
            if (navState.subTab === 'gestao') {
                /**
                 * COMPORTAMENTO INTELIGENTE:
                 * Se o utilizador já está na aba ARQUIVO e clica no texto da aba,
                 * o sistema assume que ele quer CRIAR um novo item (Gaveta ou Prateleira).
                 */
                abrirPopupForm(navState.view === 'raiz' ? 'gaveta' : 'prateleira', navState.gavetaId);
            } else {
                navState.subTab = 'gestao';
                document.querySelectorAll('.aba-item').forEach(el => el.classList.remove('active'));
                btnAba.classList.add('active');
            }
        }

        // Re-renderiza o ecrã para aplicar as mudanças de estado
        renderizarModoArquivo(idFirestoreNota, notaCache);
    };
}

/**
 * 3. ORQUESTRADOR DE RENDERIZAÇÃO
 */
export function renderizarModoArquivo(docId, nota) {
    idFirestoreNota = docId;
    notaCache = nota;

    const container = document.getElementById('editor-feed');
    const tabGestao = document.getElementById('tab-arquivo-gestao');
    
    // CAPTURAR OS ÍCONES DO CABEÇALHO GLOBAL (editor.html)
    const btnVinc = document.getElementById('btn-vincular-arquivo-global');
    const editIcon = document.getElementById('btn-editar-arquivo-toggle');

    if (!container) return;
    container.innerHTML = "";

    // 1. ATUALIZAR TEXTO DA ABA
    if (navState.subTab === 'gestao' && tabGestao) {
        tabGestao.innerText = (navState.view === 'raiz') ? "+ GAVETA" : "+ PRATELEIRA";
        
        // --- GESTÃO DE VISIBILIDADE DOS ÍCONES ---
        
        // O Lápis (Editar) deve aparecer sempre que estivermos na aba GESTÃO
        if (editIcon) {
            editIcon.style.display = "block";
            // Manter a cor correta baseada no modo
            editIcon.style.color = modoEdicaoLocal ? "var(--primary)" : "#94a3b8";
        }

        // O Clip (Vincular) só aparece se estivermos DENTRO de uma Gaveta ou Prateleira
        if (btnVinc) {
            btnVinc.style.display = (navState.view !== 'raiz') ? "block" : "none";
        }

    } else {
        // Se estivermos na aba FEED, escondemos ambos
        if (tabGestao) tabGestao.innerText = "ARQUIVO";
        if (editIcon) editIcon.style.display = "none";
        if (btnVinc) btnVinc.style.display = "none";
    }

    // 2. RENDERIZAR O CONTEÚDO NO FEED
    if (navState.subTab === 'feed') {
        desenharFeedManual(nota.caixas, container);
    } else {
        desenharEstruturaPastas(container);
    }
}

/**
 * 4. LÓGICA DE NAVEGAÇÃO DE PASTAS
 */
function desenharEstruturaPastas(container) {
    const dadosArquivo = notaCache.Arquivo || { gavetas: {} };
    const gavetas = Object.values(dadosArquivo.gavetas || {}).filter(g => g.estado !== 'desativo');

    if (navState.view === 'raiz') {
        container.innerHTML = ArquivoTemplates.raiz(gavetas, modoEdicaoLocal);
        vincularEventosRaiz(container);
    } 
    else if (navState.view === 'gaveta') {
        const gaveta = dadosArquivo.gavetas[navState.gavetaId];
        if (!gaveta || gaveta.estado === 'desativo') return voltarParaRaiz();
        
        container.innerHTML = ArquivoTemplates.gaveta(gaveta, modoEdicaoLocal);
        vincularEventosGaveta(container, gaveta);
        renderizarBlocosDoNivel(gaveta.caixas || [], document.getElementById('caixas-foco'));
    } 
    else if (navState.view === 'prateleira') {
        const gaveta = dadosArquivo.gavetas[navState.gavetaId];
        const prateleira = gaveta?.prateleiras[navState.prateleiraId];
        if (!prateleira || prateleira.estado === 'desativo') return voltarParaGaveta();

        container.innerHTML = ArquivoTemplates.prateleira(prateleira);
        vincularEventosPrateleira(container);
        renderizarBlocosDoNivel(prateleira.caixas || [], document.getElementById('caixas-foco'));
    }
}

// --- VINCULAÇÃO DE EVENTOS DE NAVEGAÇÃO ---

function vincularEventosRaiz(cont) {
    cont.querySelectorAll('.gaveta-card').forEach(card => {
        card.onclick = () => {
            const id = card.dataset.id;
            if (modoEdicaoLocal) {
                abrirPopupForm('gaveta', null, notaCache.Arquivo.gavetas[id]);
            } else {
                navState.view = 'gaveta'; 
                navState.gavetaId = id;
                renderizarModoArquivo(idFirestoreNota, notaCache);
            }
        };
    });
}

function vincularEventosGaveta(cont, gaveta) {
    const btnBack = cont.querySelector('#btn-voltar-raiz');
    if (btnBack) btnBack.onclick = () => voltarParaRaiz();
    
    const btnVinc = cont.querySelector('#btn-vincular-gaveta');
    if (btnVinc) btnVinc.onclick = () => abrirSeletorVinculo(gaveta.id, null);

    cont.querySelectorAll('.prateleira-card').forEach(p => {
        p.onclick = () => {
            const id = p.dataset.id;
            if (modoEdicaoLocal) {
                abrirPopupForm('prateleira', gaveta.id, gaveta.prateleiras[id]);
            } else {
                navState.view = 'prateleira'; 
                navState.prateleiraId = id;
                renderizarModoArquivo(idFirestoreNota, notaCache);
            }
        };
    });
}

function vincularEventosPrateleira(cont) {
    const btnBack = cont.querySelector('#btn-voltar-gaveta');
    if (btnBack) {
        btnBack.onclick = (e) => {
            e.preventDefault();
            voltarParaGaveta();
        };
    }
    
    const btnVinc = cont.querySelector('#btn-vincular-prateleira');
    if (btnVinc) btnVinc.onclick = () => abrirSeletorVinculo(navState.gavetaId, navState.prateleiraId);
}

function voltarParaRaiz() { 
    navState.view = 'raiz'; 
    navState.gavetaId = null; 
    navState.prateleiraId = null;
    renderizarModoArquivo(idFirestoreNota, notaCache); 
}

function voltarParaGaveta() { 
    navState.view = 'gaveta'; 
    navState.prateleiraId = null; 
    // Mantemos o gavetaId para saber a qual gaveta voltar
    renderizarModoArquivo(idFirestoreNota, notaCache); 
}

/**
 * 5. POPUP DE FORMULÁRIO (CRIAÇÃO E EDIÇÃO)
 */
function abrirPopupForm(tipo, gId = null, dadosExistentes = null) {
    const overlay = document.getElementById('popup-arquivo-form-overlay');
    const input = document.getElementById('arquivo-form-input');
    const containerCores = document.getElementById('arquivo-form-cores');
    const btnConfirmar = document.getElementById('btn-arquivo-form-confirmar');
    const btnCancelar = document.getElementById('btn-arquivo-form-cancelar');

    input.value = dadosExistentes ? dadosExistentes.nome : "";
    corSelecionada = dadosExistentes ? dadosExistentes.cor : "#ffffff";
    document.getElementById('arquivo-form-titulo').innerText = dadosExistentes ? `EDITAR ${tipo.toUpperCase()}` : `NOVA ${tipo.toUpperCase()}`;
    btnConfirmar.innerText = dadosExistentes ? "Gravar" : "Criar agora";
    
    btnConfirmar.className = "lab-btn btn-lab-save";
    btnCancelar.className = "lab-btn btn-lab-cancel";

    // Seletor de Cores reativo (apenas para Gavetas)
    if (tipo === 'gaveta') {
        containerCores.style.display = 'grid';
        const renderCores = () => {
            containerCores.innerHTML = Object.entries(CORES_GAVETA).map(([n, hex]) => `
                <div class="color-dot" data-hex="${hex}" 
                     style="background:${hex}; width:28px; height:28px; border-radius:50%; cursor:pointer; border: 3px solid ${corSelecionada === hex ? 'white' : 'transparent'};">
                </div>
            `).join('');
            
            containerCores.querySelectorAll('.color-dot').forEach(d => d.onclick = (e) => {
                e.stopPropagation();
                corSelecionada = d.dataset.hex;
                renderCores(); // Atualiza bordas instantaneamente
            });
        };
        renderCores();
    } else {
        containerCores.style.display = 'none';
    }

    // Botão Remover (Exclusivo para Edição)
    let btnRemover = document.getElementById('btn-arquivo-remover');
    if (dadosExistentes) {
        if (!btnRemover) {
            btnRemover = document.createElement('button');
            btnRemover.id = "btn-arquivo-remover";
            btnCancelar.parentNode.prepend(btnRemover); 
        }
        btnRemover.innerText = "Remover";
        btnRemover.className = "lab-btn btn-lab-remove";
        btnRemover.style.display = "block";
        
        btnRemover.onclick = async () => {
    if (confirm(`Desejas mover esta ${tipo} para a reciclagem?`)) {
        const timestamp = new Date().toISOString(); // 🚀 Hora da morte
        const arquivo = notaCache.Arquivo;

        if (tipo === 'gaveta') {
            arquivo.gavetas[dadosExistentes.id].estado = "desativo";
            arquivo.gavetas[dadosExistentes.id].timedelete = timestamp; // 🚀 Registo
        } else {
            arquivo.gavetas[gId].prateleiras[dadosExistentes.id].estado = "desativo";
            arquivo.gavetas[gId].prateleiras[dadosExistentes.id].timedelete = timestamp; // 🚀 Registo
        }
        
        // Grava no Firebase
        await updateDoc(doc(dbRef, "Local", idFirestoreNota), { "Arquivo": arquivo });
        
        overlay.classList.remove('active');
        triggerGlobalUpdate(); // Redesenha o editor
    }
};
    } else if (btnRemover) {
        btnRemover.style.display = "none";
    }

    overlay.classList.add('active');
    input.focus();

    btnCancelar.onclick = () => overlay.classList.remove('active');

   btnConfirmar.onclick = async () => {
        const nome = input.value.trim();
        if (!nome) return;

        // 1. Obter a estrutura atual ou criar uma nova
        const arquivo = notaCache.Arquivo || { gavetas: {} };
        const agora = new Date().toISOString();

        if (dadosExistentes) {
            // MODO EDIÇÃO
            if (tipo === 'gaveta') {
                arquivo.gavetas[dadosExistentes.id].nome = nome;
                arquivo.gavetas[dadosExistentes.id].cor = corSelecionada;
            } else {
                arquivo.gavetas[gId].prateleiras[dadosExistentes.id].nome = nome;
            }
        } else {
            // MODO CRIAÇÃO (NOVO)
            const id = crypto.randomUUID();
            if (tipo === 'gaveta') {
                arquivo.gavetas[id] = { 
                    id, nome, cor: corSelecionada, 
                    timestamp: agora, 
                    userId: authRef.currentUser.uid, 
                    estado: "ativo", 
                    prateleiras: {}, 
                    caixas: [] 
                };
            } else {
                // Nova Prateleira dentro de uma Gaveta
                if (!arquivo.gavetas[gId].prateleiras) arquivo.gavetas[gId].prateleiras = {};
                arquivo.gavetas[gId].prateleiras[id] = { 
                    id, nome, estado: 'ativo', 
                    caixas: [], 
                    timestamp: agora 
                };
            }
        }

        // ========================================================
        // 🚀 O SEGREDO PARA APARECER LOGO:
        // ========================================================
        
        // A) Atualizar a nota em memória local IMEDIATAMENTE
        notaCache.Arquivo = arquivo; 

        // B) Gravar no Firebase em background
        try {
            await updateDoc(doc(dbRef, "Local", idFirestoreNota), { "Arquivo": arquivo });
            console.log(`✅ [ARQUIVO] ${tipo} salva no Firebase.`);
        } catch (e) {
            console.error("Erro ao gravar arquivo:", e);
        }

        // C) Fechar o popup
        overlay.classList.remove('active');

        // D) FORÇAR O REDESENHO DA INTERFACE NA HORA
        // Isto faz com que a nova gaveta apareça sem teres de sair da nota
        renderizarModoArquivo(idFirestoreNota, notaCache);
    };
}

/**
 * 6. RENDERIZAÇÃO DE CONTEÚDO (CAIXAS)
 */
function renderizarBlocosDoNivel(ids, target) {
    if (!target) return;
    const caixas = notaCache.caixas.filter(c => ids.includes(c.id) && c.estado === 'ativa');
    
    if (caixas.length === 0) {
        target.innerHTML = `<p style="text-align:center; padding:40px; color:gray; font-size:11px; opacity:0.5;">Nenhum item arquivado aqui.</p>`;
        return;
    }
    desenharFeedManual(caixas, target);
}

function desenharFeedManual(lista, target) {
    renderizarFeed({
        caixasAtuais: lista,
        feed: target,
        dadosNota: notaCache,
        acionarGravacao: window.acionarGravacaoGlobal,
        
        // --- LÓGICA CONTEXTUAL DA LIXEIRA ---
        onApagar: (caixa) => {
            /**
             * Se o utilizador estiver na aba GESTÃO (dentro de gavetas ou prateleiras),
             * abrimos o popup de escolha (Tirar do local vs Ocultar geral).
             */
            if (navState.subTab === 'gestao') {
                console.log("🗑️ Contexto: Gestão de Arquivo. Abrindo popup de decisão.");
                abrirGestaoRemocaoArquivo(caixa);
            } 
            /**
             * Se o utilizador estiver na aba FEED (vista geral),
             * ignoramos o popup de arquivo e vamos diretos para a ocultação geral.
             */
            else {
                console.log("🗑️ Contexto: Feed Geral. Abrindo confirmação de ocultação total.");
                if (window.prepararOcultarGlobal) {
                    window.prepararOcultarGlobal(caixa);
                }
            }
        },

        abrirPaleta: window.abrirPaletaGlobal,
        moverCaixa: window.moverCaixaGlobal,
        prepararInsercao: window.prepararInsercaoGlobal,
        abrirPopupTags: window.abrirPopupTagsGlobal,
        abrirPopupPartilhar: window.abrirPopupPartilharGlobal
    });
}

/**
 * LÓGICA DO POPUP DE REMOÇÃO (ARQUIVO)
 */
function abrirGestaoRemocaoArquivo(caixaAlvo) {
    const overlay = document.getElementById('popup-confirmar-arquivo-remover');
    const btnApenasArquivo = document.getElementById('btn-rem-apenas-arquivo');
    const btnNotaTotal = document.getElementById('btn-rem-nota-total');

    if (!overlay) return;
    overlay.classList.add('active');

    // OPÇÃO 1: REMOVER APENAS DESTE LOCAL (GAVETA OU PRATELEIRA)
    btnApenasArquivo.onclick = async () => {
        const arquivo = notaCache.Arquivo;
        const gId = navState.gavetaId;
        const pId = navState.prateleiraId;

        console.log(`📂 [ARQUIVO] Removendo vínculo do bloco: ${caixaAlvo.id}`);

        if (pId) {
            // Remover da Prateleira
            arquivo.gavetas[gId].prateleiras[pId].caixas = 
                arquivo.gavetas[gId].prateleiras[pId].caixas.filter(id => id !== caixaAlvo.id);
        } else {
            // Remover da Gaveta
            arquivo.gavetas[gId].caixas = 
                arquivo.gavetas[gId].caixas.filter(id => id !== caixaAlvo.id);
        }

        // Atualizar Firebase e Cache Local
        await updateDoc(doc(dbRef, "Local", idFirestoreNota), { "Arquivo": arquivo });
        notaCache.Arquivo = arquivo;
        
        overlay.classList.remove('active');
        renderizarModoArquivo(idFirestoreNota, notaCache);
    };

    // OPÇÃO 2: OCULTAR DA NOTA (GLOBAL)
    btnNotaTotal.onclick = async () => {
        // Fecha este popup e abre o de confirmação global (ou executa direto)
        overlay.classList.remove('active');
        
        // Chama a função original do editor que oculta o bloco de vez
        if (window.prepararOcultarGlobal) {
            window.prepararOcultarGlobal(caixaAlvo);
        }
    };
}

/**
 * 7. SELETOR DE VÍNCULO (CHECKBOXES)
 */
function abrirSeletorVinculo(gId, pId) {
    const arquivo = notaCache.Arquivo || { gavetas: {} };
    
    // 1. IDENTIFICAR O QUE JÁ ESTÁ ARQUIVADO NESTE LOCAL ESPECÍFICO
    let idsJaVinculados = [];
    if (pId) {
        idsJaVinculados = arquivo.gavetas[gId]?.prateleiras[pId]?.caixas || [];
    } else {
        idsJaVinculados = arquivo.gavetas[gId]?.caixas || [];
    }

    const listaCaixas = notaCache.caixas.filter(c => c.estado === 'ativa');
    const overlay = document.createElement('div');
    overlay.className = "popup-overlay active";
    overlay.style.zIndex = "10005";
    
    const getMeta = (c) => {
        const config = (typeof IDENTIDADE_FERRAMENTAS !== 'undefined') 
            ? (IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor)
            : { icon: "fa-solid fa-box", cor: "#6366f1" };
        const mapas = (typeof FOCOS_BASE !== 'undefined') 
            ? { subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO }
            : null;
        const cor = (mapas && mapas[c.tipo]) 
            ? (mapas[c.tipo][c.foco || "original"]?.corForte || config.cor)
            : config.cor;
        return { cor, icon: config.icon };
    };

    overlay.innerHTML = `
        <div class="popup-content" style="max-width:420px; border-radius: 16px;">
            <div class="popup-header" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <h3 style="font-size: 15px;">ARQUIVAR BLOCOS</h3>
            </div>
            <div style="max-height:400px; overflow-y:auto; background:var(--bg-body); padding:15px; display:flex; flex-direction:column; gap:8px;">
                ${listaCaixas.map(c => {
                    const meta = getMeta(c);
                    const resumo = c.titulo || c.conteudo.substring(0, 45) + "...";
                    
                    // 2. APLICAR O ATRIBUTO 'checked' SE O ID JÁ ESTIVER NA LISTA
                    const estaMarcado = idsJaVinculados.includes(c.id) ? 'checked' : '';

                    return `
                        <label style="display:flex; align-items:center; gap:12px; padding:10px 15px; cursor:pointer; 
                                      background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);
                                      border-left: 4px solid ${meta.cor}; transition: 0.2s;" 
                               onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
                               onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                            <input type="checkbox" value="${c.id}" ${estaMarcado} class="chk-vinc" style="width:18px; height:18px; accent-color: var(--primary);">
                            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                                <i class="${meta.icon}" style="color:${meta.cor}; font-size:12px; width:15px; text-align:center;"></i>
                                <span style="font-size:13px; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${resumo}
                                </span>
                            </div>
                        </label>`;
                }).join('')}
            </div>
            <div class="popup-footer" style="padding:15px; text-align:right; display:flex; gap:10px; justify-content:flex-end; border-top: 1px solid rgba(255,255,255,0.05);">
                <button id="cancel-v" class="lab-btn btn-lab-cancel" style="min-width: 80px; padding: 10px;">Cancelar</button>
                <button id="save-v" class="lab-btn btn-lab-save" style="min-width: 120px; padding: 10px;">Atualizar Arquivo</button>
            </div>
        </div>`;
    
    document.body.appendChild(overlay);

    overlay.querySelector('#cancel-v').onclick = () => overlay.remove();

    overlay.querySelector('#save-v').onclick = async () => {
        // 3. CAPTURAR TODOS OS IDS QUE FICARAM SELECIONADOS (Marcados)
        const idsSels = Array.from(overlay.querySelectorAll('.chk-vinc:checked')).map(el => el.value);

        const arquivoAtual = notaCache.Arquivo || { gavetas: {} };

        // 4. SUBSTITUIR A LISTA ANTIGA PELA NOVA (Se desmarcou, remove automaticamente)
        if (pId) {
            // Atualizar na Prateleira
            arquivoAtual.gavetas[gId].prateleiras[pId].caixas = idsSels;
        } else {
            // Atualizar na Gaveta
            arquivoAtual.gavetas[gId].caixas = idsSels;
        }

        // 5. SALVAR NO FIREBASE
        try {
            await updateDoc(doc(dbRef, "Local", idFirestoreNota), { "Arquivo": arquivoAtual });
            overlay.remove();
            triggerGlobalUpdate(); // Atualiza a UI para mostrar ou esconder os blocos no feed do arquivo
        } catch (e) {
            console.error("Erro ao atualizar arquivo:", e);
            alert("Erro ao salvar alterações.");
        }
    };
}
