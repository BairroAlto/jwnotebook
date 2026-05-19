// components/brain-core/brain-engine.js
import { doc, updateDoc, onSnapshot, getDoc, collection, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { SharedPuzzleUI } from '../direita/shared-puzzle-ui.js';
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';

// --- ESTADO GLOBAL DO MÓDULO ---
let unsubDoc = null;
let unsubLocal = null;
let estaAEscrever = false;
let ultimoJsonRenderizado = "";
let mapaFerramentasVivas = {};
let dadosAtuais = null; // Cache para o Puzzle
let dadosSincronizados = null; // Cache para o Dossiê
let micaAbertaId = null;
let currentDocRef = null;
let currentContainer = null;
let currentUid = null;
let globalHandlerAddRef = null;
let travaDuploClique = false;

/**
 * LIMPEZA DE LISTENERS
 */
export function limparEngine() {
    console.log("%c🧹 [ENGINE] Limpeza total de listeners e trancas.", "color: #f87171; font-weight: bold;");
    
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
    if (unsubLocal) { unsubLocal(); unsubLocal = null; }
    
    if (globalHandlerAddRef) {
        window.removeEventListener('brain:adicionarTexto', globalHandlerAddRef);
        window.removeEventListener('cosmos:adicionarTexto', globalHandlerAddRef);
        window.removeEventListener('bible:adicionarTexto', globalHandlerAddRef);
        globalHandlerAddRef = null;
    }

    // --- RESET TOTAL DE ESTADOS ---
    estaAEscrever = false;
    travaDuploClique = false; 
    ultimoJsonRenderizado = "";
    micaAbertaId = null;
    dadosSincronizados = null;
    dadosAtuais = null;
}

/**
 * ==========================================
 * 🧩 MOTOR PUZZLE (ANOTAÇÕES)
 * ==========================================
 */
async function handlePlusClick() {
    const cacheValido = dadosAtuais || dadosSincronizados;

    // Se estiver bloqueado há mais de 5 segundos, assumimos erro e libertamos
    if (travaDuploClique && estaAEscrever) {
        if (!window._lastClickTime) window._lastClickTime = Date.now();
        if (Date.now() - window._lastClickTime > 5000) {
            console.warn("⚠️ [SISTEMA] Detetada tranca fantasma. Forçando libertação...");
            travaDuploClique = false;
            estaAEscrever = false;
        }
    }

    if (travaDuploClique || !cacheValido) {
        console.warn("🚫 [SISTEMA] Clique bloqueado ou dados ausentes.");
        return;
    }
    
    window._lastClickTime = Date.now();
    travaDuploClique = true; 
    estaAEscrever = true;

    try {
        const quadrosNaRam = [...(cacheValido.Puzzle?.quadros || [])];
        
        currentContainer.querySelectorAll('textarea[data-id]').forEach(ta => {
            const item = quadrosNaRam.find(q => q.id === ta.dataset.id);
            if (item) item.conteudo = ta.value;
        });

        const novoId = crypto.randomUUID();
        const novo = { 
            id: novoId, 
            userId: currentUid, 
            timestamp: new Date().toISOString(), 
            estado: "on", 
            tipo: "caixatexto", 
            conteudo: "" 
        };

        quadrosNaRam.push(novo);

        // Gravamos no Firebase
        await updateDoc(currentDocRef, { "Puzzle.quadros": quadrosNaRam });

        // Libertamos as trancas um pouco mais rápido (250ms em vez de 400ms)
        setTimeout(() => {
            const ta = currentContainer.querySelector(`textarea[data-id="${novoId}"]`);
            if (ta) {
                ta.focus();
                ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            travaDuploClique = false;
            estaAEscrever = false;
        }, 250);

    } catch (e) {
        console.error(e);
        travaDuploClique = false;
        estaAEscrever = false;
    }
}

export async function iniciarPuzzle(colecao, item, container, db, auth) {
    limparEngine(); // Limpa tudo antes de começar
    
    currentDocRef = doc(db, colecao, item.id);
    currentContainer = container;
    currentUid = auth.currentUser.uid;

    unsubDoc = onSnapshot(currentDocRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data.Puzzle) data.Puzzle = { quadros: [] };
        if (estaAEscrever && dadosAtuais) {
            data.Puzzle.quadros = data.Puzzle.quadros.map(sq => {
                const itemNaRam = dadosAtuais.Puzzle.quadros.find(l => l.id === sq.id);
                return itemNaRam ? { ...sq, conteudo: itemNaRam.conteudo } : sq;
            });
        }
        dadosAtuais = data;
        reconstruirPuzzleUI(currentContainer, currentDocRef, db, auth);
    });

    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", currentUid)), (snapshot) => {
        mapaFerramentasVivas = {};
        snapshot.forEach(docNota => {
            const d = docNota.data();
            if (d.estado !== "on") return;
            (d.caixas || []).forEach(c => {
                if (c.estado === "on" && (c.neuroniosCosmos?.some(n => n.id === item.id) || c.idBiblioteca === item.id)) {
                    mapaFerramentasVivas[c.id] = { ...c, notaDocId: docNota.id, notaDados: d };
                }
            });
        });
        reconstruirPuzzleUI(currentContainer, currentDocRef, db, auth);
    });

    globalHandlerAddRef = handlePlusClick;
    window.addEventListener('brain:adicionarTexto', globalHandlerAddRef);
    window.addEventListener('bible:adicionarTexto', globalHandlerAddRef); // <--- OUVINTE PARA BÍBLIA
    window.addEventListener('cosmos:adicionarTexto', globalHandlerAddRef); // <--- OUVINTE PARA COSMOS
}

