// components/editor/modulos/nota-manager.js
import { processarAberturaNota, configurarBotaoShare } from './nota-viewer.js';
import { gerirSessaoShare } from './share-controller.js';
import { carregarAbasDaNota, iniciarSistemaBrowser } from './browser.js';
import { syncCurrentNoteToggle } from '../../settings/settings.js';

export const NotaManager = {
    abrir: async (ctx, callbacks) => {
        const { notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride } = ctx;
        const { setEstadoGlobal, atualizarFeedEGravar, forcarGravacaoImediata } = callbacks;

        console.log(`📂 [NOTA-MANAGER] Abrindo nota: ${notaId}`);

        await forcarGravacaoImediata();

        // 1. GARANTIR QUE O BROWSER CONHECE O DB E AUTH (Evita a roda infinita)
        iniciarSistemaBrowser(db, auth);

        await processarAberturaNota({
            notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride,
            stateManager: {
                inicializarDadosNota: async (id, dados, maeId) => {
                    
                    // 2. Atualizar estado central
                    setEstadoGlobal({
                        notaAbertaId: id,
                        dadosNotaOriginal: dados,
                        caixasAtuais: dados.caixas || [],
                        notaMaeAtualId: maeId || id,
                        dbRef: db,
                        authRef: auth
                    });

                    window.notaAtualContext = {
                        notaId: id,
                        dadosNota: dados,
                        db,
                        auth
                    };
                    window.dispatchEvent(new Event('nota:aberta'));

                    // 3. CARREGAR ABAS (Agora o dbRef já está pronto)
                    await carregarAbasDaNota(maeId || id, dados, id);

                    // 4. Colaboração
                    await gerirSessaoShare(id, dados);
                    configurarBotaoShare(id, dados, auth);

                    // 5. Renderizar Editor
                    await atualizarFeedEGravar(false);

                    // 6. Abrir Índice
                    const tentarIndice = () => {
                        if (typeof window.switchEyeTab === 'function') window.switchEyeTab('indice');
                        else setTimeout(tentarIndice, 50);
                    };
                    tentarIndice();
                    syncCurrentNoteToggle();

                    return Promise.resolve();
                }
            }
        });
    }
};
