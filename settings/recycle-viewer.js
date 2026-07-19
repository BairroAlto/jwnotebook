// components/settings/recycle-viewer.js

export const RecycleViewer = {
    abrir: (item) => {
        console.log("🔎 [VIEWER] Abrindo item:", item);
        const overlay = document.getElementById('popup-recycle-viewer-overlay');
        const titEl = document.getElementById('recycle-viewer-title');
        const bodyEl = document.getElementById('recycle-viewer-body');

        if (!overlay) return;

        titEl.innerText = item.dados.nome || item.dados.titulo || "Visualizar Conteúdo";

        let htmlConteudo = "";
        if (item.tipoItem === 'nota') {
            const caixas = item.dados.caixas || [];
            htmlConteudo = caixas.map(c => `
                <div style="margin-bottom:15px; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <small style="color:var(--primary); font-weight:800; font-size:9px; text-transform:uppercase;">${c.tipo}</small>
                    <p style="font-size:13px; color:white; margin-top:5px; white-space:pre-wrap;">${c.conteudo || "Bloco vazio"}</p>
                </div>
            `).join('');
        } else if (item.tipoItem === 'caixa') {
            htmlConteudo = `<p style="font-size:14px; color:white; line-height:1.6; white-space:pre-wrap;">${item.dados.conteudo || "Sem texto."}</p>`;
        } else if (item.tipoItem === 'mica') {
            const itensMica = item.dados.caixas || [];
            htmlConteudo = `
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Esta pasta contém ${itensMica.length} referências:</p>
                <ul style="list-style:none; padding:0;">
                    ${itensMica.map(id => `<li style="padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px; color:white;">• ${id}</li>`).join('')}
                </ul>`;
        }

        bodyEl.innerHTML = htmlConteudo || "Sem conteúdo para exibir.";
        overlay.classList.add('active');
    },
    fechar: () => {
        document.getElementById('popup-recycle-viewer-overlay').classList.remove('active');
    }
};

window.RecycleViewer = RecycleViewer; // Garante acesso global
console.log("👁️ [SYSTEM] RecycleViewer carregado.");