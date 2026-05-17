// components/xray/xray-export-manager.js
import { collection, query, where, getDocs, doc, getDoc, updateDoc, or, and } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { dispararIndexacao } from '../editor/modulos/ai-search-indexer.js'; // 🚀 GATILHO GPS INTEGRADO

let notaSelecionadaId = null;
let colecaoAlvo = "Local";

/**
 * 1. INICIALIZADOR DO MOTOR DE EXPORTAÇÃO
 */
export function iniciarExportManager(db, auth) {
    const btnAbrir = document.getElementById('btn-xray-export');
    const overlay = document.getElementById('popup-export-xray');
    
    if(!btnAbrir) return;

    // Abrir Popup de Exportação
    btnAbrir.onclick = () => {
        const texto = document.getElementById('editor-manuscrito').value.trim();
        if(!texto) {
            alert("O Manuscrito está vazio! Escreve algo antes de exportar.");
            return;
        }
        overlay.classList.add('active');
        carregarEstruturaParaExport(db, auth);
    };

    // Fechar Popup
    document.getElementById('btn-fechar-export').onclick = () => {
        overlay.classList.remove('active');
        notaSelecionadaId = null;
    };

    // Alternar entre Local e Share como destino
    document.querySelectorAll('.tab-export-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-export-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            colecaoAlvo = btn.dataset.origem; // "Local" ou "Share"
            carregarEstruturaParaExport(db, auth);
        };
    });

    // Botão Final de Conversão
    document.getElementById('btn-executar-export').onclick = () => executarConversao(db, auth);
}

/**
 * 2. CARREGAR ESTRUTURA DE NOTAS (ÁRVORE)
 */
async function carregarEstruturaParaExport(db, auth) {
    const container = document.getElementById('arvore-export-xray');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--xray-primary);"></i></div>`;
    
    const uid = auth.currentUser.uid;
    let q;

    if(colecaoAlvo === "Local") {
        q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "ativa"));
    } else {
        q = query(collection(db, "Share"), and(
            where("estado", "==", "ativo"), 
            or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
        ));
    }

    try {
        const snap = await getDocs(q);
        const todosItens = [];
        
        snap.forEach(d => {
            const data = d.data();
            let pai = (colecaoAlvo === "Local") ? (data.pastapai || "root") : (data[uid]?.pastapai || "home");
            todosItens.push({ docId: d.id, ...data, paiCalculado: pai }); 
        });

        container.innerHTML = "";
        const raizId = (colecaoAlvo === "Local") ? "root" : "home";
        renderizarNivel(container, todosItens, raizId, auth);

        if (container.innerHTML === "") {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:20px; font-size:12px;">Nenhuma nota encontrada no ${colecaoAlvo}.</p>`;
        }

    } catch (e) { 
        console.error("Erro ao carregar árvore para exportação:", e); 
    }
}

/**
 * 3. RENDERIZADOR DA LISTA DE SELECÇÃO
 */
function renderizarNivel(container, lista, paiId, auth) {
    const itensNivel = lista.filter(i => i.paiCalculado === paiId).sort((a,b) => (a.ordem || 0) - (b.ordem || 0));

    itensNivel.forEach(item => {
        const wrapper = document.createElement('div');
        
        if (item.tipo === 'pasta') {
            wrapper.className = "tree-folder";
            wrapper.innerHTML = `
                <div class="tree-item-row folder-row" style="opacity: 0.6; cursor: default;">
                    <i class="fa-solid fa-folder folder-icon"></i>
                    <span style="font-weight:700;">${item.nome}</span>
                </div>
                <div class="tree-children" style="display: block; padding-left: 15px;"></div>
            `;
            container.appendChild(wrapper);
            const childrenCont = wrapper.querySelector('.tree-children');
            renderizarNivel(childrenCont, lista, item.docId, auth);
        } else {
            wrapper.className = "tree-note";
            wrapper.innerHTML = `
                <div class="tree-item-row note-row" data-firestoreid="${item.docId}">
                    <i class="fa-solid fa-file-lines note-icon"></i>
                    <span>${item.nome}</span>
                </div>
            `;
            const row = wrapper.querySelector('.note-row');
            row.onclick = () => selecionarNotaDestino(item.docId, item.nome, row);
            container.appendChild(wrapper);
        }
    });
}

function selecionarNotaDestino(id, nome, el) {
    notaSelecionadaId = id;
    document.querySelectorAll('.tree-item-row').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    
    const footer = document.getElementById('export-action-footer');
    const label = document.getElementById('txt-nota-selecionada');
    if (footer) footer.style.display = 'block';
    if (label) label.innerText = `Enviar para: ${nome}`;
}

/**
 * 4. EXECUTAR CONVERSÃO E SINCRONIZAR COM GPS
 */
async function executarConversao(db, auth) {
    if (!notaSelecionadaId) return;

    const manuscritoTexto = document.getElementById('editor-manuscrito').value.trim();
    const btn = document.getElementById('btn-executar-export');
    const uid = auth.currentUser.uid;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A ENVIAR...';

    try {
        const docRef = doc(db, colecaoAlvo, notaSelecionadaId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) throw new Error("Nota de destino não encontrada.");

        const data = snap.data();
        let caixas = data.caixas || [];

        // Criar o novo bloco de conteúdo
        const novaCaixa = {
            id: crypto.randomUUID(),
            tipo: "contentor",
            conteudo: manuscritoTexto,
            estado: "ativa",
            foco: "original",
            protecao: "fechado",
            timestamp: new Date().toISOString(),
            origem: "xray-export"
        };

        // Lógica de Ordem baseada no Modo da Nota (Post vs Normal)
        const modos = Array.isArray(data.modo) ? data.modo : [data.modo || 'normal'];
        if (modos.includes('post')) {
            caixas.unshift(novaCaixa); // No topo
        } else {
            caixas.push(novaCaixa); // No fim
        }

        // Re-indexar a ordem numérica
        caixas.forEach((c, i) => c.ordem = i + 1);

        // 1. GRAVAR NO FIRESTORE
        await updateDoc(docRef, { caixas: caixas });
        console.log(`✅ [X-RAY] Manuscrito exportado para nota ${notaSelecionadaId}`);

        // 2. 🚀 GATILHO NEXO GPS: Indexar o novo conteúdo imediatamente
        // Isto permite que o utilizador pesquise este manuscrito no GPS logo a seguir.
        dispararIndexacao(db, uid, notaSelecionadaId, {
            nome: data.nome,
            caixas: caixas,
            vincTopicos: data.vincTopicos || []
        });

        // Feedback de sucesso e fecho
        btn.innerHTML = '<i class="fa-solid fa-check"></i> ENVIADO COM SUCESSO!';
        btn.style.background = "#22c55e";

        setTimeout(() => {
            document.getElementById('popup-export-xray').classList.remove('active');
            document.getElementById('export-action-footer').style.display = 'none';
            btn.innerHTML = '<i class="fa-solid fa-file-export"></i> CONVERTER E ENVIAR';
            btn.style.background = "";
            btn.disabled = false;
            notaSelecionadaId = null;
        }, 1500);

    } catch (e) {
        console.error("❌ Erro na Exportação:", e);
        alert("Falha ao exportar manuscrito. Verifica a tua ligação.");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-export"></i> CONVERTER E ENVIAR';
    }
}