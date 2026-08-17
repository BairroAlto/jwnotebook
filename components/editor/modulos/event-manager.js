// components/editor/modulos/event-manager.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { moverCaixa, prepararInsercao } from './editor-actions.js';
import { abrirPaleta } from './paleta-cores.js';
import { abrirPopupPartilhar } from './partilhar.js';
import { abrirPopupTags } from './tags/tags-controller.js';
import { MobileBibleBar } from "./mobile-bible-bar.js";
import { isMobileViewport } from "../../ui/mobile-device.js";
import { abrirPopupImportarTexto } from './importar-texto.js';
import { LabModelos } from './lab-modelos.js';
import { obterFeaturesDisponiveis } from '../../settings/feature-admin.js';
import { obterDefinicaoModoNota, chaveAcessoModoNota } from './nota-modes.js';
import { criarAjustadorAlturaAbas } from '../../ui/fixed-tabs-height.js';

function notaEstaEmModoPost(dadosNota) {
    const modo = dadosNota?.modo;
    const modos = Array.isArray(modo) ? modo : [modo || 'normal'];
    return modos.includes('post');
}

async function verificarAcessoModoNota(ctx, modo, modosAtuais = []) {
    const featureKey = chaveAcessoModoNota(modo);
    if (!featureKey || modosAtuais.includes(modo)) return true;

    try {
        const features = await obterFeaturesDisponiveis(ctx.authRef);
        const feature = features.find(item => item.feature_key === featureKey);
        const permitido = !feature || feature.allowed;
        if (permitido) return true;

        const definicao = obterDefinicaoModoNota(modo);
        window.alert(`${definicao?.nome || 'Este modo'} requer o plano definido pelo administrador.`);
    } catch (erro) {
        console.error(`[MODOS] Não foi possível verificar o acesso a ${modo}:`, erro);
        window.alert('Não foi possível verificar o acesso ao modo. Tenta novamente.');
    }
    return false;
}

async function actualizarIndicadoresAcessoModos(ctx) {
    try {
        const features = await obterFeaturesDisponiveis(ctx.authRef);
        const porChave = new Map(features.map(feature => [feature.feature_key, feature]));
        document.querySelectorAll('.lab-item[data-mode]').forEach(card => {
            const modo = card.dataset.mode;
            const feature = porChave.get(chaveAcessoModoNota(modo));
            const bloqueado = Boolean(feature && !feature.allowed);
            card.classList.toggle('plan-locked', bloqueado);
            card.querySelector('.lab-plan-lock')?.remove();
            if (!bloqueado) return;

            const indicador = document.createElement('span');
            indicador.className = 'lab-plan-lock';
            indicador.title = 'Requer Premium';
            indicador.innerHTML = '<i class="fa-solid fa-lock" aria-hidden="true"></i>';
            card.appendChild(indicador);
        });
    } catch (erro) {
        console.warn('[MODOS] Não foi possível carregar os indicadores de plano:', erro);
    }
}

