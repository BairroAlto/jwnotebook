// components/settings/recycle-ui.js
import { doc, updateDoc, deleteDoc, addDoc, collection, getFirestore, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const db = getFirestore();

/**
 * PROMISE: Abre o popup customizado de confirmação para a Blackbox
 */
function perguntarConfirmacaoBlackbox() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-blackbox-overlay');
        const btnSim = document.getElementById('btn-confirmar-blackbox');
        const btnNao = document.getElementById('btn-cancelar-blackbox');

        if (!overlay) return resolve(confirm("Mover para a Blackbox permanentemente?"));

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
 * RENDERIZAÇÃO DOS CARDS NA ABA
 */
export function renderizarItensReciclagem(lista) {
    const container = document.getElementById('lista-reciclagem-expirada');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; font-size:12px; opacity:0.5;">Lixeira vazia.</p>`;
        return;
    }

    container.innerHTML = lista.map(item => {
        const nome = item.tipoItem === 'nota' ? item.dados.nome : `${item.dados.tipo.toUpperCase()} (em ${item.nomeNota})`;
        
        const labelStatus = item.expirado ? 
            `<span style="font-size: 8px; color: #ef4444; font-weight: 800; border: 1px solid #ef4444; padding: 1px 4px; border-radius: 3px;">EXPIRADO</span>` : 
            `<span style="font-size: 8px; color: #94a3b8; font-weight: 600; border: 1px solid #334155; padding: 1px 4px; border-radius: 3px;">RECENTE</span>`;

        const bordaColor = item.expirado ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)';

        return `
            <div class="menu-item-list" style="flex-direction: column; align-items: flex-start; gap: 12px; background: rgba(255,255,255,0.02); padding: 15px; border: 1px solid ${bordaColor}; border-radius: 10px; margin-bottom: 8px;">
                <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                        <i class="fa-solid ${item.tipoItem === 'nota' ? 'fa-file-lines' : 'fa-box'}" style="color: #94a3b8; font-size: 14px;"></i>
                        <span style="font-size: 13px; font-weight: 700; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nome}</span>
                    </div>
                    ${labelStatus}
                </div>
                
                <div style="display: flex; gap: 6px; width: 100%;">
                    <button onclick="window.acaoReciclar('${item.id}', '${item.idCaixa || ''}', 'manter')" 
                            style="flex:1; padding: 10px; font-size: 10px; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; font-weight: 700;">MANTER</button>
                    
                    <button onclick="window.acaoReciclar('${item.id}', '${item.idCaixa || ''}', 'recuperar')" 
                            style="flex:1; padding: 10px; font-size: 10px; background: #22c55e; color: black; font-weight: 800; border: none; border-radius: 6px; cursor: pointer;">RECUPERAR</button>
                    
                    <button onclick="window.acaoReciclar('${item.id}', '${item.idCaixa || ''}', 'apagar')" 
                            style="flex:1; padding: 10px; font-size: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 700;">APAGAR</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * MOTOR DE ACÇÃO GLOBAL
 */
window.acaoReciclar = async (docId, caixaId, acao) => {
    const docRef = doc(db, "Local", docId);
    
    try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const data = snap.data();

        // 1. MANTER (Adiar 3 meses)
        if (acao === 'manter') {
            if (!caixaId) { 
                await updateDoc(docRef, { timedelete: new Date().toISOString() });
            } else { 
                const novasCaixas = data.caixas.map(c => c.id === caixaId ? { ...c, timedelete: new Date().toISOString() } : c);
                await updateDoc(docRef, { caixas: novasCaixas });
            }
        } 
        // 2. RECUPERAR (Voltar a Ativo)
        else if (acao === 'recuperar') {
            if (!caixaId) {
                await updateDoc(docRef, { estado: "ativa", timedelete: null });
            } else {
                const novasCaixas = data.caixas.map(c => c.id === caixaId ? { ...c, estado: "ativa", timedelete: null } : c);
                await updateDoc(docRef, { caixas: novasCaixas });
            }
        } 
        // 3. APAGAR (Mover para Blackbox e Deletar)
        else if (acao === 'apagar') {
            const confirmou = await perguntarConfirmacaoBlackbox();
            if (!confirmou) return;

            let itemFinal = caixaId ? data.caixas.find(c => c.id === caixaId) : data;
            
            await addDoc(collection(db, "blackbox"), {
                dadosOriginais: itemFinal,
                dataMorte: new Date().toISOString(),
                motivo: "Reciclagem Manual",
                userId: data.userId
            });

            if (!caixaId) {
                await deleteDoc(docRef);
            } else {
                const novasCaixas = data.caixas.filter(c => c.id !== caixaId);
                await updateDoc(docRef, { caixas: novasCaixas });
            }
        }

        // Refresh para atualizar a lista
        const userId = data.userId;
        import('./recycle-manager.js').then(m => m.carregarTodaReciclagem(db, userId));

    } catch (e) {
        console.error("Erro na reciclagem:", e);
    }
};