function reconstruirPuzzleUI(container, docRef, db, auth) {
    if (!dadosAtuais || !container) return;
    const quadros = dadosAtuais.Puzzle?.quadros || [];
    const caixas = dadosAtuais.caixas || dadosAtuais.Puzzle?.caixas || [];
    const ferramentas = caixas.map(conf => {
        const id = typeof conf === 'object' ? conf.id : conf;
        const vivo = mapaFerramentasVivas[id];
        return vivo ? { ...vivo, timestamp: conf.timestamp || vivo.timestamp, _tipo: 'ferramenta' } : null;
    }).filter(f => f !== null);

    const listaFinal = [...quadros.map(q => ({ ...q, _tipo: 'quadro' })), ...ferramentas].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
    if (assinatura === ultimoJsonRenderizado) return;
    ultimoJsonRenderizado = assinatura;

    container.innerHTML = "";
    listaFinal.forEach((item, index) => {
        if (item._tipo === 'quadro') {
            container.appendChild(SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, docRef, {
                setEstaAEscrever: (val) => { estaAEscrever = val; },
                moverItem: (idx, dir) => moverItemGenerico(idx, dir, listaFinal, docRef),
                apagarItem: (id) => apagarQuadroGenerico(id, docRef)
            }));
        } else {
            container.appendChild(renderFerramentaEspelho(item, index, listaFinal, docRef, db, auth));
        }
    });
}

/**
 * ==========================================
 * 🔗 MOTOR FONTES (LINKS / CODEX)
 * ==========================================
 */
export async function iniciarFontes(colecao, item, container, db, auth) {
    limparEngine();
    const docRef = doc(db, colecao, item.id);
    const uid = auth.currentUser.uid;

    const handleBotaoVerdeFontes = () => {
        import('../editor/modulos/codex-browser.js').then(mBrowser => {
            mBrowser.abrirPesquisaCodex(async (dadosReferencia) => {
                if (!dadosReferencia) return;
                import('../editor/modulos/tags/tags-handlers-codex.js').then(async (mHandler) => {
                    const ctx = { dbRef: db, authRef: auth, notaMaeId: item.id };
                    const novosItens = mHandler.prepararGrupoSemantico(dadosReferencia, ctx);
                    try {
                        await updateDoc(docRef, { "Fontes.codex": arrayUnion(...novosItens) });
                        for (const subItem of novosItens) { await mHandler.executarSincronizacaoForcada(subItem, ctx); }
                    } catch (e) { console.error("Erro ao vincular:", e); }
                });
            });
        });
    };

    window.addEventListener('brain:abrirPopupFontes', handleBotaoVerdeFontes);
    globalHandlerAddRef = handleBotaoVerdeFontes;

    unsubDoc = onSnapshot(docRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const fontes = data.Fontes || { Links: [], codex: [] };
        if (!window.__codexGlobalRegistry) window.__codexGlobalRegistry = {};
        container.innerHTML = "";
        container.style.padding = "15px";

     const codexAtivos = (fontes.codex || []).filter(c => c.estado !== "off").sort((a,b) => (b.favorito==='sim'?1:0)-(a.favorito==='sim'?1:0));
        
        codexAtivos.forEach(card => {
            window.__codexGlobalRegistry[card.id] = card;
            
            const div = document.createElement('div'); 
            div.style.position = "relative"; 
            div.style.marginBottom = "10px";
            div.innerHTML = SharedUI.renderCodexCard(card, "");
            
            // 1. Localiza o grupo de botões injetado pelo SharedUI
            const btnGroup = div.querySelector('.codex-card-v2 > div[style*="position: absolute"]');
            
            if (btnGroup) {
                // 2. Limpa os originais e cria a nossa versão com a Lixeira
                btnGroup.innerHTML = "";
                const isFav = card.favorito === "sim";
                
                btnGroup.style.right = "12px"; 
                btnGroup.innerHTML = `
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star btn-fav" 
                       style="cursor:pointer; color: ${isFav ? '#fbbf24' : 'var(--text-muted)'}; font-size: 14px;" title="Favoritar"></i>
                    <i class="fa-solid fa-trash-can btn-del" 
                       style="color:#f87171; cursor:pointer; font-size:13px; margin-left: 8px; opacity: 0.7; transition: 0.2s;" title="Remover"></i>
                `;

                // Efeito visual no hover da lixeira
                const btnDel = btnGroup.querySelector('.btn-del');
                btnDel.onmouseenter = () => btnDel.style.opacity = "1";
                btnDel.onmouseleave = () => btnDel.style.opacity = "0.7";

                // 3. LÓGICA DE CLIQUE: Remover (Soft Delete)
               btnDel.onclick = async (e) => {
                    e.stopPropagation();
                    
                    // Usamos a função de confirmação que já tens importada no topo
                    const confirmou = await SharedPuzzleUI.confirmarAcao(
                        "Remover Codex?", 
                        "Tens a certeza que queres remover este mapeamento?"
                    );

                    if (confirmou) {
                        const novaLista = fontes.codex.map(c => 
                            c.id === card.id ? { ...c, estado: "off" } : c
                        );
                        await updateDoc(docRef, { "Fontes.codex": novaLista });
                    }
                };

                // 4. LÓGICA DE CLIQUE: Favorito
                btnGroup.querySelector('.btn-fav').onclick = async (e) => {
                    e.stopPropagation();
                    const novaLista = fontes.codex.map(c => 
                        c.id === card.id ? { ...c, favorito: isFav ? "nao" : "sim" } : c
                    );
                    await updateDoc(docRef, { "Fontes.codex": novaLista });
                };
            }
            
            container.appendChild(div);
        });
    });
}

