// components/biblioteca-brain/biblio-anotacoes.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function render(estudo, container, db) {
    container.innerHTML = `
        <p style="font-size:10px; color:var(--primary); font-weight:800; margin-bottom:10px; text-transform:uppercase;">Anotações de Estudo</p>
        <textarea id="txt-anotacao-biblio" style="width:100%; height:300px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:white; padding:15px; border-radius:8px; outline:none; resize:none; font-size:14px; line-height:1.6;" placeholder="Escreve aqui os teus pontos principais..."></textarea>
    `;

    const area = document.getElementById('txt-anotacao-biblio');
    area.value = estudo.anotacoes || "";

    let timer;
    area.oninput = (e) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            await updateDoc(doc(db, "Biblioteca", estudo.id), { anotacoes: e.target.value });
            console.log("📝 Anotação salva.");
        }, 1000);
    };
}