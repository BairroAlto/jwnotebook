import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarAssociados, renderizarHub } from './tags-ui.js';
import { IDENTIDADE_FERRAMENTAS } from '../../../constants/ferramentas.js';
import { perguntarRemocaoHub } from './tags-utils.js';

/**
 * Carrega a estrutura de pastas e notas para o explorador
 */
export async function carregarArvore(ctx) {
    const { dbRef, authRef } = ctx;
    const container = document.getElementById('arvore-associar-content');
    if (!container) return;

    container.innerHTML = `<p style="font-size:10px; color:gray; text-align:center; padding:20px;">A sintonizar base de dados...</p>`;
    
    try {
        // 1. BUSCAR TUDO (Notas e Pastas) do utilizador
        const q = query(
            collection(dbRef, "Local"), 
            where("userId", "==", authRef.currentUser.uid), 
            where("estado", "==", "on")
        );
        const snap = await getDocs(q);
        
        const todosItens = [];
        snap.forEach(d => todosItens.push({ docIdFirebase: d.id, ...d.data() }));

        // 2. RENDERIZAR RECURSIVAMENTE
        renderizarArvoreAssociar(container, todosItens, "root", 0, ctx);

    } catch (e) {
        console.error("Erro ao carregar árvore de associações:", e);
        container.innerHTML = `<p style="color:red; font-size:10px; text-align:center;">Erro de permissão.</p>`;
    }
}

/**
 * Desenha a árvore de forma recursiva com o design original
 */
function renderizarArvoreAssociar(container, lista, paiId, level, ctx) {
    if (level === 0) container.innerHTML = "";
    
    // Filtrar filhos do nível atual (Pastas ou Notas)
    const filhos = lista.filter(i => i.pastapai === paiId).sort((a,b) => (a.ordem || 0) - (b.ordem || 0));

    filhos.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.style.paddingLeft = (level > 0 ? 15 : 0) + "px";

        if (item.tipo === "pasta") {
            // --- RENDERIZAR PASTA ---
            wrapper.innerHTML = `
                <div style="font-size:11px; color:var(--text-muted); padding: 8px 0 4px 0; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-folder" style="color:#eab308; font-size:10px;"></i>
                    <span style="font-weight:700; text-transform:uppercase;">${item.nome}</span>
                </div>
                <div id="cont-assoc-${item.docIdFirebase || item.id}"></div>`;
            container.appendChild(wrapper);
            
            // Continua a procurar dentro desta pasta
            const subContainer = wrapper.querySelector(`#cont-assoc-${item.docIdFirebase || item.id}`);
            renderizarArvoreAssociar(subContainer, lista, item.docIdFirebase || item.id, level + 1, ctx);
        } 
        else {
            // --- RENDERIZAR NOTA ---
            const notaDiv = document.createElement('div');
            notaDiv.className = "item-assoc-nota";
            notaDiv.style.cssText = "padding:6px 10px; border-radius:6px; margin: 2px 0; cursor:pointer; display:flex; align-items:center; gap:10px; transition: 0.2; background: rgba(255,255,255,0.02);";
            
            notaDiv.innerHTML = `
                <i class="fa-solid fa-file-lines" style="color:var(--primary); font-size:12px;"></i>
                <span style="font-size:12px; color:white; font-weight:600;">${item.nome}</span>
            `;
            
            // Ao clicar na nota, associa a nota inteira
            notaDiv.onclick = () => vincular(item.docIdFirebase, item.nome, 'nota', ctx);
            wrapper.appendChild(notaDiv);

            // --- RENDERIZAR BLOCOS (CAIXAS) DENTRO DA NOTA ---
            if (item.caixas && Array.isArray(item.caixas)) {
                const boxesCont = document.createElement('div');
                boxesCont.style.paddingLeft = "20px";
                
                item.caixas.filter(c => c.estado === 'on').forEach(caixa => {
                    const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
                    const cDiv = document.createElement('div');
                    
                    const resumo = caixa.titulo || (caixa.conteudo ? caixa.conteudo.substring(0, 35) + "..." : "Bloco vazio");

                    cDiv.style.cssText = "font-size:11px; color:#94a3b8; padding:4px 8px; cursor:pointer; display:flex; align-items:center; gap:8px; border-radius:4px;";
                    cDiv.onmouseover = () => cDiv.style.background = "rgba(255,255,255,0.05)";
                    cDiv.onmouseout = () => cDiv.style.background = "transparent";
                    
                    cDiv.innerHTML = `
                        <i class="${config.icon}" style="color:${config.cor}; font-size:9px;"></i>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${resumo}</span>
                    `;
                    
                    // Ao clicar no bloco, associa o ID específico do bloco
                    cDiv.onclick = (e) => {
                        e.stopPropagation();
                        vincular(caixa.id, resumo, caixa.tipo, ctx);
                    };
                    boxesCont.appendChild(cDiv);
                });
                wrapper.appendChild(boxesCont);
            }
            container.appendChild(wrapper);
        }
    });
}

export async function vincular(idAlvo, titulo, tipo, ctx) {
    const { caixaAlvo, persistir, dbRef, authRef } = ctx;
    
    if (!caixaAlvo.associados) caixaAlvo.associados = [];
    
    // Evita duplicados
    if (caixaAlvo.associados.some(a => a.id === idAlvo)) return;
    
    console.log("🔗 Vinculando alvo:", titulo);
    
    caixaAlvo.associados.push({ id: idAlvo, titulo, tipo });
    await persistir('associados', caixaAlvo.associados);

    // Refresh na UI do Popup e da Coluna EYE
    import('./tags-ui.js').then(m => {
        m.renderizarAssociados(caixaAlvo);
        m.renderizarHub(caixaAlvo);
    });
    import('../../../direita/caixas-associadas.js').then(m => {
        m.carregarCaixasAssociadas(window.caixasAtuais, dbRef, authRef.currentUser.uid);
    });
}

export async function remover(idAlvo, ctx) {
    const { caixaAlvo, persistir, dbRef, authRef } = ctx;
    const alvo = (caixaAlvo.associados || []).find(a => a.id === idAlvo);
    const confirmou = await perguntarRemocaoHub({
        titulo: "Remover Associação?",
        mensagem: alvo?.titulo
            ? `Desejas remover "${alvo.titulo}" do Hub?`
            : "Desejas remover este item do Hub?"
    });
    if (!confirmou) return;

    caixaAlvo.associados = (caixaAlvo.associados || []).filter(a => a.id !== idAlvo);
    await persistir('associados', caixaAlvo.associados);
    
    import('./tags-ui.js').then(m => {
        m.renderizarAssociados(caixaAlvo);
        m.renderizarHub(caixaAlvo);
    });
    import('../../../direita/caixas-associadas.js').then(m => {
        m.carregarCaixasAssociadas(window.caixasAtuais, dbRef, authRef.currentUser.uid);
    });
}
