// components/bible-portal/bible-markers.js
import { collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let unsubMarkers = null;

export const BibleMarkers = {
    iniciar: (db, auth, onJump) => {
        const container = document.getElementById('bible-markers-list');
        const uid = auth.currentUser.uid;

        const q = query(
            collection(db, "Marcador"),
            where("userId", "==", uid),
            where("estado", "==", "on")
        );

        unsubMarkers = onSnapshot(q, async (snapshot) => {
            container.innerHTML = "";

            if (snapshot.empty) {
                container.innerHTML = `<p style="text-align:center; color:gray; padding:20px;">Ainda não tens categorias de marcadores.</p>`;
                return;
            }

            for (const docSnap of snapshot.docs) {
                const cat = docSnap.data();
                const catDiv = document.createElement('div');
                catDiv.className = "marker-category-group";
                catDiv.innerHTML = `
                    <div class="marker-cat-header">
                        <i class="fa-solid fa-folder-open"></i> ${cat.nome}
                    </div>
                    <div class="marker-verses-list" id="cat-list-${docSnap.id}">
                        <small style="opacity:0.5; padding-left:15px;">A carregar versículos...</small>
                    </div>
                `;
                container.appendChild(catDiv);

                // Carregar detalhes dos versículos desta categoria
                BibleMarkers.carregarVersiculosDaCategoria(db, uid, cat.textosbiblia, `cat-list-${docSnap.id}`, onJump);
            }
        });
    },

    carregarVersiculosDaCategoria: async (db, uid, idsArray, elementId, onJump) => {
        const listCont = document.getElementById(elementId);
        if (!idsArray || idsArray.length === 0) {
            listCont.innerHTML = `<p style="font-size:11px; color:gray; padding:5px 15px;">Nenhum versículo aqui.</p>`;
            return;
        }

        // Buscamos os nomes (ex: Jó 1:1) na coleção TextosBiblia
        const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("id", "in", idsArray));
        const snap = await getDocs(q);
        
        listCont.innerHTML = "";
        snap.forEach(vDoc => {
            const vData = vDoc.data();
            const item = document.createElement('div');
            item.className = "marker-verse-item";
            item.innerHTML = `<i class="fa-solid fa-quote-left"></i> ${vData.nome}`;
            item.onclick = () => onJump(vData.livro, vData.capitulo, vData.versiculo);
            listCont.appendChild(item);
        });
    }
};