function reposicionarTituloMobile(campo) {
    if (!isMobileViewport() || !campo) return;

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
     * @param {Object} ctx - Objeto de estado vivo vindo do editor.js (contÃ©m dbRef, authRef, caixasAtuais, etc.)
     */
    init: (ctx) => {
        console.log(`ðŸŽ¯ [EVENT-MANAGER] Maestro ativo for: ${ctx.notaAbertaId}`);
        try {
            MobileBibleBar.iniciar();
        } catch (erro) {
            console.error('[MOBILE-BIBLE-BAR] NÃ£o foi possÃ­vel iniciar a barra:', erro);
        }
        iniciarScrollHorizontalDosTitulos();

        // ========================================================
        // 1. NAVEGAÃ‡ÃƒO DE PAINÃ‰IS (EYE / BRAIN / X-SAT)
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

            if (p === 'bookai') {
                import('../../direita/bookai-panel.js').then(m => {
                    m.renderizarPainelBookAI({ nota: ctx.dadosNotaOriginal });
                });
            }
            if (p === 'brain' && !document.querySelector('.cosmos-brain-wrapper')) {
                if (typeof window.mostrarBrainIdle === 'function') window.mostrarBrainIdle();
            }
            if (isMobileViewport()) {
                import('../../ui/mobile-bottom-sheet.js').then(m => m.MobileBottomSheet.abrir());
            }
        };

        // ========================================================
        // 2. NAVEGAÃ‡ÃƒO INTERNA DO "EYE" (COM FILTRO DE EXCLUSIVIDADE)
        // ========================================================
        window.__atualizarGlosasEye = (caixaAtual = null) => {
            const modosLive = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
            const sentinelaLive = modosLive.includes('sentinela');
            const caixasBase = [...(window.caixasAtuais || ctx.caixasAtuais || [])];
            if (caixaAtual?.id) {
                const indiceAtual = caixasBase.findIndex(caixa => caixa.id === caixaAtual.id);
                if (indiceAtual === -1) caixasBase.push(caixaAtual);
                else caixasBase[indiceAtual] = caixaAtual;
            }
            const caixasLive = caixasBase.filter(caixa => {
                if (caixa.estado !== 'on') return false;
                return sentinelaLive ? !!caixa.referenciacodex : !caixa.referenciacodex;
            });
            return import('../../direita/eye-glosas.js').then(modulo => modulo.carregarGlosasDaNota(caixasLive));
        };
        window.switchEyeTab = (t) => {
            const ids = ['indice-nota-container', 'textos-container', 'ancora-nota-container', 'fontes-nota-container', 'glosas-nota-container', 'caixas-associadas-container', 'ficheiros-nota-container'];
            ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            document.querySelectorAll('#sub-tabs-eye i').forEach(i => i.classList.remove('active'));

            const modos = Array.isArray(ctx.dadosNotaOriginal.modo) ? ctx.dadosNotaOriginal.modo : [ctx.dadosNotaOriginal.modo || 'normal'];
            const isSentinela = modos.includes('sentinela');
            
            // ðŸš€ FILTRO RIGOROSO: A direita sÃ³ vÃª o que o modo permite
            const flt = ctx.caixasAtuais.filter(c => {
                if (c.estado !== 'on') return false;
                return isSentinela ? !!c.referenciacodex : !c.referenciacodex;
            });

            const map = { 'indice':'indice-nota-container', 'textos':'textos-container', 'ancora':'ancora-nota-container', 'fontes':'fontes-nota-container', 'glosas':'glosas-nota-container', 'caixas':'caixas-associadas-container', 'ficheiros':'ficheiros-nota-container' }[t];
            const target = document.getElementById(map);
            if (target) { target.style.display = 'flex'; target.style.flexDirection = 'column'; }
            document.getElementById(`btn-tab-${t}`)?.classList.add('active');

            if (t === 'textos') import('../../direita/eye-textos-biblia.js').then(m => m.detectarEExibirTextosBiblicos(flt));
            if (t === 'fontes') import('../../direita/eye-fontes-nota.js').then(m => m.carregarFontesGlobaisDaNota(flt));
            if (t === 'glosas') import('../../direita/eye-glosas.js').then(m => m.carregarGlosasDaNota(flt));
            if (t === 'indice') import('../../direita/indice.js').then(m => m.renderizarIndice(flt, modos.includes('post')));
            if (t === 'caixas') {
                const caixasBase = Array.isArray(window.caixasAtuais)
                    ? window.caixasAtuais
                    : (Array.isArray(ctx.caixasAtuais) ? ctx.caixasAtuais : []);
                const caixasLive = caixasBase
                    .filter(caixa => {
                        if (caixa.estado === 'off') return false;
                        return isSentinela ? !!caixa.referenciacodex : !caixa.referenciacodex;
                    });
                import('../../direita/caixas-associadas.js').then(m =>
                    m.carregarCaixasAssociadas(caixasLive, ctx.dbRef, ctx.authRef?.currentUser?.uid)
                );
            }
            if (t === 'ancora') {import('../../direita/eye-ancora.js').then(m => m.iniciarAbaAncora(ctx.notaAbertaId, ctx.dbRef, ctx.authRef) );}
            if (t === 'ficheiros') {
                import('../../storage/storage-ui.js').then(m => m.montarPainelFicheiros(target, {
                    noteId: ctx.notaAbertaId,
                    titulo: 'Ficheiros da nota',
                    permitirUpload: false,
                    permitirRemover: false,
                    focoContexto: window._ficheirosFocoContexto || null,
                    abrirNoBrowser: true
                }));
            }
        };

        if (!window._notabookFicheirosEventosIniciados) {
            window._notabookFicheirosEventosIniciados = true;
            window.addEventListener('ficheiros:alterados', () => {
                import('../../storage/storage-ui.js').then(m => m.atualizarIndicadorFicheiros(ctx.notaAbertaId));
            });
        }

        // ========================================================
        // 3. LABORATÃ“RIO (MODOS E FERRAMENTAS)
        // ========================================================
        window.alterarModoNota = async (m) => {
            if (ctx.dadosNotaOriginal.onde === "share" && m === "sentinela") {
                console.warn("ðŸš« [SISTEMA] Notas partilhadas nÃ£o suportam o Modo Sentinela.");
                return; 
            }
            if (!ctx.notaAbertaId || !ctx.dbRef) return;

            // A) TRATAMENTO DA PESQUISA GLOBAL (FERRAMENTA ÃšNICA)
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

            // B) LÃ“GICA DE EXCLUSIVIDADE DE MODOS
            let atual = Array.isArray(ctx.dadosNotaOriginal.modo) ? [...ctx.dadosNotaOriginal.modo] : [ctx.dadosNotaOriginal.modo || 'normal'];
            if (!(await verificarAcessoModoNota(ctx, m, atual))) return;
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

            // C) LÃ³gica Modo Sentinela (Browser + Duplicados)
            if (m === 'sentinela' && !ctx.caixasAtuais.some(c => c.referenciacodex)) {
                import('./sentinela-browser.js').then(sb => sb.SentinelaBrowser.abrir(async (json, idx) => {
                    const artigo = json.artigos[idx];
                    const uid = ctx.authRef.currentUser.uid;

                    const { SentinelaManager } = await import('./sentinela-manager.js');
                    const notaDuplicadaId = await SentinelaManager.verificarSeJaExiste(ctx.dbRef, ctx.authRef.currentUser.uid, artigo.referencia);

                    if (notaDuplicadaId) {
                        const { mostrarAviso } = await import('./tags/tags-utils.js');
                        mostrarAviso(`JÃ¡ existe uma nota para este estudo! Verifica a tua lista ou a reciclagem.`);
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
                // Redesenha a UI sem agendar novo debounce de 1.5s
                await ctx.atualizarFeedEGravar(false);
                // Grava imediatamente no Firebase
                if (typeof ctx.gravarImediatamente === 'function') {
                    await ctx.gravarImediatamente();
                }
            }
        };

        // ========================================================
        // ðŸš€ PONTES PARA FERRAMENTAS ESPECIAIS (LUPAS)
        // ========================================================

        // 1. CITAÃ‡ÃƒO BÃBLICA
        window.abrirSeletorBibliaGlobal = (caixa) => {
            console.log("ðŸ“– [EVENT] Abrindo seletor bÃ­blico para a caixa.");
            import('./biblia-selector.js').then(m => {
                m.abrirSelector(caixa);
            });
        };

        // 2. WEBCARD (LINKS VISUAIS)
        window.abrirWebCardConfigGlobal = (caixa) => {
            console.log("ðŸŒ [EVENT] Abrindo configurador de WebCards.");
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
            console.log("ðŸ“¸ [EVENT] Abrindo configurador de Galeria.");
            import('./imagens-service.js').then(async m => {
                const dados = await m.ImagensService.abrirConfigurador(caixa);
                if (dados) {
                    caixa.links = dados.links;
                    caixa.urldimensao = dados.urldimensao;
                    
                    // Updates gallery visualization without reloading whole note
                    const el = document.getElementById(`bloco-${caixa.id}`);
                    if (el && el.refreshGaleria) el.refreshGaleria();
                    
                    ctx.atualizarFeedEGravar(true);
                }
            });
        };

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
        window.moverCaixaGlobal = (c, d) => {
            const caixasAtuais = Array.isArray(window.caixasAtuais)
                ? window.caixasAtuais
                : ctx.caixasAtuais;
            const moveu = moverCaixa(
                caixasAtuais,
                c,
                d,
                notaEstaEmModoPost(ctx.dadosNotaOriginal),
                ctx.atualizarFeedEGravar
            );
            if (!moveu) {
                console.warn('[MOVE] Movimento ignorado:', {
                    caixaId: c?.id || null,
                    direcao: d,
                    totalCaixas: caixasAtuais?.length || 0
                });
            }
            return moveu;
        };
        
        window.abrirPopupTagsGlobal = (caixa, id) => {
            const origem = ctx.dadosNotaOriginal.onde || "local";
            abrirPopupTags(caixa, id || ctx.notaAbertaId, origem);
        };

        const tit = document.getElementById('editor-titulo');
        if (tit) {
            // 1. GravaÃ§Ã£o ao digitar
            tit.oninput = () => ctx.acionarGravacao(null, { tipo: "metadados" });

            // ðŸš€ 2. LÃ“GICA DE COLAGEM LIMPA (PLAIN TEXT)
            tit.onpaste = (e) => {
                e.preventDefault();
                const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                const cleanText = text.replace(/\r?\n|\r/g, " ");
                document.execCommand('insertText', false, cleanText);
                reposicionarTituloMobile(tit);
                ctx.acionarGravacao(null, { tipo: "metadados" });
            };
        }

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
                        <h3>Definições desta Nota</h3>
                        <button data-close-note-settings><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="padding:18px; display:flex; flex-direction:column; gap:16px; background:var(--bg-body);">
                        <label style="display:flex; flex-direction:column; gap:8px;">
                            <span style="font-size:12px; color:#e2e8f0; font-weight:700;">Tamanho do Texto (coluna do centro)</span>
                            <input id="note-text-size-input" type="range" min="12" max="30" value="${config.textSize || 15}">
                        </label>
                        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do Título (ferramentas)</span><input id="note-collapse-tools" type="checkbox" ${config.collapseToolTitles ? 'checked' : ''}></label>
                        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do Título (título nota)</span><input id="note-collapse-title" type="checkbox" ${config.collapseNoteTitle ? 'checked' : ''}></label>
                        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Linhas de caderno</span><input id="note-diario-lines" type="checkbox" ${config.diarioLines ? 'checked' : ''}></label>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div style="font-size:12px; color:#e2e8f0; font-weight:700;">Mudar Foco (Nascimento)</div>
                            ${['contentor','subnota','questao','raciocinio'].map(tipo => `
                                <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                    <span style="font-size:11px; color:var(--text-muted); text-transform:capitalize;">${tipo}</span>
                                    <select data-foco-tipo="${tipo}" style="background:#0f172a; color:white; border:1px solid rgba(255,255,255,0.1); padding:6px 8px; border-radius:8px;">
                                        <option value="original" ${config.defaultFocos?.[tipo] === 'original' ? 'selected' : ''}>Original</option>
                                        <option value="comentario" ${config.defaultFocos?.[tipo] === 'comentario' ? 'selected' : ''}>Comentário</option>
                                        <option value="revisao" ${config.defaultFocos?.[tipo] === 'revisao' ? 'selected' : ''}>Revisão</option>
                                        <option value="camaleao" ${config.defaultFocos?.[tipo] === 'camaleao' ? 'selected' : ''}>Camaleão</option>
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
                window.notaAtualContext = { notaId: ctx.notaAbertaId, maeId: ctx.notaMaeAtualId || ctx.notaAbertaId, dadosNota: ctx.dadosNotaOriginal, db: ctx.dbRef, auth: ctx.authRef };
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
            requestAnimationFrame(() => window.ajustarAlturaLabPopup?.());
            actualizarIndicadoresAcessoModos(ctx);
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
                        <h3>Definições desta Nota</h3>
                        <button data-close-note-settings><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="note-settings-tabs" role="tablist" aria-label="Secções das definições da nota">
                        <button type="button" class="note-settings-tab is-active" data-note-settings-tab="leitura" role="tab" aria-selected="true">Leitura</button>
                        <button type="button" class="note-settings-tab" data-note-settings-tab="minimal" role="tab" aria-selected="false">Modo Minimal</button>
                        ${mostrarLinhasDiario ? `<button type="button" class="note-settings-tab" data-note-settings-tab="diario" role="tab" aria-selected="false">Diário</button>` : ``}
                        <button type="button" class="note-settings-tab" data-note-settings-tab="foco" role="tab" aria-selected="false">Mudar Foco</button>
                    </div>
                    <div class="note-settings-scroll" style="padding:20px; display:flex; flex-direction:column; gap:18px; background:linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98)); max-height:75vh; overflow:auto;">
                        <div class="note-settings-panel is-active" data-note-settings-panel="leitura" role="tabpanel" style="padding:16px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; background:rgba(255,255,255,0.03); display:flex; flex-direction:column; gap:14px;">
                            <div>
                                <div style="font-size:11px; color:#cbd5e1; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Leitura</div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">As alterações são guardadas automaticamente.</div>
                            </div>
                            <label style="display:flex; flex-direction:column; gap:8px;">
                                <span style="font-size:12px; color:#e2e8f0; font-weight:700;">Tamanho do Texto</span>
                                <input id="note-text-size-input" type="range" min="12" max="30" value="${config.textSize || 15}">
                            </label>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do Título (ferramentas)</span><input id="note-collapse-tools" type="checkbox" ${config.collapseToolTitles ? 'checked' : ''}></label>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Colapso do Título (nota)</span><input id="note-collapse-title" type="checkbox" ${config.collapseNoteTitle ? 'checked' : ''}></label>
                        </div>
                        <div class="note-settings-panel" data-note-settings-panel="minimal" role="tabpanel" style="padding:16px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; background:rgba(0,0,0,0.35); display:flex; flex-direction:column; gap:12px;">
                            <div>
                                <div style="font-size:11px; color:#cbd5e1; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Modo Minimal</div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Escolhe quanto a coluna da direita deve permanecer iluminada.</div>
                            </div>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer;">
                                <span style="font-size:12px; color:#e2e8f0; font-weight:700;">Eclipse total <small style="color:var(--text-muted); font-weight:500;">(predefinido)</small></span>
                                <input type="radio" name="note-minimal-eclipse" value="total" ${config.minimalEclipse === 'total' ? 'checked' : ''}>
                            </label>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer;">
                                <span style="font-size:12px; color:#e2e8f0; font-weight:700;">Eclipse parcial <small style="color:var(--text-muted); font-weight:500;">(ilumina um pouco mais a coluna da direita)</small></span>
                                <input type="radio" name="note-minimal-eclipse" value="parcial" ${config.minimalEclipse === 'parcial' ? 'checked' : ''}>
                            </label>
                        </div>
                        ${mostrarLinhasDiario ? `
                        <div class="note-settings-panel" data-note-settings-panel="diario" role="tabpanel" style="padding:16px; border:1px solid rgba(96,165,250,0.18); border-radius:16px; background:rgba(59,130,246,0.08); display:flex; flex-direction:column; gap:12px;">
                            <div>
                                <div style="font-size:11px; color:#bfdbfe; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Modo Diário</div>
                                <div style="font-size:11px; color:#93c5fd; margin-top:4px;">Esta opção só aparece quando o Modo Diário está ativo.</div>
                            </div>
                            <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;"><span style="font-size:12px; color:#e2e8f0; font-weight:700;">Linhas de caderno</span><input id="note-diario-lines" type="checkbox" ${config.diarioLines ? 'checked' : ''}></label>
                        </div>` : ``}
                        <div class="note-settings-panel" data-note-settings-panel="foco" role="tabpanel" style="padding:16px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; background:rgba(255,255,255,0.03); display:flex; flex-direction:column; gap:12px;">
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

            const areaDefinicoes = popup.querySelector('.note-settings-scroll');
            const paineisDefinicoes = [...popup.querySelectorAll('[data-note-settings-panel]')];
            const ajustadorAlturaDefinicoes = criarAjustadorAlturaAbas({
                area: areaDefinicoes,
                paineis: paineisDefinicoes,
                obterEstado: panel => panel.classList.contains('is-active'),
                definirVisivel: (panel, visivel) => panel.classList.toggle('is-active', visivel),
                alturaExtra: 40,
                limiteAltura: () => Math.floor(window.innerHeight * 0.75)
            });
            const fecharPopupDefinicoes = () => {
                ajustadorAlturaDefinicoes.destruir();
                popup.remove();
            };

            popup.querySelector('[data-close-note-settings]')?.addEventListener('click', fecharPopupDefinicoes);

            popup.querySelectorAll('[data-note-settings-tab]').forEach(tab => {
                tab.addEventListener('click', () => {
                    const alvo = tab.dataset.noteSettingsTab;
                    popup.querySelectorAll('[data-note-settings-tab]').forEach(item => {
                        const ativo = item === tab;
                        item.classList.toggle('is-active', ativo);
                        item.setAttribute('aria-selected', String(ativo));
                    });
                    popup.querySelectorAll('[data-note-settings-panel]').forEach(panel => {
                        panel.classList.toggle('is-active', panel.dataset.noteSettingsPanel === alvo);
                    });
                });
            });

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
                    minimalEclipse: popup.querySelector('input[name="note-minimal-eclipse"]:checked')?.value || 'total',
                    defaultFocos
                });
                if (ctx.dadosNotaOriginal.onde === "share") ctx.dadosNotaOriginal[uid] = { ...(ctx.dadosNotaOriginal[uid] || {}), notaConfig: merged };
                else ctx.dadosNotaOriginal.notaConfig = merged;
                window.notaAtualContext = { notaId: ctx.notaAbertaId, maeId: ctx.notaMaeAtualId || ctx.notaAbertaId, dadosNota: ctx.dadosNotaOriginal, db: ctx.dbRef, auth: ctx.authRef };
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
            if (!(await verificarAcessoModoNota(ctx, m, atual))) return;
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

            if (novos.includes('sentinela')) {
                const caixasVivas = ctx.caixasAtuais || [];
                const jaTemEstudo = caixasVivas.some(c => c.referenciacodex && c.estado === 'on');
                if (!jaTemEstudo) {
                    console.log("ðŸ“š [SENTINELA] Sem caixas vinculadas. Abrindo Explorador Codex...");
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
        };

        // Inicializar controlador modular de modelos
        LabModelos.init(ctx);
    }
};


