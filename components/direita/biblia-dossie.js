// components/direita/biblia-dossie.js
import { 
    doc, updateDoc, onSnapshot, getDoc, collection, 
    query, where, getDocs, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';

// --- ESTADO LOCAL DO MÓDULO ---
let unsubDossie = null;
let unsubLocal = null; 
let micaAbertaId = null; 
let currentRef = null;
let currentUid = null;
let infoVersiculoAtual = null; 
let cacheMicas = {}; 
let ferramentasMapaVico = {}; // Cache de caixas: [UUID_INTERNO] -> Dados

const CORES_MICA = {
    "Branco": "#ffffff", "Amarelo": "#f59e0b", "Vermelho": "#ef4444", "Laranja": "#ea580c", 
    "Castanho": "#78350f", "Verde": "#10b981", "Azul": "#3b82f6", "Rosa": "#ec4899", 
    "Lilás": "#a855f7", "Cinzento": "#6b7280", "Preto": "#000000"
};

/**
 * LIMPEZA DE LISTENERS
 */
export function limparDossieBiblia() {
    if (unsubDossie) unsubDossie();
    if (unsubLocal) unsubLocal();
    micaAbertaId = null;
    cacheMicas = {};
    ferramentasMapaVico = {};
}

/**
 * INICIALIZAÇÃO E ESCUTAS LIVE
 */
export async function renderizarDossieBiblia(info, container, db, auth, onNavegacaoMica) {
    infoVersiculoAtual = info;
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    currentUid = auth.currentUser.uid;
    limparDossieBiblia();

    // --- ESCUTA 1: NOTAS LOCAIS (FILTRAGEM POR USERID E ESTADO ATIVO) ---
    const qLocal = query(
        collection(db, "Local"), 
        where("userId", "==", currentUid),
        where("estado", "==", "on") // 🛡️ Apenas notas vivas do utilizador
    );

    unsubLocal = onSnapshot(qLocal, (snap) => {
        ferramentasMapaVico = {};
        snap.forEach(docN => {
            const nData = docN.data();
            if(nData.caixas) nData.caixas.forEach(c => {
                // 🛡️ REGRA: A caixa também tem de estar ativa e usamos o ID (UUID) interno
                if (c.estado === "on") {
                    ferramentasMapaVico[c.id] = { ...c, notaDocId: docN.id, notaDadosCompletos: nData };
                }
            });
        });
        if (micaAbertaId) executarDesenhoDossie(container, db, auth, onNavegacaoMica);
    });

    // --- ESCUTA 2: ESTRUTURA DO DOSSIÊ NO VERSÍCULO ---
    const qDossie = query(collection(db, "TextosBiblia"), where("userId", "==", currentUid), where("nome", "==", nomeCompleto));
    const snapDossie = await getDocs(qDossie);
    
    if (snapDossie.empty) {
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Cria anotações primeiro para ativar o Dossiê.</p>`;
        return;
    }

    currentRef = doc(db, "TextosBiblia", snapDossie.docs[0].id);

    unsubDossie = onSnapshot(currentRef, (docSnap) => {
        if (!docSnap.exists()) return;
        cacheMicas = docSnap.data().Dossie?.mica || {};
        executarDesenhoDossie(container, db, auth, onNavegacaoMica);
    });

    // --- REGISTO DE EVENTOS DO CABEÇALHO ---
    window.removeEventListener('brain:abrirMicaPopup', abrirMicaHandler);
    window.addEventListener('brain:abrirMicaPopup', () => abrirPopupMica(db, auth));
    
    window.removeEventListener('brain:abrirReferenciaMica', abrirRefHandler);
    window.addEventListener('brain:abrirReferenciaMica', () => abrirPopupRefApta(db));
}

function abrirMicaHandler() {} // Placeholders para os listeners
function abrirRefHandler() {}

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
 * VISTA 1: LISTA DE MICAS
 */
function renderizarListaMicas(micas, container, db, auth, onNavegacaoMica) {
    const lista = Object.values(micas).filter(m => m.estado === "on").sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (lista.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:40px; font-size:12px; opacity:0.5;">Dossiê vazio. Clica no + laranja.</p>`;
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
                    <i class="fa-solid fa-chevron-up btn-up"></i>
                    <i class="fa-solid fa-chevron-down btn-down"></i>
                    <i class="fa-solid fa-trash btn-del" style="color:#f87171;"></i>
                </div>
            </div>`;
        
        div.onclick = () => { micaAbertaId = mica.id; executarDesenhoDossie(container, db, auth, onNavegacaoMica); };
        const stop = (e) => e.stopPropagation();
        div.querySelector('.btn-up').onclick = (e) => { stop(e); moverMica(index, -1, lista); };
        div.querySelector('.btn-down').onclick = (e) => { stop(e); moverMica(index, 1, lista); };
        div.querySelector('.btn-del').onclick = async (e) => { 
            stop(e); 
            if(confirm(`Ocultar a pasta "${mica.titulo}"?`)) 
                await updateDoc(currentRef, { [`Dossie.mica.${mica.id}.estado`]: "off" });
        };
        container.appendChild(div);
    });
}

/**
 * VISTA 2: INTERIOR DA MICA (FILTRADO)
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
        const c = ferramentasMapaVico[idAlvo]; // Aqui já está filtrado por estado e userId
        if(!c) return;

        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        const div = document.createElement('div');
        div.style.cssText = `border-left: 3px solid ${config.cor}; background: rgba(255,255,255,0.02); margin-bottom: 8px; border-radius: 4px; padding: 10px;`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                <i class="fa-solid fa-trash-can btn-rem" style="color:#f87171; cursor:pointer; font-size:10px; opacity:0.4;"></i>
            </div>
            <div style="font-size:12px; color:white; opacity:0.9; cursor:pointer;" class="txt-body">
                ${c.titulo ? `<b>${c.titulo}</b><br>` : ''}${c.conteudo.substring(0,120)}...
            </div>`;
        
        div.querySelector('.txt-body').onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDadosCompletos, db, auth, c.id);
        div.querySelector('.btn-rem').onclick = async (e) => {
            e.stopPropagation();
            const novos = caixasMica.filter(x => (typeof x === 'object' ? x.id : x) !== idAlvo);
            await updateDoc(currentRef, { [`Dossie.mica.${mica.id}.caixas`]: novos });
        };
        container.appendChild(div);
    });
}

