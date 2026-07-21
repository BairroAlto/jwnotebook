// components/editor/modulos/event-manager.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { moverCaixa, prepararInsercao } from './editor-actions.js';
import { abrirPaleta } from './paleta-cores.js';
import { abrirPopupPartilhar } from './partilhar.js';
import { abrirPopupTags } from './tags/tags-controller.js';
import { MobileBibleBar } from "./mobile-bible-bar.js";
import { abrirPopupImportarTexto } from './importar-texto.js';
function reposicionarTituloMobile(campo) {
    if (window.innerWidth > 768 || !campo) return;

    const estilo = window.getComputedStyle(campo);
    const permiteScrollHorizontal = estilo.whiteSpace === 'nowrap' &&
        (estilo.overflowX === 'auto' || estilo.overflowX === 'scroll');
    if (!permiteScrollHorizontal) return;

    requestAnimationFrame(() => {
        campo.scrollLeft = 0;
    });
}

function iniciarScrollHorizontalDosTitulos() {
    if (window._notebookScrollTitulosMobileIniciado) return;
    window._notebookScrollTitulosMobileIniciado = true;

    document.addEventListener('input', (evento) => {
        const campo = evento.target.closest?.('#editor-titulo, .tool-title-input');
        if (campo) reposicionarTituloMobile(campo);
    });

    document.addEventListener('paste', (evento) => {
        const campo = evento.target.closest?.('#editor-titulo, .tool-title-input');
        if (campo) requestAnimationFrame(() => reposicionarTituloMobile(campo));
    });
}

