// components/local/local-tree-mover.js
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Estado interno do módulo
let idItemMover = null;
let tipoItemMover = null;
let pastaDestinoIdInterno = null; 

/**
 * MOTOR DE MOVIMENTAÇÃO (VISTA ÁRVORE)
 * Popula o popup com a estrutura de pastas do utilizador.
 */
export async function iniciarMotorMover(id, tipo) {
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

        container.innerHTML = "";
        
        // 3. Adicionar o nível raiz (LOCAL)
        container.appendChild(criarItemPastaRaiz("root", "LOCAL (RAIZ)", 0));

        // 4. Renderizar pastas de forma recursiva
        renderizarNivelPastas(container, todosItens, "root", 1);
        
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
        iniciarMotorMover("INVITE_MODE", "nota");

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
 * AUXILIAR: Cria um elemento de pasta para a árvore
 */
function criarItemPasta(id, nome, level) {
    const div = document.createElement('div');
    div.className = "tree-item-pasta-select";
    div.style.cssText = `padding: 10px 10px 10px ${level * 15 + 10}px; cursor: pointer; border-radius: 6px; transition: 0.2s; display: flex; align-items: center; gap: 10px; margin-bottom: 2px;`;
    
    // Diferenciação visual entre Raiz e Pastas Normais
    const icone = (id === "root") ? "fa-folder-tree" : "fa-folder";
    const cor = (id === "root") ? "var(--primary)" : "#eab308";

    div.innerHTML = `<i class="fa-solid ${icone}" style="color: ${cor}; opacity: 0.7;"></i> <span style="font-size:13px; color:white;">${nome}</span>`;
    
    div.onclick = () => {
        // Limpar seleções anteriores
        document.querySelectorAll('.tree-item-pasta-select').forEach(el => el.style.background = "transparent");
        
        // Destacar seleção atual
        div.style.background = "rgba(99, 102, 241, 0.2)";
        pastaDestinoIdInterno = id; 
        
        document.getElementById('nome-pasta-selecionada').innerText = nome;
        const btn = document.getElementById('btn-confirmar-movimentacao');
        btn.disabled = false;
        btn.style.opacity = "1";
    };
    return div;
}

// Alias para clareza no código
function criarItemPastaRaiz(id, nome, level) {
    return criarItemPasta(id, nome, level);
}

/**
 * RECURSIVIDADE: Renderiza filhos de uma pasta
 */
function renderizarNivelPastas(container, lista, paiId, level) {
    // Filtramos apenas itens do tipo 'pasta' que pertençam ao pai atual
    // E ignoramos a própria pasta que estamos a mover (para não criar loops infinitos)
    const pastasFilhas = lista.filter(i => i.tipo === 'pasta' && i.pastapai === paiId && i.id !== idItemMover);
    
    pastasFilhas.forEach(p => {
        container.appendChild(criarItemPasta(p.id, p.nome, level));
        renderizarNivelPastas(container, lista, p.id, level + 1);
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
        
        // Recarregar para atualizar a barra lateral (Podes disparar a tua função de ler-local se preferires)
        location.reload();

    } catch (e) {
        console.error("Falha ao mover item:", e);
        alert("Erro ao processar movimento.");
        btn.innerHTML = "Mover Agora";
    }
}