/**
 * ==========================================
 * 📂 MOTOR DOSSIÊ (MICAS / PASTAS)
 * ==========================================
 */
/**
 * ==========================================
 * 📂 MOTOR DOSSIÊ (MICAS / PASTAS) - COMPLETO
 * ==========================================
 */
export async function iniciarDossie(colecao, item, container, db, auth) {
    limparEngine();
    
    // 1. DEFINIÇÕES DE ESTADO
    currentDocRef = doc(db, colecao, item.id);
    currentContainer = container;
    currentUid = auth.currentUser.uid;
    micaAbertaId = null;
    window.micaAtivaId = null; 

    console.log(`%c📂 [ENGINE] Dossiê Ativo: ${colecao} | ID: ${item.id}`, "color: #f59e0b; font-weight: bold;");

    // 2. ESCUTA 1: NOTAS LOCAIS (Alimenta o conteúdo visual do popup)
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", currentUid)), (snapshot) => {
        mapaFerramentasVivas = {}; 
        snapshot.forEach(docNota => {
            const d = docNota.data();
            if (d.estado !== "on") return;
            (d.caixas || []).forEach(c => {
                if (c.estado === "on") {
                    mapaFerramentasVivas[c.id] = { 
                        ...c, 
                        notaDocId: docNota.id, 
                        notaDadosCompletos: d 
                    };
                }
            });
        });
        if (dadosSincronizados) redesenharDossieUI(dadosSincronizados);
    });

    // 3. ESCUTA 2: DOCUMENTO MESTRE (Ficha na Biblioteca ou Tema no Cosmos)
    unsubDoc = onSnapshot(currentDocRef, (snap) => {
        if (!snap.exists()) return;
        dadosSincronizados = snap.data();
        redesenharDossieUI(dadosSincronizados);
    });

    /**
     * RENDERIZAÇÃO DA UI (LISTA DE MICAS VS INTERIOR)
     */
    function redesenharDossieUI(dados) {
        if (!dados || !container) return;
        const micas = dados.Dossie?.mica || {};
        container.innerHTML = "";

        if (micaAbertaId && micas[micaAbertaId]) {
            window.micaAtivaId = micaAbertaId; 
            renderizarInteriorMicaLocal(micas[micaAbertaId], container, currentDocRef, redesenharDossieUI);
        } else {
            window.micaAtivaId = null; 
            const lista = Object.values(micas)
                .filter(m => m.estado === "on")
                .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (lista.length === 0) {
                container.innerHTML = `<p style="color:gray; text-align:center; margin-top:40px; font-size:12px; opacity:0.5;">Dossiê vazio. Clica no + laranja para criar uma pasta.</p>`;
            }

lista.forEach((mica, index) => {
    const card = document.createElement('div');
    
    // 1. CONTAINER DO CARD: Resetamos o padding e forçamos o alinhamento total (stretch)
    card.style.cssText = `
        display: flex; 
        align-items: stretch; 
        background: rgba(255,255,255,0.03); 
        border-radius: 8px; 
        margin-bottom: 8px; 
        overflow: hidden; 
        border: 1px solid rgba(255,255,255,0.05); 
        cursor: pointer; 
        min-height: 60px; 
        padding: 0 !important; 
        position: relative;
    `;
    
    // Cor padrão: Branco se não houver cor no Firebase
    const corMica = mica.cor || "#ffffff";

    card.innerHTML = `
        <!-- 2. FAIXA DE COR LATERAL -->
        <div style="width: 6px; background: ${corMica}; flex-shrink: 0;"></div>
        
        <!-- 3. CONTENTOR DE TEXTO E BOTÕES (Com o padding real aqui) -->
        <div style="flex: 1; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px; overflow: hidden;">
            
            <!-- TÍTULO E QUANTIDADE -->
            <div style="display: flex; flex-direction: column; overflow: hidden; pointer-events: none;">
                <span style="font-weight: 700; color: white; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${mica.titulo}
                </span>
                <span style="font-size: 9px; color: var(--text-muted); font-weight: 800; opacity: 0.5; margin-top: 2px;">
                    ${mica.caixas?.length || 0} ITENS
                </span>
            </div>

            <!-- BOTÕES DE ACÇÃO (Aumentei o espaçamento para 18px para não ficarem colados) -->
            <div style="display: flex; gap: 18px; align-items: center; color: rgba(255,255,255,0.25); font-size: 12px;">
                <i class="fa-solid fa-chevron-up btn-up" title="Subir" style="cursor:pointer; transition: 0.2s;"></i>
                <i class="fa-solid fa-chevron-down btn-down" title="Descer" style="cursor:pointer; transition: 0.2s;"></i>
                <i class="fa-solid fa-pen btn-edit" title="Editar" style="cursor:pointer; transition: 0.2s;"></i>
                <i class="fa-solid fa-trash-can btn-del" style="color: #f87171; opacity: 0.8; cursor:pointer; transition: 0.2s;"></i>
            </div>
        </div>
    `;
    
    // LÓGICA DE CLIQUE E EVENTOS
    card.onclick = () => { 
        micaAbertaId = mica.id; 
        redesenharDossieUI(dados); 
    };

    const stop = (e) => e.stopPropagation();

    // Eventos dos Botões
    card.querySelector('.btn-up').onclick = (e) => { stop(e); moverMicaPosicao(index, -1, lista, currentDocRef); };
    card.querySelector('.btn-down').onclick = (e) => { stop(e); moverMicaPosicao(index, 1, lista, currentDocRef); };
    card.querySelector('.btn-edit').onclick = (e) => { stop(e); abrirPopupMicaParaEdicao(mica); };
    card.querySelector('.btn-del').onclick = async (e) => {
        stop(e);
        const confirmou = await SharedPuzzleUI.confirmarAcao("Ocultar Pasta?", `Desejas ocultar "${mica.titulo}"?`);
        if(confirmou) {
            await updateDoc(currentDocRef, { [`Dossie.mica.${mica.id}.estado`]: "off" });
        }
    };

    // Aplicar hover visual nos ícones via JS (já que não usamos CSS externo aqui)
    card.querySelectorAll('i').forEach(icon => {
        icon.onmouseenter = () => icon.style.color = icon.classList.contains('btn-del') ? "#ef4444" : "white";
        icon.onmouseleave = () => icon.style.color = "";
    });

    container.appendChild(card);
});
        }
        if (typeof window.atualizarBotoesHeader === 'function') window.atualizarBotoesHeader();
    }