export const EventManager = {
    /**
     * INICIALIZADOR DE EVENTOS
     * @param {Object} ctx - Objeto de estado vivo vindo do editor.js (contÃƒÆ’Ã‚Â©m dbRef, authRef, caixasAtuais, etc.)
     */
    init: (ctx) => {
        console.log(`ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ [EVENT-MANAGER] Maestro ativo para: ${ctx.notaAbertaId}`);
        try {
            MobileBibleBar.iniciar();
        } catch (erro) {
            console.error('[MOBILE-BIBLE-BAR] Não foi possível iniciar a barra:', erro);
        }
        iniciarScrollHorizontalDosTitulos();

        // ========================================================
        // 1. NAVEGAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE PAINÃƒÆ’Ã¢â‚¬Â°IS (EYE / BRAIN / X-SAT)
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
                    // ForÃƒÆ’Ã‚Â§a a IA a ler os dados da nota atual respeitando o modo
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
        // 2. NAVEGAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O INTERNA DO "EYE" (COM FILTRO DE EXCLUSIVIDADE)
        // ========================================================
        window.switchEyeTab = (t) => {
            const ids = ['indice-nota-container', 'textos-container', 'ancora-nota-container', 'fontes-nota-container', 'caixas-associadas-container'];
            ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            document.querySelectorAll('#sub-tabs-eye i').forEach(i => i.classList.remove('active'));

            const modos = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
            const isSentinela = modos.includes('sentinela');
            
            // ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ FILTRO RIGOROSO: A direita sÃƒÆ’Ã‚Â³ vÃƒÆ’Ã‚Âª o que o modo permite
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
        // 3. LABORATÃƒÆ’Ã¢â‚¬Å“RIO (MODOS E FERRAMENTAS)
        // ========================================================
        window.alterarModoNota = async (m) => {
            if (ctx.dadosNotaOriginal.onde === "share" && m === "sentinela") {
        console.warn("ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â« [SISTEMA] Notas partilhadas nÃƒÆ’Ã‚Â£o suportam o Modo Sentinela.");
        return; 
    }
            if (!ctx.notaAbertaId || !ctx.dbRef) return;

            // A) TRATAMENTO DA PESQUISA GLOBAL (FERRAMENTA ÃƒÆ’Ã…Â¡NICA)
            if (m === 'global') {
                const caixasVivas = ctx.caixasAtuais.filter(c => c.estado === 'on');
                const textoFull = caixasVivas.map(c => `${c.titulo || ""} ${c.conteudo || ""}`).join(" [BLOCK] ");
                if (textoFull) window.dispararPesquisaParabolica(textoFull, true);
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
                return; 
            }


            if (m === 'sumar-global') {
    import('./sumariar-service.js').then(mod => {
        mod.SumariarService.abrirSumarioGlobal();
    });
    document.getElementById('popup-lab-overlay')?.classList.remove('active');
    return;
}

            // B) LÃƒÆ’Ã¢â‚¬Å“GICA DE EXCLUSIVIDADE DE MODOS
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

            // C) LÃƒÆ’Ã¢â‚¬Å“GICA MODO SENTINELA (BROWSER + DUPLICADOS)
            if (m === 'sentinela' && !ctx.caixasAtuais.some(c => c.referenciacodex)) {
                import('./sentinela-browser.js').then(sb => sb.SentinelaBrowser.abrir(async (json, idx) => {
                    const artigo = json.artigos[idx];
                    const uid = ctx.authRef.currentUser.uid;

                    const { SentinelaManager } = await import('./sentinela-manager.js');
const notaDuplicadaId = await SentinelaManager.verificarSeJaExiste(ctx.dbRef, ctx.authRef.currentUser.uid, artigo.referencia);

                    if (notaDuplicadaId) {
                        const { mostrarAviso } = await import('./tags/tags-utils.js');
                        mostrarAviso(`JÃƒÆ’Ã‚Â¡ existe uma nota para este estudo! Verifica a tua lista ou a reciclagem.`);
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
    // 1. Verificar se a nota atual ÃƒÆ’Ã‚Â© do tipo Share
    const isNotaShare = ctx.dadosNotaOriginal.onde === "share";
const btnAncora = document.getElementById('btn-tab-ancora');
if (btnAncora) {
    // Se for nota partilhada, o utilizador nÃƒÆ’Ã‚Â£o pode ancorar temas pessoais nela
    btnAncora.style.display = isNotaShare ? 'none' : 'flex';
}

    // 2. Localizar o item do Modo Sentinela no HTML do popup
    const itemSentinela = document.querySelector('.lab-item[data-mode="sentinela"]');

    // 3. Ocultar se for Share, mostrar se for Local
    if (itemSentinela) {
        itemSentinela.style.display = isNotaShare ? 'none' : 'flex';
    }

    // --- LÃƒÆ’Ã‚Â³gica que jÃƒÆ’Ã‚Â¡ tinhas para ativar os botÃƒÆ’Ã‚Âµes ---
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
        // ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ PONTES PARA FERRAMENTAS ESPECIAIS (LUPAS)
        // ========================================================

        // 1. CITAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O BÃƒÆ’Ã‚ÂBLICA
        window.abrirSeletorBibliaGlobal = (caixa) => {
            console.log("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬â€œ [EVENT] Abrindo seletor bÃƒÆ’Ã‚Â­blico para a caixa.");
            import('./biblia-selector.js').then(m => {
                m.abrirSelector(caixa);
            });
        };

        // 2. WEBCARD (LINKS VISUAIS)
        window.abrirWebCardConfigGlobal = (caixa) => {
            console.log("ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â [EVENT] Abrindo configurador de WebCards.");
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
            console.log("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¸ [EVENT] Abrindo configurador de Galeria.");
            import('./imagens-service.js').then(async m => {
                const dados = await m.ImagensService.abrirConfigurador(caixa);
                if (dados) {
                    caixa.links = dados.links;
                    caixa.urldimensao = dados.urldimensao;
                    
                    // Atualiza a visualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da galeria sem recarregar a nota toda
                    const el = document.getElementById(`bloco-${caixa.id}`);
                    if (el && el.refreshGaleria) el.refreshGaleria();
                    
                    ctx.atualizarFeedEGravar(true);
                }
            });
        };

      // ========================================================
        // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â PONTES GLOBAIS EXISTENTES (HEADER E ACTIONS)
        // ========================================================
        window.inserirFerramentaNoEditor = (tipo) => ctx.inserirFerramentaNoEditor(tipo);
        window.abrirImportarTexto = () => {
            document.getElementById('popup-lab-overlay')?.classList.remove('active');
            abrirPopupImportarTexto(ctx);
        };

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
if (tit) {
    // 1. GravaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ao digitar
    tit.oninput = () => ctx.acionarGravacao();

    // ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ 2. LÃƒÆ’Ã¢â‚¬Å“GICA DE COLAGEM LIMPA (PLAIN TEXT)
    // O EventManager é reiniciado ao abrir notas; onpaste substitui o
    // handler anterior e impede que uma colagem seja processada várias vezes.
    tit.onpaste = (e) => {
        // Impede o comportamento padrÃƒÆ’Ã‚Â£o (que colaria HTML/FormataÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o)
        e.preventDefault();

        // Extrai apenas o texto puro do clipboard
        const text = (e.originalEvent || e).clipboardData.getData('text/plain');

        // Limpeza extra: remove quebras de linha para o tÃƒÆ’Ã‚Â­tulo nÃƒÆ’Ã‚Â£o "partir"
        const cleanText = text.replace(/\r?\n|\r/g, " ");

        // Insere o texto limpo na posiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o onde estÃƒÆ’Ã‚Â¡ o cursor
        document.execCommand('insertText', false, cleanText);
         reposicionarTituloMobile(tit);
        
        // Notifica o sistema que houve uma alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para gravar
        ctx.acionarGravacao();
    };
}

        window.alterarModoNota = async (m) => {
            if (!ctx.notaAbertaId || !ctx.dbRef) return;
            if (ctx.dadosNotaOriginal.onde === "share" && m === "sentinela") return;
            if (ctx.dadosNotaOriginal.onde !== "share" && m === "social") return;
            if (m === 'global') {
                const caixasVivas = ctx.caixasAtuais.filter(c => c.estado === 'on');
                const textoFull = caixasVivas.map(c => `${c.titulo || ""} ${c.conteudo || ""}`).join(" [BLOCK] ");
                if (textoFull) window.dispararPesquisaParabolica(textoFull, true);
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
                return;
            }
            if (m === 'sumar-global') {
                import('./sumariar-service.js').then(mod => mod.SumariarService.abrirSumarioGlobal());
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
                return;
            }

            let atual = Array.isArray(ctx.dadosNotaOriginal.modo) ? [...ctx.dadosNotaOriginal.modo] : [ctx.dadosNotaOriginal.modo || 'normal'];
            let novos = [];
            if (m === 'normal' || m === 'sentinela') novos = [m];
            else {
                novos = atual.filter(x => x !== 'normal' && x !== 'sentinela');
                if (novos.includes(m)) novos = novos.filter(x => x !== m);
                else novos.push(m);
            }
            if (novos.length === 0) novos = ['normal'];

            ctx.dadosNotaOriginal.modo = novos;
            document.querySelectorAll('.lab-item').forEach(c => c.classList.toggle('active', novos.includes(c.dataset.mode)));
            import('./lab-status.js').then(mod => mod.atualizarIconeLab(novos));
            const col = (ctx.dadosNotaOriginal.onde === "share") ? "Share" : "Local";
            await updateDoc(doc(ctx.dbRef, col, ctx.notaAbertaId), { modo: novos });
            await ctx.atualizarFeedEGravar(false);
            document.getElementById('popup-lab-overlay')?.classList.remove('active');
        };

        window.abrirDefinicoesDaNota = async () => {
            const { obterConfigNota, guardarConfigNota } = await import('../../settings/preferences.js');
            const uid = ctx.authRef.currentUser.uid;
            const config = obterConfigNota(ctx.dadosNotaOriginal, uid);
            document.getElementById('popup-note-settings-overlay')?.remove();
            const popup = document.createElement('div');
            popup.id = 'popup-note-settings-overlay';
            popup.className = 'popup-overlay active';
            popup.style.zIndex = '10008';
            popup.innerHTML = `
                <div class="popup-content" style="max-width:460px; width:94%;">
                    <div class="popup-header">
                        <h3>Defini??es desta Nota</h3>
                        <button data-close-note-settings><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="padding:18px; display:flex; flex-direction:column; gap:16px; background:var(--bg-body);">
                        <label style="display:flex; flex-direction:column; gap:8px;">
                            <span style="font-size:12px; color:#e2e8f0; font-weight:700;">Tamanho do Texto (coluna do centro)</span>
                            <input id="note-text-size-input" type="range" min="12" max="30" value="${config.textSize || 15}">
                        </label>
                        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do T?tulo (ferramentas)</span><input id="note-collapse-tools" type="checkbox" ${config.collapseToolTitles ? 'checked' : ''}></label>
                        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do TÃƒÆ’Ã‚Â­tulo (tÃƒÆ’Ã‚Â­tulo nota)</span><input id="note-collapse-title" type="checkbox" ${config.collapseNoteTitle ? 'checked' : ''}></label>
                        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Linhas de caderno</span><input id="note-diario-lines" type="checkbox" ${config.diarioLines ? 'checked' : ''}></label>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div style="font-size:12px; color:#e2e8f0; font-weight:700;">Mudar Foco (Nascimento)</div>
                            ${['contentor','subnota','questao','raciocinio'].map(tipo => `
                                <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                    <span style="font-size:11px; color:var(--text-muted); text-transform:capitalize;">${tipo}</span>
                                    <select data-foco-tipo="${tipo}" style="background:#0f172a; color:white; border:1px solid rgba(255,255,255,0.1); padding:6px 8px; border-radius:8px;">
                                        <option value="original" ${config.defaultFocos?.[tipo] === 'original' ? 'selected' : ''}>Original</option>
                                        <option value="comentario" ${config.defaultFocos?.[tipo] === 'comentario' ? 'selected' : ''}>ComentÃƒÆ’Ã‚Â¡rio</option>
                                        <option value="revisao" ${config.defaultFocos?.[tipo] === 'revisao' ? 'selected' : ''}>RevisÃƒÆ’Ã‚Â£o</option>
                                        <option value="camaleao" ${config.defaultFocos?.[tipo] === 'camaleao' ? 'selected' : ''}>CamaleÃƒÆ’Ã‚Â£o</option>
                                    </select>
                                </label>
                            `).join('')}
                        </div>
                        <button id="btn-save-note-settings" style="background:var(--primary); color:white; padding:10px 14px; border-radius:10px; font-weight:700;">Guardar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(popup);
            popup.querySelector('[data-close-note-settings]')?.addEventListener('click', () => popup.remove());
            popup.querySelector('#btn-save-note-settings')?.addEventListener('click', async () => {
                const defaultFocos = {};
                popup.querySelectorAll('select[data-foco-tipo]').forEach(select => {
                    defaultFocos[select.dataset.focoTipo] = select.value;
                });
                const merged = await guardarConfigNota(ctx.dbRef, ctx.notaAbertaId, ctx.dadosNotaOriginal, uid, {
                    textSize: Number(popup.querySelector('#note-text-size-input')?.value || 15),
                    collapseToolTitles: popup.querySelector('#note-collapse-tools')?.checked,
                    collapseNoteTitle: popup.querySelector('#note-collapse-title')?.checked,
                    diarioLines: popup.querySelector('#note-diario-lines')?.checked,
                    defaultFocos
                });
                const { aplicarPreferenciasDeNota } = await import('../../settings/preferences.js');
                if (ctx.dadosNotaOriginal.onde === "share") ctx.dadosNotaOriginal[uid] = { ...(ctx.dadosNotaOriginal[uid] || {}), notaConfig: merged };
                else ctx.dadosNotaOriginal.notaConfig = merged;
                window.notaAtualContext = { notaId: ctx.notaAbertaId, dadosNota: ctx.dadosNotaOriginal, db: ctx.dbRef, auth: ctx.authRef };
                aplicarPreferenciasDeNota({
                    ...merged,
                    collapseNoteTitle: merged.collapseNoteTitle || Boolean(window.NotaBookUserPrefs?.noteTitleCollapse)
                });
                await ctx.atualizarFeedEGravar(false);
                popup.remove();
            });
        };

        document.getElementById('btn-editor-lab').onclick = () => {
            const isNotaShare = ctx.dadosNotaOriginal.onde === "share";
            const modosAtuais = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
            const btnAncora = document.getElementById('btn-tab-ancora');
            if (btnAncora) btnAncora.style.display = isNotaShare ? 'none' : 'flex';

            const itemSentinela = document.querySelector('.lab-item[data-mode="sentinela"]');
            const itemSocial = document.querySelector('.lab-item[data-mode="social"]');
            if (itemSentinela) itemSentinela.style.display = isNotaShare ? 'none' : 'flex';
            if (itemSocial) itemSocial.style.display = isNotaShare ? 'flex' : 'none';

            document.querySelectorAll('.lab-item').forEach(card => card.classList.toggle('active', modosAtuais.includes(card.dataset.mode)));
            const nexoSec = document.getElementById('lab-nexo-section');
            if (nexoSec) nexoSec.style.display = modosAtuais.includes('sentinela') ? 'none' : 'block';

            document.getElementById('popup-lab-overlay')?.classList.add('active');
        };

        window.abrirDefinicoesDaNota = async () => {
            const pref = await import('../../settings/preferences.js');
            const paleta = await import('./paleta-cores.js');
            const uid = ctx.authRef.currentUser.uid;
            const config = pref.obterConfigNotaEfetiva(ctx.dadosNotaOriginal, uid, window.NotaBookUserPrefs);
            const modosAtuais = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
            const mostrarLinhasDiario = modosAtuais.includes('diario');
            const mapasFoco = {
                contentor: paleta.FOCOS_BASE,
                subnota: paleta.FOCOS_SUBNOTA,
                questao: paleta.FOCOS_QUESTAO,
                raciocinio: paleta.FOCOS_RACIOCINIO
            };

            document.getElementById('popup-note-settings-overlay')?.remove();
            const popup = document.createElement('div');
            popup.id = 'popup-note-settings-overlay';
            popup.className = 'popup-overlay active';
            popup.style.zIndex = '10008';
            popup.innerHTML = `
                <div class="popup-content" style="max-width:540px; width:94%; border-radius:20px; overflow:hidden;">
                    <div class="popup-header" style="padding:18px 22px; background:linear-gradient(135deg, rgba(99,102,241,0.18), rgba(15,23,42,0.95)); border-bottom:1px solid rgba(255,255,255,0.08);">
                        <h3>Defini&ccedil;&otilde;es desta Nota</h3>
                        <button data-close-note-settings><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="padding:20px; display:flex; flex-direction:column; gap:18px; background:linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98)); max-height:75vh; overflow:auto;">
                        <div style="padding:16px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; background:rgba(255,255,255,0.03); display:flex; flex-direction:column; gap:14px;">
                            <div>
                                <div style="font-size:11px; color:#cbd5e1; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Leitura</div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">As altera&ccedil;&otilde;es s&atilde;o guardadas automaticamente.</div>
                            </div>
                            <label style="display:flex; flex-direction:column; gap:8px;">
                                <span style="font-size:12px; color:#e2e8f0; font-weight:700;">Tamanho do Texto</span>
                                <input id="note-text-size-input" type="range" min="12" max="30" value="${config.textSize || 15}">
                            </label>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do T&iacute;tulo (ferramentas)</span><input id="note-collapse-tools" type="checkbox" ${config.collapseToolTitles ? 'checked' : ''}></label>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do T&iacute;tulo (nota)</span><input id="note-collapse-title" type="checkbox" ${config.collapseNoteTitle ? 'checked' : ''}></label>
                        </div>
                        ${mostrarLinhasDiario ? `
                        <div style="padding:16px; border:1px solid rgba(96,165,250,0.18); border-radius:16px; background:rgba(59,130,246,0.08); display:flex; flex-direction:column; gap:12px;">
                            <div>
                                <div style="font-size:11px; color:#bfdbfe; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Modo Di&aacute;rio</div>
                                <div style="font-size:11px; color:#93c5fd; margin-top:4px;">Esta op&ccedil;&atilde;o s&oacute; aparece quando o Modo Di&aacute;rio est&aacute; ativo.</div>
                            </div>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Linhas de caderno</span><input id="note-diario-lines" type="checkbox" ${config.diarioLines ? 'checked' : ''}></label>
                        </div>` : ``}
                        <div style="padding:16px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; background:rgba(255,255,255,0.03); display:flex; flex-direction:column; gap:12px;">
                            <div>
                                <div style="font-size:11px; color:#cbd5e1; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Mudar Foco (Nascimento)</div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Cada ferramenta usa os seus valores oficiais.</div>
                            </div>
                            ${['contentor','subnota','questao','raciocinio'].map(tipo => `
                                <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                    <span style="font-size:11px; color:var(--text-muted); text-transform:capitalize;">${tipo}</span>
                                    <select data-foco-tipo="${tipo}" style="min-width:180px; background:#0f172a; color:white; border:1px solid rgba(255,255,255,0.1); padding:8px 10px; border-radius:10px;">
                                        ${Object.entries(mapasFoco[tipo]).map(([key, meta]) => `<option value="${key}" ${config.defaultFocos?.[tipo] === key ? 'selected' : ''}>${meta.nome}</option>`).join('')}
                                    </select>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(popup);
            popup.querySelector('[data-close-note-settings]')?.addEventListener('click', () => popup.remove());

            const persistir = async () => {
                const defaultFocos = {};
                popup.querySelectorAll('select[data-foco-tipo]').forEach(select => {
                    defaultFocos[select.dataset.focoTipo] = select.value;
                });
                const merged = await pref.guardarConfigNota(ctx.dbRef, ctx.notaAbertaId, ctx.dadosNotaOriginal, uid, {
                    textSize: Number(popup.querySelector('#note-text-size-input')?.value || 15),
                    collapseToolTitles: popup.querySelector('#note-collapse-tools')?.checked,
                    collapseNoteTitle: popup.querySelector('#note-collapse-title')?.checked,
                    diarioLines: mostrarLinhasDiario ? popup.querySelector('#note-diario-lines')?.checked : false,
                    defaultFocos
                });
                if (ctx.dadosNotaOriginal.onde === "share") ctx.dadosNotaOriginal[uid] = { ...(ctx.dadosNotaOriginal[uid] || {}), notaConfig: merged };
                else ctx.dadosNotaOriginal.notaConfig = merged;
                window.notaAtualContext = { notaId: ctx.notaAbertaId, dadosNota: ctx.dadosNotaOriginal, db: ctx.dbRef, auth: ctx.authRef };
                pref.aplicarPreferenciasDeNota(merged);
                await ctx.atualizarFeedEGravar(false);
            };

            popup.querySelectorAll('input, select').forEach(field => {
                const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
                field.addEventListener(eventName, () => {
                    clearTimeout(popup._saveTimer);
                    popup._saveTimer = setTimeout(() => { persistir(); }, 180);
                });
            });
        };

        window.alterarModoNota = async (m) => {
            if (!ctx.notaAbertaId || !ctx.dbRef) return;
            if (ctx.dadosNotaOriginal.onde === "share" && m === "sentinela") return;
            if (ctx.dadosNotaOriginal.onde !== "share" && m === "social") return;
            if (m === 'global') {
                const caixasVivas = ctx.caixasAtuais.filter(c => c.estado === 'on');
                const textoFull = caixasVivas.map(c => `${c.titulo || ""} ${c.conteudo || ""}`).join(" [BLOCK] ");
                if (textoFull) window.dispararPesquisaParabolica(textoFull, true);
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
                return;
            }
            if (m === 'sumar-global') {
                import('./sumariar-service.js').then(mod => mod.SumariarService.abrirSumarioGlobal());
                document.getElementById('popup-lab-overlay')?.classList.remove('active');
                return;
            }

            let atual = Array.isArray(ctx.dadosNotaOriginal.modo) ? [...ctx.dadosNotaOriginal.modo] : [ctx.dadosNotaOriginal.modo || 'normal'];
            let novos = [];
            if (m === 'normal' || m === 'sentinela') novos = [m];
            else {
                novos = atual.filter(x => x !== 'normal' && x !== 'sentinela');
                if (novos.includes(m)) novos = novos.filter(x => x !== m);
                else novos.push(m);
            }
            if (novos.length === 0) novos = ['normal'];

            ctx.dadosNotaOriginal.modo = novos;
            document.querySelectorAll('.lab-item').forEach(c => c.classList.toggle('active', novos.includes(c.dataset.mode)));
            import('./lab-status.js').then(mod => mod.atualizarIconeLab(novos));

            const col = (ctx.dadosNotaOriginal.onde === "share") ? "Share" : "Local";
            const payload = { modo: novos };
            if (!novos.includes('diario')) {
                const pref = await import('../../settings/preferences.js');
                const uid = ctx.authRef.currentUser.uid;
                const merged = await pref.guardarConfigNota(ctx.dbRef, ctx.notaAbertaId, ctx.dadosNotaOriginal, uid, { diarioLines: false });
                if (ctx.dadosNotaOriginal.onde === "share") ctx.dadosNotaOriginal[uid] = { ...(ctx.dadosNotaOriginal[uid] || {}), notaConfig: merged };
                else ctx.dadosNotaOriginal.notaConfig = merged;
                pref.aplicarPreferenciasDeNota(merged);
            }

            await updateDoc(doc(ctx.dbRef, col, ctx.notaAbertaId), payload);
            await ctx.atualizarFeedEGravar(false);
            document.getElementById('popup-lab-overlay')?.classList.remove('active');
        };
    }
};