// components/biblioteca-brain/biblio-tabs.js
import { 
    doc, updateDoc, getDocs, collection, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { buscarRespostasDaRede } from './biblio-social.js';
import { transmitirParaEditorVivo } from './biblio-transmitter.js';
import { salvarNaBiblioteca, replicarParaNotaSentinela } from './biblio-persistence.js';
import { executarMutacaoCores, executarApagar } from './biblio-actions.js';

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
    if (container.innerHTML === "") {
        cacheLocalUI.idDoc = null;
    }
    
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
        if (!snap.exists()) return;
        
        const data = snap.data();
        let caixa = data.anotacaoEspecial;

        if (!caixa || caixa.estado === "off") {
            cacheLocalUI.idCaixa = null;
            renderSeletor(container, docRef);
            return;
        }
    
    // 🚀 A CORREÇÃO MESTRE: SINCRONIZAÇÃO RAM -> UI
        // Antes de renderizar, verificamos se este bloco está aberto no Editor
        if (window.caixasAtuais) {
            const blocoNoEditor = window.caixasAtuais.find(c => 
                c.referenciacodex && 
                c.referenciacodex[0] === data.referencia && 
                String(c.referenciacodex[1]) === String(data.sequencia)
            );

            if (blocoNoEditor) {
                console.log("⚡ [BRAIN-SYNC] Usando texto em tempo real da RAM.");
                caixa.conteudo = blocoNoEditor.conteudo;
                caixa.titulo = blocoNoEditor.titulo;
            }
        }

    // 🚀 CORREÇÃO 2: Só calcula a assinatura se a caixa existir
    const assinaturaAtual = `${caixa.id}-${caixa.tipo}-${caixa.foco}-${caixa.destaques}`;
    const assinaturaCache = `${cacheLocalUI.idCaixa}-${cacheLocalUI.tipo}-${cacheLocalUI.foco}-${cacheLocalUI.cor}`;

    if (assinaturaAtual !== assinaturaCache) {
        cacheLocalUI = { 
            idDoc: estudo.id,
            idCaixa: caixa.id, 
            tipo: caixa.tipo, 
            foco: caixa.foco, 
            cor: caixa.destaques 
        };
        
        renderCaixaAtiva(container, caixa, docRef, estudo);
    } else {
        sincronizarCamposAtivos(container, caixa);
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

function sincronizarCamposAtivos(container, caixa) {
    const inputTit = container.querySelector('#tit-especial');
    const inputTxt = container.querySelector('#txt-especial');

    if (inputTit && inputTit.value !== (caixa.titulo || "")) {
        inputTit.value = caixa.titulo || "";
    }

    if (inputTxt && inputTxt.value !== (caixa.conteudo || "")) {
        inputTxt.value = caixa.conteudo || "";
    }
}

/**
 * LOGICA DE EVENTOS (COM SINCRONIZAÇÃO TOTAL RAM/FIRESTORE)
 */
function vincularEventosUI(container, caixa, docRef, estudoMestre) {
    const inputTit = container.querySelector('#tit-especial');
    const inputTxt = container.querySelector('#txt-especial');
    let timer;

    // Função de auto-save interna
    const salvarAutomatico = () => {
        const dados = { 
            conteudo: inputTxt.value, 
            titulo: inputTit ? inputTit.value : (caixa.titulo || "") 
        };
        
        // Sincroniza RAM (Transmissor)
        transmitirParaEditorVivo(dados, estudoMestre);

        // Sincroniza Firebase (Persistência)
        clearTimeout(timer);
        timer = setTimeout(async () => {
            try {
                await salvarNaBiblioteca(docRef, dados);
                await replicarParaNotaSentinela(window.db, estudoMestre, dados);
            } catch (e) { console.error("Erro no auto-save:", e); }
        }, 800);
    };

    inputTxt.oninput = salvarAutomatico;
    if (inputTit) inputTit.oninput = salvarAutomatico;

    // ========================================================
    // ATRIBUIÇÃO DOS CLIQUES (USANDO AS FUNÇÕES IMPORTADAS)
    // ========================================================
    
    // COR DA CAIXA / MUTAÇÃO
    window.colorirAnotacaoEspecial = () => {
        // Chamamos a função que veio do biblio-actions.js
        executarMutacaoCores(caixa, docRef, estudoMestre);
    };

    // LIXEIRA
    window.apagarAnotacaoEspecial = () => {
        executarApagar(docRef, estudoMestre);
    };

    // PARTILHA
    window.partilharAnotacaoEspecial = async () => {
        const p = { 
            ...caixa, 
            titulo: inputTit ? inputTit.value : (caixa.titulo || ""), 
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
