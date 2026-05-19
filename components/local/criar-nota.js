// components/local/criar-nota.js
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor, forcarGravacaoImediata } from '../editor/editor.js';

/**
 * Inicializa a lógica do botão de criar nota.
 */
export function inicializarCriacaoNota(db, auth) {
    const btnCriarNota = document.getElementById('btn-criar-nota');
    const popupOpcoes = document.getElementById('popup-criar-overlay'); 

    if (btnCriarNota) {
        btnCriarNota.addEventListener('click', async () => {
            if (!auth.currentUser) return alert("Precisas de estar logado!");

            try {
                // 1. Gravar nota anterior se estiver aberta
                await forcarGravacaoImediata();

                btnCriarNota.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> A criar...`;
                btnCriarNota.style.pointerEvents = "none";
                
                const userId = auth.currentUser.uid;
                const pastapai = window.pastaAtual || "root"; 
                const localRef = collection(db, "Local");
                
                // Determinar ordem
                const q = query(localRef, where("pastapai", "==", pastapai), where("userId", "==", userId));
                const querySnapshot = await getDocs(q);
                const ordem = querySnapshot.size + 1; 

                const idNotaUnico = crypto.randomUUID();
                const idBlocoInicial = crypto.randomUUID();

                // --- OBJETO DE DADOS DA NOTA ---
                const dadosNovaNota = {
                    id: idNotaUnico,
                    userId: userId,
                    tipo: "nota",
                    modo: "normal", // <--- NOVO CAMPO ADICIONADO AQUI
                    estado: "on",
                    nome: "Nova Nota " + ordem,
                    pastapai: pastapai,
                    ordem: ordem,
                    browser: [], // Lista de abas vazia
                  caixas: [
        {
            id: idBlocoInicial,
            tipo: "contentor",
            conteudo: "",
            timestamp: new Date().toISOString(),
            protecao: "fechado",
            estado: "on",
            foco: "original",
            // origem: removido. Só será adicionado quando a caixa for copiada.
            ordem: 1
        }
    ]
};

                // 2. Gravar no Firestore
                const docRef = await addDoc(localRef, {
                    ...dadosNovaNota,
                    timestamp: serverTimestamp() 
                });

                // 3. ABRIR NO EDITOR IMEDIATAMENTE
                await abrirNotaNoEditor(docRef.id, dadosNovaNota, db, auth);

                if (window.innerWidth <= 768) {
    document.getElementById('area-esquerda').classList.add('closed');
    document.getElementById('mobile-overlay').classList.remove('active');
}

                // 4. Limpar UI do Popup
                if(popupOpcoes) popupOpcoes.classList.remove('active');
                btnCriarNota.innerHTML = `<i class="fa-solid fa-note-sticky" style="color: #6366f1;"></i> Criar Nota`;
                btnCriarNota.style.pointerEvents = "auto";

            } catch (error) {
                console.error("Erro ao criar:", error);
                btnCriarNota.style.pointerEvents = "auto";
                btnCriarNota.innerHTML = `<i class="fa-solid fa-note-sticky" style="color: #6366f1;"></i> Criar Nota`;
            }
        });
    }
}