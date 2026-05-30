// components/direita/ai-bridge-external.js
import { AIController } from './ai-controller.js';

/**
 * MOTOR DE TRANSIÇÃO (BRIDGE)
 * Responsável por levar textos de fora (Biblioteca/Bíblia) para a IA
 */
export const AIBridge = {
    
    iniciarAnaliseFonteExterna: async (texto, referenciaLabel) => {
        console.log(`🚀 [AI-BRIDGE] Transportando fonte: ${referenciaLabel}`);

        // 1. Injetar os dados diretamente no controlador de IA
        // Criamos uma "caixa virtual" que o motor de protocolos entenda
        const dadosVirtuais = {
            id: "externo", // ID reservado para fontes bibliográficas
            tipo: "contentor",
            titulo: referenciaLabel,
            conteudo: texto
        };

        // 2. Acionar a mudança de painel global
        if (window.switchPanel) {
            window.switchPanel('xsat');
        }

        // 3. Forçar ativação do Canal 6 (IA) e limpar lógicas de canais de satélite
        const btn6 = document.querySelector('.xsat-num[data-num="6"]');
        if (btn6) {
            document.querySelectorAll('.xsat-num').forEach(b => b.classList.remove('active'));
            btn6.classList.add('active');
            
            // Esconder sub-nav de livros/pubs (inútil para IA)
            const subNav = document.getElementById('xsat-sub-nav');
            if (subNav) subNav.style.display = 'none';
        }

        // 4. Mão-de-ferro no AIController:
        // Definimos o alvo e saltamos o ecrã de listagem de blocos
        import('./ai-controller.js').then(m => {
            // Usamos um método interno para definir o estado sem redesenhar a lista
            m.AIController.configurarAlvoExterno(dadosVirtuais);
            m.AIController.abrirProtocolos();
        });
    }
};

window.AIBridge = AIBridge;
