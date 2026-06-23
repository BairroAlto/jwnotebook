// components/direita/cosmos-dossie.js
import { doc, updateDoc, onSnapshot, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { moverItemNaMica, removerItemDaMica } from './dossie-actions.js';

// --- ESTADO LOCAL DO MÓDULO ---
let unsubDossie = null;
let unsubLocal = null; 
let micaAbertaId = null; 
let cacheDadosTema = null;
let currentTemaRef = null;
let currentContainer = null;
let currentOnMicaChange = null;
let currentDb = null;
let currentAuth = null;
let ferramentasMapaVico = {}; 

// --- HANDLERS ESTÁVEIS (Para o botão + funcionar sempre) ---
const abrirMicaHandler = () => abrirPopupMica();
const abrirRefHandler = () => abrirPopupRef();

const CORES_MICA = {
    "Branco": "#ffffff", "Amarelo": "#f59e0b", "Vermelho": "#ef4444", "Laranja": "#ea580c", 
    "Castanho": "#78350f", "Verde": "#10b981", "Azul": "#3b82f6", "Rosa": "#ec4899", 
    "Lilás": "#a855f7", "Cinzento": "#6b7280", "Preto": "#000000"
};

/**
 * 1. RENDERIZAÇÃO E ESCUTA LIVE
 */
export function renderizarDossie(tema, container, db, auth, onMicaChange) {
    currentTemaRef = doc(db, "Cosmo", tema.docIdFirebase || tema.id);
    currentContainer = container; 
    currentOnMicaChange = onMicaChange;
    currentDb = db; 
    currentAuth = auth;
    const uid = auth.currentUser.uid;

    // Ligar os sinais do botão +
    window.removeEventListener('cosmos:abrirMicaPopup', abrirMicaHandler);
    window.addEventListener('cosmos:abrirMicaPopup', abrirMicaHandler);
    window.removeEventListener('cosmos:abrirRefPopup', abrirRefHandler);
    window.addEventListener('cosmos:abrirRefPopup', abrirRefHandler);

    // Escuta Notas Locais
    if (unsubLocal) unsubLocal();
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", uid)), (snap) => {
        ferramentasMapaVico = {};
        snap.forEach(docN => {
            const d = docN.data();
            if (d.estado !== "on") return;
            if(d.caixas) d.caixas.forEach(c => {
                if (c.estado !== "on") return;
                ferramentasMapaVico[c.id] = { ...c, notaDocId: docN.id, notaDadosCompletos: d };
            });
        });
        executarRenderizacaoLogica();
    });

    // Escuta Estrutura do Dossiê
    if(unsubDossie) unsubDossie();
    unsubDossie = onSnapshot(currentTemaRef, (docSnap) => {
        if (!docSnap.exists()) return;
        cacheDadosTema = docSnap.data();
        executarRenderizacaoLogica();
    });
}

function executarRenderizacaoLogica() {
    if (!cacheDadosTema || !currentContainer) return;
    const micas = cacheDadosTema.Dossie?.mica || {};
    currentContainer.innerHTML = "";

    if (micaAbertaId && micas[micaAbertaId]) {
        renderizarVistaInterior(micas[micaAbertaId]);
    } else {
        const listaMicas = Object.values(micas)
            .filter(m => m.estado === "on")
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (listaMicas.length === 0) {
            currentContainer.innerHTML = `<p style="color:gray; text-align:center; margin-top:40px; font-size:12px; opacity:0.5;">Dossiê vazio.</p>`;
        }
        listaMicas.forEach((mica, idx) => currentContainer.appendChild(criarCardMica(mica, idx, listaMicas)));
    }
}

/**
 * 2. VISTA INTERIOR E CARDS (USANDO DOSSIE-ACTIONS)
 */
