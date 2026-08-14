// components/direita/biblia-dossie.js
import { 
    doc, updateDoc, onSnapshot, getDoc, collection, 
    query, where, getDocs, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { abrirNotaNoEditor } from '../editor/editor.js';
import { isMobileViewport } from '../ui/mobile-device.js';
import { subscreverCaixasPorIds } from './biblia-associadas-cache.js';
import { mostrarCarregamentoCaixas, mostrarErroCarregamentoCaixas } from './biblia-carregamento-ui.js';

// --- ESTADO LOCAL DO MÓDULO ---
let unsubDossie = null;
let cancelLocalDossieSub = null; 
let micaAbertaId = null; 
let currentRef = null;
let currentUid = null;
let infoVersiculoAtual = null; 
let cacheMicas = {};
let ferramentasMapaVico = {};
let estruturaDossiePronta = false;
let caixasAssociadasProntas = false;
let dossieSemDocumento = false;
let tInicioDossie = 0;
let filtroSublinhadoDossie = null;
export function limparDossieBiblia() {
    if (unsubDossie) unsubDossie();
    if (cancelLocalDossieSub) { cancelLocalDossieSub(); cancelLocalDossieSub = null; }
    micaAbertaId = null;
    cacheMicas = {};
    ferramentasMapaVico = {};
    estruturaDossiePronta = false;
    caixasAssociadasProntas = false;
    dossieSemDocumento = false;
}

export async function renderizarDossieBiblia(info, container, db, auth, onNavegacaoMica, referenciaSublinhado = null) {
    const tStart = performance.now();
    tInicioDossie = tStart;
    infoVersiculoAtual = info;
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    currentUid = auth.currentUser.uid;
    limparDossieBiblia();
    filtroSublinhadoDossie = referenciaSublinhado;

    mostrarCarregamentoCaixas(container, { area: "Dossiê", cor: "#f59e0b" });

    const qDossie = query(collection(db, "TextosBiblia"), where("userId", "==", currentUid), where("nome", "==", nomeCompleto));
    
    unsubDossie = onSnapshot(qDossie, (snapDossie) => {
        if (snapDossie.empty) {
            dossieSemDocumento = true;
            estruturaDossiePronta = true;
            ferramentasMapaVico = {};
            caixasAssociadasProntas = true;
            tentarRenderizarDossie(container, db, auth, onNavegacaoMica);
            return;
        }
        const docSnap = snapDossie.docs[0];
        currentRef = docSnap.ref;
        const dadosDossie = docSnap.data();
        cacheMicas = dadosDossie.Dossie?.mica || {};
        dossieSemDocumento = false;
        estruturaDossiePronta = true;
        ligarCaixasDoDossie(dadosDossie, container, db, auth, onNavegacaoMica, tStart);
        console.log("[BIBLE-BOX-PERF] Dossie | TextosBiblia recebido em " + (performance.now() - tStart).toFixed(1) + "ms");
        tentarRenderizarDossie(container, db, auth, onNavegacaoMica);
    });

    window.removeEventListener('brain:abrirMicaPopup', abrirMicaHandler);
    window.addEventListener('brain:abrirMicaPopup', () => abrirPopupMica(db, auth));
    
    window.removeEventListener('brain:abrirReferenciaMica', abrirRefHandler);
    window.addEventListener('brain:abrirReferenciaMica', () => abrirPopupRefApta(db));
}

function ligarCaixasDoDossie(dadosDossie, container, db, auth, onNavegacaoMica, tStart) {
    const referencias = [
        ...(dadosDossie.Dossie?.Apto || []),
        ...Object.values(dadosDossie.Dossie?.mica || {}).flatMap(mica => mica.caixas || [])
    ];
    const ids = referencias.map(item => typeof item === "string" ? item : item?.id).filter(Boolean);

    if (!ids.length) {
        ferramentasMapaVico = {};
        caixasAssociadasProntas = true;
        return;
    }

    caixasAssociadasProntas = false;
    mostrarCarregamentoCaixas(container, { area: "Dossie", cor: "#f59e0b", mensagem: "A carregar caixas associadas..." });
    cancelLocalDossieSub?.();
    cancelLocalDossieSub = subscreverCaixasPorIds(ids, db, currentUid, (mapa, meta) => {
        if (meta?.erro) {
            caixasAssociadasProntas = true;
            mostrarErroCarregamentoCaixas(container, { area: "Dossie", cor: "#fb7185", mensagem: "Não foi possível carregar as caixas do Dossiê." });
            return;
        }
        console.log("[BIBLE-BOX-PERF] Dossie | caixas por IDs recebidas em " + (performance.now() - tStart).toFixed(1) + "ms | caixas: " + Object.keys(mapa).length);
        ferramentasMapaVico = mapa;
        caixasAssociadasProntas = true;
        tentarRenderizarDossie(container, db, auth, onNavegacaoMica);
    });
}
function abrirMicaHandler() {}
function abrirRefHandler() {}

function tentarRenderizarDossie(container, db, auth, onNavegacaoMica) {
    if (!estruturaDossiePronta || !caixasAssociadasProntas) {
        const mensagem = estruturaDossiePronta
            ? "A carregar caixas associadas..."
            : "A preparar o Dossiê...";
        mostrarCarregamentoCaixas(container, { area: "Dossiê", cor: "#f59e0b", mensagem });
        return;
    }

    if (dossieSemDocumento) {
        container.innerHTML = '<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Cria anotações primeiro para activar o Dossiê.</p>';
        return;
    }

    executarDesenhoDossie(container, db, auth, onNavegacaoMica);
    console.log("[BIBLE-BOX-PERF] Dossiê | conteúdo visível no DOM em " + (performance.now() - tInicioDossie).toFixed(1) + "ms");
}

function executarDesenhoDossie(container, db, auth, onNavegacaoMica) {
    if (!container) return;
    container.innerHTML = "";
    if (filtroSublinhadoDossie?.groupIds?.length) {
        const faixa = document.createElement("div");
        faixa.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:9px 11px; border-radius:9px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.24); color:#fcd34d; font-size:11px;";
        faixa.innerHTML = '<i class="fa-solid fa-highlighter"></i> A mostrar apenas caixas do sublinhado seleccionado';
        container.appendChild(faixa);
    }
    if (micaAbertaId && cacheMicas[micaAbertaId]) {
        renderizarInteriorMica(cacheMicas[micaAbertaId], container, db, auth, onNavegacaoMica);
        onNavegacaoMica(true); 
    } else {
        onNavegacaoMica(false); 
        renderizarListaMicas(cacheMicas, container, db, auth, onNavegacaoMica);
    }
}

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

