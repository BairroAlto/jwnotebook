// components/editor/modulos/paleta-cores.js
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const CORES_BASE = [
    { code: "#B12823", name: "Vermelho" }, { code: "#AC4A0B", name: "Laranja" },
    { code: "#D8B200", name: "Amarelo" }, { code: "#436C21", name: "Verde" },
    { code: "#006042", name: "Esmeralda" }, { code: "#1F7AC4", name: "Azul" },
    { code: "#B53E69", name: "Rosa" }, { code: "#8438D7", name: "Roxo" }, 
    { code: "#A08F8E", name: "Cinza" }  
];

export const FOCOS_BASE = {
    "original": { nome: "Original", corForte: "#ea580c" },
    "reflexao": { nome: "Reflexão", corForte: "#9a3412" },
    "comentario": { nome: "Comentário", corForte: "#D69834" },
    "desafio": { nome: "Desafio", corForte: "#ca8a04" },
    "exemplo": { nome: "Exemplo", corForte: "#854d0e" },
    "transcricao": { nome: "Transcrição", corForte: "#f97316" },
    "rascunho": { nome: "Rascunho", corForte: "#573516" },
    "camaleao": { nome: "Camaleão", corForte: "var(--bg-body)" }
};

export const FOCOS_SUBNOTA = {
    "original": { nome: "Original", corForte: "#2563eb" },
    "resumo": { nome: "Resumo", corForte: "#1a3a5f" },
    "estudo": { nome: "Estudo", corForte: "#4169E1" },
    "perola": { nome: "Pérola", corForte: "#0032FD" },
    "ponto_chave": { nome: "Chave", corForte: "#85C1E9" },
    "palestra": { nome: "Palestra", corForte: "#5c6bc0" }
};

export const FOCOS_QUESTAO = {
    "original": { nome: "Original", corForte: "#10b981" },
    "revisao": { nome: "Revisão", corForte: "#2B6467" },
    "dilema": { nome: "Dilema", corForte: "#052c1e" },
    "hipotese": { nome: "Hipótese", corForte: "#27ae60" },
    "paradoxo": { nome: "Paradoxo", corForte: "#82e0aa" }
};

export const FOCOS_RACIOCINIO = {
    "original": { nome: "Original", corForte: "#f59e0b" },
    "socratico": { nome: "Socrático", corForte: "#b45309" }
};

let nomesCoresCustom = {};
let caixaParaColorir = null;
let corSendoEditada = null;
let dbReferencia = null;
let uidLogado = null;
let callbackAtualizarEditor = null;

export async function iniciarSistemaCores(db, user, callbackUpdate) {
    if (!user) return;
    dbReferencia = db; uidLogado = user.uid; callbackAtualizarEditor = callbackUpdate;
    
    try {
        const snap = await getDoc(doc(db, "users", uidLogado));
        if (snap.exists() && snap.data().caixadestaques) nomesCoresCustom = snap.data().caixadestaques;
    } catch (e) {}

    // Configuração das abas
    vincularCliquesAbas();
}

function vincularCliquesAbas() {
    const tabs = document.querySelectorAll('.tab-cor');
    tabs.forEach(tab => {
        tab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation(); // Agora o stopPropagation aqui é bom para as abas
            
            const targetId = tab.getAttribute('data-target');
            console.log("📂 [TABS] Trocando para aba:", targetId);

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.cor-tab-content').forEach(c => c.style.display = 'none');
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.style.display = 'block';
        };
    });
}

