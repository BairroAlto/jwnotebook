// components/editor/modulos/event-manager.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { moverCaixa, prepararInsercao } from './editor-actions.js';
import { abrirPaleta } from './paleta-cores.js';
import { abrirPopupPartilhar } from './partilhar.js';
import { abrirPopupTags } from './tags/tags-controller.js';

export const EventManager = {
    /**
     * INICIALIZADOR DE EVENTOS
     * @param {Object} ctx - Objeto de estado vivo vindo do editor.js (contém dbRef, authRef, caixasAtuais, etc.)
     */
    init: (ctx) => {
        console.log(`🎯 [EVENT-MANAGER] Maestro ativo para: ${ctx.notaAbertaId}`);

        // ========================================================
        // 1. NAVEGAÇÃO DE PAINÉIS (EYE / BRAIN / X-SAT)
        // ========================================================
        window.switchPanel = (p) => {
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            document.querySelectorAll('.segmented-control button').forEach(b => b.classList.remove('active'));
            
            const target = document.getElementById('panel-' + p);
            const btn = document.getElementById('btn-' + p);
            if(target) { target.classList.add('active'); target.style.display = 'flex'; }
            if(btn) btn.classList.add('active');

           if (p === 'xsat') {
                const canalA = document.querySelector('.xsat-num.active');
                if (!canalA || canalA.dataset.num === "6") {
                    const b6 = document.querySelector('.xsat-num[data-num="6"]');
                    if (b6) b6.classList.add('active');
                    // Força a IA a ler os dados da nota atual respeitando o modo
                    import('../../direita/ai-controller.js').then(m => {
                        m.AIController.renderizarLista(null, ctx.dadosNotaOriginal);
                        });
                }
            }
            if (p === 'brain' && !document.querySelector('.cosmos-brain-wrapper')) {
                if (typeof window.mostrarBrainIdle === 'function') window.mostrarBrainIdle();
            }
            if (window.innerWidth <= 768) {
                import('../../ui/mobile-bottom-sheet.js').then(m => m.MobileBottomSheet.abrir());
            }
        };

        // ========================================================
        // 2. NAVEGAÇÃO INTERNA DO "EYE" (COM FILTRO DE EXCLUSIVIDADE)
        // ========================================================
        window.switchEyeTab = (t) => {
            const ids = ['indice-nota-container', 'textos-container', 'ancora-nota-container', 'fontes-nota-container', 'caixas-associadas-container'];
            ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            document.querySelectorAll('#sub-tabs-eye i').forEach(i => i.classList.remove('active'));

            const modos = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
            const isSentinela = modos.includes('sentinela');
            
            // 🚀 FILTRO RIGOROSO: A direita só vê o que o modo permite
            const flt = ctx.caixasAtuais.filter(c => {
                if (c.estado !== 'on') return false;
                return isSentinela ? !!c.referenciacodex : !c.referenciacodex;
            });

            const map = { 'indice':'indice-nota-container', 'textos':'textos-container', 'ancora':'ancora-nota-container', 'fontes':'fontes-nota-container', 'caixas':'caixas-associadas-container' }[t];
            const target = document.getElementById(map);
            if (target) { target.style.display = 'flex'; target.style.flexDirection = 'column'; }
            document.getElementById(`btn-tab-${t}`)?.classList.add('active');

            if (t === 'textos') import('../../direita/eye-textos-biblia.js').then(m => m.detectarEExibirTextosBiblicos(flt));
            if (t === 'fontes') import('../../direita/eye-fontes-nota.js').then(m => m.carregarFontesGlobaisDaNota(flt));
            if (t === 'indice') import('../../direita/indice.js').then(m => m.renderizarIndice(flt, modos.includes('post')));
            if (t === 'ancora') {import('../../direita/eye-ancora.js').then(m => m.iniciarAbaAncora(ctx.notaAbertaId, ctx.dbRef, ctx.authRef) );
}
        };

        // ========================================================
        // 3. LABORATÓRIO (MODOS E FERRAMENTAS)
        // ========================================================
        window.alterarModoNota = async (m) => {
            if (ctx.dadosNotaOriginal.onde === "share" && m === "sentinela") {
        console.warn("🚫 [SISTEMA] Notas partilhadas não suportam o Modo Sentinela.");
        return; 
    }
            if (!ctx.notaAbertaId || !ctx.dbRef) return;

            // A) TRATAMENTO DA PESQUISA GLOBAL (FERRAMENTA ÚNICA)
            if (m === 'global') {
                const caixasVivas = ctx.caixasAtuais.filter(c => c.estado === 'on');
                const textoFull = caixasVivas.map(c => `${c.titulo || ""} ${c.conteudo || ""}`).join(" [BLOCK] ");
                if (textoFull) window.dispararPesquisaParabolica(textoFull, true);
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
                return; 
            }

            // B) LÓGICA DE EXCLUSIVIDADE DE MODOS
            let atual = Array.isArray(ctx.dadosNotaOriginal.modo) ? [...ctx.dadosNotaOriginal.modo] : [ctx.dadosNotaOriginal.modo || 'normal'];
            let novos = [];

            if (m === 'normal' || m === 'sentinela') {
                novos = [m]; // Estes modos limpam tudo o resto
            } else {
                // Post e Arquivo limpam Normal e Sentinela
                novos = atual.filter(x => x !== 'normal' && x !== 'sentinela');
                if (novos.includes(m)) novos = novos.filter(x => x !== m);
                else novos.push(m);
            }
            if (novos.length === 0) novos = ['normal'];

            // UI Feedback
            ctx.dadosNotaOriginal.modo = novos;
            document.querySelectorAll('.lab-item').forEach(c => c.classList.toggle('active', novos.includes(c.dataset.mode)));
            import('./lab-status.js').then(mod => mod.atualizarIconeLab(novos));
            
            const nexoSec = document.getElementById('lab-nexo-section');
            if (nexoSec) nexoSec.style.display = novos.includes('sentinela') ? 'none' : 'block';

            // C) LÓGICA MODO SENTINELA (BROWSER + DUPLICADOS)
            if (m === 'sentinela' && !ctx.caixasAtuais.some(c => c.referenciacodex)) {
                import('./sentinela-browser.js').then(sb => sb.SentinelaBrowser.abrir(async (json, idx) => {
                    const artigo = json.artigos[idx];
                    const uid = ctx.authRef.currentUser.uid;

                    const { SentinelaManager } = await import('./sentinela-manager.js');
const notaDuplicadaId = await SentinelaManager.verificarSeJaExiste(ctx.dbRef, ctx.authRef.currentUser.uid, artigo.referencia);

                    if (notaDuplicadaId) {
                        const { mostrarAviso } = await import('./tags/tags-utils.js');
                        mostrarAviso(`Já existe uma nota para este estudo! Verifica a tua lista ou a reciclagem.`);
                        // Reset para normal
                        ctx.dadosNotaOriginal.modo = ['normal'];
                        await updateDoc(doc(ctx.dbRef, "Local", ctx.notaAbertaId), { modo: ['normal'] });
                        await ctx.atualizarFeedEGravar(false);
                        return;
                    }

                    SentinelaManager.configurarNota(json, idx, { db: ctx.dbRef, auth: ctx.authRef, caixasAtuais: ctx.caixasAtuais, notaId: ctx.notaAbertaId });
                }));
            }

            // D) PERSISTIR E REDESENHAR
            try {
                const col = (ctx.dadosNotaOriginal.onde === "share") ? "Share" : "Local";
                await updateDoc(doc(ctx.dbRef, col, ctx.notaAbertaId), { modo: novos });
                await ctx.atualizarFeedEGravar(false);
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
            } catch (e) { console.error("Erro ao mudar modo:", e); }
        };

        // ========================================================
        // 4. PONTES GLOBAIS E HEADER
        // ========================================================
       document.getElementById('btn-editor-lab').onclick = () => {
    // 1. Verificar se a nota atual é do tipo Share
    const isNotaShare = ctx.dadosNotaOriginal.onde === "share";
const btnAncora = document.getElementById('btn-tab-ancora');
if (btnAncora) {
    // Se for nota partilhada, o utilizador não pode ancorar temas pessoais nela
    btnAncora.style.display = isNotaShare ? 'none' : 'flex';
}

    // 2. Localizar o item do Modo Sentinela no HTML do popup
    const itemSentinela = document.querySelector('.lab-item[data-mode="sentinela"]');

    // 3. Ocultar se for Share, mostrar se for Local
    if (itemSentinela) {
        itemSentinela.style.display = isNotaShare ? 'none' : 'flex';
    }

    // --- Lógica que já tinhas para ativar os botões ---
    const m = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
    document.querySelectorAll('.lab-item').forEach(card => card.classList.toggle('active', m.includes(card.dataset.mode)));
    
    const nexoSec = document.getElementById('lab-nexo-section');
    if (nexoSec) nexoSec.style.display = m.includes('sentinela') ? 'none' : 'block';
    
    document.getElementById('popup-lab-overlay')?.classList.add('active');
};

        document.getElementById('btn-abrir-browser').onclick = () => {
            import('./browser.js').then(m => {
                m.iniciarSistemaBrowser(ctx.dbRef, ctx.authRef);
                m.abrirPopupEscolha();
            });
        };

        document.getElementById('btn-editor-tags').onclick = () => {
            if (ctx.dadosNotaOriginal.onde !== "share") {
                import('./tags/tags-controller.js').then(m => m.abrirPopupTagsNota(ctx.notaAbertaId, ctx.dbRef, ctx.authRef));
            }
        };

        document.getElementById('btn-editor-restaurar').onclick = () => {
            import('./recuperacao.js').then(m => m.abrirCentroRecuperacao(ctx.caixasAtuais, ctx.dadosNotaOriginal, ctx.notaAbertaId, ctx.atualizarFeedEGravar, ctx.dbRef, ctx.authRef));
        };

        // Lixeira
        window.prepararOcultarGlobal = (caixa) => {
            window.caixaParaOcultar = caixa; 
            document.getElementById('popup-confirmar-overlay')?.classList.add('active');
        };

const btnCancelarOcultar = document.getElementById('btn-cancelar-ocultar');
        if (btnCancelarOcultar) {
            btnCancelarOcultar.onclick = () => {
                document.getElementById('popup-confirmar-overlay').classList.remove('active');
            };
        }

        document.getElementById('btn-confirmar-ocultar').onclick = async () => {
            if (window.caixaParaOcultar) {
                const c = window.caixaParaOcultar;
                c.estado = "off";
                c.timedelete = new Date().toISOString();
                if (c.referenciacodex) {
                    const { SentinelaManager } = await import('./sentinela-manager.js');
                    SentinelaManager.sincronizarParaBiblioteca(c, ctx.dbRef, ctx.authRef.currentUser.uid);
                }
                document.getElementById('popup-confirmar-overlay').classList.remove('active');
                await ctx.atualizarFeedEGravar();
            }
        };

              // ========================================================
        // 🚀 PONTES PARA FERRAMENTAS ESPECIAIS (LUPAS)
        // ========================================================

        // 1. CITAÇÃO BÍBLICA
        window.abrirSeletorBibliaGlobal = (caixa) => {
            console.log("📖 [EVENT] Abrindo seletor bíblico para a caixa.");
            import('./biblia-selector.js').then(m => {
                m.abrirSelector(caixa);
            });
        };

        // 2. WEBCARD (LINKS VISUAIS)
        window.abrirWebCardConfigGlobal = (caixa) => {
            console.log("🌐 [EVENT] Abrindo configurador de WebCards.");
            import('./webcard-service.js').then(async m => {
                const urls = await m.WebCardService.abrirConfigurador(caixa);
                if (urls) {
                    // Se o utilizador confirmou as URLs, o sistema processa os metadados
                    const elementoFisico = document.getElementById(`bloco-${caixa.id}`);
                    if (elementoFisico && elementoFisico.processarLinks) {
                        await elementoFisico.processarLinks(urls);
                        ctx.atualizarFeedEGravar(true);
                    }
                }
            });
        };

        // 3. IMAGENS (GALERIA ROSA)
        window.abrirImagensConfigGlobal = (caixa) => {
            console.log("📸 [EVENT] Abrindo configurador de Galeria.");
            import('./imagens-service.js').then(async m => {
                const dados = await m.ImagensService.abrirConfigurador(caixa);
                if (dados) {
                    caixa.links = dados.links;
                    caixa.urldimensao = dados.urldimensao;
                    
                    // Atualiza a visualização da galeria sem recarregar a nota toda
                    const el = document.getElementById(`bloco-${caixa.id}`);
                    if (el && el.refreshGaleria) el.refreshGaleria();
                    
                    ctx.atualizarFeedEGravar(true);
                }
            });
        };

      // ========================================================
        // 🛠️ PONTES GLOBAIS EXISTENTES (HEADER E ACTIONS)
        // ========================================================
        window.inserirFerramentaNoEditor = (tipo) => ctx.inserirFerramentaNoEditor(tipo);
        window.abrirFerramentasDoNexo = () => {
            document.getElementById('popup-lab-overlay')?.classList.remove('active');
            window.idReferenciaInsercao = null; 
            document.getElementById('popup-ferramentas-inline')?.classList.add('active');
        };
        window.acionarGravacaoGlobal = (caixa) => ctx.acionarGravacao(caixa);
        window.abrirPaletaGlobal = (caixa) => abrirPaleta(caixa);
        window.prepararInsercaoGlobal = (id) => prepararInsercao(id);
        window.abrirPopupPartilharGlobal = (caixa, id) => abrirPopupPartilhar(caixa, id || ctx.notaAbertaId, ctx.atualizarFeedEGravar);
        window.moverCaixaGlobal = (c, d) => moverCaixa(ctx.caixasAtuais, c, d, ctx.dadosNotaOriginal.modo.includes('post'), ctx.atualizarFeedEGravar);
        
        window.abrirPopupTagsGlobal = (caixa, id) => {
            const origem = ctx.dadosNotaOriginal.onde || "local";
            abrirPopupTags(caixa, id || ctx.notaAbertaId, origem);
        };

        const tit = document.getElementById('editor-titulo');
        if (tit) tit.oninput = () => ctx.acionarGravacao();
    }
};