async function renderizarInteriorMica(mica, container, db, auth, onNavegacaoMica) {
    const btnVoltar = document.createElement('div');
    btnVoltar.style.cssText = `padding:10px; color:var(--primary); cursor:pointer; font-size:11px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:15px; display:flex; align-items:center; gap:6px;`;
    btnVoltar.innerHTML = `<i class="fa-solid fa-arrow-left"></i> VOLTAR ÀS MICAS`;
    btnVoltar.onclick = () => { micaAbertaId = null; executarDesenhoDossie(container, db, auth, onNavegacaoMica); };
    container.appendChild(btnVoltar);

    const caixasMica = mica.caixas || [];

    if (caixasMica.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = `color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;`;
        emptyMsg.innerText = `Esta pasta está vazia. Usa o + verde para adicionar referências.`;
        container.appendChild(emptyMsg);
        return;
    }

    caixasMica.forEach((refObj, index) => {
        const idAlvo = typeof refObj === 'object' ? refObj.id : refObj;
        const c = ferramentasMapaVico[idAlvo];
        if (!c) return;
        const grupos = filtroSublinhadoDossie?.groupIds || [];
        const gruposCaixa = c.referenciaSublinhado?.groupIds || (c.referenciaSublinhado?.groupId ? [c.referenciaSublinhado.groupId] : []);
        if (grupos.length && !gruposCaixa.some(groupId => grupos.includes(groupId))) return;

        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor || { icon: 'fa-solid fa-box', cor: '#ea580c', nome: 'Contentor' };
        const mapaFocos = { subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO };
        const corFoco = c.corFocus || (mapaFocos[c.tipo] || FOCOS_BASE)[c.foco || "original"]?.corForte || config.cor || '#ea580c';
        const nomeNota = c.notaDadosCompletos?.titulo || c.notaDadosCompletos?.nome || "Nota sem título";
        const tipoNome = config.nome || c.tipo || "Ferramenta";

        const div = document.createElement('div');
        div.style.cssText = `border-left: 4px solid ${corFoco}; background: rgba(255,255,255,0.03); margin-bottom: 12px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);`;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background: ${corFoco}18; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="display:flex; align-items:center; gap:8px; overflow:hidden; max-width:75%;">
                    <span style="font-size:10px; font-weight:800; color:${corFoco}; text-transform:uppercase; display:flex; align-items:center; gap:5px; flex-shrink:0;">
                        <i class="${config.icon}"></i> ${tipoNome}
                    </span>
                    <span style="font-size:11px; font-weight:600; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <i class="fa-regular fa-file-lines" style="margin-left:4px; margin-right:2px; opacity:0.6;"></i> ${nomeNota}
                    </span>
                </div>
                <div style="display:flex; gap:12px; align-items:center; flex-shrink:0;">
                    <button class="btn-viajar" title="Ir para a nota" style="background:none; border:none; color:#818cf8; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                    <button class="btn-rem" title="Desvincular da Mica" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:12px; padding:2px;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div style="padding:12px; font-size:13px; color:#e2e8f0; line-height:1.5;" class="txt-body">
                ${c.titulo ? `<div style="font-weight:700; margin-bottom:6px; color:${corFoco}; font-size:13px;">${c.titulo}</div>` : ''}
                <p style="margin:0; white-space: pre-wrap; font-size:13.5px; color:#cbd5e1;">${c.conteudo || "Caixa vazia"}</p>
            </div>
        `;

        div.querySelector('.btn-viajar').onclick = (e) => {
            e.stopPropagation();
            if (window.location.pathname.includes('biblia.html') && !isMobileViewport()) {
                window.open(`index.html?nota=${c.notaDocId}&caixa=${c.id}${c.onde === "share" ? "&onde=share" : ""}`, '_blank');
            } else if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
                window.abrirNotaNoBook(c.notaDocId, { ...c.notaDadosCompletos, onde: c.onde || "local" }, db, auth, c.id);
            } else {
                abrirNotaNoEditor(c.notaDocId, { ...c.notaDadosCompletos, onde: c.onde || "local" }, db, auth, c.id);
            }
        };

        div.querySelector('.btn-rem').onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Remover esta caixa da pasta do Dossiê?")) {
                const novos = caixasMica.filter(x => (typeof x === 'object' ? x.id : x) !== idAlvo);
                await updateDoc(currentRef, { [`Dossie.mica.${mica.id}.caixas`]: novos });
            }
        };

        container.appendChild(div);
    });
}

export async function abrirPopupRefApta(db) {
    const overlay = document.getElementById('popup-mica-ref-overlay');
    const container = document.getElementById('mica-ref-content');
    
    if (!overlay || !micaAbertaId) return;

    const btnTabBiblia = overlay.querySelector('.tab-mica-ref[data-target="ref-biblia"]');
    const tabContainer = overlay.querySelector('.sub-tabs');
    if (btnTabBiblia) btnTabBiblia.style.display = 'none';
    if (tabContainer) tabContainer.style.display = 'none';

    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    const snapB = await getDoc(currentRef);
    const aptos = snapB.data().Dossie?.Apto || [];
    const jaNaMica = (cacheMicas[micaAbertaId].caixas || []).map(x => typeof x === 'object' ? x.id : x);

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

export async function abrirPopupMica(db, auth) {
    const overlay = document.getElementById('popup-mica-overlay');
    const inputT = document.getElementById('mica-input-titulo');
    const selectorCores = document.getElementById('mica-cor-selector');
    const btnConfirmar = document.getElementById('btn-gravar-mica');
    const btnCancelar = document.getElementById('btn-cancelar-mica');
    if (!overlay || !inputT || !btnConfirmar) return;

    overlay.classList.add('active');
    inputT.value = "";
    let corSelecionada = "#3b82f6";
    if (selectorCores) {
        selectorCores.innerHTML = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
            .map(cor => `<div class="color-dot-mica" data-hex="${cor}" style="background:${cor}; width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid ${cor === corSelecionada ? 'white' : 'transparent'};"></div>`)
            .join('');
        selectorCores.querySelectorAll('.color-dot-mica').forEach(dot => {
            dot.onclick = () => {
                selectorCores.querySelectorAll('.color-dot-mica').forEach(item => item.style.borderColor = 'transparent');
                dot.style.borderColor = 'white';
                corSelecionada = dot.dataset.hex;
            };
        });
    }

    btnConfirmar.onclick = async () => {
        const titulo = inputT.value.trim();
        const cor = corSelecionada;
        if (!titulo) return;

        const idMica = crypto.randomUUID();
        const novaMica = {
            id: idMica,
            titulo: titulo,
            cor: cor,
            estado: "on",
            timestamp: new Date().toISOString(),
            caixas: []
        };

        await updateDoc(currentRef, {
            [`Dossie.mica.${idMica}`]: novaMica
        });
        await sincronizarMicaNosVersiculos(idMica, novaMica);

        overlay.classList.remove('active');
    };
    if (btnCancelar) btnCancelar.onclick = () => overlay.classList.remove('active');
}

async function moverMica(index, direcao, lista) {
    const targetIdx = index + direcao;
    if (targetIdx < 0 || targetIdx >= lista.length) return;
    const temp = lista[index];
    lista[index] = lista[targetIdx];
    lista[targetIdx] = temp;

    const novasMicas = {};
    lista.forEach(m => { novasMicas[m.id] = m; });
    await updateDoc(currentRef, { "Dossie.mica": novasMicas });
}

async function sincronizarMicaNosVersiculos(idMica, mica) {
    const versiculos = [...new Set((filtroSublinhadoDossie?.fragmentos || [])
        .map(fragmento => Number(fragmento.versiculo)).filter(Boolean))];
    if (versiculos.length <= 1 || !currentRef || !infoVersiculoAtual) return;

    const qCapitulo = query(
        collection(currentRef.firestore, 'TextosBiblia'),
        where('userId', '==', currentUid),
        where('livro', '==', infoVersiculoAtual.livro)
    );
    const snapshot = await getDocs(qCapitulo);
    const docs = snapshot.docs.filter(snap =>
        Number(snap.data()?.capitulo) === Number(infoVersiculoAtual.cap) &&
        versiculos.includes(Number(snap.data()?.versiculo))
    );

    await Promise.all(docs.map(snap => updateDoc(snap.ref, {
        [`Dossie.mica.${idMica}`]: mica
    })));
}
