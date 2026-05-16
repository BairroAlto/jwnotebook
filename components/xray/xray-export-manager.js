// components/xray/xray-export-manager.js
import { collection, query, where, getDocs, doc, getDoc, updateDoc, or, and } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state } from './xray-state.js';

let notaSelecionadaId = null;
let colecaoAlvo = "Local";

export function iniciarExportManager(db, auth) {
    const btnAbrir = document.getElementById('btn-xray-export');
    const overlay = document.getElementById('popup-export-xray');
    
    if(!btnAbrir) return;

    btnAbrir.onclick = () => {
        const texto = document.getElementById('editor-manuscrito').value.trim();
        if(!texto) return alert("O Manuscrito está vazio!");
        overlay.classList.add('active');
        carregarEstruturaParaExport(db, auth);
    };

    document.getElementById('btn-fechar-export').onclick = () => overlay.classList.remove('active');

    // Abas Local/Share
  document.querySelectorAll('.tab-export-btn').forEach(btn => {
        btn.onclick = () => {
            // 1. Remover classe active de todos
            document.querySelectorAll('.tab-export-btn').forEach(b => b.classList.remove('active'));
            // 2. Adicionar ao clicado
            btn.classList.add('active');
            
            // 3. Atualizar dados
            colecaoAlvo = btn.dataset.origem;
            carregarEstruturaParaExport(db, auth);
        };
    });

    document.getElementById('btn-executar-export').onclick = () => executarConversao(db);
}

async function carregarEstruturaParaExport(db, auth) {
    const container = document.getElementById('arvore-export-xray');
    container.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--xray-primary);"></i></div>`;
    
    const uid = auth.currentUser.uid;
    let q;

    if(colecaoAlvo === "Local") {
        q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "ativa"));
    } else {
        q = query(collection(db, "Share"), and(where("estado", "==", "ativo"), or(where("userId", "==", uid), where("aprovado", "array-contains", uid))));
    }

    try {
        const snap = await getDocs(q);
        const todosItens = [];
        
        snap.forEach(d => {
            // 🚀 A CORREÇÃO ESTÁ AQUI: 
            // Guardamos o id do Firestore como 'docId' para não confundir com o id interno
            todosItens.push({ docId: d.id, ...d.data() }); 
        });

        container.innerHTML = "";
        const raizId = colecaoAlvo === "Local" ? "root" : "home";
        renderizarNivel(container, todosItens, raizId);

    } catch (e) { console.error(e); }
}

function renderizarNivel(container, lista, paiId) {
    // Ajuste no filtro para suportar Local e Share
    const itensNivel = lista.filter(i => {
        if (colecaoAlvo === "Local") return i.pastapai === paiId;
        const uid = auth.currentUser.uid;
        return i[uid]?.pastapai === paiId;
    });

    itensNivel.sort((a,b) => (a.ordem || 0) - (b.ordem || 0)).forEach(item => {
        const wrapper = document.createElement('div');
        
        if (item.tipo === 'pasta') {
            wrapper.className = "tree-folder";
            wrapper.innerHTML = `
                <div class="tree-item-row folder-row">
                    <i class="fa-solid fa-chevron-right chevron-rotate"></i>
                    <i class="fa-solid fa-folder folder-icon"></i>
                    <span style="font-weight:700;">${item.nome}</span>
                </div>
                <div class="tree-children"></div>
            `;
            container.appendChild(wrapper);

            wrapper.querySelector('.folder-row').onclick = (e) => {
                e.stopPropagation();
                const children = wrapper.querySelector('.tree-children');
                const isOpen = children.classList.toggle('open');
                wrapper.querySelector('.chevron-rotate').classList.toggle('open', isOpen);
                // Usamos o 'id' interno ou 'docId' para o paiId conforme a tua lógica de pastas
                if (isOpen && children.innerHTML === "") renderizarNivel(children, lista, (item.id || item.docId));
            };
        } else {
            // É UMA NOTA
           wrapper.className = "tree-note";
        wrapper.innerHTML = `
            <div class="tree-item-row note-row" data-firestoreid="${item.docId}">
                <i class="fa-solid fa-file-lines note-icon" style="margin-left: 22px;"></i>
                <span>${item.nome}</span>
            </div>
        `;
        container.appendChild(wrapper);

        const row = wrapper.querySelector('.note-row');
        row.onclick = (e) => {
            e.stopPropagation();
            // 🚀 PASSAMOS O ID, O NOME E O ELEMENTO (row)
            selecionarNota(item.docId, item.nome, row); 
        };
    }
    });
}

function selecionarNota(id, nome, elementoClicado) {
    // 1. Guardar o ID para a exportação final
    notaSelecionadaId = id;

    // 2. Limpar a seleção visual de todos os outros itens
    document.querySelectorAll('.tree-item-row').forEach(el => {
        el.classList.remove('selected');
    });

    // 3. Adicionar destaque ao elemento que foi passado (sem erro de querySelector)
    if (elementoClicado) {
        elementoClicado.classList.add('selected');
    } else {
        // Fallback de segurança caso o elemento não venha por argumento
        const el = document.querySelector(`[data-firestoreid="${id}"]`);
        if (el) el.classList.add('selected');
    }

    // 4. Mostrar o rodapé de confirmação
    const footer = document.getElementById('export-action-footer');
    const label = document.getElementById('txt-nota-selecionada');
    
    if (footer) footer.style.display = 'block';
    if (label) label.innerText = `Destino: ${nome}`;
}


async function executarConversao(db) {
    if (!notaSelecionadaId) return;

    const manuscritoTexto = document.getElementById('editor-manuscrito').value.trim();
    const btn = document.getElementById('btn-executar-export');
    
    // Elementos da UI para resetar no fim
    const footer = document.getElementById('export-action-footer');
    const overlay = document.getElementById('popup-export-xray');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A ENVIAR...';

    try {
        console.log(`📡 Exportando para ${colecaoAlvo} / ID: ${notaSelecionadaId}`);

        const docRef = doc(db, colecaoAlvo, notaSelecionadaId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            throw new Error("A nota de destino não foi encontrada.");
        }

        const data = snap.data();
        let caixas = data.caixas || [];

        // 1. CRIAR O NOVO CONTENTOR
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

        // 2. LÓGICA DE ORDEM (NORMAL vs POST)
        const modos = Array.isArray(data.modo) ? data.modo : [data.modo || 'normal'];
        if (modos.includes('post')) {
            caixas.unshift(novaCaixa);
        } else {
            caixas.push(novaCaixa);
        }

        // 3. RE-INDEXAR
        caixas.forEach((c, i) => c.ordem = i + 1);

        // 4. GRAVAR NO FIRESTORE
        await updateDoc(docRef, { caixas: caixas });

        // 5. FEEDBACK E LIMPEZA (IDs Corrigidos aqui)
        
        if (overlay) overlay.classList.remove('active');
        
        // 🚀 A CORREÇÃO: Usar o ID que existe no seu HTML
        if (footer) footer.style.display = 'none'; 
        
        notaSelecionadaId = null;

    } catch (e) {
        console.error("❌ Erro na Exportação:", e);
        alert("Falha ao exportar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-export"></i> CONVERTER E ENVIAR';
    }
}