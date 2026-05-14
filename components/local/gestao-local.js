// components/local/gestao-local.js
import { 
    getFirestore, doc, updateDoc, getDoc, collection, 
    query, where, getDocs, addDoc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { iniciarMotorMover } from './local-tree-mover.js';
import { abrirPopupOrdenacao } from './local-order-manager.js';

// Variável de estado para o item que está a ser gerido no momento
let itemAtual = null; 

/**
 * 1. INICIALIZAÇÃO DO CONTROLADOR
 * Aguarda o carregamento do HTML dinâmico antes de configurar os botões.
 */
export function inicializarGestaoLocal() {
    setTimeout(() => {
        const btnToggle = document.getElementById('btn-editar-local-toggle');
        const listaLocal = document.getElementById('lista-local');
        if (!btnToggle || !listaLocal) return;

        btnToggle.onclick = (e) => {
            e.stopPropagation();
            const modoAtivo = btnToggle.classList.toggle('active');
            listaLocal.classList.toggle('lista-modo-edicao', modoAtivo);
        };
    }, 800); 
}


/**
 * 2. CONFIGURAÇÃO DOS EVENTOS DENTRO DO POPUP
 */
function configurarCliquesPopup() {
    const btnPin = document.getElementById('btn-gestao-pin');
    const btnTop = document.getElementById('btn-gestao-top');
    const btnSalvar = document.getElementById('btn-salvar-gestao-item');

    if (!btnPin || !btnTop) {
        console.error("❌ [GESTAO-POPUP] Erro: Botões do popup não encontrados no DOM.");
        return;
    }

    // --- LÓGICA DO BOTÃO PIN ---
    btnPin.onclick = async () => {
        if (!itemAtual) return;
        console.group("📌 [PIN-LOG] Alterando estado Pin");
        
        const db = getFirestore();
        const auth = getAuth();
        const uid = auth.currentUser.uid;
        
        const isPinAtivo = itemAtual.dados.pin === "sim";
        const novoEstadoPin = isPinAtivo ? "nao" : "sim";

        try {
            await updateDoc(doc(db, "Local", itemAtual.id), { pin: novoEstadoPin });
            itemAtual.dados.pin = novoEstadoPin;
            btnPin.classList.toggle('pin-ativo', novoEstadoPin === "sim");

            // Sincronizar com a coleção Atalho (para a aba PINS)
            await gerirAtalhoFirebase(db, uid, {id: itemAtual.id, nome: itemAtual.dados.nome, tipo: itemAtual.tipo}, "Local", novoEstadoPin === "sim" ? "adicionar" : "remover");
            console.log("✅ Pin atualizado.");
        } catch (e) { console.error(e); }
        console.groupEnd();
    };





    // --- LÓGICA DO BOTÃO TOP ---
 btnTop.onclick = async () => {
        if (!itemAtual) return; // Removida a restrição que obrigava a ser 'nota'
        
        console.group("🚀 [TOP-LOG] Alterando estado TOP");

        const db = getFirestore();
        const uid = getAuth().currentUser.uid;
        const isTopAtivo = itemAtual.dados.Top?.estado === "ativo";
        const novoEstado = isTopAtivo ? "desativo" : "ativo";

        try {
            // Feedback de loading no botão
            btnTop.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            let ordemTop = 0;

            if (novoEstado === "ativo") {
                // Cálculo de ordem para o Top
                const qTop = query(collection(db, "Local"), where("userId", "==", uid), where("Top.estado", "==", "ativo"));
                const snapTop = await getDocs(qTop);
                ordemTop = snapTop.size + 1;
            }

            // Gravar no Firebase
            await updateDoc(doc(db, "Local", itemAtual.id), { 
                "Top": { estado: novoEstado, ordem: ordemTop } 
            });

            // Atualizar estado na memória do popup
            itemAtual.dados.Top = { estado: novoEstado, ordem: ordemTop };
            
            // Feedback visual no botão
            btnTop.classList.toggle('pin-ativo', novoEstado === "ativo");
            btnTop.innerHTML = `<i class="fa-solid fa-up-long"></i> <span style="font-size: 9px;">TOP</span>`;
            
            console.log("✅ Estado TOP atualizado com sucesso.");
        } catch (e) { 
            console.error("❌ Erro ao atualizar TOP:", e); 
            btnTop.innerHTML = `<i class="fa-solid fa-up-long"></i> <span style="font-size: 9px;">TOP</span>`; 
        }
        console.groupEnd();
    };

    // --- LÓGICA DO BOTÃO GRAVAR (NOME E ÍCONE) ---
   if (btnSalvar) {
        btnSalvar.onclick = async () => {
            if (!itemAtual) return;
            const novoNome = document.getElementById('input-gestao-nome').value.trim();
            if (!novoNome) return alert("O nome não pode estar vazio.");

            btnSalvar.innerText = "Gravando...";
            btnSalvar.disabled = true; // Evita múltiplos cliques

            const db = getFirestore();
            const updates = { nome: novoNome };
            if (itemAtual.tipo === 'pasta') updates.icon = itemAtual.dados.icon || "folder";

            try {
                // Tenta gravar na coleção Local
                await updateDoc(doc(db, "Local", itemAtual.id), updates);
                
                // Fecha o popup e limpa o botão
                document.getElementById('popup-gestao-item-overlay').classList.remove('active');
                btnSalvar.innerText = "Gravar Alterações";
                btnSalvar.disabled = false;
            } catch (e) { 
                console.error("Erro ao salvar:", e); 
                alert("Erro ao gravar no banco de dados. Verifica a tua ligação.");
                btnSalvar.innerText = "Gravar Alterações";
                btnSalvar.disabled = false;
            }
        };
    }

    // Seleção de ícones para pastas
    document.querySelectorAll('.icon-opt').forEach(el => {
        el.onclick = () => {
            document.querySelectorAll('.icon-opt').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
            if (itemAtual) itemAtual.dados.icon = el.dataset.icon;
        };
    });

    console.log("✅ [GESTAO] Motores de clique do popup ativados.");
}

/**
 * 3. FUNÇÃO DE ABERTURA (Disparada pela Roldana na lista)
 */
window.abrirEditorItemLocal = async (id, tipo, nome) => {
    const db = getFirestore();
    const auth = getAuth();
    const uid = auth.currentUser.uid;
    const overlay = document.getElementById('popup-gestao-item-overlay');
    
    try {
        // 1. BUSCAR DADOS REAIS DO FIREBASE
        const docRef = doc(db, "Local", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        // Atualizar a variável de estado do módulo para o item selecionado
        itemAtual = { id: snap.id, tipo, dados: snap.data() };

        // 2. CONFIGURAR INTERFACE BÁSICA
        document.getElementById('gestao-item-titulo').innerText = `Gerir ${tipo === 'pasta' ? 'Pasta' : 'Nota'}`;
        const inputNome = document.getElementById('input-gestao-nome');
        inputNome.value = itemAtual.dados.nome;

        const btnPin = document.getElementById('btn-gestao-pin');
        const btnTop = document.getElementById('btn-gestao-top');

        // 3. RESET VISUAL (Garante que spins antigos e estados de clique limpam)
        btnTop.innerHTML = '<i class="fa-solid fa-up-long"></i> <span style="font-size: 9px;">TOP</span>';
        btnTop.style.pointerEvents = "auto";
        btnPin.style.pointerEvents = "auto";

        // 4. SINCRONIZAR CLASSES DE DESTAQUE (Classes CSS .pin-ativo)
        btnPin.classList.toggle('pin-ativo', itemAtual.dados.pin === "sim");
        btnTop.classList.toggle('pin-ativo', itemAtual.dados.Top?.estado === "ativo");

        // 5. GESTÃO DE ÍCONES (Apenas se for Pasta)
        const seccaoIcones = document.getElementById('seccao-icones-pasta');
        if (tipo === 'pasta') {
            seccaoIcones.style.display = 'block';
            const iconeAtual = itemAtual.dados.icon || "folder";
            document.querySelectorAll('.icon-opt').forEach(el => {
                el.classList.toggle('active', el.dataset.icon === iconeAtual);
                el.onclick = () => {
                    document.querySelectorAll('.icon-opt').forEach(i => i.classList.remove('active'));
                    el.classList.add('active');
                    itemAtual.dados.icon = el.dataset.icon; // Guarda na memória do popup
                };
            });
        } else {
            seccaoIcones.style.display = 'none';
        }

        // ========================================================
        // 6. LÓGICA DO BOTÃO PIN (SINCRONIZAÇÃO COM ABA PINS)
        // ========================================================
        btnPin.onclick = async (e) => {
            e.stopPropagation();
            console.log("🚀 [LOCAL-PIN] Botão clicado!");

            // Calcular novo estado baseado na memória
            const isPinAtivo = (itemAtual.dados.pin === "sim");
            const novoEstadoPin = isPinAtivo ? "nao" : "sim";

            console.log(`📌 [LOCAL-PIN] Transição: ${itemAtual.dados.pin} -> ${novoEstadoPin}`);

            // Atualizar Memória e UI Imediatamente
            itemAtual.dados.pin = novoEstadoPin;
            btnPin.classList.toggle('pin-ativo', novoEstadoPin === "sim");

            try {
                // Gravar no Firestore (Coleção Local)
                await updateDoc(doc(db, "Local", itemAtual.id), { pin: novoEstadoPin });
                
                // Sincronizar Coleção Atalho (Aba Pins)
                const acaoAtalho = (novoEstadoPin === "sim") ? "adicionar" : "remover";
                await gerirAtalhoFirebase(db, uid, {
                    id: itemAtual.id, 
                    nome: itemAtual.dados.nome, 
                    tipo: itemAtual.tipo
                }, "Local", acaoAtalho);

                console.log("✅ [LOCAL-PIN] Processo concluído com sucesso.");
            } catch (err) {
                console.error("❌ [LOCAL-PIN] Erro na gravação:", err);
                // Reverter em caso de falha
                itemAtual.dados.pin = isPinAtivo ? "sim" : "nao";
                btnPin.classList.toggle('pin-ativo', isPinAtivo);
            }
        };

        // ========================================================
        // 7. LÓGICA DO BOTÃO TOP (FAVORITOS DA PASTA)
        // ========================================================
        btnTop.onclick = async (e) => {
            e.stopPropagation();
            btnTop.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btnTop.style.pointerEvents = "none";

            const isTopAtivo = itemAtual.dados.Top?.estado === "ativo";
            const novoEstadoTop = isTopAtivo ? "desativo" : "ativo";

            try {
                let novaOrdemTop = 0;
                if (novoEstadoTop === "ativo") {
                    const qTop = query(collection(db, "Local"), where("userId", "==", uid), where("Top.estado", "==", "ativo"));
                    const snapTop = await getDocs(qTop);
                    novaOrdemTop = snapTop.size + 1;
                }

                await updateDoc(doc(db, "Local", itemAtual.id), { 
                    "Top": { estado: novoEstadoTop, ordem: novaOrdemTop } 
                });

                // Atualizar Memória e UI
                itemAtual.dados.Top = { estado: novoEstadoTop, ordem: novaOrdemTop };
                btnTop.classList.toggle('pin-ativo', novoEstadoTop === "ativo");
                
                console.log("✅ [LOCAL-TOP] Estado TOP atualizado.");
            } catch (err) { console.error(err); }

            btnTop.innerHTML = '<i class="fa-solid fa-up-long"></i> <span style="font-size: 9px;">TOP</span>';
            btnTop.style.pointerEvents = "auto";
        };

        // ========================================================
        // 8. ACÇÕES DE MOVIMENTAÇÃO E ORDENAÇÃO
        // ========================================================
        document.getElementById('btn-gestao-mover').onclick = (e) => {
            e.stopPropagation();
            overlay.classList.remove('active');
            iniciarMotorMover(itemAtual.id, itemAtual.tipo); 
        };

        document.getElementById('btn-gestao-ordenar').onclick = (e) => {
            e.stopPropagation();
            overlay.classList.remove('active');
            abrirPopupOrdenacao(itemAtual.dados.pastapai || "root", itemAtual.id);
        };

        // ========================================================
        // 9. BOTÃO GRAVAR (NOME E ÍCONE)
        // ========================================================
        document.getElementById('btn-salvar-gestao-item').onclick = async (e) => {
            e.stopPropagation();
            const novoNome = inputNome.value.trim();
            if (!novoNome) return;

            const updates = { nome: novoNome };
            if (itemAtual.tipo === 'pasta') updates.icon = itemAtual.dados.icon || "folder";

            try {
                await updateDoc(doc(db, "Local", itemAtual.id), updates);
                overlay.classList.remove('active');
                console.log("✅ [LOCAL-SAVE] Alterações de nome/ícone gravadas.");
            } catch (err) { console.error(err); }
        };

        // ABRIR POPUP FINALMENTE
        overlay.classList.add('active');

    } catch (e) { console.error("❌ Erro ao abrir gestão local:", e); }
};


/**
 * 4. HELPER: GESTÃO DA COLECÇÃO ATALHO
 */
async function gerirAtalhoFirebase(db, uid, item, ondeAlvo, acao) {
    const atalhosRef = collection(db, "Atalho");
    
    if (acao === "adicionar") {
        const qOrdem = query(atalhosRef, where("userId", "==", uid));
        const snapOrdem = await getDocs(qOrdem);
        
        await addDoc(atalhosRef, {
            userId: uid, 
            itemId: item.id, // ID da nota original
            nome: item.nome, 
            tipo: item.tipo, 
            onde: ondeAlvo,   // "Local"
            timestamp: serverTimestamp(), 
            ordem: snapOrdem.size + 1
        });
        console.log("🌟 [ATALHO] PIN local adicionado com sucesso.");
    } else {
        const qRem = query(atalhosRef, where("userId", "==", uid), where("itemId", "==", item.id));
        const snapRem = await getDocs(qRem);
        snapRem.forEach(d => deleteDoc(doc(db, "Atalho", d.id)));
        console.log("🗑️ [ATALHO] PIN local removido.");
    }
}

/**
 * Função Auxiliar: Procura e desativa todos os filhos no Local
 */
async function ocultarConteudoRecursivoLocal(db, pastaId, timestamp) {
    // Procuramos tudo o que tem esta pasta como "pastapai"
    const q = query(collection(db, "Local"), where("pastapai", "==", pastaId));
    const snap = await getDocs(q);

    // Criamos uma lista de promessas para processar tudo em paralelo (mais rápido)
    const promessas = snap.docs.map(async (docSnap) => {
        const itemData = docSnap.data();
        const itemRef = docSnap.ref;

        console.log(`  - Ocultando filho: ${itemData.nome} (${docSnap.id})`);

        // A) Desativar o item atual (Nota ou Sub-pasta)
        await updateDoc(itemRef, { 
            estado: "desativa", 
            timedelete: timestamp 
        });

        // B) Se for uma sub-pasta, mergulhar recursivamente
        if (itemData.tipo === "pasta") {
            return ocultarConteudoRecursivoLocal(db, docSnap.id, timestamp);
        }
    });

    return Promise.all(promessas);
}

/**
 * 5. OUVINTE GLOBAL PARA SUB-MENUS (Mover, Ordenar, Ocultar)
 */
document.addEventListener('click', async (e) => {
    // Se não houver nenhum item selecionado para gestão, ignoramos o clique
    if (!itemAtual) return;

    // --- A) ABRIR CONFIRMAÇÃO DE OCULTAÇÃO ---
    if (e.target.closest('#btn-gestao-ocultar')) {
        document.getElementById('popup-gestao-item-overlay').classList.remove('active');
        const popupConfirm = document.getElementById('popup-confirmar-ocultar-item');
        if (popupConfirm) popupConfirm.classList.add('active');
        return;
    }

    // --- B) FECHAR CONFIRMAÇÃO (CANCELAR) ---
    if (e.target.id === 'btn-cancelar-ocultar-final' || e.target.id === 'btn-cancelar-ocultar-item') {
        document.getElementById('popup-confirmar-ocultar-item').classList.remove('active');
        return;
    }

    // --- C) EXECUTAR OCULTAÇÃO DEFINITIVA (CASCATA + REFRESH) ---
    if (e.target.id === 'btn-confirmar-ocultar-final') {
        const db = getFirestore();
        const timestamp = new Date().toISOString();
        const btn = e.target;

        // Feedback visual de carregamento
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A processar...';

        try {
            console.log(`🗑️ [CASCATA] Iniciando ocultação do item: ${itemAtual.id}`);

            // 1. Ocultar o item principal (Pasta ou Nota)
            const docRef = doc(db, "Local", itemAtual.id);
            await updateDoc(docRef, {
                estado: "desativa",
                timedelete: timestamp
            });

            // 2. Se for uma pasta, disparar o motor recursivo para limpar o interior
            if (itemAtual.tipo === "pasta") {
                console.log("📂 Detetada pasta. Limpando sub-itens...");
                await ocultarConteudoRecursivoLocal(db, itemAtual.id, timestamp);
            }

            console.log("✅ Processo concluído. Reiniciando sistema...");

            // 3. FECHAR POPUPS E FAZER REFRESH
            document.querySelectorAll('.popup-overlay').forEach(p => p.classList.remove('active'));
            
            // O refresh garante que o editor central e as listas limpam os dados antigos
            location.reload();

        } catch (err) {
            console.error("❌ Erro crítico na ocultação em cascata:", err);
            alert("Erro ao ocultar itens. Verifica as permissões de administrador.");
            btn.disabled = false;
            btn.innerText = "Sim, Ocultar";
        }
    }
});
