import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarAssociados } from './tags-ui.js';
import { IDENTIDADE_FERRAMENTAS } from '../../../constants/ferramentas.js';

/**
 * Carrega a estrutura de pastas e notas para o explorador
 */
export async function carregarArvore(ctx) {
    const { dbRef, authRef } = ctx;
    const container = document.getElementById('arvore-associar-content');
    if (!container) return;

    container.innerHTML = `<p style="font-size:10px; color:gray; text-align:center; padding:20px;">A ler base de dados...</p>`;
    
    try {
        const q = query(collection(dbRef, "Local"), where("userId", "==", authRef.currentUser.uid), where("estado", "==", "ativa"));
        const snap = await getDocs(q); // CORRIGIDO: Agora usa a query 'q'
        
        const itens = [];
        snap.forEach(d => itens.push({ docIdFirebase: d.id, ...d.data() }));

        renderizarArvoreAssociar(container, itens, "root", 0, ctx);
    } catch (e) {
        console.error("Erro Árvore:", e);
        container.innerHTML = `<p style="color:red; font-size:10px; text-align:center;">Erro ao carregar notas.</p>`;
    }
}

/**
 * Desenha a árvore de forma recursiva com o design original
 */
function renderizarArvoreAssociar(container, todos, paiId, level, ctx) {
    if (level === 0) container.innerHTML = "";
    
    const filhos = todos.filter(i => i.pastapai === paiId).sort((a,b) => (a.ordem || 0) - (b.ordem || 0));

    filhos.forEach(item => {
        const div = document.createElement('div');
        div.style.paddingLeft = (level * 15) + "px";

        if (item.tipo === "pasta") {
            div.innerHTML = `
                <div style="font-size:11px; color:var(--text-muted); padding: 10px 0 5px 0; display:flex; align-items:center; gap:8px; opacity: 0.8;">
                    <i class="fa-solid fa-folder" style="color:#eab308; font-size:10px;"></i>
                    <span style="font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${item.nome}</span>
                </div>`;
            container.appendChild(div);
            renderizarArvoreAssociar(container, todos, item.id, level + 1, ctx);
        } else {
            // NOTA
            const notaDiv = document.createElement('div');
            notaDiv.style.cssText = "padding:8px 12px; border-radius:6px; margin: 2px 0; cursor:pointer; display:flex; align-items:center; gap:10px; transition: 0.2s; background: rgba(255,255,255,0.02);";
            
            notaDiv.onmouseover = () => notaDiv.style.background = "rgba(99, 102, 241, 0.1)";
            notaDiv.onmouseout = () => notaDiv.style.background = "rgba(255,255,255,0.02)";
            
            notaDiv.innerHTML = `
                <i class="fa-solid fa-file-lines" style="color:var(--primary); font-size:14px;"></i>
                <span style="font-size:13px; color:white; font-weight:600;">${item.nome}</span>
            `;
            
            notaDiv.onclick = () => vincular(item.docIdFirebase, item.nome, 'nota', ctx);
            container.appendChild(notaDiv);

            // BLOCOS INTERNOS (CAIXAS)
            if (item.caixas) {
                item.caixas.filter(c => c.estado === 'ativa').forEach(caixa => {
                    const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
                    const cDiv = document.createElement('div');
                    cDiv.style.paddingLeft = "25px";
                    
                    const textoExibicao = caixa.titulo || (caixa.conteudo ? caixa.conteudo.substring(0, 35) + "..." : "Sem conteúdo");

                    cDiv.innerHTML = `
                        <div style="font-size:11px; color:#cbd5e1; padding:6px 10px; border-radius:4px; cursor:pointer; display:flex; align-items:center; gap:8px; margin: 1px 0;" 
                             onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <i class="${config.icon}" style="color:${config.cor}; font-size:10px; opacity:0.8;"></i>
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${textoExibicao}</span>
                        </div>`;
                    
                    cDiv.onclick = (e) => {
                        e.stopPropagation();
                        vincular(caixa.id, textoExibicao, caixa.tipo, ctx);
                    };
                    container.appendChild(cDiv);
                });
            }
        }
    });
}

export async function vincular(idAlvo, titulo, tipo, ctx) {
    const { caixaAlvo, persistir, dbRef, authRef } = ctx;
    if (!caixaAlvo.associados) caixaAlvo.associados = [];
    if (caixaAlvo.associados.some(a => a.id === idAlvo)) return;
    
    caixaAlvo.associados.push({ id: idAlvo, titulo, tipo });
    await persistir('associados', caixaAlvo.associados);

    import('./tags-ui.js').then(m => m.renderizarAssociados(caixaAlvo));
    import('../../../direita/caixas-associadas.js').then(m => {
        m.carregarCaixasAssociadas(window.caixasAtuais, dbRef, authRef.currentUser.uid);
    });
}

export async function remover(idAlvo, ctx) {
    const { caixaAlvo, persistir, dbRef, authRef } = ctx;
    caixaAlvo.associados = (caixaAlvo.associados || []).filter(a => a.id !== idAlvo);
    await persistir('associados', caixaAlvo.associados);
    
    import('./tags-ui.js').then(m => m.renderizarAssociados(caixaAlvo));
    import('../../../direita/caixas-associadas.js').then(m => {
        m.carregarCaixasAssociadas(window.caixasAtuais, dbRef, authRef.currentUser.uid);
    });
}