function abrirPopupMicaParaEdicao(micaExistente = null) {
    const overlay = document.getElementById('popup-mica-overlay');
    const input = document.getElementById('mica-input-titulo');
    const selectorCores = document.getElementById('mica-cor-selector');
    const btnGravar = document.getElementById('btn-gravar-mica');
    const btnCancelar = document.getElementById('btn-cancelar-mica');
    const tituloPopup = document.getElementById('mica-popup-titulo');

    if (!overlay || !selectorCores) return;

    // 1. CONFIGURAÇÃO INICIAL E LIMPEZA
    tituloPopup.innerText = micaExistente ? "Editar Pasta" : "Nova Pasta (Mica)";
    input.value = micaExistente ? micaExistente.titulo : "";
    let corSelecionada = micaExistente ? micaExistente.cor : "#ffffff";

    // 2. RENDERIZAR GRELHA DE CORES (Isto estava a faltar ao criar novas)
    const CORES_MICA = { 
        "Branco": "#ffffff", "Amarelo": "#f59e0b", "Vermelho": "#ef4444", 
        "Laranja": "#ea580c", "Verde": "#10b981", "Azul": "#3b82f6", 
        "Rosa": "#ec4899", "Castanho": "#78350f", "Lilás": "#a855f7", 
        "Cinzento": "#6b7280", "Preto": "#000000" 
    };
    
    selectorCores.innerHTML = Object.entries(CORES_MICA).map(([nome, hex]) => `
        <div class="color-dot-mica" data-hex="${hex}" title="${nome}"
             style="background:${hex}; width:28px; height:28px; border-radius:50%; cursor:pointer; border: 2px solid ${corSelecionada === hex ? 'white' : 'transparent'}; transition: 0.2s;">
        </div>
    `).join('');

    // 3. LISTENERS PARA SELEÇÃO DE COR
    selectorCores.querySelectorAll('.color-dot-mica').forEach(dot => {
        dot.onclick = () => {
            selectorCores.querySelectorAll('.color-dot-mica').forEach(d => d.style.borderColor = "transparent");
            dot.style.borderColor = "white";
            corSelecionada = dot.dataset.hex;
        };
    });

    // 4. MOSTRAR POPUP
    overlay.classList.add('active');
    input.focus();

    // 5. LÓGICA DE CANCELAR (Forçada para prevenir bugs no html)
    btnCancelar.onclick = (e) => {
        e.preventDefault();
        overlay.classList.remove('active');
    };

    // 6. LÓGICA DE GRAVAR
    btnGravar.onclick = async () => {
        const novoTitulo = input.value.trim();
        if (!novoTitulo) {
            input.style.border = "1px solid #ef4444"; // Aviso visual
            return;
        }
        input.style.border = "1px solid var(--border-color)";

        // Feedback de gravação
        btnGravar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        btnGravar.disabled = true;

        const idMica = micaExistente ? micaExistente.id : crypto.randomUUID();
        const dadosMica = {
            id: idMica,
            titulo: novoTitulo,
            cor: corSelecionada,
            timestamp: micaExistente ? micaExistente.timestamp : new Date().toISOString(),
            estado: "on",
            caixas: micaExistente ? micaExistente.caixas : []
        };

        try {
            // currentDocRef é a variável global da ficha da Biblioteca atual
            await updateDoc(currentDocRef, { [`Dossie.mica.${idMica}`]: dadosMica });
            overlay.classList.remove('active');
        } catch (e) { 
            console.error("Erro ao gravar mica:", e); 
            alert("Falha de permissão ao gravar. Verifica a tua ligação.");
        } finally {
            // Reset visual do botão para a próxima utilização
            btnGravar.innerHTML = "Gravar Mica";
            btnGravar.disabled = false;
        }
    };
}


