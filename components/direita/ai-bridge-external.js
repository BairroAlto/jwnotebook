// components/direita/ai-bridge-external.js
import { AIController } from './ai-controller.js';

export const AIBridge = {
    iniciarAnaliseFonteExterna: async (texto, referenciaLabel) => {
        console.log("%c🌉 [AI-BRIDGE] Recebendo payload externo...", "color: #fbbf24; font-weight: bold;");

        const dadosVirtuais = {
            id: "externo",
            tipo: "contentor",
            titulo: referenciaLabel,
            conteudo: texto
        };

        console.log("🛠️ [AI-BRIDGE] Caixa virtual criada:", dadosVirtuais);

        // Mudar painel
        if (window.switchPanel) window.switchPanel('xsat');
        
        // Ativar Canal 6
        const btn6 = document.querySelector('.xsat-num[data-num="6"]');
        if (btn6) {
            document.querySelectorAll('.xsat-num').forEach(b => b.classList.remove('active'));
            btn6.classList.add('active');
        }

        // Entregar ao controlador
        AIController.configurarAlvoExterno(dadosVirtuais);
        AIController.abrirProtocolos();
    }
};
