// components/local/local-tree-mover.js
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { renderFolderTree } from "../ui/folder-tree.js";

// Estado interno do módulo
let idItemMover = null;
let tipoItemMover = null;
let pastaDestinoIdInterno = null; 

/**
 * MOTOR DE MOVIMENTAÇÃO (VISTA ÁRVORE)
 * Popula o popup com a estrutura de pastas do utilizador.
 */
export async function iniciarMotorMover(id, tipo, pastaAtualIdFornecida = null) {
    idItemMover = id;
    tipoItemMover = tipo;
    pastaDestinoIdInterno = null;

    const overlay = document.getElementById('popup-mover-item-overlay');
    const container = document.getElementById('arvore-mover-local');
    const btnConfirmar = document.getElementById('btn-confirmar-movimentacao');

    if (!overlay || !container || !btnConfirmar) return;

    // 1. Reset visual e estado inicial
    overlay.classList.add('active');
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = "Mover Agora";
    btnConfirmar.style.opacity = "0.5";
    document.getElementById('nome-pasta-selecionada').innerText = "Escolhe uma pasta...";
    container.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    try {
        const db = getFirestore();
        const uid = getAuth().currentUser.uid;
        
        // 2. Buscar todas as pastas e notas "vivas" do utilizador
        const q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "on"));
        const snap = await getDocs(q);
        
        const todosItens = [];
        snap.forEach(d => todosItens.push({ id: d.id, ...d.data() }));

        const itemAtual = id === "INVITE_MODE" ? null : todosItens.find(item => item.id === id);
        const pastaAtualId = pastaAtualIdFornecida || itemAtual?.pastapai || "root";

        renderFolderTree(container, {
            items: todosItens,
            rootId: "root",
            rootLabel: "LOCAL (RAIZ)",
            theme: "local",
            currentId: pastaAtualId,
            excludeId: id === "INVITE_MODE" ? null : id,
            getParentId: item => item.pastapai || "root",
            onSelect: ({ id: pastaId, name }) => {
                pastaDestinoIdInterno = pastaId;
                document.getElementById('nome-pasta-selecionada').innerText = name;
                const btn = document.getElementById('btn-confirmar-movimentacao');
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        });
        
        // 5. Configurar clique de confirmação (Apenas se não for modo convite)
        if (id !== "INVITE_MODE") {
            btnConfirmar.onclick = () => executarMovimentacao();
        }

    } catch (e) {
        console.error("Erro ao carregar árvore:", e);
        container.innerHTML = `<p style="color:red; font-size:11px; text-align:center;">Erro ao carregar estrutura.</p>`;
    }
}

/**
 * FUNÇÃO DE PONTE: Promete o ID da pasta destino
 * Usada pelo convites-manager.js para saber onde clonar a nota.
 */
export function pedirPastaDestino() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-mover-item-overlay');
        const btnConfirmar = document.getElementById('btn-confirmar-movimentacao');
        const btnFechar = overlay.querySelector('button'); // Botão X do cabeçalho

        // Ativa o motor em modo especial
        iniciarMotorMover("INVITE_MODE", "nota", null);

        // Ajusta textos para o contexto de aceitação
        overlay.querySelector('h3').innerText = "Onde queres colocar esta nota?";
        btnConfirmar.innerText = "Colocar aqui";

        // Clique no Confirmar: Resolve a promessa com o ID selecionado
        btnConfirmar.onclick = () => {
            overlay.classList.remove('active');
            resolve(pastaDestinoIdInterno || "root");
        };

        // Clique no Fechar: Resolve como null (cancelado)
        btnFechar.onclick = () => {
            overlay.classList.remove('active');
            resolve(null);
        };
    });
}

/**
 * EXECUÇÃO: Altera o pastapai no Firestore (Modo Mover Normal)
 */
async function executarMovimentacao() {
    if (!pastaDestinoIdInterno || !idItemMover) return;
    
    const db = getFirestore();
    const uid = getAuth().currentUser.uid;
    const btn = document.getElementById('btn-confirmar-movimentacao');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A mover...';

    try {
        // Lógica de Ordenação: Colocamos o item no topo da nova pasta
        const q = query(
            collection(db, "Local"), 
            where("userId", "==", uid), 
            where("pastapai", "==", pastaDestinoIdInterno), 
            orderBy("ordem", "asc")
        );
        const snap = await getDocs(q);
        
        // Nova ordem = menor ordem encontrada - 1 (ou 1 se vazio)
        let novaOrdem = 1;
        if (!snap.empty) {
            novaOrdem = snap.docs[0].data().ordem - 1;
        }

        // Atualizar no Firebase
        await updateDoc(doc(db, "Local", idItemMover), {
            pastapai: pastaDestinoIdInterno,
            ordem: novaOrdem
        });

        document.getElementById('popup-mover-item-overlay').classList.remove('active');
        
        // A lista local usa onSnapshot; actualiza-se apenas a pasta visível.
        if (typeof window.carregarPastaLocalManual === "function") {
            window.carregarPastaLocalManual(window.pastaAtual || "root");
        }

    } catch (e) {
        console.error("Falha ao mover item:", e);
        alert("Erro ao processar movimento.");
        btn.innerHTML = "Mover Agora";
    }
}