/**
 * TROCA A ORDEM DAS MICAS NO FIREBASE (Via Timestamp)
 */
async function moverMicaPosicao(idx, dir, lista, docRef) {
    const targetIdx = idx + dir;
    
    // Verificar limites da lista
    if (targetIdx < 0 || targetIdx >= lista.length) return;

    console.log("↕️ [DOSSIÊ] Alterando ordem das pastas...");

    // Trocar os timestamps para inverter a posição no sort()
    const timeA = lista[idx].timestamp;
    const timeB = lista[targetIdx].timestamp;

    try {
        await updateDoc(docRef, { 
            [`Dossie.mica.${lista[idx].id}.timestamp`]: timeB,
            [`Dossie.mica.${lista[targetIdx].id}.timestamp`]: timeA
        });
        console.log("✅ Ordem sincronizada.");
    } catch (e) {
        console.error("Erro ao mover Mica:", e);
    }
}




    /**
     * POPUP: ADICIONAR À MICA (MULTI-SELEÇÃO + BÍBLIA)
     */
    const handleNovaRef = async () => {
        const overlay = document.getElementById('popup-mica-ref-overlay');
        const content = document.getElementById('mica-ref-content');
        if (!overlay || !micaAbertaId || !dadosSincronizados) return;

        overlay.classList.add('active');

        // --- GESTÃO DE ABAS DO POPUP ---
        const tabs = overlay.querySelectorAll('.tab-mica-ref');
        tabs.forEach(tab => {
            tab.onclick = () => {
                const target = tab.dataset.target;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                if (target === 'ref-biblia') {
                    // COMPORTAMENTO BÍBLIA: Teleporte para o Seletor
                    window.micaAbertaIdParaSelector = micaAbertaId; 
                    overlay.classList.remove('active'); 
                    import('../editor/modulos/biblia-selector.js').then(m => {
                        m.abrirSelector({ ...dadosSincronizados, docIdFirebase: currentDocRef.id });
                    });
                } else {
                    // COMPORTAMENTO CAIXAS: Lista de blocos mapeados
                    renderizarListaSelecaoMica(content);
                }
            };
        });

        // Abrir por defeito na aba Caixas
        const tabCaixas = overlay.querySelector('[data-target="ref-caixas"]');
        if (tabCaixas) tabCaixas.click();
    };

    /**
     * AUXILIAR: RENDERIZAR LISTA DE CAIXAS APTAS
     */
    function renderizarListaSelecaoMica(content) {
        content.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

        const aptos = dadosSincronizados.Dossie?.Apto || [];
        const jaNaMica = dadosSincronizados.Dossie?.mica[micaAbertaId]?.caixas || [];

        if (aptos.length === 0) {
            content.innerHTML = `<p style="color:gray; text-align:center; padding:20px; font-size:11px;">Não existem blocos mapeados (Codex) para este estudo.</p>`;
        } else {
            content.innerHTML = aptos.map(id => {
                const c = mapaFerramentasVivas[id]; 
                if (!c) return ""; 

                const isSelected = jaNaMica.includes(id);
                const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
                
                return `
                    <div class="ref-select-card" data-id="${c.id}" data-selected="${isSelected ? 'true' : 'false'}"
                         style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px; cursor:pointer; transition:0.2s;
                                border: 1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.1)'}; border-left: 4px solid ${config.cor};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                            <i class="fa-solid fa-check-circle check-icon" style="color:${isSelected ? '#6366f1' : 'transparent'}; font-size:14px;"></i>
                        </div>
                        <div style="font-size:12px; color:white; opacity:0.9;">
                            ${c.titulo || (c.conteudo ? c.conteudo.substring(0, 80) + '...' : 'Sem conteúdo')}
                        </div>
                    </div>`;
            }).join('');

            content.querySelectorAll('.ref-select-card').forEach(card => {
                card.onclick = () => {
                    const wasSel = card.dataset.selected === "true";
                    card.dataset.selected = !wasSel;
                    card.style.borderColor = !wasSel ? '#6366f1' : 'rgba(255,255,255,0.1)';
                    card.querySelector('.check-icon').style.color = !wasSel ? '#6366f1' : 'transparent';
                };
            });

            document.getElementById('btn-confirmar-ref-mica').onclick = async () => {
                const finalIds = Array.from(content.querySelectorAll('.ref-select-card'))
                    .filter(c => c.dataset.selected === "true")
                    .map(c => c.dataset.id);

                try {
                    await updateDoc(currentDocRef, { [`Dossie.mica.${micaAbertaId}.caixas`]: finalIds });
                    console.log("✅ [DOSSIÊ] Sincronização concluída.");
                } catch (e) { console.error(e); }
                document.getElementById('popup-mica-ref-overlay').classList.remove('active');
            };
        }
    }

    /**
     * POPUP: NOVA MICA (PASTA)
     */
   const handleNovaMica = () => {
        // Redireciona o clique do botão "+" para o construtor completo
        if (typeof abrirPopupMicaParaEdicao === 'function') {
            abrirPopupMicaParaEdicao(null);
        }
    };

    // 4. LISTENERS DE EVENTOS (Botões do Cabeçalho)
    window.addEventListener('brain:abrirMicaPopup', handleNovaMica);
    window.addEventListener('brain:abrirReferenciaMica', handleNovaRef);
    
    globalHandlerAddRef = () => {
        window.removeEventListener('brain:abrirMicaPopup', handleNovaMica);
        window.removeEventListener('brain:abrirReferenciaMica', handleNovaRef);
    };
}



