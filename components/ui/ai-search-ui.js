// components/ui/ai-search-ui.js
import { AISearchEngine } from "../direita/ai-search-engine.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from "../editor/editor.js";

export const SearchUI = {
    abrir: () => {
        const overlay = document.getElementById('popup-search-overlay');
        if (!overlay) return;
        
        overlay.classList.add('active');
        const input = document.getElementById('input-global-search');
        const btnExecutar = document.getElementById('btn-executar-busca');

        input.value = "";
        input.focus();

        // Limpar status
        document.getElementById('search-status-text').innerHTML = "O Nexo vai analisar o significado das tuas notas.";
        document.getElementById('search-status-text').style.color = "var(--text-muted)";

        // ATRIBUIR O CLIQUE AO BOTÃO (O que faltava!)
        btnExecutar.onclick = () => SearchUI.executar();
    },

    fechar: () => {
        document.getElementById('popup-search-overlay').classList.remove('active');
    },

    executar: async () => {
        const input = document.getElementById('input-global-search');
        const status = document.getElementById('search-status-text');
        const btn = document.getElementById('btn-executar-busca');
        const query = input.value.trim();

        if (!query) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A PENSAR...';
        status.innerHTML = `<span style="color:var(--primary)">O Nexo está a consultar os baldes de memória...</span>`;

        try {
            const userId = window.auth.currentUser.uid;
            // Chama o motor que lê os Shards e envia para o DeepSeek
            const idEncontrado = await AISearchEngine.procurar(query, window.db, userId);

            if (idEncontrado && idEncontrado !== "NULL" && idEncontrado !== "ERROR") {
                status.innerHTML = `<b style="color:#22c55e;">✅ CONEXÃO ENCONTRADA!</b><br>Abrindo nota...`;
                
                const noteSnap = await getDoc(doc(window.db, "Local", idEncontrado));
                if (noteSnap.exists()) {
                    setTimeout(() => {
                        SearchUI.fechar();
                        abrirNotaNoEditor(idEncontrado, noteSnap.data(), window.db, window.auth);
                    }, 600);
                }
            } else {
                status.innerHTML = `<span style="color:#f87171;">❌ Não encontrei correlações.</span><br>Tenta mudar os termos da busca.`;
            }
        } catch (e) {
            console.error(e);
            status.innerText = "Erro na ligação ao satélite.";
        } finally {
            btn.disabled = false;
            btn.innerHTML = "PERGUNTAR AO NEXO";
        }
    }
};

window.SearchUI = SearchUI;
