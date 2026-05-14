// components/local/local-order-manager.js
import { getFirestore, collection, getDocs, query, where, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let listaLocalMemoria = [];
let idAlvoParaBrilhar = null; 

export async function abrirPopupOrdenacao(idPastaPai, idAtivo) {
    console.log("🛠️ [ORDEM] Iniciando Ordem. Alvo:", idAtivo);
    idAlvoParaBrilhar = idAtivo.trim(); // Limpa espaços
    
    const overlay = document.getElementById('popup-ordenar-itens-overlay');
    const container = document.getElementById('lista-reordenar-container');
    
    if (!overlay || !container) return;

    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    try {
        const db = getFirestore();
        const uid = getAuth().currentUser.uid;
        
        const q = query(
            collection(db, "Local"), 
            where("userId", "==", uid),
            where("pastapai", "==", idPastaPai),
            where("estado", "==", "ativa"),
            orderBy("ordem", "asc")
        );

        const snap = await getDocs(q);
        listaLocalMemoria = [];
        
        snap.forEach(d => {
            // Usamos '_realId' para garantir que os dados internos não apaguem o ID do documento
            listaLocalMemoria.push({ _realId: d.id, ...d.data() });
        });

        console.log(`📊 [ORDEM] Itens carregados: ${listaLocalMemoria.length}`);
        renderizarLista();

    } catch (e) {
        console.error("❌ [ORDEM] Erro fatal:", e);
    }
}

function renderizarLista() {
    const container = document.getElementById('lista-reordenar-container');
    if (!container) return;
    container.innerHTML = "";

    listaLocalMemoria.forEach((item, index) => {
        // --- COMPARAÇÃO ULTRA-ROBUSTA ---
        const itemID = String(item._realId).trim();
        const alvoID = String(idAlvoParaBrilhar).trim();
        const estaAtivo = (itemID === alvoID);
        
        if (estaAtivo) console.log("✅ [MATCH] Destaque aplicado a:", item.nome);

        const div = document.createElement('div');
        
        // Estilo visual idêntico ao que funcionou na pasta
        div.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px 15px; 
            border-radius: 10px; 
            margin-bottom: 6px;
            transition: 0.2s;
            background: ${estaAtivo ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)'};
            border: 1px solid ${estaAtivo ? '#6366f1' : 'rgba(255,255,255,0.08)'};
            box-shadow: ${estaAtivo ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'};
        `;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1; overflow:hidden;">
                ${estaAtivo ? '<i class="fa-solid fa-star" style="color:#6366f1; font-size:10px;"></i>' : ''}
                <span style="font-size:13px; color:${estaAtivo ? 'white' : '#94a3b8'}; font-weight:${estaAtivo ? '700' : '400'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${item.nome}
                </span>
            </div>
            <div style="display:flex; gap:15px; color:#6366f1; font-size:14px;">
                <i class="fa-solid fa-circle-chevron-up" onclick="window.moverOrdemLocal(${index}, -1)" style="cursor:pointer; opacity: 0.7;"></i>
                <i class="fa-solid fa-circle-chevron-down" onclick="window.moverOrdemLocal(${index}, 1)" style="cursor:pointer; opacity: 0.7;"></i>
            </div>
        `;
        container.appendChild(div);
    });
}

window.moverOrdemLocal = async (index, direcao) => {
    const targetIdx = index + direcao;
    if (targetIdx < 0 || targetIdx >= listaLocalMemoria.length) return;

    const temp = listaLocalMemoria[index];
    listaLocalMemoria[index] = listaLocalMemoria[targetIdx];
    listaLocalMemoria[targetIdx] = temp;

    listaLocalMemoria.forEach((item, i) => item.ordem = i + 1);
    renderizarLista();

    const db = getFirestore();
    try {
        for (const item of listaLocalMemoria) {
            // Usamos o '_realId' que guardámos no fetch
            await updateDoc(doc(db, "Local", item._realId), { ordem: item.ordem });
        }
    } catch (err) { console.error(err); }
};