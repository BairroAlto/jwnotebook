// components/editor/ferramentas/elevador.js



/**
 * Fábrica do Elevador de Referências (Vermelho com hierarquia de links)
 */
export function criarElevadorVermelho(caixa, onTextoAlterado, onApagar, onPaleta, onPartilhar, onMover, onTags, onAddAbaixo) {
    const caixaDiv = document.createElement("div");
      const meuUid = window.authInstance?.currentUser?.uid;
    const estaBloqueadoPorOutro = caixa.bloqueio && caixa.bloqueio.userId !== meuUid;
    const isShare = (window.dadosNotaOriginal && window.dadosNotaOriginal.onde === "share");

    if (isShare && estaBloqueadoPorOutro) {
        caixaDiv.style.opacity = "0.5";
        caixaDiv.style.pointerEvents = "none"; // Desativa todos os inputs e botões de uma vez
        // Adiciona o aviso visual
        const aviso = document.createElement('div');
        aviso.style.cssText = "font-size:9px; color: #ef4444; padding: 8px; font-weight:800; text-transform:uppercase; background: rgba(0,0,0,0.2);";
        aviso.innerHTML = `<i class="fa-solid fa-lock"></i> EM EDIÇÃO POR: ${caixa.bloqueio.userName}`;
        caixaDiv.prepend(aviso);
    }
    const corVermelha = "#ef4444";

    caixaDiv.style.cssText = `
        background-color: rgba(239, 68, 68, 0.05); border: 1px solid ${corVermelha}; 
        border-radius: var(--radius-md); overflow: hidden; margin-bottom: 15px; transition: 0.2s;
    `;

    // Glow no Hover
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 4px 20px ${corVermelha}4D`;
        caixaDiv.style.transform = "translateY(-1px)";
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
    };

    // --- 1. TOOLBAR SUPERIOR ---
    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: rgba(239, 68, 68, 0.2); color: #fecaca;`;
    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity:0.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity:0.7;"></i>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color: #34d399; font-size: 15px;"></i>
            <i class="fa-solid fa-folder-plus btn-add-pai" title="Adicionar Barra Pai" style="cursor:pointer; color: ${corVermelha}; font-size: 16px; margin-left:5px;"></i>
        </div>
        <div style="display: flex; gap: 16px; font-size: 13px; align-items: center; opacity: 0.8;">
            <i class="fa-solid fa-tag btn-tag" title="Tópicos" style="cursor:pointer;"></i>
            <i class="fa-solid fa-paper-plane btn-partilhar" title="Partilhar" style="cursor:pointer;"></i>
            <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer;"></i>
        </div>
    `;

    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);
    header.querySelector('.btn-partilhar').onclick = () => onPartilhar(caixa);
    header.querySelector('.btn-tag').onclick = () => onTags(caixa);

    header.querySelector('.btn-add-pai').onclick = () => {
        if(!caixa.pastapai) caixa.pastapai = [];
        caixa.pastapai.push({ id: crypto.randomUUID(), nome: "", oculto: false, links: [], pastafilho: [] });
        renderizarEstrutura();
        onTextoAlterado();
    };

    const corpo = document.createElement("div");
    corpo.style.padding = "10px";

    // --- 2. RENDERIZAÇÃO DA ESTRUTURA (BARRAS PAI E FILHOS) ---
    function renderizarEstrutura() {
        corpo.innerHTML = "";
        if(!caixa.pastapai) return;

        caixa.pastapai.forEach((pai) => {
            const paiDiv = document.createElement("div");
            paiDiv.style.cssText = "margin-bottom: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); overflow: hidden; border: 1px solid rgba(239,68,68,0.2);";

            // LINHA DA BARRA PAI
            const linhaPai = document.createElement("div");
            linhaPai.style.cssText = "display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(239,68,68,0.1);";
            
            // TITULO DA BARRA PAI (MUDADO PARA TEXTAREA)
            const inputPaiNome = document.createElement("textarea");
            inputPaiNome.className = "tool-title-input";
            inputPaiNome.value = pai.nome;
            if (isShare && !estaBloqueadoPorOutro) {
    inputPaiNome.onfocus = () => window.definirBloqueioCaixa(caixa.id, true);
    inputPaiNome.onblur = () => window.definirBloqueioCaixa(caixa.id, false);
}
            inputPaiNome.placeholder = "Nome da Barra Pai...";
            inputPaiNome.rows = 1;
            inputPaiNome.style.cssText = `
                flex:1; background:transparent; border:none; color:white; 
                font-size: var(--fs-editor-titulo-ferramentas); font-weight:700; 
                outline:none; resize:none; overflow:hidden; font-family:inherit; line-height:1.3;
            `;

            const ajustarAlturaPai = () => {
                inputPaiNome.style.height = 'auto';
                inputPaiNome.style.height = inputPaiNome.scrollHeight + 'px';
            };
            inputPaiNome.oninput = () => { ajustarAlturaPai(); pai.nome = inputPaiNome.value; onTextoAlterado(caixa); };

            const controlesPai = document.createElement("div");
            controlesPai.style.cssText = "display:flex; gap:12px; font-size:12px; color:rgba(255,255,255,0.5); align-items:center;";
            controlesPai.innerHTML = `
                <i class="fa-solid fa-link add-link" title="Adicionar Hiperligação" style="cursor:pointer;"></i>
                <i class="fa-solid fa-folder-tree add-filho" title="Adicionar Pasta Filho" style="cursor:pointer;"></i>
                <i class="fa-solid ${pai.oculto ? 'fa-eye-slash' : 'fa-eye'} toggle-pai" style="cursor:pointer;"></i>
            `;

            controlesPai.querySelector('.toggle-pai').onclick = () => { pai.oculto = !pai.oculto; renderizarEstrutura(); onTextoAlterado(); };
            controlesPai.querySelector('.add-link').onclick = () => { pai.links.push({ id: crypto.randomUUID(), url: "" }); renderizarEstrutura(); onTextoAlterado(caixa); };
            controlesPai.querySelector('.add-filho').onclick = () => { pai.pastafilho.push({ id: crypto.randomUUID(), nome: "", url: "", oculto: false }); renderizarEstrutura(); onTextoAlterado(); };

            linhaPai.appendChild(inputPaiNome);
            linhaPai.appendChild(controlesPai);
            paiDiv.appendChild(linhaPai);

            // CONTEÚDO EXPANSÍVEL
            if (!pai.oculto) {
                const conteudosDiv = document.createElement("div");
                conteudosDiv.style.padding = "8px 12px";

                // Links Diretos
                pai.links.forEach((link) => {
                    const lDiv = document.createElement("div");
                    lDiv.style.margin = "4px 0";
                    lDiv.innerHTML = `<input type="text" placeholder="Link (URL)..." value="${link.url}" style="width:100%; font-size:11px; color:#60a5fa; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:5px; border-radius:4px; outline:none;">`;
                    lDiv.querySelector('input').oninput = (e) => { link.url = e.target.value; onTextoAlterado(caixa); };
                    conteudosDiv.appendChild(lDiv);
                });

                // Pastas Filho (Cards)
                pai.pastafilho.forEach((filho) => {
                    const fCard = document.createElement("div");
                    fCard.style.cssText = `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-top: 8px; display: ${filho.oculto ? 'none' : 'block'};`;
                    fCard.innerHTML = `
                        <div style="display:flex; gap:8px; margin-bottom:5px;">
                            <input type="text" class="f-nome" placeholder="Nome Filho..." value="${filho.nome}" style="flex:1; font-size:12px; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.1); color:white; outline:none;">
                            <i class="fa-solid fa-eye-slash f-hide" style="cursor:pointer; font-size:11px; opacity:0.5;"></i>
                        </div>
                        <input type="text" class="f-url" placeholder="Link Filho..." value="${filho.url}" style="width:100%; font-size:11px; background:rgba(0,0,0,0.2); border:none; color:#60a5fa; padding:4px; outline:none;">
                    `;
                    fCard.querySelector('.f-nome').oninput = (e) => { filho.nome = e.target.value; onTextoAlterado(caixa); };
                    fCard.querySelector('.f-url').oninput = (e) => { filho.url = e.target.value; onTextoAlterado(); };
                    fCard.querySelector('.f-hide').onclick = () => { filho.oculto = true; renderizarEstrutura(); onTextoAlterado(); };
                    conteudosDiv.appendChild(fCard);
                });

                paiDiv.appendChild(conteudosDiv);
            }

            corpo.appendChild(paiDiv);
            setTimeout(ajustarAlturaPai, 10);
        });
    }

    renderizarEstrutura();
    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    return caixaDiv;
}