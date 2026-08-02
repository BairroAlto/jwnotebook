import { obterCaixasPorIds, obterNotasPorCaixas } from "../local/caixas-repository.js";
import { obterCaixasShareAcessiveisPorIds, obterNotasSharePorCaixas } from "../share/share-caixas-repository.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

export async function carregarCaixasAssociadas(caixasAtuais, db, userId) {
    const container = document.getElementById('caixas-associadas-container');
    if (!container) return;

    const ferramentasComVinculos = caixasAtuais.filter(c => 
        c.estado === 'on' && 
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

        const idsNormalizados = [...todosIds].map(String);
        const caixasLocaisMap = await obterCaixasPorIds(db, userId, idsNormalizados);
        const idsShare = idsNormalizados.filter(id => !caixasLocaisMap.has(id));
        const caixasShareMap = await obterCaixasShareAcessiveisPorIds(db, idsShare);
        const [notasLocais, notasShare] = await Promise.all([
            obterNotasPorCaixas(db, [...caixasLocaisMap.values()]),
            obterNotasSharePorCaixas(db, [...caixasShareMap.values()])
        ]);
        const dataMap = {};
        [...caixasLocaisMap.values(), ...caixasShareMap.values()].forEach(caixa => {
            const notaId = caixa.onde === "share" ? caixa.shareId : caixa.localDocId;
            const nota = (caixa.onde === "share" ? notasShare : notasLocais).get(notaId) || {};
            dataMap[caixa.id] = {
                ...caixa,
                notaOrigem: nota.nome || (caixa.onde === "share" ? "Nota Share" : "Nota Local"),
                notaDocId: notaId,
                notaDados: { ...nota, onde: caixa.onde }
            };
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
                    if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
                        window.abrirNotaNoBook(b.notaDocId, { ...b.notaDados, onde: b.onde || "local" }, db, {currentUser: {uid: userId}}, b.id);
                    } else {
                        import('../editor/editor.js').then(m => {
                            m.abrirNotaNoEditor(b.notaDocId, { ...b.notaDados, onde: b.onde || "local" }, db, {currentUser: {uid: userId}}, b.id);
                        });
                    }
                };
                container.appendChild(card);
            });
        });

    } catch (e) {
        console.error("Erro ao carregar associados:", e);
        container.innerHTML = "Erro de carregamento.";
    }
}
