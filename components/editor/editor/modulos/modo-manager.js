// components/editor/modulos/modo-manager.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { atualizarIconeLab } from './lab-status.js';

export const ModoManager = {
    /**
     * Alterna entre modos de visualização (Normal, Post, Arquivo, etc)
     */
    alternarModo: async (novoModo, ctx) => {
        const { db, notaId, dadosNota, callbackRedraw } = ctx;

        if (!notaId) return;

        // 1. IDENTIFICAR A COLECÇÃO CORRETA (Local vs Share)
        const colecaoAlvo = (dadosNota.onde === "share") ? "Share" : "Local";
        const notaRef = doc(db, colecaoAlvo, notaId);
        
        // 2. OBTER E NORMALIZAR MODOS ATUAIS
        let modosAtuais = Array.isArray(dadosNota.modo) 
            ? [...dadosNota.modo] 
            : [dadosNota.modo || 'normal'];

        // 3. LÓGICA DE TOGGLE (Seleção)
        if (novoModo === 'normal') {
            modosAtuais = ["normal"];
        } else {
            if (modosAtuais.includes(novoModo)) {
                modosAtuais = modosAtuais.filter(m => m !== novoModo);
                if (modosAtuais.length === 0) modosAtuais = ["normal"];
            } else {
                modosAtuais.push(novoModo);
                modosAtuais = modosAtuais.filter(m => m !== 'normal'); // Se ligou algo, remove o 'normal'
            }
        }

        // 4. ATUALIZAÇÃO VISUAL DO POPUP (Feedback imediato)
        const cards = document.querySelectorAll('.lab-item');
        cards.forEach(card => {
            const m = card.getAttribute('data-mode');
            card.classList.toggle('active', modosAtuais.includes(m));
        });

        // 5. ATUALIZAR MEMÓRIA DA NOTA E ÍCONE DO TOPO
        dadosNota.modo = modosAtuais;
        atualizarIconeLab(modosAtuais);
        
        // 6. REDESENHAR O EDITOR (Arquivo vs Feed)
        if (typeof callbackRedraw === 'function') {
            await callbackRedraw();
        }

        // 7. PERSISTIR NO FIREBASE (Coleção dinâmica)
        try {
            await updateDoc(notaRef, { modo: modosAtuais });
            console.log(`🚀 [MODO] Mudança para [${modosAtuais}] gravada em: ${colecaoAlvo}`);
        } catch (e) {
            console.error("Erro ao gravar modo no Firestore:", e);
            alert("Não tens permissão para alterar o modo desta nota.");
        }

        // 🚀 ABRIR EXPLORADOR CODEX: Se ativou o Sentinela e a nota não tem nenhuma caixa vinculada ao Codex
        if (modosAtuais.includes('sentinela')) {
            const caixasVivas = dadosNota.caixas || [];
            const jaTemEstudo = caixasVivas.some(c => c.referenciacodex && c.estado === 'on');
            if (!jaTemEstudo) {
                console.log("📚 [SENTINELA] Sem caixas vinculadas. Abrindo Explorador Codex...");
                
                // Fecha o popup do laboratório para dar espaço ao Codex
                const popupLab = document.getElementById('popup-lab-overlay');
                if (popupLab) popupLab.classList.remove('active');

                // Importa dinamicamente os browsers e inicializa a seleção
                Promise.all([
                    import('./sentinela-browser.js'),
                    import('./sentinela-manager.js')
                ]).then(([browser, manager]) => {
                    browser.SentinelaBrowser.abrir((json, artigoIdx) => {
                        manager.SentinelaManager.configurarNota(json, artigoIdx, ctx);
                    });
                }).catch(err => console.error("Erro ao abrir Explorador Codex:", err));
            }
        }
    }
};