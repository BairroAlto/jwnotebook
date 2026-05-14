// components/biblioteca-brain/biblio-tabs.js
import { doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { buscarRespostasDaRede } from './biblio-social.js';

let statusLocal = { tipoAtivo: null, corAtiva: null, idAtivo: null, focoAtivo: null };

/**
 * MOTOR PRINCIPAL: Gere o ciclo de vida da anotação
 */
export function renderAnotacoes(estudo, container, db) {
    const docRef = doc(db, "Biblioteca", estudo.id);
    
    // Reset de estado ao trocar de aba para forçar redesenho inicial
    statusLocal = { tipoAtivo: null, corAtiva: null, idAtivo: null, focoAtivo: null };

    if (window._unsubAnotacao) window._unsubAnotacao();

    window._unsubAnotacao = onSnapshot(docRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const caixa = data.anotacaoEspecial;

        if (!caixa || caixa.estado === "desativo") {
            renderSeletor(container, docRef);
            return;
        }

        // RENDERIZAÇÃO INTELIGENTE: Só reconstrói o HTML se a estrutura mudar (evita saltos no scroll)
        if (statusLocal.tipoAtivo !== caixa.tipo || 
            statusLocal.corAtiva !== caixa.destaques || 
            statusLocal.focoAtivo !== caixa.foco || 
            statusLocal.idAtivo !== caixa.id) {
            
            statusLocal = { 
                tipoAtivo: caixa.tipo, 
                corAtiva: caixa.destaques, 
                focoAtivo: caixa.foco, 
                idAtivo: caixa.id 
            };
            renderCaixaAtiva(container, caixa, docRef, estudo.id);
        }
    });
}

/**
 * VISTA 1: Seletor Inicial (3 Botões)
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
            id: crypto.randomUUID(), tipo, conteudo: "", titulo: "", estado: "ativo",
            foco: tipo === "contentor" ? "comentario" : "original",
            destaques: "", timestamp: new Date().toISOString()
        };
        await updateDoc(docRef, { anotacaoEspecial: nova });
    };
}

/**
 * VISTA 2: Caixa Ativa (Área de Escrita)
 */
function renderCaixaAtiva(container, caixa, docRef, studyId) {
    const config = IDENTIDADE_FERRAMENTAS[caixa.tipo];
    const fKey = caixa.foco || "original";

    // 1. Título Dinâmico do Cabeçalho (CAPSLOCK)
    let textoCabecalho = (fKey === "original") ? config.nome : 
        (({ subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO, contentor: FOCOS_BASE }[caixa.tipo] || FOCOS_BASE)[fKey]?.nome || fKey);
    
    // 2. Cor da Barra (respeita o foco)
    const corBarra = ({ subnota: FOCOS_SUBNOTA, questao: FOCOS_QUESTAO, raciocinio: FOCOS_RACIOCINIO, contentor: FOCOS_BASE }[caixa.tipo] || FOCOS_BASE)[fKey]?.corForte || config.cor;

    const corDestaque = caixa.destaques || "transparent";
    const corTexto = caixa.destaques ? "#000" : "white";

    // 3. Exibir título apenas se não for contentor
    const htmlTitulo = caixa.tipo !== 'contentor' ? `
        <input type="text" id="tit-especial" value="${caixa.titulo || ''}" placeholder="Título..." 
               style="width:100%; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.05); color:${corTexto}; font-weight:700; margin-bottom:12px; outline:none; font-size:16px;">
    ` : '';

    container.innerHTML = `
        <div class="brain-box-item" style="border: 1px solid ${corBarra}4D; background: rgba(255,255,255,0.02); border-radius: 12px; overflow: hidden; margin-bottom: 50px;">
            <div style="display: flex; justify-content: space-between; padding: 12px 15px; background: ${corBarra}33; border-bottom: 1px solid ${corBarra}22;">
                <div style="font-size:9px; font-weight:900; color:${corBarra}; text-transform:uppercase; letter-spacing:1px;">${textoCabecalho}</div>
                <div style="display: flex; gap: 20px; color: rgba(255,255,255,0.4); font-size: 14px;">
                    <i class="fa-solid fa-paper-plane" onclick="window.partilharAnotacaoEspecial()" style="cursor:pointer;" title="Partilhar"></i>
                    <i class="fa-solid fa-palette" onclick="window.colorirAnotacaoEspecial()" style="cursor:pointer;" title="Destaque"></i>
                    <i class="fa-solid fa-trash-can" onclick="window.apagarAnotacaoEspecial()" style="color:#f87171; cursor:pointer;" title="Ocultar"></i>
                </div>
            </div>
            <div style="padding: 20px; background-color: ${corDestaque}; transition: background 0.3s; min-height: 450px;">
                ${htmlTitulo}
                <textarea id="txt-especial" style="width:100%; min-height:400px; background:transparent; border:none; color:${corTexto}; outline:none; resize:none; font-size:15px; line-height:1.7; font-family:inherit;" 
                          placeholder="Escreve aqui as tuas anotações de estudo...">${caixa.conteudo || ""}</textarea>
            </div>
        </div>
    `;

    vincularEventosUI(container, caixa, docRef, studyId);
}

