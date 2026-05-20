// components/biblioteca-brain/biblio-transmitter.js

export async function transmitirParaEditorVivo(camposNovos, estudoMestre) {
    if (!window.caixasAtuais) return;

    // 1. Localizar a caixa na Memória RAM
    const caixaNoEditor = window.caixasAtuais.find(c => 
        c.referenciacodex && 
        c.referenciacodex[0] === estudoMestre.referencia && 
        String(c.referenciacodex[1]) === String(estudoMestre.sequencia)
    );

    if (caixaNoEditor) {
        // Atualizar Memória
        Object.assign(caixaNoEditor, camposNovos);

        const elementoAntigo = document.getElementById(`bloco-${caixaNoEditor.id}`);
        if (!elementoAntigo) return;

        // 2. MUDANÇA ESTRUTURAL (Tipo ou Foco) -> Substituição de Elemento
        if (camposNovos.tipo || camposNovos.foco) {
            console.log("🛠️ [TRANSMITTER] Mudança estrutural: Reconstruindo caixa.");
            
            const mapa = { questao: 'questao.js', subnota: 'subnota.js', contentor: 'contentor.js', raciocinio: 'raciocinio.js' };
            const m = await import(`../editor/ferramentas/${mapa[caixaNoEditor.tipo] || 'contentor.js'}`);
            
            const args = [caixaNoEditor, window.acionarGravacaoGlobal, window.prepararOcultarGlobal, window.abrirPaletaGlobal, window.abrirPopupPartilharGlobal, window.moverCaixaGlobal, window.abrirPopupTagsGlobal, window.prepararInsercaoGlobal];

            let novoEl;
            if (caixaNoEditor.tipo === 'questao') novoEl = m.criarQuestaoVerde(...args);
            else if (caixaNoEditor.tipo === 'subnota') novoEl = m.criarSubNotaAzul(...args);
            else if (caixaNoEditor.tipo === 'raciocinio') novoEl = m.criarRaciocinioAmarelo(caixaNoEditor, 1, ...args);
            else novoEl = m.criarContentorLaranja(...args);

            novoEl.id = `bloco-${caixaNoEditor.id}`;
            elementoAntigo.replaceWith(novoEl); // 🚀 SUBSTITUIÇÃO CIRÚRGICA

        } else {
            // 3. MUDANÇA VISUAL (Destaques ou Conteúdo) -> Manipulação Direta
            const txt = elementoAntigo.querySelector('textarea:not(.tool-title-input)');
            if (txt) {
                if (camposNovos.conteudo !== undefined) txt.value = camposNovos.conteudo;
                if (camposNovos.destaques !== undefined) {
                    txt.style.backgroundColor = camposNovos.destaques || "transparent";
                    txt.style.color = camposNovos.destaques ? "#000" : "white";
                }
            }
        }
        
        // Ajustar altura apenas desta caixa
        import('../editor/modulos/ui-utils.js').then(mod => mod.EditorUI.forçarAjusteAlturas());
    }
}

export function transmitirParaBrainVivo(caixaEditada) {
    if (!caixaEditada.referenciacodex) return;

    const refEditor = `${caixaEditada.referenciacodex[0]}|${caixaEditada.referenciacodex[1]}`;
    if (window._brainRefAtiva !== refEditor) return;

    const brainBox = document.querySelector('.brain-box-item');
    if (brainBox) {
        // 1. MAPA COMPLETO DE CORES POR FOCO
        const mapaCoresFocos = {
            subnota: { original: '#3b82f6', perola: '#0032FD', estudo: '#4169E1', resumo: '#1a3a5f', palestra: '#5c6bc0', ponto_chave: '#85C1E9' },
            questao: { original: '#10b981', paradoxo: '#82e0aa', dilema: '#D1E491', hipotese: '#607455', revisao: '#2B4B44' },
            raciocinio: { original: '#f59e0b', socratico: '#FFD155' },
            contentor: { original: '#ea580c', comentario: '#F86B44', transcricao: '#f97316', reflexao: '#C23515', desafio: '#9a3412', rascunho: '#573516', exemplo: '#854d0e' }
        };

        const fKey = caixaEditada.foco || "original";
        const corBase = mapaCoresFocos[caixaEditada.tipo]?.[fKey] || '#6366f1';
        
        // 2. ATUALIZAR BORDA E CABEÇALHO
        brainBox.style.borderColor = `${corBase}4D`;
        const header = brainBox.querySelector('div[style*="display: flex"]');
        if (header) header.style.background = `${corBase}33`;
        
        // 3. ATUALIZAR O TEXTO DA LABEL (Ex: SUBNOTA -> PÉROLA)
        const label = header ? header.querySelector('div') : null;
        if (label) {
            label.innerText = fKey === "original" ? caixaEditada.tipo.toUpperCase() : fKey.toUpperCase().replace('_', ' ');
            label.style.color = corBase;
        }

        // 4. ATUALIZAR CORES DE FUNDO (DESTAQUES)
        const areaConteudo = brainBox.querySelector('div[style*="padding: 20px"]');
        if (areaConteudo) {
            areaConteudo.style.backgroundColor = caixaEditada.destaques || "transparent";
            const corTexto = caixaEditada.destaques ? "#000" : "white";
            const brainTxt = document.getElementById('txt-especial');
            const brainTit = document.getElementById('tit-especial');
            if (brainTxt) brainTxt.style.color = corTexto;
            if (brainTit) brainTit.style.color = corTexto;
        }
    }
}