// components/editor/modulos/paleta-cores.js
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { MutationManager } from './mutation-manager.js'; // 🚀 NOVO MÓDULO

const CORES_BASE = [
    { code: "#B12823", name: "Vermelho" }, { code: "#AC4A0B", name: "Laranja" },
    { code: "#D8B200", name: "Amarelo" }, { code: "#436C21", name: "Verde" },
    { code: "#006042", name: "Esmeralda" }, { code: "#1F7AC4", name: "Azul" },
    { code: "#B53E69", name: "Rosa" }, { code: "#8438D7", name: "Roxo" }, 
    { code: "#A08F8E", name: "Cinza" }  
];

export const FOCOS_BASE = {
    "original": { nome: "Original", corForte: "#ea580c" },
    "comentario": { nome: "Comentário", corForte: "#F86B44" }, 
    "transcricao": { nome: "Transcrição", corForte: "#f97316" },
    "reflexao": { nome: "Reflexão", corForte: "#C23515" },
    "desafio": { nome: "Desafio", corForte: "#9a3412" },
    "rascunho": { nome: "Rascunho", corForte: "#573516" },
    "exemplo": { nome: "Exemplo", corForte: "#854d0e" },
    "camaleao": { nome: "Camaleão", corForte: "var(--bg-body)" }
};

export const FOCOS_SUBNOTA = {
    "original": { nome: "Original", corForte: "#2563eb" },
    "perola": { nome: "Pérola", corForte: "#0032FD" },
    "estudo": { nome: "Estudo", corForte: "#4169E1" },
    "resumo": { nome: "Resumo", corForte: "#1a3a5f" },
    "palestra": { nome: "Palestra", corForte: "#5c6bc0" },
    "ponto_chave": { nome: "Chave", corForte: "#85C1E9" }
};

export const FOCOS_QUESTAO = {
    "original": { nome: "Original", corForte: "#10b981" },
    "paradoxo": { nome: "Paradoxo", corForte: "#82e0aa" },
    "dilema": { nome: "Dilema", corForte: "#D1E491" },
    "hipotese": { nome: "Hipótese", corForte: "#607455" },
    "revisao": { nome: "Revisão", corForte: "#2B4B44" }
};

export const FOCOS_RACIOCINIO = {
    "original": { nome: "Original", corForte: "#f59e0b" },
    "socratico": { nome: "Socrático", corForte: "#FFD155" }
};

let nomesCoresCustom = {};
let caixaParaColorir = null;
let corSendoEditada = null;
let dbReferencia = null;
let uidLogado = null;
let callbackAtualizarEditor = null;

/**
 * INICIALIZAÇÃO
 */
export async function iniciarSistemaCores(db, user, callbackUpdate) {
    if (!user) return;
    dbReferencia = db; uidLogado = user.uid; callbackAtualizarEditor = callbackUpdate;
    
    try {
        const snap = await getDoc(doc(db, "users", uidLogado));
        if (snap.exists() && snap.data().caixadestaques) {
            nomesCoresCustom = snap.data().caixadestaques;
        }
    } catch (e) {}

    vincularCliquesAbas();
}

/**
 * GESTÃO DE NAVEGAÇÃO ENTRE ABAS
 */
function vincularCliquesAbas() {
    const tabs = document.querySelectorAll('.tab-cor');
    tabs.forEach(tab => {
        tab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = tab.getAttribute('data-target');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.cor-tab-content').forEach(c => c.style.display = 'none');
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.style.display = 'block';
        };
    });
}

/**
 * ABRIR POPUP DE CORES E MUTAÇÃO
 */