function renderizarListaSelecaoCaixas(content) {
    // 1. Mostrar estado de carregamento
    content.innerHTML = `
        <div style="text-align:center; padding:30px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary); font-size: 24px;"></i>
            <p style="font-size: 10px; color: var(--text-muted); margin-top: 10px; font-weight: 700;">A SINCRONIZAR BLOCOS...</p>
        </div>`;

    // 2. Extrair dados das variáveis globais do módulo
    const aptos = dadosSincronizados.Dossie?.Apto || [];
    const jaNaMica = dadosSincronizados.Dossie?.mica[micaAbertaId]?.caixas || [];

    // 3. Verificação de existência de mapeamentos
    if (aptos.length === 0) {
        content.innerHTML = `
            <div style="text-align:center; padding:40px; opacity:0.5; color:gray;">
                <i class="fa-solid fa- ghost" style="font-size:30px; margin-bottom:15px;"></i>
                <p style="font-size:11px;">Não existem blocos mapeados (Codex) para este estudo.</p>
                <p style="font-size:9px; margin-top:5px;">Mapeia um parágrafo no editor para o veres aqui.</p>
            </div>`;
        return;
    }

    // 4. Mapear IDs para conteúdo visual
    const htmlCards = aptos.map(id => {
        const c = mapaFerramentasVivas[id]; // Procura na RAM carregada pelo onSnapshot
        
        if (!c) {
            console.warn(`⚠️ [DOSSIÊ] Bloco ${id} está em Apto mas não foi encontrado na RAM.`);
            return ""; 
        }

        const isSelected = jaNaMica.includes(id);
        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        const resumo = c.titulo || (c.conteudo ? c.conteudo.substring(0, 80) + '...' : 'Sem conteúdo');
        
        return `
            <div class="ref-select-card" 
                 data-id="${c.id}" 
                 data-selected="${isSelected ? 'true' : 'false'}"
                 style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px; cursor:pointer; transition:0.2s;
                        border: 1px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.05)'}; 
                        border-left: 4px solid ${config.cor};
                        position: relative; overflow: hidden;">
                
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                        <i class="${config.icon}"></i> ${c.tipo}
                    </span>
                    <i class="fa-solid fa-check-circle check-icon" 
                       style="color:${isSelected ? '#6366f1' : 'transparent'}; font-size:14px; transition: 0.2s;"></i>
                </div>

                <div style="font-size:12.5px; color:white; font-weight:500; opacity:0.9; line-height:1.4;">
                    ${resumo}
                </div>

                <div style="font-size:8px; color:var(--text-muted); margin-top:8px; text-transform: uppercase; font-weight: 700; opacity: 0.5;">
                    <i class="fa-solid fa-file-lines"></i> ${c.notaDadosCompletos?.nome || "Nota Local"}
                </div>
            </div>`;
    }).join('');

    content.innerHTML = htmlCards;

    // 5. LÓGICA DE CLIQUE (MULTI-SELEÇÃO)
    content.querySelectorAll('.ref-select-card').forEach(card => {
        card.onclick = () => {
            const wasSelected = card.dataset.selected === "true";
            const isNowSelected = !wasSelected;
            
            card.dataset.selected = isNowSelected ? "true" : "false";
            
            // Atualização Visual Imediata
            card.style.borderColor = isNowSelected ? '#6366f1' : 'rgba(255,255,255,0.05)';
            card.querySelector('.check-icon').style.color = isNowSelected ? '#6366f1' : 'transparent';
            
            if (isNowSelected) {
                card.style.background = "rgba(99, 102, 241, 0.05)";
            } else {
                card.style.background = "rgba(255,255,255,0.03)";
            }
        };
    });

    // 6. BOTÃO CONFIRMAR (GRAVAÇÃO POR ATRIBUIÇÃO)
    const btnConfirmar = document.getElementById('btn-confirmar-ref-mica');
    if (btnConfirmar) {
        btnConfirmar.onclick = async () => {
            // Captura todos os IDs que estão marcados como "true"
            const finalSelection = Array.from(content.querySelectorAll('.ref-select-card'))
                .filter(c => c.dataset.selected === "true")
                .map(c => c.dataset.id);

            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A GUARDAR...';

            try {
                // Atribuição direta: Se o ID não está na lista, o Firebase remove-o
                await updateDoc(currentDocRef, {
                    [`Dossie.mica.${micaAbertaId}.caixas`]: finalSelection
                });
                
                console.log(`✅ [DOSSIÊ] Mica ${micaAbertaId} atualizada com ${finalSelection.length} itens.`);
                document.getElementById('popup-mica-ref-overlay').classList.remove('active');
            } catch (e) {
                console.error("❌ [ERROR] Falha ao sincronizar Mica:", e);
                alert("Erro ao gravar. Verifica a tua ligação.");
            } finally {
                btnConfirmar.disabled = false;
                btnConfirmar.innerText = "Confirmar Seleção";
            }
        };
    }
}


