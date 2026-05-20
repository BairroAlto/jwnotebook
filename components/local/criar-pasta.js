import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function inicializarCriacaoPasta(db, auth) {
    const btnAbrir = document.getElementById('btn-abrir-criar-pasta');
    const popupOpcoes = document.getElementById('popup-criar-overlay'); 
    const popupCriar = document.getElementById('popup-nome-pasta-overlay'); 
    
    const btnCancelar = document.getElementById('btn-cancelar-pasta');
    const btnCancelarX = document.getElementById('btn-cancelar-pasta-x');
    const btnConfirmar = document.getElementById('btn-confirmar-pasta');
    const inputNome = document.getElementById('input-nome-pasta');

    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => {
            popupOpcoes.classList.remove('active'); 
            popupCriar.classList.add('active');
            inputNome.focus();
        });
    }

    const fecharPopup = () => {
        popupCriar.classList.remove('active');
        inputNome.value = '';
    };
    if(btnCancelar) btnCancelar.addEventListener('click', fecharPopup);
    if(btnCancelarX) btnCancelarX.addEventListener('click', fecharPopup);

    if(btnConfirmar) {
        btnConfirmar.addEventListener('click', async () => {
            if (btnConfirmar.dataset.modo === "share") return; 
            const nome = inputNome.value.trim();
            if (!nome) return alert("O nome da pasta não pode estar vazio.");
            if (!auth.currentUser) return alert("Tens de estar logado!");

            try {
                btnConfirmar.innerText = "A criar...";
                
                const userId = auth.currentUser.uid;
                const pastapai = window.pastaAtual || "root";
                
                const localRef = collection(db, "Local");
                
                // ========================================================
                // CORREÇÃO AQUI: Agora provamos ao Firestore que só queremos 
                // ler as pastas que nos pertencem (onde o userId é o nosso)
                // ========================================================
                const q = query(
                    localRef, 
                    where("pastapai", "==", pastapai),
                    where("userId", "==", userId) 
                );
                
                const querySnapshot = await getDocs(q);
                const ordem = querySnapshot.size + 1; 

                // Criar o documento
                await addDoc(localRef, {
                    timestamp: serverTimestamp(), 
                    userId: userId, // Grava com o teu ID
                    tipo: "pasta",
                    estado: "on",
                    nome: nome,
                    pastapai: pastapai,
                    ordem: ordem
                });

                fecharPopup();
                btnConfirmar.innerText = "Criar Pasta";

                if (window.innerWidth <= 768) {
                document.getElementById('area-esquerda').classList.add('closed');
                document.getElementById('mobile-overlay').classList.remove('active');
            }
            
            } catch (error) {
                console.error("Erro do Firestore:", error);
                alert("Erro: " + error.message);
                btnConfirmar.innerText = "Criar Pasta";
            }
        });
    }
}