async function renderizarVistaInterior(mica) {
    const btnVoltar = document.createElement('div');
    btnVoltar.style.cssText = `padding: 10px; color: var(--primary); cursor:pointer; font-size:11px; font-weight:800; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.03); margin-bottom:15px;`;
    btnVoltar.innerHTML = `<i class="fa-solid fa-arrow-left"></i> VOLTAR AO DOSSIÊ`;
    btnVoltar.onclick = () => { micaAbertaId = null; currentOnMicaChange(null); executarRenderizacaoLogica(); };
    currentContainer.appendChild(btnVoltar);

    const idCaixas = mica.caixas || [];

    idCaixas.forEach((id, index) => {
        const c = ferramentasMapaVico[id];
        const div = document.createElement('div');
        
        // --- CONTROLOS COMUNS (SETAS E LIXEIRA) ---
        const controlesHtml = `
            <div style="display:flex; gap:12px; color:rgba(255,255,255,0.2); font-size:11px; align-items:center;">
                <i class="fa-solid fa-chevron-up btn-up" title="Subir" style="cursor:pointer;"></i>
                <i class="fa-solid fa-chevron-down btn-down" title="Descer" style="cursor:pointer;"></i>
                <i class="fa-solid fa-trash-can btn-rem" title="Remover" style="color:#f87171; cursor:pointer;"></i>
            </div>`;

        if (c) {
            // ==========================================
            // CENÁRIO 1: É UMA FERRAMENTA (CAIXA DE NOTA)
            // ==========================================
            const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            div.style.cssText = `border-left: 3px solid ${config.cor}; background: rgba(255,255,255,0.02); margin-bottom: 8px; border-radius: 4px; padding: 12px; cursor:pointer; transition: 0.2s;`;
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                    ${controlesHtml}
                </div>
                <div class="txt-body" style="font-size:12px; color:white; opacity:0.9; line-height:1.4;">
                    ${c.titulo ? `<b>${c.titulo}</b><br>` : ''}${c.conteudo}
                </div>`;
            
            // Clique no corpo: Abre a nota no editor central
            div.onclick = (e) => {
                if (e.target.classList.contains('fa-solid')) return; // Ignora se clicou nos ícones
                if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
                    window.abrirNotaNoBook(c.notaDocId, { ...c.notaDadosCompletos, onde: "local" }, currentDb, currentAuth, c.id);
                } else {
                    abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, currentDb, currentAuth, c.id);
                }
            };
        } else {
            // ==========================================
            // CENÁRIO 2: É UM VERSÍCULO BÍBLICO (STRING)
            // ==========================================
            div.style.cssText = `border-left: 3px solid #818cf8; background: rgba(129, 140, 248, 0.05); margin-bottom: 8px; border-radius: 4px; padding: 12px; cursor:pointer; transition: 0.2s;`;
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-book-bible" style="color:#818cf8; font-size:12px;"></i>
                        <span style="font-size:13px; color:white; font-weight:700;">${id}</span>
                    </div>
                    ${controlesHtml}
                </div>`;

            // Clique no corpo: Teleporte para Lists > Bíblia
            div.onclick = (e) => {
                if (e.target.classList.contains('fa-solid')) return; // Ignora se clicou nos ícones

                // 1. Extrair Livro, Cap e Ver da string (ex: "Salmos 23:1")
                const regex = /(.*)\s(\d+):(\d+)/;
                const match = id.match(regex);
                if (!match) return;
                const [_, livro, cap, ver] = match;

                // 2. Mudar a aba da Esquerda para "LISTS"
                const btnLists = Array.from(document.querySelectorAll('#left-buttons button'))
                                      .find(b => b.innerText.trim().toUpperCase() === 'LISTS');
                if (btnLists) btnLists.click();

                // 3. Executar a viagem na Bíblia
                import('../lists/biblia.js').then(m => {
                    if (typeof m.viajarParaVersiculoBiblico === 'function') {
                        m.viajarParaVersiculoBiblico(livro, cap, ver);
                    }
                });
            };
        }

        // --- ATRIBUIÇÃO DE ACÇÕES (MOVER E REMOVER) ---
        div.querySelector('.btn-up').onclick = (e) => { e.stopPropagation(); moverItemNaMica(index, -1, mica, currentTemaRef); };
        div.querySelector('.btn-down').onclick = (e) => { e.stopPropagation(); moverItemNaMica(index, 1, mica, currentTemaRef); };
        div.querySelector('.btn-rem').onclick = (e) => { e.stopPropagation(); removerItemDaMica(id, mica, currentTemaRef, currentDb, currentAuth, cacheDadosTema.id); };

        currentContainer.appendChild(div);
    });
}

/**
 * 3. AUXILIARES E POPUPS
 */
function criarCardMica(mica, index, listaCompleta) {
    const div = document.createElement('div');
    div.style.cssText = `display:flex; align-items:center; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.05); cursor:pointer;`;
    div.innerHTML = `
        <div style="width:6px; height:50px; background:${mica.cor || '#fff'}; flex-shrink:0;"></div>
        <div style="flex:1; padding:0 15px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; color:white; font-size:13px;">${mica.titulo}</span>
            <div style="display:flex; gap:12px; color:rgba(255,255,255,0.2); font-size:11px;">
                <i class="fa-solid fa-chevron-up btn-up-m"></i>
                <i class="fa-solid fa-chevron-down btn-down-m"></i>
                <i class="fa-solid fa-trash btn-del-m" style="color:#f87171;"></i>
            </div>
        </div>`;

    div.onclick = () => { micaAbertaId = mica.id; currentOnMicaChange(mica.id); executarRenderizacaoLogica(); };
    const stop = (e) => e.stopPropagation();
    div.querySelector('.btn-up-m').onclick = (e) => { stop(e); moverPastaMica(index, -1, listaCompleta); };
    div.querySelector('.btn-down-m').onclick = (e) => { stop(e); moverPastaMica(index, 1, listaCompleta); };
    div.querySelector('.btn-del-m').onclick = async (e) => { 
    stop(e); 
    if(await confirmarDossieAcao("Ocultar?", "Esta pasta será movida para a reciclagem. Confirmar?")) {
        const timestamp = new Date().toISOString(); // 🚀 Marca a hora da morte
        
        await updateDoc(currentTemaRef, { 
            [`Dossie.mica.${mica.id}.estado`]: "off",
            [`Dossie.mica.${mica.id}.timedelete`]: timestamp // 🚀 Crucial para os 3 meses
        });
        
        console.log(`🗑️ [DOSSIÊ] Mica "${mica.titulo}" enviada para reciclagem.`);
    }
};
    return div;
}

async function moverPastaMica(index, direcao, lista) {
    const n = index + direcao; if (n < 0 || n >= lista.length) return;
    const novos = [...lista]; [novos[index].timestamp, novos[n].timestamp] = [novos[n].timestamp, novos[index].timestamp];
    const obj = {}; novos.forEach(m => obj[m.id] = m);
    await updateDoc(currentTemaRef, { "Dossie.mica": obj });
}

export function abrirPopupMica(mica = null) {
    const overlay = document.getElementById('popup-mica-overlay');
    const input = document.getElementById('mica-input-titulo');
    const selector = document.getElementById('mica-cor-selector');
    if (!overlay) return;
    overlay.classList.add('active');
    input.value = mica ? mica.titulo : "";
    let corSel = mica ? mica.cor : "#ffffff";
    selector.innerHTML = Object.entries(CORES_MICA).map(([n, h]) => `<div class="color-dot-mica" data-hex="${h}" style="background:${h}; width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid ${corSel===h?'white':'transparent'};"></div>`).join('');
    selector.querySelectorAll('.color-dot-mica').forEach(dot => dot.onclick = () => { selector.querySelectorAll('.color-dot-mica').forEach(d => d.style.borderColor = "transparent"); dot.style.borderColor = "white"; corSel = dot.dataset.hex; });
    document.getElementById('btn-gravar-mica').onclick = async () => {
        const tit = input.value.trim(); if(!tit) return;
        const id = mica ? mica.id : crypto.randomUUID();
        const data = { id, titulo: tit, cor: corSel, timestamp: mica ? mica.timestamp : new Date().toISOString(), estado: "on", caixas: mica ? mica.caixas : [] };
        await updateDoc(currentTemaRef, { [`Dossie.mica.${id}`]: data });
        overlay.classList.remove('active');
    };
    document.getElementById('btn-cancelar-mica').onclick = () => overlay.classList.remove('active');
}

export function abrirPopupRef() {
    const overlay = document.getElementById('popup-mica-ref-overlay');
    const container = document.getElementById('mica-ref-content');
    
    // 1. VERIFICAÇÃO DE SEGURANÇA
    if (!overlay || !micaAbertaId || !cacheDadosTema) {
        console.warn("⚠️ [COSMOS-DOSSIÊ] Não é possível abrir o seletor sem uma Mica ativa.");
        return;
    }

    // 2. CONFIGURAÇÃO DE INTERFACE (CONTEXTO COSMOS)
    const tabBiblia = overlay.querySelector('.tab-mica-ref[data-target="ref-biblia"]');
    const tabContainer = overlay.querySelector('.sub-tabs');

    // ✅ No Cosmos, a aba Bíblia é OBRIGATÓRIA
    if (tabBiblia) tabBiblia.style.display = 'inline-flex';
    if (tabContainer) tabContainer.style.display = 'flex';

    overlay.classList.add('active');
    
    // 3. GESTÃO DE CLIQUES NAS ABAS DO POPUP
    const tabs = overlay.querySelectorAll('.tab-mica-ref');
    tabs.forEach(tab => {
        tab.onclick = () => {
            const target = tab.dataset.target;
            
            // Limpar estados das abas
            tabs.forEach(x => x.classList.remove('active'));
            tab.classList.add('active');

            if (target === 'ref-biblia') {
                // --- CENÁRIO A: SELECIONAR VERSÍCULOS ---
                // Guardamos o ID da Mica na window para o seletor saber onde devolver os dados
                window.micaAbertaIdParaSelector = micaAbertaId; 
                overlay.classList.remove('active'); 
                
                // Abre o seletor bíblico global enviando os dados do tema atual
                import('../editor/modulos/biblia-selector.js').then(m => {
                    m.abrirSelector({ 
                        ...cacheDadosTema, 
                        docIdFirebase: currentTemaRef.id,
                        tipo: "cosmos" // Contexto para o seletor saber que é Cosmos
                    });
                });
            } else {
                // --- CENÁRIO B: SELECIONAR BLOCOS DE NOTAS ---
                renderizarListaCaixasAptasLocal(container);
            }
        };
    });

    // Abrir por defeito na aba de Caixas (Anotações)
    const tabDefault = overlay.querySelector('.tab-mica-ref[data-target="ref-caixas"]');
    if (tabDefault) tabDefault.click();
}

function renderizarListaCaixasAptasLocal(container) {
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i><p style="font-size:10px; margin-top:10px;">A SINTONIZAR...</p></div>`;

    // 1. Identificar o que está "Apto" para este tema e o que já está nesta Mica
    const aptos = cacheDadosTema.Dossie?.Apto || [];
    const jaNaMicaRaw = cacheDadosTema.Dossie.mica[micaAbertaId].caixas || [];
    
    // Normalizar IDs (suporta se a mica tiver strings ou objetos)
    const jaNaMicaIds = jaNaMicaRaw.map(item => typeof item === 'object' ? item.id : item);

    // 2. Cruzamento com as Notas Locais (ferramentasMapaVico é filtrado por userId e estado)
    const caixasExibir = aptos
        .filter(uuid => !jaNaMicaIds.includes(uuid))
        .map(uuid => ferramentasMapaVico[uuid])
        .filter(c => c !== undefined);

    if (caixasExibir.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; opacity:0.5;">
                <i class="fa-solid fa-ghost" style="font-size:30px; margin-bottom:15px;"></i>
                <p style="font-size:11px;">Não existem novos blocos mapeados.</p>
            </div>`;
        return;
    }

    // 3. DESENHAR A LISTA
    container.innerHTML = caixasExibir.map(c => {
        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        return `
            <div class="ref-select-card" data-uuid="${c.id}" data-selected="false"
                 style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px; cursor:pointer; border:1px solid rgba(255,255,255,0.1); border-left: 4px solid ${config.cor}; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                    <i class="fa-solid fa-check-circle check-icon" style="color:transparent; font-size:14px;"></i>
                </div>
                <div style="font-size:12px; color:white; opacity:0.9; line-height:1.4;">
                    ${c.titulo ? `<b>${c.titulo}</b><br>` : ''}${c.conteudo.substring(0,80)}...
                </div>
            </div>`;
    }).join('');

    // 4. LOGICA DE SELEÇÃO VISUAL
    container.querySelectorAll('.ref-select-card').forEach(card => {
        card.onclick = () => {
            const isSelected = card.getAttribute('data-selected') === "true";
            const newStatus = !isSelected;
            card.setAttribute('data-selected', newStatus);
            
            card.style.borderColor = newStatus ? '#6366f1' : 'rgba(255,255,255,0.1)';
            card.querySelector('.check-icon').style.color = newStatus ? '#6366f1' : 'transparent';
            card.style.background = newStatus ? "rgba(99, 102, 241, 0.05)" : "rgba(255,255,255,0.03)";
        };
    });

    // 5. BOTÃO CONFIRMAR (ATUALIZA O FIREBASE)
    document.getElementById('btn-confirmar-ref-mica').onclick = async () => {
        const selecionados = Array.from(container.querySelectorAll('.ref-select-card'))
            .filter(c => c.getAttribute('data-selected') === "true")
            .map(c => ({ id: c.dataset.uuid, timestamp: new Date().toISOString() }));

        if (selecionados.length > 0) {
            const listaFinal = [...jaNaMicaRaw, ...selecionados];
            await updateDoc(currentTemaRef, { 
                [`Dossie.mica.${micaAbertaId}.caixas`]: listaFinal 
            });
        }
        document.getElementById('popup-mica-ref-overlay').classList.remove('active');
    };
}

function renderizarListaCaixasAptas(container) {
    const aptos = cacheDadosTema.Dossie?.Apto || [];
    const jaNaMica = cacheDadosTema.Dossie.mica[micaAbertaId].caixas || [];
    const exibir = aptos.filter(id => !jaNaMica.includes(id)).map(id => ferramentasMapaVico[id]).filter(c => c);
    if (exibir.length === 0) { container.innerHTML = `<p style="color:gray; text-align:center; padding:20px; font-size:11px;">Sem caixas aptas.</p>`; return; }
    container.innerHTML = exibir.map(c => `<div class="ref-select-card" data-id="${c.id}" style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px; cursor:pointer; border:1px solid rgba(255,255,255,0.1);"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="font-size:9px; opacity:0.5; font-weight:800; color:var(--primary);">${c.tipo.toUpperCase()}</span><i class="fa-solid fa-check-circle check-icon" style="color:transparent;"></i></div><div style="font-size:12px; color:white;">${c.titulo || c.conteudo.substring(0,80)}...</div></div>`).join('');
    container.querySelectorAll('.ref-select-card').forEach(card => card.onclick = () => {
        const isS = card.style.borderColor === 'rgb(99, 102, 241)';
        card.style.borderColor = isS ? 'rgba(255,255,255,0.1)' : '#6366f1';
        card.querySelector('.check-icon').style.color = isS ? 'transparent' : '#6366f1';
    });
    document.getElementById('btn-confirmar-ref-mica').onclick = async () => {
        const sels = Array.from(container.querySelectorAll('.ref-select-card')).filter(c => c.style.borderColor === 'rgb(99, 102, 241)').map(c => c.dataset.id);
        if(sels.length > 0) await updateDoc(currentTemaRef, { [`Dossie.mica.${micaAbertaId}.caixas`]: [...new Set([...jaNaMica, ...sels])] });
        overlay.classList.remove('active');
    };
}

function confirmarDossieAcao(t, m) {
    return new Promise(res => {
        const o = document.getElementById('popup-confirmar-puzzle-overlay');
        if (!o) return res(confirm(m));
        document.getElementById('puzzle-confirm-titulo').innerText = t;
        document.getElementById('puzzle-confirm-msg').innerText = m;
        o.classList.add('active');
        document.getElementById('btn-puzzle-confirm-sim').onclick = () => { o.classList.remove('active'); res(true); };
        document.getElementById('btn-puzzle-confirm-cancelar').onclick = () => { o.classList.remove('active'); res(false); };
    });
}

/**
 * LIMPEZA DO DOSSIÊ
 * Interrompe todas as escutas live do Firebase para esta aba
 */
export function limparDossie() {
    if (unsubDossie) {
        console.log("🛑 [CLEANUP] Dossiê: Parando escuta de estrutura.");
        unsubDossie();
        unsubDossie = null;
    }
    if (unsubLocal) {
        console.log("🛑 [CLEANUP] Dossiê: Parando escuta de notas locais.");
        unsubLocal();
        unsubLocal = null;
    }
    micaAbertaId = null; // Reset da pasta para não reabrir na mesma se mudar de tema
}
