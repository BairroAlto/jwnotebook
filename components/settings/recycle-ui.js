// components/settings/recycle-ui.js
import { getFirestore, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { RecycleViewer } from './recycle-viewer.js';

const db = getFirestore();

export function renderizarItensReciclagem(lista, isAutoOpen) {
    const container = document.getElementById('lista-reciclagem-expirada');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; opacity:0.5;">Lixeira vazia.</p>`;
        return;
    }

    const listaUrgente = lista.filter(i => i.expirado);
    const listaNormal = lista.filter(i => !i.expirado);

    let htmlFinal = "";

    if (listaUrgente.length > 0) {
        htmlFinal += `
            <div style="margin-bottom: 25px;">
                <p style="font-size: 10px; color: #ef4444; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Lixo Urgente (+90 dias)
                </p>
                ${listaUrgente.map(item => criarCardHTML(item)).join('')}
            </div>
            <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 20px 0;"></div>
        `;
    }

    if (listaNormal.length > 0) {
        htmlFinal += `
            <div>
                <p style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-recycle"></i> Lixeira Inteligente
                </p>
                ${listaNormal.map(item => criarCardHTML(item)).join('')}
            </div>
        `;
    }

    container.innerHTML = htmlFinal;
}

function criarCardHTML(item) {
    let nome = item.dados.nome || item.dados.titulo || "Sem Nome";
    let icone = "fa-file-lines";
    if (item.tipoItem === 'caixa') { icone = "fa-box"; nome += ` (em ${item.nomePai})`; }
    if (item.tipoItem === 'mica') { icone = "fa-folder-open"; nome += ` (Dossiê: ${item.nomePai})`; }
    if (item.tipoItem === 'cosmos-tema') icone = "fa-meteor";
    if (item.tipoItem === 'topico') icone = "fa-hashtag";

    // Codificação segura para evitar quebra de aspas no HTML
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(item))));
    const bordaColor = item.expirado ? "#ef4444" : "rgba(255,255,255,0.1)";

    return `
        <div class="menu-item-list" style="flex-direction: column; align-items: flex-start; gap: 10px; background: rgba(255,255,255,0.02); padding: 12px; border: 1px solid ${bordaColor}; border-radius: 10px; margin-bottom: 8px; position: relative;">
            
            <!-- 👁️ BOTÃO VER (Usando Classe em vez de Onclick) -->
            <i class="fa-solid fa-eye btn-ver-reciclagem" 
               data-payload="${payload}"
               style="position: absolute; top: 12px; right: 12px; cursor: pointer; color: var(--text-muted); opacity: 0.6;"
               title="Ver Conteúdo"></i>

            <div style="width:100%; display:flex; justify-content:space-between; align-items:center; padding-right: 25px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid ${icone}" style="color:var(--primary); font-size:12px;"></i>
                    <span style="font-size:13px; font-weight:700; color:white;">${nome}</span>
                </div>
                <span style="font-size:8px; font-weight:900; opacity:0.3;">${item.tipoItem.toUpperCase()}</span>
            </div>
            
            <div style="display:flex; gap:5px; width:100%;">
                <button onclick="window.execRecuperar('${item.id}', '${item.idSub || ''}', '${item.tipoItem}')" style="flex:1; background:#22c55e; color:black; border:none; padding:8px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer;">RECUPERAR</button>
                <button onclick="window.execEliminar('${item.id}', '${item.idSub || ''}', '${item.tipoItem}')" style="flex:1; background:rgba(239, 68, 68, 0.1); color:#f87171; border:1px solid #ef4444; padding:8px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer;">ELIMINAR</button>
            </div>
        </div>
    `;
}

// ==========================================================
// 🚀 O SEGREDO: GESTOR DE CLIQUES CENTRALIZADO
// ==========================================================
document.addEventListener('click', (e) => {
    const btnVer = e.target.closest('.btn-ver-reciclagem');
    if (btnVer) {
        e.stopPropagation();
        try {
            const base64 = btnVer.dataset.payload;
            const item = JSON.parse(decodeURIComponent(escape(atob(base64))));
            RecycleViewer.abrir(item);
        } catch (err) {
            console.error("Erro ao decodificar item da lixeira:", err);
        }
    }
});

/**
 * ACÇÕES DE RECUPERAÇÃO E ELIMINAÇÃO
 */
window.execRecuperar = async (docId, subId, tipo) => {
    const colecao = (tipo === 'cosmos-tema' || tipo === 'mica') ? "Cosmo" : (tipo === 'topico' ? "Topico" : "Local");
    const docRef = doc(db, colecao, docId);
    try {
        if (subId) {
            const snap = await getDoc(docRef);
            if (tipo === 'mica') {
                await updateDoc(docRef, { [`Dossie.mica.${subId}.estado`]: "ativo", [`Dossie.mica.${subId}.timedelete`]: null });
            } else {
                const novas = snap.data().caixas.map(c => c.id === subId ? {...c, estado:"ativa", timedelete: null} : c);
                await updateDoc(docRef, { caixas: novas });
            }
        } else {
            await updateDoc(docRef, { estado: (colecao === "Local" ? "ativa" : "ativo"), timedelete: null });
        }
        location.reload(); 
    } catch (e) { console.error(e); }
};

window.execEliminar = async (docId, subId, tipo) => {
    if (!confirm("Eliminar permanentemente?")) return;
    const colecao = (tipo === 'cosmos-tema' || tipo === 'mica') ? "Cosmo" : (tipo === 'topico' ? "Topico" : "Local");
    const docRef = doc(db, colecao, docId);
    try {
        if (subId) {
            const snap = await getDoc(docRef);
            if (tipo === 'mica') {
                const micas = { ...snap.data().Dossie.mica }; delete micas[subId];
                await updateDoc(docRef, { "Dossie.mica": micas });
            } else {
                const novas = snap.data().caixas.filter(c => c.id !== subId);
                await updateDoc(docRef, { caixas: novas });
            }
        } else { await deleteDoc(docRef); }
        location.reload();
    } catch (e) { console.error(e); }
};
