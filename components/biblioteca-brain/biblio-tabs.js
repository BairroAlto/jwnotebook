// components/biblioteca-brain/biblio-tabs.js
import { 
    doc, updateDoc, getDocs, collection, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { buscarRespostasDaRede } from './biblio-social.js';

/**
 * CACHE DE CONTROLO DE INTERFACE
 * idDoc: ID do documento da Biblioteca ativo.
 * idCaixa: ID da anotação especial interna.
 * Evita que o ecrã redesenhe (pisque) enquanto o utilizador digita.
 */
let cacheLocalUI = { idDoc: null, idCaixa: null, tipo: null, foco: null, cor: null };

/**
 * MOTOR PRINCIPAL: GERE O CICLO DE VIDA DA ANOTAÇÃO (ABA PEN-NIB)
 */
export function renderAnotacoes(estudo, container, db) {
    if (!estudo || !estudo.id) {
        console.warn("⚠️ [BRAIN] Estudo sem ID válido recebido.");
        return;
    }

    // 1. SINAL DE RÁDIO (PONTE RAM)
    // Indica ao Editor qual o parágrafo exato que o Brain tem aberto para sincronização instantânea
    window._brainRefAtiva = `${estudo.referencia}|${estudo.sequencia}`;

    // 2. LIMPEZA DE TRANSIÇÃO (ANTI-DADOS FANTASMA)
    // Se o ID do documento mudou (clique num parágrafo diferente), reseta tudo
    if (cacheLocalUI.idDoc !== estudo.id) {
        console.log(`♻️ [BRAIN] Trocando contexto para estudo: ${estudo.id}`);
        container.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.5;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
        cacheLocalUI = { idDoc: estudo.id, idCaixa: null, tipo: null, foco: null, cor: null };
    }

    // 3. SEGURANÇA DE LISTENERS
    // Mata o "ouvinte" anterior para não haver conflitos de rede ou múltiplas gravações
    if (window._unsubAnotacao) {
        window._unsubAnotacao();
        window._unsubAnotacao = null;
    }

    const docRef = doc(db, "Biblioteca", estudo.id);

    // 4. ESCUTA EM TEMPO REAL (SNAPSHOT)
    window._unsubAnotacao = onSnapshot(docRef, (snap) => {
        if (!snap.exists()) {
            console.error("❌ [BRAIN] Ficha não encontrada no Firebase.");
            return;
        }
        
        const data = snap.data();
        const caixa = data.anotacaoEspecial;

        // Caso a anotação não exista ou esteja marcada como removida (off)
        if (!caixa || caixa.estado === "off") {
            renderSeletor(container, docRef);
            return;
        }

        // 5. ASSINATURA DE RENDERIZAÇÃO
        // Só reconstrói o HTML se as propriedades estruturais mudarem (Tipo, Foco ou Cor)
        const assinaturaAtual = `${caixa.id}-${caixa.tipo}-${caixa.foco}-${caixa.destaques}`;
        const assinaturaCache = `${cacheLocalUI.idCaixa}-${cacheLocalUI.tipo}-${cacheLocalUI.foco}-${cacheLocalUI.cor}`;

        if (assinaturaAtual !== assinaturaCache) {
            // Atualizar assinatura no cache
            cacheLocalUI = { 
                idDoc: estudo.id,
                idCaixa: caixa.id, 
                tipo: caixa.tipo, 
                foco: caixa.foco, 
                cor: caixa.destaques 
            };
            
            // Desenha a interface ativa
            renderCaixaAtiva(container, caixa, docRef, estudo);
        }
    }, (error) => {
        console.error("❌ [BRAIN] Erro no Snapshot:", error);
    });
}

/**
 * VISTA 1: SELETOR DE FERRAMENTA (ESTUDO INÉDITO)
 */
function renderSeletor(container, docRef) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 60px 20px; gap:20px; opacity:0.9;">
            <p style="font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase; letter-spacing:2px; margin-bottom:10px;">Nova Anotação de Estudo</p>
            <div style="display:flex; flex-direction:column; gap:12px; width:100%; max-width:240px;">
                <button class="btn-amt" style="width:100%; height:54px; display:flex; align-items:center; gap:15px; padding:0 20px; border-radius:10px;" onclick="window.criarAnotacaoEspecial('contentor')">
                    <i class="fa-solid fa-box" style="color:#ea580c; font-size:18px;"></i> 
                    <span style="font-weight:700; font-size:13px; letter-spacing:0.5px;">CONTENTOR</span>
                </button>
                <button class="btn-amt" style="width:100%; height:54px; display:flex; align-items:center; gap:15px; padding:0 20px; border-radius:10px;" onclick="window.criarAnotacaoEspecial('subnota')">
                    <i class="fa-solid fa-box" style="color:#3b82f6; font-size:18px;"></i> 
                    <span style="font-weight:700; font-size:13px; letter-spacing:0.5px;">SUBNOTA</span>
                </button>
                <button class="btn-amt" style="width:100%; height:54px; display:flex; align-items:center; gap:15px; padding:0 20px; border-radius:10px;" onclick="window.criarAnotacaoEspecial('questao')">
                    <i class="fa-solid fa-box" style="color:#10b981; font-size:18px;"></i> 
                    <span style="font-weight:700; font-size:13px; letter-spacing:0.5px;">QUESTÃO</span>
                </button>
            </div>
        </div>
    `;

    window.criarAnotacaoEspecial = async (tipo) => {
        const nova = {
            id: crypto.randomUUID(), 
            tipo: tipo, 
            conteudo: "", 
            titulo: "", 
            estado: "on",
            foco: (tipo === "contentor" ? "comentario" : "original"),
            destaques: "", 
            timestamp: new Date().toISOString()
        };
        await updateDoc(docRef, { anotacaoEspecial: nova });
    };
}

/**
 * VISTA 2: ÁREA DE ESCRITA ATIVA
 */
function renderCaixaAtiva(container, caixa, docRef, estudoMestre) {
    const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const fKey = caixa.foco || "original";
    const mapaFocos = { subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO, contentor: FOCOS_BASE };
    
    const corBarra = (mapaFocos[caixa.tipo] || FOCOS_BASE)[fKey]?.corForte || config.cor;
    const labelTexto = (fKey === "original") ? config.nome : (mapaFocos[caixa.tipo] || FOCOS_BASE)[fKey]?.nome || fKey;

    const corFundo = caixa.destaques || "transparent";
    const corTexto = caixa.destaques ? "#000" : "white";

    container.innerHTML = `
        <div class="brain-box-item" style="border: 1px solid ${corBarra}4D; background: rgba(255,255,255,0.02); border-radius: 12px; overflow: hidden; margin-bottom: 50px;">
            <div style="display: flex; justify-content: space-between; padding: 12px 15px; background: ${corBarra}33; border-bottom: 1px solid ${corBarra}22;">
                <div style="font-size:9px; font-weight:900; color:${corBarra}; text-transform:uppercase; letter-spacing:1px;">${labelTexto}</div>
                <div style="display: flex; gap: 20px; color: rgba(255,255,255,0.4); font-size: 14px;">
                    <i class="fa-solid fa-paper-plane" onclick="window.partilharAnotacaoEspecial()" style="cursor:pointer;" title="Partilhar"></i>
                    <i class="fa-solid fa-palette" onclick="window.colorirAnotacaoEspecial()" style="cursor:pointer;" title="Destaque"></i>
                    <i class="fa-solid fa-trash-can" onclick="window.apagarAnotacaoEspecial()" style="color:#f87171; cursor:pointer;" title="Ocultar"></i>
                </div>
            </div>
            <div style="padding: 20px; background-color: ${corFundo}; transition: background 0.3s; min-height: 450px;">
                ${caixa.tipo !== 'contentor' ? `<input type="text" id="tit-especial" value="${caixa.titulo || ''}" placeholder="Título..." style="width:100%; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.05); color:${corTexto}; font-weight:700; margin-bottom:12px; outline:none; font-size:16px;">` : ''}
                <textarea id="txt-especial" style="width:100%; min-height:400px; background:transparent; border:none; color:${corTexto}; outline:none; resize:none; font-size:15px; line-height:1.7; font-family:inherit;" placeholder="Escreve aqui as tuas anotações...">${caixa.conteudo || ""}</textarea>
            </div>
        </div>
    `;

    vincularEventosUI(container, caixa, docRef, estudoMestre);
}

/**
 * LOGICA DE EVENTOS (COM SINCRONIZAÇÃO TOTAL RAM/FIRESTORE)
 */
function vincularEventosUI(container, caixa, docRef, estudoMestre) {
    const inputTit = container.querySelector('#tit-especial');
    const inputTxt = container.querySelector('#txt-especial');
    const db = window.db; 
    let timer;

    // ========================================================
    // 🚀 TRANSMISSOR RAM: BRAIN -> EDITOR CENTRAL
    // ========================================================
const transmitirParaEditorVivo = (camposNovos) => {
    // 1. Verificações de Segurança
    if (!window.caixasAtuais || !window.dadosNotaOriginal) return;
    
    const modos = Array.isArray(window.dadosNotaOriginal.modo) ? 
                  window.dadosNotaOriginal.modo : [window.dadosNotaOriginal.modo];
    
    // Só sincroniza se estivermos no modo Sentinela ou se a nota tiver o vínculo
    if (!modos.includes('sentinela')) return;

    // 2. Localizar a caixa correspondente na memória RAM (window.caixasAtuais)
    const caixaNoEditor = window.caixasAtuais.find(c => 
        c.referenciacodex && 
        c.referenciacodex[0] === estudoMestre.referencia && 
        String(c.referenciacodex[1]) === String(estudoMestre.sequencia)
    );

    if (caixaNoEditor) {
        // 3. Atualizar os dados na RAM
        Object.assign(caixaNoEditor, camposNovos);

        // 4. Localizar o elemento físico no DOM do Editor
        const elementoFisico = document.getElementById(`bloco-${caixaNoEditor.id}`);
        
        if (elementoFisico) {
            // A) Atualizar o CONTEÚDO (Textarea principal)
            if (camposNovos.conteudo !== undefined) {
                const txtArea = elementoFisico.querySelector('textarea:not(.tool-title-input)');
                // Só atualiza se o utilizador não estiver com o cursor lá (foco)
                if (txtArea && document.activeElement !== txtArea) {
                    txtArea.value = camposNovos.conteudo;
                }
            }

            // B) Atualizar o TÍTULO (Se for Questão ou SubNota)
            if (camposNovos.titulo !== undefined) {
                const titArea = elementoFisico.querySelector('.tool-title-input');
                if (titArea && document.activeElement !== titArea) {
                    titArea.value = camposNovos.titulo;
                }
            }

            // C) Sincronizar DESTAQUES (Cores de fundo)
            if (camposNovos.destaques !== undefined) {
                const targetTextarea = elementoFisico.querySelector('textarea:not(.tool-title-input)');
                if (targetTextarea) {
                    targetTextarea.style.backgroundColor = camposNovos.destaques || "transparent";
                    targetTextarea.style.color = camposNovos.destaques ? "#000" : "white";
                }
            }

            // 5. AJUSTE DE ALTURA AUTOMÁTICO
            // Importamos o utilitário para garantir que a caixa estica ou encolhe no editor
            import('../editor/modulos/ui-utils.js').then(m => {
                m.EditorUI.forçarAjusteAlturas();
            });
        }
    }
};

    // ========================================================
    // ✍️ ESCRITA LIVE COM DEBOUNCE
    // ========================================================
    const salvarTudo = () => {
        const txt = inputTxt.value;
        const tit = inputTit ? inputTit.value : (caixa.titulo || "");
        
        // 1. Sincronização RAM instantânea
        transmitirParaEditorVivo({ conteudo: txt, titulo: tit });

        // 2. Persistência Firebase
        clearTimeout(timer);
        timer = setTimeout(async () => {
            try {
                const agora = new Date().toISOString();
                await updateDoc(docRef, { 
                    "anotacaoEspecial.conteudo": txt, 
                    "anotacaoEspecial.titulo": tit,
                    "anotacaoEspecial.timestamp": agora 
                });

                // Replica para a Nota Sentinela se estiver aberta/existir
                const uid = window.auth.currentUser.uid;
                const qS = query(collection(db, "Local"), where("userId", "==", uid), where("modo", "array-contains", "sentinela"));
                const snapS = await getDocs(qS);
                for (const notaDoc of snapS.docs) {
                    const d = notaDoc.data();
                    let notaMudou = false;
                    const nC = d.caixas.map(c => {
                        if(c.referenciacodex && c.referenciacodex[0] === estudoMestre.referencia && String(c.referenciacodex[1]) === String(estudoMestre.sequencia)) {
                            notaMudou = true;
                            return { ...c, conteudo: txt, titulo: tit, timestamp: agora };
                        }
                        return c;
                    });
                    if (notaMudou) await updateDoc(notaDoc.ref, { caixas: nC });
                }
            } catch (e) { console.error("Erro no Sync Brain:", e); }
        }, 800);
    };

    inputTxt.oninput = salvarTudo;
    if (inputTit) inputTit.oninput = salvarTudo;

    // ========================================================
    // 🎨 PALETA E MUTAÇÃO (AUTO-SUFICIENTE)
    // ========================================================
window.colorirAnotacaoEspecial = async () => {
    console.log("📥 [BRAIN] Utilizador solicitou Centro de Personalização.");
    
    if (typeof window.abrirPaletaGlobal !== 'function') {
        console.log("📦 [BRAIN] Carregando motor de cores pela primeira vez...");
        const { abrirPaleta } = await import('../editor/modulos/paleta-cores.js');
        window.abrirPaletaGlobal = abrirPaleta;
    }

    window.abrirPaletaGlobal(caixa, "tab-destaques");


    // Sincronização após alteração (sem hacks de clique no overlay)
    // O paleta-cores.js usa o 'callbackAtualizarEditor' definido no 'iniciarSistemaCores'
    // Mas no Brain, precisamos de forçar a atualização da Biblioteca e da Nota local
    
    const listenerAlteracao = async () => {
        console.log("🎨 [BRAIN-PALETA] Alteração detectada, sincronizando...");
        
        // 1. Sincronizar com o Editor Vivo (RAM)
        transmitirParaEditorVivo({ 
            destaques: caixa.destaques, 
            foco: caixa.foco, 
            tipo: caixa.tipo 
        });

        // 2. Gravar na Biblioteca (Ficha Mestre)
        await updateDoc(docRef, { 
            "anotacaoEspecial.destaques": caixa.destaques || "",
            "anotacaoEspecial.foco": caixa.foco || "original",
            "anotacaoEspecial.tipo": caixa.tipo || "questao"
        });

        // 3. Replicar para a Nota Sentinela se necessário
        const uid = window.auth.currentUser.uid;
        const qS = query(collection(db, "Local"), where("userId", "==", uid), where("modo", "array-contains", "sentinela"));
        const snapS = await getDocs(qS);
        snapS.forEach(async (docN) => {
            const d = docN.data();
            const nC = d.caixas.map(c => {
                if(c.referenciacodex && c.referenciacodex[0] === estudoMestre.referencia && String(c.referenciacodex[1]) === String(estudoMestre.sequencia)) {
                    return { ...c, destaques: caixa.destaques, foco: caixa.foco, tipo: caixa.tipo };
                }
                return c;
            });
            await updateDoc(docN.ref, { caixas: nC });
        });
    };

    // Atribuímos este listener ao fecho do popup
    const btnFechar = document.getElementById('btn-fechar-cores');
    if (btnFechar) btnFechar.onclick = () => {
        listenerAlteracao();
        document.getElementById('popup-cores-overlay').classList.remove('active');
    };
};

    // ========================================================
    // 🗑️ LIXEIRA SINCRONIZADA
    // ========================================================
    window.apagarAnotacaoEspecial = async () => {
        if (confirm("Mover esta anotação para a reciclagem?")) {
            const agora = new Date().toISOString();
            transmitirParaEditorVivo({ estado: "off", timedelete: agora });

            await updateDoc(docRef, { 
                "anotacaoEspecial.estado": "off", 
                "anotacaoEspecial.timedelete": agora 
            });

            const uid = window.auth.currentUser.uid;
            const qS = query(collection(db, "Local"), where("userId", "==", uid), where("modo", "array-contains", "sentinela"));
            const snapS = await getDocs(qS);
            snapS.forEach(async (notaDoc) => {
                const d = notaDoc.data();
                const nC = d.caixas.map(c => {
                    if(c.referenciacodex && c.referenciacodex[0] === estudoMestre.referencia && String(c.referenciacodex[1]) === String(estudoMestre.sequencia)) {
                        return { ...c, estado: "off", timedelete: agora };
                    }
                    return c;
                });
                await updateDoc(notaDoc.ref, { caixas: nC });
            });
        }
    };

    // ========================================================
    // ✈️ PARTILHA (AUTO-SUFICIENTE)
    // ========================================================
    window.partilharAnotacaoEspecial = async () => {
        const p = { 
            ...caixa, 
            titulo: inputTit ? inputTit.value : "", 
            conteudo: inputTxt.value, 
            onde: "biblioteca", 
            idReferencia: estudoMestre.id 
        };

        if (typeof window.abrirPopupPartilharGlobal !== 'function') {
            const { abrirPopupPartilhar } = await import('../editor/modulos/partilhar.js');
            window.abrirPopupPartilharGlobal = (c, id) => abrirPopupPartilhar(c, id, () => {});
        }

        window.abrirPopupPartilharGlobal(p, estudoMestre.id);
    };
}

export function renderComentarios(estudo, container, db) {
    buscarRespostasDaRede(estudo, container);
}