export function abrirPaleta(caixaAlvo, abaAlvo = "tab-destaques") {
    caixaParaColorir = caixaAlvo;

    const overlay = document.getElementById('popup-cores-overlay');
    const btnRemover = document.getElementById('btn-remover-cor');
    const btnFechar = document.getElementById('btn-fechar-cores');
    const listaDest = document.getElementById('lista-cores-destaque');
    const listaFoco = document.getElementById('lista-cores-foco');

    if (!overlay) return;

    // --- 🧬 LÓGICA DE MUTAÇÃO ---
    const btnMutacao = document.querySelector('.tab-cor[data-target="tab-mutacao"]');
    const areaMutacao = document.getElementById('tab-mutacao');
    
    if (MutationManager.podeMutar(caixaAlvo.tipo)) {
        btnMutacao.style.display = "inline-flex";
        MutationManager.render(caixaAlvo, areaMutacao, callbackAtualizarEditor);
    } else {
        btnMutacao.style.display = "none";
        // Se a aba mutação estava ativa e mudámos para um bloco não mutável, voltamos para destaques
        if (abaAlvo === "tab-mutacao") abaAlvo = "tab-destaques";
    }

    // --- 🎨 RENDERIZAÇÃO DE DESTAQUES (CORES) ---
    if (listaDest) {
        listaDest.innerHTML = "";
        CORES_BASE.forEach(corObj => {
            const nomeReal = nomesCoresCustom[corObj.code] || corObj.name;
            const isSel = (caixaParaColorir.destaques === corObj.code);
            
            const div = document.createElement("div");
            div.className = "card-cor-item";
            div.style.cssText = `display:flex; flex-direction:column; background:${isSel ? 'rgba(255,255,255,0.08)' : 'var(--bg-panel)'}; border:2px solid ${isSel ? corObj.code : 'transparent'}; border-radius:6px; overflow:hidden; cursor:pointer; transition:0.2s;`;

            div.innerHTML = `
                <div style="height:8px; width:100%; background-color:${corObj.code};"></div>
                <div class="click-area" style="display:flex; align-items:center; justify-content:space-between; padding:12px 10px; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px; pointer-events:none; flex:1; overflow:hidden;">
                        <div style="width:18px; height:18px; border-radius:50%; background:${corObj.code}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            ${isSel ? '<i class="fa-solid fa-check" style="color:white; font-size:9px;"></i>' : ''}
                        </div>
                        <span style="font-size:12px; font-weight:600; color:${isSel ? 'white' : 'var(--text-muted)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nomeReal}</span>
                    </div>
                    <i class="fa-solid fa-pen btn-edit-cor" style="font-size:11px; color:var(--primary); opacity:0.5; padding:5px;"></i>
                </div>`;

            div.querySelector('.click-area').onclick = (e) => {
                if (e.target.classList.contains('btn-edit-cor')) return;
                caixaParaColorir.destaques = isSel ? "" : corObj.code; 
                if (callbackAtualizarEditor) callbackAtualizarEditor();
                if (window.innerWidth <= 768) overlay.classList.remove('active');
                else abrirPaleta(caixaParaColorir, "tab-destaques");
            };

            div.querySelector('.btn-edit-cor').onclick = (e) => {
                e.stopPropagation();
                corSendoEditada = corObj.code;
                const editOverlay = document.getElementById('popup-editar-cor-overlay');
                const inputNome = document.getElementById('input-nome-cor');
                const btnGuardar = document.getElementById('btn-guardar-nome-cor');
                const btnCancelar = document.getElementById('btn-cancelar-nome-cor');

                document.getElementById('amostra-cor-edicao').style.backgroundColor = corObj.code;
                inputNome.value = nomeReal;
                overlay.classList.remove('active');
                editOverlay.classList.add('active');

                btnGuardar.onclick = async () => {
                    const n = inputNome.value.trim();
                    if (!n) return;
                    nomesCoresCustom[corSendoEditada] = n;
                    await setDoc(doc(dbReferencia, "users", uidLogado), { caixadestaques: nomesCoresCustom }, { merge: true });
                    editOverlay.classList.remove('active');
                    abrirPaleta(caixaParaColorir, "tab-destaques");
                };

                btnCancelar.onclick = () => { editOverlay.classList.remove('active'); overlay.classList.add('active'); };
                setTimeout(() => inputNome.focus(), 150);
            };
            listaDest.appendChild(div);
        });
    }

    // --- 🎭 RENDERIZAÇÃO DE FOCOS ---
    if (listaFoco) {
        listaFoco.innerHTML = "";
        const mapa = (caixaParaColorir.tipo === 'subnota') ? FOCOS_SUBNOTA : 
                     (caixaParaColorir.tipo === 'questao') ? FOCOS_QUESTAO : 
                     (caixaParaColorir.tipo === 'raciocinio') ? FOCOS_RACIOCINIO : FOCOS_BASE;

        Object.entries(mapa).forEach(([key, obj]) => {
            const isSelF = (caixaParaColorir.foco === key || (!caixaParaColorir.foco && key === "original"));
            const row = document.createElement("div");
            row.style.cssText = `display:flex; align-items:center; gap:12px; padding:12px; background:${isSelF ? 'rgba(255,255,255,0.05)' : 'var(--bg-panel)'}; border:2px solid ${isSelF ? obj.corForte : 'var(--border-color)'}; border-radius:8px; cursor:pointer; margin-bottom:8px; transition: 0.2s;`;
            
            row.innerHTML = `
                <div style="width:20px; height:20px; border-radius:4px; background:${obj.corForte}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${isSelF ? '<i class="fa-solid fa-check" style="color:white; font-size:10px;"></i>' : ''}
                </div>
                <span style="font-size:13px; font-weight:700; color:white;">${obj.nome}</span>`;
            
            row.onclick = () => {
                caixaParaColorir.foco = key;
                if (callbackAtualizarEditor) callbackAtualizarEditor();
                if (window.innerWidth <= 768) overlay.classList.remove('active');
                else abrirPaleta(caixaParaColorir, "tab-focos");
            };
            listaFoco.appendChild(row);
        });
    }

    // Configurar Botões de Fecho e Remover Cor
    if (btnRemover) {
        btnRemover.onclick = () => {
            caixaParaColorir.destaques = "";
            if (callbackAtualizarEditor) callbackAtualizarEditor();
            overlay.classList.remove('active');
        };
    }
    if (btnFechar) btnFechar.onclick = () => overlay.classList.remove('active');

    // Mostrar Overlay e selecionar aba inicial
    overlay.classList.add('active');
    const selectorAba = document.querySelector(`.tab-cor[data-target="${abaAlvo}"]`);
    if (selectorAba) selectorAba.click();
}
