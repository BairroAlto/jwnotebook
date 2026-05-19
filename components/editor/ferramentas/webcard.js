// components/editor/ferramentas/webcard.js
import { WebCardService } from '../modulos/webcard-service.js';

export function criarWebCardRoxo(caixa, onApagar, onMover, onAddAbaixo, onTextoAlterado) {
    const caixaDiv = document.createElement("div");
    const corRoxo = "#8b5cf6";

    caixaDiv.style.cssText = `
        background-color: rgba(139, 92, 246, 0.03); 
        border: 1px solid ${corRoxo}44; 
        border-radius: 14px; 
        overflow: hidden; 
        margin-bottom: 15px; 
        transition: 0.3s;
        position: relative;
    `;

    // --- EFEITO DE BRILHO (GLOW) ---
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 4px 20px rgba(139, 92, 246, 0.3)`;
        caixaDiv.style.transform = "translateY(-1px)";
        caixaDiv.style.borderColor = corRoxo;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
        caixaDiv.style.borderColor = `${corRoxo}44`;
    };

    // TOOLBAR
    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: rgba(139, 92, 246, 0.2); color: white;`;
    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" style="cursor:pointer; opacity:0.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" style="cursor:pointer; opacity:0.7;"></i>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color: #34d399; font-size: 15px;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar Links" style="cursor:pointer; color: white; font-size: 13px; margin-left: 5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" style="cursor:pointer; opacity: 0.8; font-size: 12px; color: #ef4444;"></i>
    `;

    const corpo = document.createElement("div");
    corpo.style.cssText = "padding: 15px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;";

    const renderLinks = () => {
        if (!caixa.links || caixa.links.length === 0) {
            corpo.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:${corRoxo}; font-size:11px; font-style:italic; padding:10px; opacity:0.6;">Clica na lupa para analisar URLs e gerar cartões...</div>`;
            return;
        }
        corpo.innerHTML = caixa.links.map(link => {
            if (link.loading) {
                return `<div style="background: rgba(255,255,255,0.02); border-radius: 10px; height: 140px; display: flex; align-items: center; justify-content: center; border: 1px dashed ${corRoxo}44;"><i class="fa-solid fa-circle-notch fa-spin" style="color:${corRoxo};"></i></div>`;
            }
            return `
            <a href="${link.url}" target="_blank" style="text-decoration:none; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                <div style="width: 100%; height: 100px; background: #000; overflow:hidden; display: flex; align-items: center; justify-content: center;">
                    <img src="${link.imagem}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://placehold.co/200x100/1e293b/8b5cf6?text=Web'">
                </div>
                <div style="padding: 10px;">
                    <p style="font-size: 11px; color: white; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px;">${link.titulo}</p>
                    <span style="font-size: 9px; color: ${corRoxo}; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">${link.site || 'Ver Site'}</span>
                </div>
            </a>`;
        }).join('');
    };

    const processarLinksEmBackground = async (urls) => {
        caixa.links = urls.map(u => ({ url: u, loading: true }));
        renderLinks();
        const resultados = await Promise.all(urls.map(u => WebCardService.obterMetadados(u)));
        caixa.links = resultados.filter(r => r !== null);
        renderLinks();
        onTextoAlterado(caixa); 
    };

    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    header.querySelector('.btn-lupa').onclick = () => {
        if (typeof window.abrirWebCardConfigGlobal === 'function') {
            window.abrirWebCardConfigGlobal(caixa);
        }
    };

    caixaDiv.processarLinks = processarLinksEmBackground;

    renderLinks();
    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    return caixaDiv;
}