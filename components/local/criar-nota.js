// components/local/criar-nota.js
import { isMobileViewport } from '../ui/mobile-device.js';
import { abrirNotaNoEditor, forcarGravacaoImediata } from '../editor/editor.js';
import { criarNotaLocal } from './criar-nota-service.js';

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
                
                const pastapai = window.pastaAtual || "root";
                const notaCriada = await criarNotaLocal(db, auth, { pastapai });

                // 2. ABRIR NO EDITOR IMEDIATAMENTE
                await abrirNotaNoEditor(notaCriada.id, notaCriada.dados, db, auth);

                if (isMobileViewport()) {
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