/**
 * VINCULOS DE EVENTOS: Escrita, Cores, Partilha e Lixeira
 */
function vincularEventosUI(container, caixa, docRef, studyId) {
    const inputTit = container.querySelector('#tit-especial');
    const inputTxt = container.querySelector('#txt-especial');
    let timer;

    const salvar = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const updates = { "anotacaoEspecial.conteudo": inputTxt.value, "anotacaoEspecial.timestamp": new Date().toISOString() };
            if (inputTit) updates["anotacaoEspecial.titulo"] = inputTit.value;
            await updateDoc(docRef, updates);
        }, 800);
    };

    if (inputTit) inputTit.oninput = salvar;
    inputTxt.oninput = salvar;

    // --- LÓGICA DE APAGAR (POPUP) ---
    window.apagarAnotacaoEspecial = () => {
        const overlay = document.getElementById('popup-confirmar-overlay');
        const btnSim = document.getElementById('btn-confirmar-ocultar');
        const btnNao = document.getElementById('btn-cancelar-ocultar');
        overlay.querySelector('h3').innerText = "Mover para Reciclagem?";
        overlay.classList.add('active');
        btnSim.onclick = async () => {
            await updateDoc(docRef, { "anotacaoEspecial.estado": "desativo", "anotacaoEspecial.timedelete": new Date().toISOString() });
            overlay.classList.remove('active');
        };
        btnNao.onclick = () => overlay.classList.remove('active');
    };

    // --- LÓGICA DE CORES (LIVE) ---
window.colorirAnotacaoEspecial = () => {
    // 1. Abre a paleta global passando a referência da caixa atual
    if (typeof window.abrirPaletaGlobal === 'function') {
        window.abrirPaletaGlobal(caixa);
        
        const overlay = document.getElementById('popup-cores-overlay');
        if (!overlay) return;

        // 2. LÓGICA DE ESCUTA PARA MOBILE/BRAIN
        // Como a paleta é um popup partilhado, adicionamos um ouvinte temporário
        // para detetar quando o utilizador faz uma escolha.
        overlay.onclick = (e) => {
            // Ignorar cliques que sejam apenas nas abas (Destaques/Focos)
            if (e.target.closest('.tab-cor')) return;

            // Detetar se clicou num item de cor, no botão remover ou num item de foco
            const clicouCor = e.target.closest('.click-area');
            const clicouRemover = e.target.closest('#btn-remover-cor');
            const clicouFoco = e.target.closest('#lista-cores-foco > div');

            if (clicouCor || clicouRemover || clicouFoco) {
                console.log("📡 [BRAIN-COLOR] Escolha detetada. Sincronizando...");

                // Se clicou em remover, limpamos a cor na memória local antes de gravar
                if (clicouRemover) {
                    caixa.destaques = "";
                }

                // Pequeno delay para garantir que os dados da paleta-cores.js 
                // já atualizaram o objeto 'caixa'
                setTimeout(async () => {
                    try {
                        // 3. GRAVAÇÃO NO FIREBASE (Coleção Biblioteca)
                        // docRef é a referência ao estudo atual definida no início da função renderAnotacoes
                        await updateDoc(docRef, { 
                            "anotacaoEspecial.destaques": caixa.destaques || "",
                            "anotacaoEspecial.foco": caixa.foco || "original"
                        });

                        console.log("✅ [BRAIN-COLOR] Cor e Foco gravados na Biblioteca.");

                        // 4. FEEDBACK MOBILE: Fechar o popup
                        // Isto é vital no mobile para o utilizador ver a nota mudar
                        overlay.classList.remove('active');

                        // Se mudou o foco, resetamos o estado local para forçar 
                        // a atualização do título (CAPSLOCK) na renderização
                        if (clicouFoco) {
                            statusLocal.focoAtivo = null; 
                        }

                    } catch (err) {
                        console.error("❌ Erro ao gravar cor no Brain:", err);
                    }
                }, 100);
            }
        };
    } else {
        console.error("❌ Motor de cores (abrirPaletaGlobal) não encontrado.");
    }
};

    // --- LÓGICA DE PARTILHA (CONTEÚDO REAL) ---
    window.partilharAnotacaoEspecial = () => {
        const caixaParaPartilhar = { 
            ...caixa, 
            titulo: document.getElementById('tit-especial')?.value || "",
            conteudo: document.getElementById('txt-especial')?.value || "",
            onde: "biblioteca", idReferencia: studyId 
        };
        if (window.abrirPopupPartilharGlobal) window.abrirPopupPartilharGlobal(caixaParaPartilhar, studyId);
    };
}

export function renderComentarios(estudo, container, db) {
    buscarRespostasDaRede(estudo, container);
}
