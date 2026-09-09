// components/biblioteca-brain/biblio-comentarios.js
export function render(estudo, container, db) {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <p style="font-size:10px; color:#fb7185; font-weight:800; text-transform:uppercase; margin:0;">Preparação de Comentário</p>
            <button class="btn-amt" style="width:auto; padding:0 10px; height:24px;">NOVO</button>
        </div>
        <div id="lista-comentarios-biblio" style="display:flex; flex-direction:column; gap:10px;">
            <!-- Renderizar lista de comentários guardados -->
            <p style="color:gray; font-size:11px; text-align:center; padding:20px;">Clica em NOVO para preparar uma resposta.</p>
        </div>
    `;
}