/**
 * RENDERIZADORES DE APOIO
 */
function renderizarInteriorMicaLocal(mica, container, docRef, callbackRedraw) {
    console.log(`%c🔍 [DOSSIÊ] Renderizando interior de: ${mica.titulo}`, "color: #10b981;");

    // 1. LIMPAR E CRIAR BOTÃO VOLTAR
    const btnVoltar = document.createElement('div');
    btnVoltar.id = "btn-voltar-ao-dossie-logico"; // ID único para teste
    btnVoltar.style.cssText = "padding:12px 10px; color:var(--primary); cursor:pointer; font-size:11px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:15px; display: flex; align-items: center; gap: 8px;";
    btnVoltar.innerHTML = `<i class="fa-solid fa-arrow-left"></i> VOLTAR AO DOSSIÊ`;
    
    // FORÇAR O CLIQUE
    btnVoltar.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("%c🔙 [NAV-CLICK] Botão Voltar pressionado!", "background: #3b82f6; color: white; padding: 2px 5px;");
        
        // Reset dos estados
        micaAbertaId = null; 
        window.micaAtivaId = null; 
        
        if (typeof callbackRedraw === 'function') {
            console.log("♻️ Chamando Redesenho...");
            callbackRedraw(dadosSincronizados);
        } else {
            console.error("❌ Erro: Redesenho indisponível.");
        }
    };

    container.appendChild(btnVoltar);
    

    // 2. ITERAR SOBRE O ARRAY DE CAIXAS
        const ids = mica.caixas || [];
    ids.forEach((idOuTexto, index) => {
        const div = document.createElement('div');
        
        // --- LÓGICA DE DISTINÇÃO DE CONTEÚDO ---
        // Se contiver ":" e for uma string, assumimos que é um VERSÍCULO BÍBLICO
        const isVersiculo = typeof idOuTexto === 'string' && idOuTexto.includes(':');

        if (isVersiculo) {
            // ==========================================
            // DESIGN DO CARD BÍBLICO (AZULADO)
            // ==========================================
            div.style.cssText = `border-left: 3px solid #818cf8; background: rgba(129, 140, 241, 0.05); margin-bottom: 8px; border-radius: 4px; padding: 12px; cursor:pointer; transition: 0.2s;`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:24px; height:24px; background:rgba(129,140,248,0.1); border-radius:4px; display:flex; align-items:center; justify-content:center; color:#818cf8;">
                            <i class="fa-solid fa-book-bible" style="font-size:12px;"></i>
                        </div>
                        <span style="font-size:13px; color:white; font-weight:700;">${idOuTexto}</span>
                    </div>
                    <i class="fa-solid fa-trash-can btn-rem-item" style="color:#f87171; font-size:11px; opacity:0.4; cursor:pointer; padding:5px;"></i>
                </div>`;

            // CLIQUE NO CARD: Teleporte para a Bíblia
            div.onclick = (e) => {
                if (e.target.classList.contains('fa-trash-can')) return;
                
                const [livro, coords] = idOuTexto.split(' ');
                const [cap, ver] = coords.split(':');

                // 1. Mudar aba lateral para LISTS
                const btnLists = Array.from(document.querySelectorAll('#left-buttons button'))
                                      .find(b => b.innerText.trim().toUpperCase() === 'LISTS');
                if (btnLists) btnLists.click();

                // 2. Executar salto na Bíblia
                import('../lists/biblia.js').then(m => {
                    m.viajarParaVersiculoBiblico(livro, cap, ver);
                });
            };

        } else {
            // ==========================================
            // DESIGN DO CARD DE FERRAMENTA (CORES ORIGINAIS)
            // ==========================================
            const c = mapaFerramentasVivas[idOuTexto];
            if (!c) return; // Bloco pode ter sido apagado ou estar oculto

            const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            div.style.cssText = `border-left: 3px solid ${config.cor}; background: rgba(255,255,255,0.02); margin-bottom: 8px; border-radius: 4px; padding: 12px; cursor:pointer;`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                    <i class="fa-solid fa-trash-can btn-rem-item" style="color:#f87171; font-size:11px; opacity:0.4; cursor:pointer; padding:5px;"></i>
                </div>
                <div style="font-size:12.5px; color:white; opacity:0.9; line-height:1.4;">
                    ${c.titulo ? `<b>${c.titulo}</b><br>` : ''}${c.conteudo.substring(0, 150)}${c.conteudo.length > 150 ? '...' : ''}
                </div>`;

            div.onclick = (e) => {
                if (e.target.classList.contains('fa-trash-can')) return;
                import('../editor/editor.js').then(m => m.abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, null, null, c.id));
            };
        }

        // LÓGICA DE REMOÇÃO (Comum a ambos)
      div.querySelector('.btn-rem-item').onclick = async (e) => {
    e.stopPropagation();
    
    // CHAMADA AO POPUP VISUAL
    const confirmou = await confirmarRemocaoMicaItem(idOuTexto);
    
    if (confirmou) {
        console.log(`🗑️ [SISTEMA] Removendo "${idOuTexto}" da Mica...`);
        const novosIds = ids.filter(x => x !== idOuTexto);
        
        try {
            await updateDoc(docRef, { 
                [`Dossie.mica.${mica.id}.caixas`]: novosIds 
            });
            console.log("✅ [SISTEMA] Firebase atualizado.");
        } catch (error) {
            console.error("Erro ao gravar no Firebase:", error);
        }
    }
};

        container.appendChild(div);
    });
}

