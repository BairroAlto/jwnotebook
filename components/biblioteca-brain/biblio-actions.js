// components/biblioteca-brain/biblio-actions.js
import { updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { transmitirParaEditorVivo } from './biblio-transmitter.js';
import { replicarParaNotaSentinela } from './biblio-persistence.js';

export async function executarMutacaoCores(caixa, docRef, estudoMestre) {
    const { abrirPaleta } = await import('../editor/modulos/paleta-cores.js');

    // 1. FUNÇÃO DE ATUALIZAÇÃO "DUPLO ALVO" (Centro + Direita)
 const onCliqueCorLive = () => {
        const dados = { 
            tipo: caixa.tipo, 
            foco: caixa.foco || "original", 
            destaques: caixa.destaques || "" 
        };

        // A) Mudar o Centro (Nota no Editor)
        transmitirParaEditorVivo(dados, estudoMestre);

        // B) Mudar a Direita (O próprio cabeçalho e fundo do Brain)
        const brainBox = document.querySelector('.brain-box-item');
        if (brainBox) {
            const mapaCoresFocos = {
                subnota: { original: '#3b82f6', perola: '#0032FD', estudo: '#4169E1', resumo: '#1a3a5f', palestra: '#5c6bc0', ponto_chave: '#85C1E9' },
                questao: { original: '#10b981', paradoxo: '#82e0aa', dilema: '#D1E491', hipotese: '#607455', revisao: '#2B4B44' },
                raciocinio: { original: '#f59e0b', socratico: '#FFD155' },
                contentor: { original: '#ea580c', comentario: '#F86B44', transcricao: '#f97316', reflexao: '#C23515', desafio: '#9a3412', rascunho: '#573516', exemplo: '#854d0e' }
            };

            const corBase = mapaCoresFocos[dados.tipo]?.[dados.foco] || '#6366f1';
            
            // 1. Atualizar Borda e Topo
            brainBox.style.borderColor = `${corBase}4D`;
            const header = brainBox.querySelector('div[style*="display: flex"]');
            if (header) header.style.background = `${corBase}33`;
            
            const label = header ? header.querySelector('div') : null;
            if (label) {
                label.innerText = dados.foco === "original" ? dados.tipo.toUpperCase() : dados.foco.toUpperCase().replace('_', ' ');
                label.style.color = corBase;
            }

            // 2. ATUALIZAR FUNDO (DESTAQUES) NO BRAIN - A parte que faltava!
            const areaConteudo = brainBox.querySelector('div[style*="padding: 20px"]');
            if (areaConteudo) {
                areaConteudo.style.backgroundColor = dados.destaques || "transparent";
                
                // Ajustar a cor do texto para legibilidade (Preto se tiver cor, Branco se transparente)
                const corTexto = dados.destaques ? "#000" : "white";
                const brainTxt = document.getElementById('txt-especial');
                const brainTit = document.getElementById('tit-especial');
                if (brainTxt) brainTxt.style.color = corTexto;
                if (brainTit) brainTit.style.color = corTexto;
            }
        }
    };

    // 2. ABRIR A PALETA PASSANDO O CALLBACK TEMPORÁRIO
    // Isto NÃO substitui o callback do editor, apenas o usa para esta sessão.
    abrirPaleta(caixa, "tab-destaques", onCliqueCorLive);

    // 3. GRAVAÇÃO FINAL NO FECHO
    const btnFechar = document.getElementById('btn-fechar-cores');
    if (btnFechar) {
        btnFechar.onclick = async () => {
            console.log("💾 [ACTIONS] Gravando alterações finais na Biblioteca...");
            await updateDoc(docRef, {
                "anotacaoEspecial.tipo": caixa.tipo,
                "anotacaoEspecial.foco": caixa.foco,
                "anotacaoEspecial.destaques": caixa.destaques
            });
            await replicarParaNotaSentinela(window.db, estudoMestre, { 
                tipo: caixa.tipo, foco: caixa.foco, destaques: caixa.destaques 
            });
            document.getElementById('popup-cores-overlay').classList.remove('active');
        };
    }
}

export async function executarApagar(docRef, estudoMestre) {
    if (confirm("Mover para a reciclagem?")) {
        const update = { estado: "off", timedelete: new Date().toISOString() };
        await transmitirParaEditorVivo(update, estudoMestre);
        await updateDoc(docRef, { 
            "anotacaoEspecial.estado": "off", 
            "anotacaoEspecial.timedelete": update.timedelete 
        });
        await replicarParaNotaSentinela(window.db, estudoMestre, update);
    }
}