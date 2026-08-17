import { obterCaixasLocais, obterCaixasPorIds, obterNotasPorCaixas } from "../local/caixas-repository.js";
import { obterCaixasShareAcessiveisPorIds, obterNotasSharePorCaixas } from "../share/share-caixas-repository.js";
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

let revisaoRenderizacao = 0;

export async function carregarCaixasAssociadas(caixasAtuais, db, userId) {
    const container = document.getElementById('caixas-associadas-container');
    if (!container) return;

    const revisaoAtual = ++revisaoRenderizacao;
    const listaCaixas = Array.isArray(caixasAtuais) ? caixasAtuais : [];

    const gruposComVinculos = listaCaixas.filter(c =>
        c.estado !== 'off' &&
        c.associados && 
        c.associados.length > 0
    );

    if (gruposComVinculos.length === 0) {
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
        const idsSharePermitidos = new Set();
        gruposComVinculos.forEach(grupo => {
            grupo.associados.forEach(associado => {
                if (associado.tipo !== 'nota' && associado.id) {
                    const id = String(associado.id);
                    todosIds.add(id);
                    if (associado.onde === 'share' || associado.origem === 'share') {
                        idsSharePermitidos.add(id);
                    }
                }
            });
        });

        const idsNormalizados = [...todosIds].map(String);
        let caixasLocaisMap = await obterCaixasPorIds(db, userId, idsNormalizados);
        const notasLocaisLegadas = new Map();

        // O explorador também mostra caixas antigas guardadas dentro de
        // Local.caixas. Recupera-as quando ainda não existem em LocalCaixas.
        const idsLocaisEmFalta = idsNormalizados.filter(id => !caixasLocaisMap.has(id));
        if (idsLocaisEmFalta.length) {
            const locais = await obterCaixasLocais(db, userId, { incluirLegacy: true });
            const idsEmFalta = new Set(idsLocaisEmFalta);
            const caixasLegadas = locais.caixas
                .filter(caixa => idsEmFalta.has(String(caixa.id)) && caixa.estado !== 'off')
                .map(caixa => [String(caixa.id), { ...caixa, id: String(caixa.id) }]);
            caixasLocaisMap = new Map([...caixasLocaisMap, ...caixasLegadas]);
            locais.notas.forEach((nota, notaId) => notasLocaisLegadas.set(notaId, nota));
        }

        const idsShare = idsNormalizados.filter(id =>
            !caixasLocaisMap.has(id) && idsSharePermitidos.has(id)
        );
        const caixasShareMap = await obterCaixasShareAcessiveisPorIds(db, idsShare);
        const [notasLocaisBase, notasShare] = await Promise.all([
            obterNotasPorCaixas(db, [...caixasLocaisMap.values()]),
            obterNotasSharePorCaixas(db, [...caixasShareMap.values()])
        ]);
        const notasLocais = new Map([...notasLocaisLegadas, ...notasLocaisBase]);

        // Uma associação nova pode iniciar outra leitura antes desta terminar.
        // Só a renderização mais recente pode tocar no painel.
        if (revisaoAtual !== revisaoRenderizacao) return;

        const dataMap = {};

        [...caixasLocaisMap.values(), ...caixasShareMap.values()].forEach(caixa => {
            const id = String(caixa.id);
            const notaId = caixa.onde === "share" ? caixa.shareId : caixa.localDocId;
            const nota = (caixa.onde === "share" ? notasShare : notasLocais).get(notaId) || {};
            dataMap[id] = {
                ...caixa,
                id,
                notaOrigem: nota.nome || (caixa.onde === "share" ? "Nota Share" : "Nota Local"),
                notaDocId: notaId,
                notaDados: { ...nota, onde: caixa.onde }
            };
        });

        // A memória local tem prioridade quando a mesma caixa já está na
        // nota aberta: é essa versão que contém a alteração mais recente.
        listaCaixas.forEach(caixa => {
            if (!caixa?.id) return;
            const id = String(caixa.id);
            const anterior = dataMap[id] || {};
            const notaActual = window.notaAtualContext?.dadosNota || {};
            dataMap[id] = {
                ...anterior,
                ...caixa,
                id,
                notaOrigem: anterior.notaOrigem || notaActual.nome || 'Nota actual',
                notaDocId: anterior.notaDocId || caixa.localDocId || notaActual.idFirestore || window.notaAtualContext?.notaId,
                notaDados: {
                    ...(anterior.notaDados || {}),
                    ...notaActual,
                    onde: caixa.onde || anterior.notaDados?.onde || notaActual.onde || 'local'
                }
            };
        });

        container.innerHTML = `<div style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:10px; font-weight:800; color:var(--primary);">CAIXAS ASSOCIADAS</div>`;

        gruposComVinculos.forEach(grupo => {
            grupo.associados.forEach(associado => {
                const b = associado.tipo === 'nota'
                    ? {
                        id: String(associado.id),
                        tipo: 'nota',
                        titulo: associado.titulo || 'Nota associada',
                        conteudo: '',
                        notaOrigem: 'Nota associada',
                        notaDocId: String(associado.id),
                        notaDados: { nome: associado.titulo || 'Nota associada', onde: 'local' }
                    }
                    : (dataMap[String(associado.id)] || {
                        id: String(associado.id),
                        tipo: associado.tipo || 'contentor',
                        titulo: associado.titulo || 'Ferramenta associada',
                        conteudo: 'A aguardar sincronização desta ferramenta.',
                        notaOrigem: 'Associação guardada',
                        notaDocId: null,
                        indisponivel: true
                    });
                if (!b) return;
                const config = b.tipo === 'nota'
                    ? { nome: 'NOTA', cor: 'var(--primary)' }
                    : (IDENTIDADE_FERRAMENTAS[b.tipo] || IDENTIDADE_FERRAMENTAS.contentor);
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
                    if (b.indisponivel || !b.notaDocId) return;
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
        if (revisaoAtual === revisaoRenderizacao) {
            container.innerHTML = "Erro de carregamento.";
        }
    }
}
