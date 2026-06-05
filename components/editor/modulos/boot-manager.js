// components/editor/modulos/boot-manager.js
import { iniciarShareController } from './share-controller.js';
import { iniciarSelectorBiblia } from './biblia-selector.js';
import { iniciarSistemaRecuperacao } from './recuperacao.js';
import { iniciarSistemaCores } from './paleta-cores.js';
import { iniciarSistemaTags } from './tags/tags-controller.js';
import { iniciarSistemaBrowser } from './browser.js';
import { EventManager } from './event-manager.js';

export const BootManager = {
    motores: async (state, callbacks) => {
        const { dbRef, authRef } = state;
        const { guardarNotaNoFirebase, atualizarFeedEGravar, acionarGravacao, inserirFerramentaNoEditor } = callbacks;

        console.log("⚙️ [BOOT] Iniciando subsistemas...");

        // 1. Reset de flags de Scroll para o Índice funcionar em notas novas
        window._indiceScrollInited = false;

        // 2. Iniciar Controladores
        iniciarShareController(dbRef, authRef, () => guardarNotaNoFirebase());
        iniciarSelectorBiblia(() => atualizarFeedEGravar(true));
        iniciarSistemaRecuperacao(dbRef, authRef); 
        
        if (authRef.currentUser) {
            await iniciarSistemaCores(dbRef, authRef.currentUser, () => atualizarFeedEGravar(true));
        }
        
        iniciarSistemaTags(dbRef, authRef); 
        iniciarSistemaBrowser(dbRef, authRef);

        // 3. Iniciar Maestro de Eventos
        EventManager.init({
            ...state,
            atualizarFeedEGravar,
            acionarGravacao,
            inserirFerramentaNoEditor 
        });

        console.log("🚀 [BOOT] Sistema modular pronto e ScrollSpy ativo.");
    }
};