async function moverMicaLocal(idx, dir, lista, docRef) {
    const n = idx + dir; if (n < 0 || n >= lista.length) return;
    const t = lista[idx].timestamp; lista[idx].timestamp = lista[n].timestamp; lista[n].timestamp = t;
    await updateDoc(docRef, { [`Dossie.mica.${lista[idx].id}.timestamp`]: lista[idx].timestamp, [`Dossie.mica.${lista[n].id}.timestamp`]: lista[n].timestamp });
}

async function moverItemGenerico(index, dir, todos, ref) {
    const n = index + dir; if (n < 0 || n >= todos.length) return;
    estaAEscrever = false; ultimoJsonRenderizado = "";
    const tmp = todos[index].timestamp; todos[index].timestamp = todos[n].timestamp; todos[n].timestamp = tmp;
    const q = todos.filter(i => i._tipo === 'quadro').map(({_tipo, ...rest}) => rest);
    const c = todos.filter(i => i._tipo === 'ferramenta').map(i => ({id: i.id, timestamp: i.timestamp}));
    await updateDoc(ref, { "Puzzle.quadros": q, "caixas": c });
}

async function apagarQuadroGenerico(id, ref) {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const novos = snap.data().Puzzle.quadros.filter(q => q.id !== id);
    await updateDoc(ref, { "Puzzle.quadros": novos });
}

function renderFerramentaEspelho(c, index, todos, docRef, db, auth) {
    const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const div = document.createElement('div');
    div.style.cssText = `border-left: 4px solid ${config.cor}; background: rgba(255,255,255,0.02); margin-bottom: 12px; border-radius: 8px; padding:12px; cursor:pointer;`;
    div.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="font-size:9px; font-weight:800; color:${config.cor}; text-transform:uppercase;">${c.tipo}</span><i class="fa-solid fa-arrow-up-right-from-square" style="opacity:0.3; font-size:11px;"></i></div><div style="font-size:13px; color:white; line-height:1.4;">${c.titulo?`<b style="display:block; margin-bottom:4px;">${c.titulo}</b>`:''}<div style="opacity:0.8; white-space: pre-wrap;">${c.conteudo}</div></div><div style="font-size:8px; opacity:0.3; text-align:right; margin-top:8px; font-weight:800; text-transform:uppercase;"><i class="fa-solid fa-file-lines"></i> ${c.notaDados.nome}</div>`;
    div.onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDados, db, auth, c.id);
    return div;
}

function confirmarRemocaoMicaItem(nomeItem) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-puzzle-overlay');
        const btnSim = document.getElementById('btn-puzzle-confirm-sim');
        const btnNao = document.getElementById('btn-puzzle-confirm-cancelar');
        const txtTit = document.getElementById('puzzle-confirm-titulo');
        const txtMsg = document.getElementById('puzzle-confirm-msg');

        if (!overlay) return resolve(confirm(`Remover "${nomeItem}"?`));

        // Configuração Visual
        txtTit.innerText = "Remover Conteúdo?";
        txtMsg.innerHTML = `Tens a certeza que desejas retirar <br><b>"${nomeItem}"</b> desta Mica?`;
        btnSim.innerText = "Sim, Remover";
        btnSim.style.backgroundColor = "#ef4444"; // Vermelho para perigo

        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null; // Limpa o evento para evitar duplicação futura
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}