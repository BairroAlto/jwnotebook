// components/bible-portal/bible-anchors.js
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const BibleAnchors = {
    carregarAncoras: async (db, auth) => {
        const container = document.getElementById('bible-anchors-list');
        const uid = auth.currentUser.uid;

        // Regra: Nome tem de ser "Bíblia"
        const q = query(
            collection(db, "Ancora"),
            where("userId", "==", uid),
            where("nome", "==", "Bíblia"),
            where("estado", "==", "on")
        );

        const snap = await getDocs(q);
        container.innerHTML = "";

        if (snap.empty) {
            container.innerHTML = `<p style="color:gray; font-size:12px; text-align:center;">Nenhuma âncora "Bíblia" encontrada.</p>`;
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const btn = document.createElement('div');
            btn.className = "piccard"; 
            btn.style.marginBottom = "8px";
            btn.innerHTML = `<i class="fa-solid fa-anchor"></i> Investigar Temas`;
            
            btn.onclick = () => BibleAnchors.ativarDestaquesDeAncora(db, uid, data.cosmos);
            container.appendChild(btn);
        });
    },

    ativarDestaquesDeAncora: async (db, uid, cosmosIds) => {
        if (!cosmosIds || cosmosIds.length === 0) return;

        // 1. Buscar os nomes dos temas Cosmos associados
        const nomesParaDestacar = [];
        for (const id of cosmosIds) {
            const q = query(collection(db, "Cosmo"), where("userId", "==", uid), where("id", "==", id));
            const s = await getDocs(q);
            if (!s.empty) nomesParaDestacar.push(s.docs[0].data().nome);
        }

        if (nomesParaDestacar.length > 0) {
            BibleAnchors.aplicarHighlighterNoTexto(nomesParaDestacar);
            document.getElementById('popup-anchors-bible').classList.remove('active');
            document.getElementById('btn-limpar-highlights').style.display = 'block';
        }
    },

    aplicarHighlighterNoTexto: (termos) => {
        const feed = document.getElementById('bible-feed');
        if (!feed) return;

        // Limpar destaques anteriores antes de aplicar novos
        BibleAnchors.limparHighlighter();

        let html = feed.innerHTML;
        
        termos.forEach(termo => {
            // Regex para encontrar a palavra exata, ignorando maiúsculas/minúsculas
            const regex = new RegExp(`\\b(${termo})\\b`, 'gi');
            html = html.replace(regex, `<mark class="anchor-highlight">$1</mark>`);
        });

        feed.innerHTML = html;
    },

    limparHighlighter: () => {
        const feed = document.getElementById('bible-feed');
        if (!feed) return;
        
        // Remove as tags <mark> mantendo o texto
        feed.innerHTML = feed.innerHTML.replace(/<mark class="anchor-highlight">(.*?)<\/mark>/g, '$1');
        document.getElementById('btn-limpar-highlights').style.display = 'none';
    }
};