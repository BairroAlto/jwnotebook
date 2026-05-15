// components/direita/biblia-dossie.js
import { 
    doc, updateDoc, onSnapshot, getDoc, getDocs, collection, 
    query, where, arrayUnion, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';

let unsubDossie = null;
let unsubLocal = null; 
let micaAbertaId = null; 
let currentRef = null;
let currentUid = null;
let infoVersiculoAtual = null; 
let cacheMicas = {}; 
let ferramentasMapaVico = {}; // Cache vivo filtrado das notas

const CORES_MICA = {
    "Branco": "#ffffff", "Amarelo": "#f59e0b", "Vermelho": "#ef4444", "Laranja": "#ea580c", 
    "Castanho": "#78350f", "Verde": "#10b981", "Azul": "#3b82f6", "Rosa": "#ec4899", 
    "Lilás": "#a855f7", "Cinzento": "#6b7280", "Preto": "#000000"
};

/**
 * LIMPEZA
 */
export function limparDossieBiblia() {
    if (unsubDossie) { unsubDossie(); unsubDossie = null; }
    if (unsubLocal) { unsubLocal(); unsubLocal = null; }
    micaAbertaId = null;
    currentRef = null;
    cacheMicas = {};
    ferramentasMapaVico = {};
}

/**
 * ORQUESTRADOR DE DESENHO
 */
function executarDesenhoDossie(container, db, auth, onNavegacaoMica) {
    if (!container) return;
    container.innerHTML = "";
    if (micaAbertaId && cacheMicas[micaAbertaId]) {
        renderizarInteriorMica(cacheMicas[micaAbertaId], container, db, auth, onNavegacaoMica);
        onNavegacaoMica(true); 
    } else {
        onNavegacaoMica(false); 
        renderizarListaMicas(cacheMicas, container, db, auth, onNavegacaoMica);
    }
}

/**
 * INICIALIZAÇÃO E ESCUTAS LIVE
 */
export async function renderizarDossieBiblia(info, container, db, auth, onNavegacaoMica) {
    infoVersiculoAtual = info;
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    currentUid = auth.currentUser.uid;

    // --- 1. SINTONIZAR COM A TORRE DE CONTROLO (index.html) ---
    
    // A) Comando para Nova Pasta (Mica) - Ícone Laranja Folder-Plus
    window.removeEventListener('brain:abrirMicaPopup', window._handlerMicaBiblia);
    window._handlerMicaBiblia = () => {
        console.log("📥 [DOSSIÊ-BIBLIA] Abrindo criador de Mica...");
        abrirPopupMica(db, auth);
    };
    window.addEventListener('brain:abrirMicaPopup', window._handlerMicaBiblia);

    // B) Comando para Nova Referência - Ícone Verde Plus
    window.removeEventListener('brain:abrirReferenciaMica', window._handlerRefBiblia);
    window._handlerRefBiblia = () => {
        // Esta função deve abrir o popup de seleção (Micas/Aptos)
        if (typeof abrirPopupRefApta === 'function') {
            abrirPopupRefApta(db);
        }
    };
    window.addEventListener('brain:abrirReferenciaMica', window._handlerRefBiblia);


    // --- 2. ESCUTA DO DOCUMENTO MESTRE ---
    const qDossie = query(collection(db, "TextosBiblia"), where("userId", "==", currentUid), where("nome", "==", nomeCompleto));
    const snapDossie = await getDocs(qDossie);
    
    if (snapDossie.empty) {
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Cria primeiro uma anotação (aba +) para poderes usar o Dossiê.</p>`;
        return;
    }

    currentRef = doc(db, "TextosBiblia", snapDossie.docs[0].id);

    if (unsubDossie) unsubDossie();
    unsubDossie = onSnapshot(currentRef, (docSnap) => {
        if (!docSnap.exists()) return;
        cacheMicas = docSnap.data().Dossie?.mica || {};
        executarDesenhoDossie(container, db, auth, onNavegacaoMica);
    });
}

/**
 * VISTA 1: LISTA DE MICAS
 */
function renderizarListaMicas(micas, container, db, auth, onNavegacaoMica) {
    const lista = Object.values(micas).filter(m => m.estado === "ativo").sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (lista.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Nenhuma Mica criada.</p>`;
        return;
    }

    lista.forEach((mica, index) => {
        const div = document.createElement('div');
        div.style.cssText = `display:flex; align-items:center; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.05); cursor:pointer;`;
        div.innerHTML = `
            <div style="width:6px; height:50px; background:${mica.cor || '#fff'}; flex-shrink:0;"></div>
            <div style="flex:1; padding:0 15px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:white; font-size:13px;">${mica.titulo}</span>
                <div style="display:flex; gap:12px; color:rgba(255,255,255,0.2); font-size:11px;">
                    <i class="fa-solid fa-chevron-up btn-up" title="Subir"></i>
                    <i class="fa-solid fa-chevron-down btn-down" title="Descer"></i>
                    <i class="fa-solid fa-pen btn-edit" title="Editar"></i>
                    <i class="fa-solid fa-trash btn-del" style="color:#f87171;" title="Ocultar"></i>
                </div>
            </div>`;
        
        div.onclick = () => { micaAbertaId = mica.id; executarDesenhoDossie(container, db, auth, onNavegacaoMica); };
        
        const stop = (e) => e.stopPropagation();
        div.querySelector('.btn-up').onclick = (e) => { stop(e); moverMica(index, -1, lista); };
        div.querySelector('.btn-down').onclick = (e) => { stop(e); moverMica(index, 1, lista); };
        div.querySelector('.btn-edit').onclick = (e) => { stop(e); abrirPopupMica(db, auth, mica); };
        
        // --- POPUP PERSONALIZADO ---
        div.querySelector('.btn-del').onclick = async (e) => {
            stop(e);
            const confirmou = await confirmarDossieAcao("Ocultar Mica?", `Desejas ocultar a pasta "${mica.titulo}"?`, "Sim, Ocultar");
            if (confirmou) {
                await updateDoc(currentRef, { [`Dossie.mica.${mica.id}.estado`]: "desativo" });
            }
        };
        container.appendChild(div);
    });
}

/**
 * VISTA 2: INTERIOR DA MICA
 */
async function renderizarInteriorMica(mica, container, db, auth, onNavegacaoMica) {
    const btnVoltar = document.createElement('div');
    btnVoltar.style.cssText = `padding:10px; color:var(--primary); cursor:pointer; font-size:11px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:15px;`;
    btnVoltar.innerHTML = `<i class="fa-solid fa-arrow-left"></i> VOLTAR ÀS MICAS`;
    btnVoltar.onclick = () => { micaAbertaId = null; executarDesenhoDossie(container, db, auth, onNavegacaoMica); };
    container.appendChild(btnVoltar);

    const caixasMica = mica.caixas || [];

    caixasMica.forEach((refObj, index) => {
        const idAlvo = typeof refObj === 'object' ? refObj.id : refObj;
        const c = ferramentasMapaVico[idAlvo];
        if(!c) return;

        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        const div = document.createElement('div');
        div.style.cssText = `border-left: 3px solid ${config.cor}; background: rgba(255,255,255,0.02); margin-bottom: 8px; border-radius: 4px; padding: 10px;`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                <div style="display:flex; gap:10px; color:rgba(255,255,255,0.2); font-size:10px;">
                    <i class="fa-solid fa-chevron-up btn-up" style="cursor:pointer;"></i>
                    <i class="fa-solid fa-chevron-down btn-down" style="cursor:pointer;"></i>
                    <i class="fa-solid fa-trash-can btn-rem" style="color:#f87171; cursor:pointer;"></i>
                </div>
            </div>
            <div style="font-size:12px; color:white; opacity:0.9; cursor:pointer; line-height:1.4;" class="txt-body">
                ${c.titulo ? `<b>${c.titulo}</b><br>` : ''}${c.conteudo}
            </div>`;
        
        div.querySelector('.txt-body').onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, db, auth, c.id);
        div.querySelector('.btn-up').onclick = () => moverRefMica(index, -1, caixasMica, mica.id);
        div.querySelector('.btn-down').onclick = () => moverRefMica(index, 1, caixasMica, mica.id);
        
        // --- POPUP PERSONALIZADO ---
        div.querySelector('.btn-rem').onclick = async (e) => {
            e.stopPropagation();
            const confirmou = await confirmarDossieAcao("Remover Conteúdo?", "Remover este bloco da pasta?", "Remover");
            if(confirmou) {
                const novos = caixasMica.filter(x => (typeof x === 'object' ? x.id : x) !== idAlvo);
                await updateDoc(currentRef, { [`Dossie.mica.${mica.id}.caixas`]: novos });
            }
        };
        container.appendChild(div);
    });
}

/**
 * FUNÇÃO AUXILIAR: POPUP DE CONFIRMAÇÃO
 */
function confirmarDossieAcao(titulo, mensagem, textoBotao = "Confirmar", corBotao = "#ef4444") {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-puzzle-overlay');
        const btnSim = document.getElementById('btn-puzzle-confirm-sim');
        const btnNao = document.getElementById('btn-puzzle-confirm-cancelar');
        const txtTit = document.getElementById('puzzle-confirm-titulo');
        const txtMsg = document.getElementById('puzzle-confirm-msg');

        if (!overlay) return resolve(confirm(mensagem));

        txtTit.innerText = titulo;
        txtMsg.innerText = mensagem;
        btnSim.innerText = textoBotao;
        btnSim.style.backgroundColor = corBotao;

        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

/**
 * MOVIMENTAÇÃO
 */
async function moverMica(index, direcao, lista) {
    const novoIdx = index + direcao;
    if (novoIdx < 0 || novoIdx >= lista.length) return;
    const temp = lista[index].timestamp;
    lista[index].timestamp = lista[novoIdx].timestamp;
    lista[novoIdx].timestamp = temp;
    const obj = {};
    lista.forEach(m => obj[m.id] = m);
    await updateDoc(currentRef, { "Dossie.mica": obj });
}

async function moverRefMica(index, direcao, lista, micaId) {
    const novoIdx = index + direcao;
    if (novoIdx < 0 || novoIdx >= lista.length) return;
    [lista[index], lista[novoIdx]] = [lista[novoIdx], lista[index]];
    await updateDoc(currentRef, { [`Dossie.mica.${micaId}.caixas`]: lista });
}

/**
 * POPUPS DE CRIAÇÃO
 */
export function abrirPopupMica(db, auth, micaExistente = null) {
    const overlay = document.getElementById('popup-mica-overlay');
    const input = document.getElementById('mica-input-titulo');
    const seletorCor = document.getElementById('mica-cor-selector');
    
    input.value = micaExistente ? micaExistente.titulo : "";
    let corSel = micaExistente ? micaExistente.cor : "#ffffff";

    seletorCor.innerHTML = Object.entries(CORES_MICA).map(([n, h]) => `<div class="color-dot" data-hex="${h}" style="background:${h}; width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid ${corSel === h ? 'white' : 'transparent'};"></div>`).join('');
    seletorCor.querySelectorAll('.color-dot').forEach(dot => dot.onclick = () => { seletorCor.querySelectorAll('.color-dot').forEach(d => d.style.borderColor = "transparent"); dot.style.borderColor = "white"; corSel = dot.dataset.hex; });

    overlay.classList.add('active');
    input.focus();

    document.getElementById('btn-cancelar-mica').onclick = () => overlay.classList.remove('active');

    document.getElementById('btn-gravar-mica').onclick = async () => {
        const tit = input.value.trim(); if(!tit) return;
        const id = micaExistente ? micaExistente.id : crypto.randomUUID();
        const data = { id, titulo: tit, cor: corSel, timestamp: micaExistente ? micaExistente.timestamp : new Date().toISOString(), userId: currentUid, estado: "ativo", caixas: micaExistente ? micaExistente.caixas : [], textos: micaExistente ? micaExistente.textos : [] };
        await updateDoc(currentRef, { [`Dossie.mica.${id}`]: data });
        overlay.classList.remove('active');
    };
}

export async function abrirPopupRefApta(db) {
    const overlay = document.getElementById('popup-mica-ref-overlay');
    const container = document.getElementById('mica-ref-content');
    const tabNav = overlay.querySelector('.sub-tabs');
    if(tabNav) tabNav.style.display = 'none';

    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    const snapB = await getDoc(currentRef);
    const aptos = snapB.data().Dossie?.Apto || [];

    const caixasParaExibir = aptos.map(id => ferramentasMapaVico[id]).filter(c => c !== undefined);

    if(caixasParaExibir.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:20px; font-size:12px;">Nenhuma ferramenta apta e visível encontrada.</p>`;
        return;
    }

    container.innerHTML = caixasParaExibir.map(c => `
        <div class="ref-select-card" data-id="${c.id}" style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px; cursor:pointer; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:9px; opacity:0.5; font-weight:800;">${c.tipo.toUpperCase()}</span>
                <i class="fa-solid fa-check-circle check-icon" style="color:transparent;"></i>
            </div>
            <div style="font-size:13px; color:white;">${c.titulo || c.conteudo.substring(0,80)}...</div>
        </div>`).join('');
    
    container.querySelectorAll('.ref-select-card').forEach(card => {
        card.onclick = () => {
            const sel = card.style.borderColor === 'rgb(99, 102, 241)';
            card.style.borderColor = sel ? 'rgba(255,255,255,0.1)' : '#6366f1';
            card.querySelector('.check-icon').style.color = sel ? 'transparent' : '#6366f1';
        };
    });

    document.getElementById('btn-confirmar-ref-mica').onclick = async () => {
        const sels = Array.from(container.querySelectorAll('.ref-select-card')).filter(c => c.style.borderColor === 'rgb(99, 102, 241)').map(c => ({ id: c.dataset.id, timestamp: new Date().toISOString() }));
        if(sels.length > 0) {
            const snapA = await getDoc(currentRef);
            const m = snapA.data().Dossie.mica[micaAbertaId];
            const idsAtuais = (m.caixas || []).map(x => typeof x === 'object' ? x.id : x);
            const novosFiltrados = sels.filter(s => !idsAtuais.includes(s.id));
            await updateDoc(currentRef, { [`Dossie.mica.${micaAbertaId}.caixas`]: [...(m.caixas || []), ...novosFiltrados] });
        }
        overlay.classList.remove('active');
    };
}
