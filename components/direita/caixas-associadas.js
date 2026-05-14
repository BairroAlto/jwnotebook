import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

export async function carregarCaixasAssociadas(caixasAtuais, db, userId) {
    const container = document.getElementById('caixas-associadas-container');
    if (!container) return;

    const ferramentasComVinculos = caixasAtuais.filter(c => 
        c.estado === 'ativa' && 
        c.associados && 
        c.associados.length > 0 &&
        c.associados.some(a => a.tipo !== 'nota')
    );

    if (ferramentasComVinculos.length === 0) {
        container.innerHTML = "";
        const btn = document.getElementById('btn-tab-caixas');
        if(btn) btn.style.display = 'none';
        return;
    }

    const btnTab = document.getElementById('btn-tab-caixas');
    if(btnTab) btnTab.style.display = 'flex';

    container.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    try {
        const todosIds = new Set();
        ferramentasComVinculos.forEach(f => {
            f.associados.forEach(a => { if(a.tipo !== 'nota') todosIds.add(a.id); });
        });

        const q = query(collection(db, "Local"), where("userId", "==", userId));
        const snap = await getDocs(q);
        const dataMap = {};

        snap.forEach(docSnap => {
            const nota = docSnap.data();
            if (nota.caixas) {
                nota.caixas.forEach(c => {
                    if (todosIds.has(c.id)) {
                        dataMap[c.id] = { ...c, notaOrigem: nota.nome, notaDocId: docSnap.id, notaDados: nota };
                    }
                });
            }
        });

        container.innerHTML = `<div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:10px; font-weight:800; color:var(--primary);">CAIXAS ASSOCIADAS</div>`;

        ferramentasComVinculos.forEach(grupo => {
            const idsG = grupo.associados.filter(a => a.tipo !== 'nota').map(a => a.id);
            idsG.forEach(id => {
                const b = dataMap[id];
                if (!b) return;
                const config = IDENTIDADE_FERRAMENTAS[b.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
                const card = document.createElement('div');
                card.className = "indice-card";
                card.style.borderLeft = `4px solid ${config.cor}`;
                card.style.padding = "15px";
                card.style.marginBottom = "10px";
                card.innerHTML = `
                    <div style="font-size:9px; color:${config.cor}; font-weight:800; margin-bottom:5px;">${config.nome}</div>
                    <div style="font-size:13px; color:white; font-weight:700;">${b.titulo || ""}</div>
                    <div style="font-size:12px; color:#cbd5e1; margin-top:5px; white-space:pre-wrap;">${b.conteudo || ""}</div>
                    <div style="font-size:8px; opacity:0.4; margin-top:10px;">Em: ${b.notaOrigem}</div>
                `;
                card.onclick = () => {
                    import('../editor/editor.js').then(m => {
                        m.abrirNotaNoEditor(b.notaDocId, b.notaDados, db, {currentUser: {uid: userId}}, b.id);
                    });
                };
                container.appendChild(card);
            });
        });

    } catch (e) {
        console.error("Erro ao carregar associados:", e);
        container.innerHTML = "Erro de carregamento.";
    }
}