export function abrirPaleta(caixaAlvo) {
    caixaParaColorir = caixaAlvo;

    // 1. GARANTIR INSTÂNCIAS (Fallback se o sistema não iniciou corretamente)
    if (!dbReferencia && window.db) { 
        dbReferencia = window.db; 
        uidLogado = window.auth.currentUser.uid; 
    }

    // 2. ELEMENTOS DA UI
    const overlay = document.getElementById('popup-cores-overlay');
    const btnRemover = document.getElementById('btn-remover-cor');
    const btnFechar = document.getElementById('btn-fechar-cores');
    const listaDest = document.getElementById('lista-cores-destaque');
    const listaFoco = document.getElementById('lista-cores-foco');

    if (!overlay) return console.error("Popup de cores não encontrado no DOM.");

    // 3. CONFIGURAR ABAS (Reset visual)
    vincularCliquesAbas();
    document.querySelector('.tab-cor[data-target="tab-destaques"]').click();

    // 4. BOTÃO REMOVER COR (Borracha)
    if (btnRemover) {
        btnRemover.onclick = () => {
            caixaParaColorir.destaques = "";
            if (typeof callbackAtualizarEditor === 'function') callbackAtualizarEditor();
            
            // Feedback mobile: Fecha ao limpar se estivermos no Brain
            if (document.querySelector('.cosmos-brain-wrapper')) {
                overlay.classList.remove('active');
            }
        };
    }

    // 5. BOTÃO FECHAR (X)
    if (btnFechar) {
        btnFechar.onclick = () => overlay.classList.remove('active');
    }

    // 6. RENDERIZAR LISTA DE DESTAQUES (CORES DE FUNDO)
    if (listaDest) {
        listaDest.innerHTML = "";
        CORES_BASE.forEach(corObj => {
            const nomeReal = nomesCoresCustom[corObj.code] || corObj.name;
            const isSel = (caixaParaColorir.destaques === corObj.code);
            
            const div = document.createElement("div");
            div.className = "card-cor-item";
            div.style.cssText = `
                display:flex; flex-direction:column; 
                background:${isSel ? 'rgba(255,255,255,0.08)' : 'var(--bg-panel)'}; 
                border:2px solid ${isSel ? corObj.code : 'transparent'}; 
                border-radius:6px; overflow:hidden; cursor:pointer; transition: 0.2s;
            `;

            div.innerHTML = `
                <div style="height:8px; width:100%; background-color:${corObj.code};"></div>
                <div class="click-area" style="display:flex; align-items:center; justify-content:space-between; padding:12px 10px;">
                    <div style="display:flex; align-items:center; gap:10px; pointer-events:none;">
                        <div style="width:18px; height:18px; border-radius:50%; background:${corObj.code}; display:flex; align-items:center; justify-content:center;">
                            ${isSel ? '<i class="fa-solid fa-check" style="color:white; font-size:9px;"></i>' : ''}
                        </div>
                        <span style="font-size:12px; font-weight:600; color:${isSel ? 'white' : 'var(--text-muted)'};">${nomeReal}</span>
                    </div>
                    <i class="fa-solid fa-pen btn-edit-cor" style="font-size:10px; opacity:0.4; padding:5px;"></i>
                </div>`;

            // Clique na Cor
            div.querySelector('.click-area').onclick = () => {
                caixaParaColorir.destaques = isSel ? "" : corObj.code; 
                if (typeof callbackAtualizarEditor === 'function') callbackAtualizarEditor();
                
                // No mobile (dentro do Brain), fecha para dar feedback de sucesso
                if (window.innerWidth <= 768) {
                    overlay.classList.remove('active');
                }
            };

            // Clique no Lápis (Editar Nome)
            div.querySelector('.btn-edit-cor').onclick = (e) => {
                e.stopPropagation(); // Previne colorir ao clicar no lápis
                corSendoEditada = corObj.code;
                document.getElementById('amostra-cor-edicao').style.backgroundColor = corObj.code;
                document.getElementById('input-nome-cor').value = nomeReal;
                overlay.classList.remove('active');
                document.getElementById('popup-editar-cor-overlay').classList.add('active');
            };
            
            listaDest.appendChild(div);
        });
    }

    // 7. RENDERIZAR LISTA DE FOCOS (SEMÂNTICA)
    if (listaFoco) {
        listaFoco.innerHTML = "";
        
        // Determinar qual mapa de focos usar baseado no tipo da caixa
        const mapaUsar = (caixaParaColorir.tipo === 'subnota') ? FOCOS_SUBNOTA : 
                         (caixaParaColorir.tipo === 'questao') ? FOCOS_QUESTAO : 
                         (caixaParaColorir.tipo === 'raciocinio') ? FOCOS_RACIOCINIO : FOCOS_BASE;

        Object.entries(mapaUsar).forEach(([key, obj]) => {
            const isSelF = (caixaParaColorir.foco === key || (!caixaParaColorir.foco && key === "original"));
            
            const row = document.createElement("div");
            row.style.cssText = `
                display:flex; align-items:center; gap:12px; padding:12px; 
                background:${isSelF ? 'rgba(255,255,255,0.05)' : 'var(--bg-panel)'}; 
                border:2px solid ${isSelF ? obj.corForte : 'var(--border-color)'}; 
                border-radius:8px; cursor:pointer; margin-bottom:8px; transition: 0.2s;
            `;
            
            row.innerHTML = `
                <div style="width:20px; height:20px; border-radius:4px; background:${obj.corForte}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${isSelF ? '<i class="fa-solid fa-check" style="color:white; font-size:10px;"></i>' : ''}
                </div>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:13px; font-weight:700; color:white;">${obj.nome}</span>
                    <span style="font-size:10px; color:var(--text-muted); opacity:0.7;">Foco em ${obj.nome.toLowerCase()}</span>
                </div>`;
            
            row.onclick = () => {
                caixaParaColorir.foco = key;
                if (typeof callbackAtualizarEditor === 'function') callbackAtualizarEditor();
                
                // No mobile, fecha para o utilizador ver a mudança na nota
                if (window.innerWidth <= 768) {
                    overlay.classList.remove('active');
                } else {
                    abrirPaleta(caixaParaColorir); // Refresh no PC para mostrar o check
                }
            };
            listaFoco.appendChild(row);
        });
    }

    // 8. EXIBIR O OVERLAY
    overlay.classList.add('active');
}
