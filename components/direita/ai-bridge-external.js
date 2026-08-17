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

        // O BookAI tem agora um painel próprio, fora do X-SAT.
        if (window.switchPanel) window.switchPanel('bookai');

        // Entregar ao controlador
        AIController.configurarAlvoExterno(dadosVirtuais);
        AIController.abrirProtocolos();
    }
};