/**
 * POPUP: ADICIONAR À MICA (FILTRAGEM DE ABA BÍBLIA)
 */
export async function abrirPopupRefApta(db) {
    const overlay = document.getElementById('popup-mica-ref-overlay');
    const container = document.getElementById('mica-ref-content');
    
    if (!overlay || !micaAbertaId) return;

    // --- 🎯 REGRA: ESCONDER ABA BÍBLIA NESTE CONTEXTO ---
    const btnTabBiblia = overlay.querySelector('.tab-mica-ref[data-target="ref-biblia"]');
    const tabContainer = overlay.querySelector('.sub-tabs');
    if (btnTabBiblia) btnTabBiblia.style.display = 'none';
    if (tabContainer) tabContainer.style.display = 'none'; // Esconde a barra toda se quiseres

    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    const snapB = await getDoc(currentRef);
    const aptos = snapB.data().Dossie?.Apto || [];
    const jaNaMica = (cacheMicas[micaAbertaId].caixas || []).map(x => typeof x === 'object' ? x.id : x);

    // Cruzamento com Cache filtrado por User e Estado
    const caixasParaExibir = aptos
        .filter(uuid => !jaNaMica.includes(uuid))
        .map(uuid => ferramentasMapaVico[uuid])
        .filter(c => c !== undefined);

    if(caixasParaExibir.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; font-size:11px;">Nenhum conteúdo mapeado disponível.</p>`;
        return;
    }

    container.innerHTML = caixasParaExibir.map(c => {
        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        return `
            <div class="ref-select-card" data-uuid="${c.id}" 
                 style="padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px; cursor:pointer; border:1px solid rgba(255,255,255,0.1); border-left: 4px solid ${config.cor};">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase;">${c.tipo}</span>
                    <i class="fa-solid fa-check-circle check-icon" style="color:transparent;"></i>
                </div>
                <div style="font-size:12px; color:white;">${c.titulo || c.conteudo.substring(0,80)}...</div>
            </div>`;
    }).join('');

    container.querySelectorAll('.ref-select-card').forEach(card => {
        card.onclick = () => {
            const isS = card.style.borderColor === 'rgb(99, 102, 241)';
            card.style.borderColor = isS ? 'rgba(255,255,255,0.1)' : '#6366f1';
            card.querySelector('.check-icon').style.color = isS ? 'transparent' : '#6366f1';
        };
    });

    document.getElementById('btn-confirmar-ref-mica').onclick = async () => {
        const selecionados = Array.from(container.querySelectorAll('.ref-select-card'))
            .filter(c => c.style.borderColor === 'rgb(99, 102, 241)')
            .map(c => ({ id: c.dataset.uuid, timestamp: new Date().toISOString() }));

        if(selecionados.length > 0) {
            const atuais = cacheMicas[micaAbertaId].caixas || [];
            await updateDoc(currentRef, { [`Dossie.mica.${micaAbertaId}.caixas`]: [...atuais, ...selecionados] });
        }
        overlay.classList.remove('active');
    };
}

/**
 * POPUP: NOVA MICA (PASTA)
 */
export function abrirPopupMica(db, auth) {
    const overlay = document.getElementById('popup-mica-overlay');
    const input = document.getElementById('mica-input-titulo');
    const seletorCor = document.getElementById('mica-cor-selector');
    
    input.value = "";
    let corSel = "#ffffff";

    seletorCor.innerHTML = Object.entries(CORES_MICA).map(([n, h]) => `<div class="color-dot" data-hex="${h}" style="background:${h}; width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid ${corSel === h ? 'white' : 'transparent'};"></div>`).join('');
    seletorCor.querySelectorAll('.color-dot').forEach(dot => dot.onclick = () => { seletorCor.querySelectorAll('.color-dot').forEach(d => d.style.borderColor = "transparent"); dot.style.borderColor = "white"; corSel = dot.dataset.hex; });

    overlay.classList.add('active');
    input.focus();

    document.getElementById('btn-cancelar-mica').onclick = () => overlay.classList.remove('active');
    document.getElementById('btn-gravar-mica').onclick = async () => {
        const tit = input.value.trim(); if(!tit) return;
        const id = crypto.randomUUID();
        const data = { id, titulo: tit, cor: corSel, timestamp: new Date().toISOString(), estado: "on", caixas: [] };
        await updateDoc(currentRef, { [`Dossie.mica.${id}`]: data });
        overlay.classList.remove('active');
    };
}

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