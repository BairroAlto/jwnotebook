// components/editor/modulos/lab-modelos.js
import { criarAjustadorAlturaAbas } from '../../ui/fixed-tabs-height.js';
import { criarCaixaBairroDoModelo, criarEditorBairroModelo } from './lab-bairro-modelos.js';
import { guardarConfiguracaoLocalSites, guardarPublicacaoSites, removerPublicacaoSites } from './sites-publicacao.js?v=20260819-capa-altura-sinaletica';
import { exigirAcessoFerramenta } from '../../settings/feature-admin.js';
import { apagarFicheiro, enviarFicheiro, obterUsoArmazenamento } from '../../storage/storage-client.js';

export const LabModelos = {
    init: (ctx) => {
        const FERRAMENTAS_LISTA = [
            { id: "bairro", nome: "Bairro Tarefas", icon: "fa-solid fa-city", cor: "#c084fc" },
            { id: "cartaovisita", nome: "Cartão Visita", icon: "fa-solid fa-address-card", cor: "#ffffff" },
            { id: "citacaobiblica", nome: "Citação Bíblica", icon: "fa-solid fa-book-open", cor: "#ffffff" },
            { id: "contentor", nome: "Contentor", icon: "fa-solid fa-box", cor: "#ea580c" },
            { id: "elevador", nome: "Elevador", icon: "fa-solid fa-elevator", cor: "#ef4444" },
            { id: "firmamento", nome: "Firmamento", icon: "fa-solid fa-aquarius", cor: "#ffffff" },
            { id: "galeria", nome: "Imagens", icon: "fa-solid fa-panorama", cor: "#ffffff" },
            { id: "questao", nome: "Questão", icon: "fa-solid fa-box", cor: "#10b981" },
            { id: "raciocinio", nome: "Raciocínio", icon: "fa-solid fa-box", cor: "#f59e0b" },
            { id: "subnota", nome: "SubNota", icon: "fa-solid fa-box", cor: "#3b82f6" },
            { id: "webcard", nome: "WebCard", icon: "fa-solid fa-tablet-screen-button", cor: "#ffffff" }
        ].sort((a, b) => a.nome.localeCompare(b.nome));

        const FOCOS_MAPA = {
            contentor: [
                { id: "original", nome: "Original" },
                { id: "comentario", nome: "Comentário" },
                { id: "transcricao", nome: "Transcrição" },
                { id: "reflexao", nome: "Reflexão" },
                { id: "desafio", nome: "Desafio" },
                { id: "rascunho", nome: "Rascunho" },
                { id: "exemplo", nome: "Exemplo" },
                { id: "camaleao", nome: "Camaleão" }
            ],
            subnota: [
                { id: "original", nome: "Original" },
                { id: "perola", nome: "Pérola" },
                { id: "estudo", nome: "Estudo" },
                { id: "resumo", nome: "Resumo" },
                { id: "palestra", nome: "Palestra" },
                { id: "ponto_chave", nome: "Chave" }
            ],
            questao: [
                { id: "original", nome: "Original" },
                { id: "paradoxo", nome: "Paradoxo" },
                { id: "dilema", nome: "Dilema" },
                { id: "hipotese", nome: "Hipótese" },
                { id: "revisao", nome: "Revisão" }
            ],
            raciocinio: [
                { id: "original", nome: "Original" },
                { id: "socratico", nome: "Socrático" }
            ]
        };

        let modeloSendoEditadoId = null;

        // Resolve os versículos bíblicos de forma assíncrona
        async function resolverTextosBiblicos(valor) {
            const normalizarNome = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase();
            const entradas = String(valor || '').split(/[;\n]+/).map(item => item.trim()).filter(Boolean);
            const resultados = [];
            
            try {
                const bibleDataMod = await import('../../lists/bible-data.js').catch(() => null);
                const BIBLE_DATA = bibleDataMod ? bibleDataMod.BIBLE_DATA : [];
                
                const encontrarLivro = (nome) => {
                    const chave = normalizarNome(nome);
                    return BIBLE_DATA.find(livro =>
                        normalizarNome(livro.nome) === chave ||
                        normalizarNome(livro.abrev) === chave
                    );
                };

                const dadosPorLivro = new Map();

                for (const entrada of entradas) {
                    const partes = entrada.match(/^(.+?)\s+(\d+)\s*:\s*(\d+(?:\s*[-–—]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?)*)$/);
                    if (!partes) continue;

                    const livro = encontrarLivro(partes[1]);
                    if (!livro) continue;

                    const capitulo = Number(partes[2]);
                    const totalVersiculos = livro.versiculos?.[capitulo - 1];
                    if (!totalVersiculos) continue;

                    const versiculos = partes[3].split(',').flatMap(segmento => {
                        const limites = segmento.trim().match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
                        if (!limites) return [];
                        const primeiro = Number(limites[1]);
                        const ultimo = Number(limites[2] || limites[1]);
                        if (primeiro < 1 || ultimo < primeiro || ultimo > totalVersiculos) return [];
                        return Array.from({ length: ultimo - primeiro + 1 }, (_, indice) => primeiro + indice);
                    });

                    const uniqueVerses = [...new Set(versiculos)];
                    
                    let dados = dadosPorLivro.get(livro.nome);
                    if (!dados) {
                        const slug = normalizarNome(livro.nome).replace(/\s+/g, '_');
                        const resposta = await fetch(`data/biblia/${slug}.json`);
                        if (resposta.ok) {
                            dados = await resposta.json();
                            dadosPorLivro.set(livro.nome, dados);
                        }
                    }

                    if (dados) {
                        const capituloDados = dados[livro.nome]?.[capitulo];
                        if (capituloDados) {
                            uniqueVerses.forEach(versiculo => {
                                const textoVersiculo = capituloDados[versiculo];
                                if (textoVersiculo) {
                                    resultados.push({
                                        livro: livro.nome,
                                        cap: capitulo,
                                        ver: String(versiculo),
                                        texto: textoVersiculo
                                    });
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Erro ao resolver textos bíblicos:", e);
            }
            return resultados;
        }

        window.destruirAjustadorAlturaLabPopup?.();
        const areaLaboratorio = document.querySelector('#popup-lab-overlay .lab-fixed-panels');
        const paineisLaboratorio = areaLaboratorio
            ? [...areaLaboratorio.querySelectorAll(':scope > .lab-container')]
            : [];
        const ajustadorAlturaLab = criarAjustadorAlturaAbas({
            area: areaLaboratorio,
            paineis: paineisLaboratorio,
            obterEstado: painel => painel.style.display !== 'none',
            definirVisivel: (painel, visivel) => { painel.style.display = visivel ? 'block' : 'none'; },
            alturaExtra: 0,
            limiteAltura: () => Math.floor(window.innerHeight * 0.78),
            observarAlteracoes: true
        });
        window.ajustarAlturaLabPopup = () => ajustadorAlturaLab.atualizar();
        window.destruirAjustadorAlturaLabPopup = () => ajustadorAlturaLab.destruir();

        window.switchLabPopupTab = async (tabName) => {
            const btnLab = document.getElementById('tab-btn-lab');
            const btnModelos = document.getElementById('tab-btn-modelos');
            const btnSites = document.getElementById('tab-btn-sites');
            const contentLab = document.getElementById('lab-options-list');
            const contentModelos = document.getElementById('lab-modelos-tab-content');
            const contentSites = document.getElementById('lab-sites-tab-content');

            const acessoDaAba = {
                lab: ['aba_laboratorio', 'A aba Laboratório requer o plano definido pelo administrador.'],
                modelos: ['aba_modelos', 'A aba Modelos requer o plano definido pelo administrador.'],
                sites: ['sites_publicos', 'A aba Sites requer o plano definido pelo administrador.']
            }[tabName];
            if (acessoDaAba && !(await exigirAcessoFerramenta(
                ctx.authRef,
                acessoDaAba[0],
                acessoDaAba[1]
            ))) return;
            
            if (tabName === 'lab') {
                btnLab?.classList.add('active');
                btnModelos?.classList.remove('active');
                btnSites?.classList.remove('active');
                if (contentLab) contentLab.style.display = 'block';
                if (contentModelos) contentModelos.style.display = 'none';
                if (contentSites) contentSites.style.display = 'none';
            } else if (tabName === 'modelos') {
                btnLab?.classList.remove('active');
                btnModelos?.classList.add('active');
                btnSites?.classList.remove('active');
                if (contentLab) contentLab.style.display = 'none';
                if (contentModelos) contentModelos.style.display = 'block';
                if (contentSites) contentSites.style.display = 'none';
                window.carregarModelosDoUtilizador();
            } else {
                btnLab?.classList.remove('active');
                btnModelos?.classList.remove('active');
                btnSites?.classList.add('active');
                if (contentLab) contentLab.style.display = 'none';
                if (contentModelos) contentModelos.style.display = 'none';
                if (contentSites) contentSites.style.display = 'block';
            }
            ajustadorAlturaLab.atualizar();
        };

        const sitesToggle = document.getElementById('lab-sites-toggle');
        const sitesCapa = document.getElementById('lab-sites-capa-url');
        const sitesCapaUpload = document.getElementById('lab-sites-capa-upload');
        const sitesCapaUploadButton = document.getElementById('lab-sites-capa-upload-button');
        const sitesCapaUploadStatus = document.getElementById('lab-sites-capa-upload-status');
        const sitesCapaAltura = [...document.querySelectorAll('input[name="lab-sites-capa-altura"]')];
        const sitesBrowser = document.getElementById('lab-sites-browser-toggle');
        const sitesLargura = document.getElementById('lab-sites-largura');
        const sitesModoAtualizacao = document.getElementById('lab-sites-modo-atualizacao');
        const sitesPublicarAgora = document.getElementById('lab-sites-publicar-agora');
        const sitesUpdateStatus = document.getElementById('lab-sites-update-status');
        const sitesLink = document.getElementById('lab-sites-link');
        const sitesLinkUrl = document.getElementById('lab-sites-link-url');
        const sitesLinkOpen = document.getElementById('lab-sites-link-open');
        const sitesSubtabs = [...document.querySelectorAll('.lab-sites-subtab')];
        const sitesSubpanels = [...document.querySelectorAll('.lab-sites-subpanel')];
        const activarSitesSubtab = (nome) => {
            sitesSubtabs.forEach(botao => {
                const activo = botao.dataset.sitesSubtab === nome;
                botao.classList.toggle('active', activo);
                botao.setAttribute('aria-selected', String(activo));
            });
            sitesSubpanels.forEach(painel => {
                painel.hidden = painel.dataset.sitesSubpanel !== nome;
            });
            ajustadorAlturaLab.atualizar();
        };
        sitesSubtabs.forEach(botao => {
            botao.dataset.sitesSubtab = botao.id.endsWith('topo') ? 'topo' : 'generico';
            botao.addEventListener('click', () => activarSitesSubtab(botao.dataset.sitesSubtab));
        });
        sitesSubpanels.forEach(painel => {
            painel.dataset.sitesSubpanel = painel.id.endsWith('topo') ? 'topo' : 'generico';
        });
        activarSitesSubtab('generico');
        const sitesConfig = ctx.dadosNotaOriginal?.sites || {};
        let sitesCapaFileId = typeof sitesConfig.capaFileId === 'string' ? sitesConfig.capaFileId : '';
        let sitesCapaPublicadaFileId = sitesCapaFileId;
        const SITES_COVER_URL = `https://storage.notabook.site/sites/${encodeURIComponent(ctx.notaAbertaId)}/cover`;
        const SITES_COVER_MAX_BYTES = 10 * 1024 * 1024;
        const formatarBytesCapa = bytes => {
            if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        };
        const actualizarLinkSites = () => {
            const url = `${window.location.origin}/sites.html?id=${encodeURIComponent(ctx.notaAbertaId)}`;
            if (sitesLinkUrl) {
                sitesLinkUrl.href = url;
                sitesLinkUrl.textContent = url;
            }
            if (sitesLinkOpen) sitesLinkOpen.href = url;
            if (sitesLink) sitesLink.hidden = false;
        };
        if (sitesToggle) sitesToggle.checked = sitesConfig.estado === 'on';
        if (sitesCapa) sitesCapa.value = sitesConfig.capaUrl || '';
        const definirCapaAltura = (valor) => {
            const altura = ['pequena', 'media', 'grande'].includes(valor) ? valor : 'grande';
            sitesCapaAltura.forEach(input => { input.checked = input.value === altura; });
        };
        definirCapaAltura(sitesConfig.capaAltura);
        if (sitesBrowser) sitesBrowser.checked = sitesConfig.mostrarBrowser === true;
        if (sitesLargura) sitesLargura.value = sitesConfig.largura || 'centralizada';
        if (sitesModoAtualizacao) {
            sitesModoAtualizacao.value = sitesConfig.modoActualizacao || (sitesConfig.estado === 'on' ? 'manual' : 'automatico');
        }
        const obterModoActualizacao = () => sitesModoAtualizacao?.value === 'automatico' ? 'automatico' : 'manual';
        const actualizarEstadoActualizacao = () => {
            const activo = sitesToggle?.checked === true;
            const automatico = obterModoActualizacao() === 'automatico';
            if (sitesPublicarAgora) sitesPublicarAgora.hidden = !activo || automatico;
            if (sitesUpdateStatus) {
                sitesUpdateStatus.hidden = !activo;
                sitesUpdateStatus.textContent = automatico
                    ? 'As alterações serão publicadas automaticamente depois de serem guardadas.'
                    : 'As alterações ficam na nota até clicares em “Actualizar Site agora”.';
            }
        };
        if (sitesLink && sitesConfig.estado === 'on') {
            actualizarLinkSites();
        }
        actualizarEstadoActualizacao();
        const obterCapaAltura = () => sitesCapaAltura.find(input => input.checked)?.value || 'grande';
        const obterConfiguracaoSites = () => ({
            capaUrl: sitesCapa.value.trim(),
            capaFileId: sitesCapaFileId,
            capaAltura: obterCapaAltura(),
            largura: sitesLargura.value,
            mostrarBrowser: sitesBrowser.checked,
            modoActualizacao: obterModoActualizacao()
        });
        sitesToggle?.addEventListener('change', async () => {
            console.debug('[SITES] Toggle Publicar Site alterado.', {
                checked: sitesToggle.checked,
                notaId: ctx.notaAbertaId || null,
                userId: ctx.authRef?.currentUser?.uid || null
            });
            sitesToggle.disabled = true;
            try {
                if (sitesToggle.checked) {
                    const configuracao = obterConfiguracaoSites();
                    const capaUrl = configuracao.capaUrl;
                    if (capaUrl && !/^https:\/\//i.test(capaUrl)) throw new Error('A imagem de capa tem de usar HTTPS.');
                    await guardarPublicacaoSites(ctx, configuracao);
                    actualizarLinkSites();
                } else {
                    const idCapaAEliminar = sitesCapaFileId;
                    await removerPublicacaoSites(ctx);
                    if (idCapaAEliminar) {
                        apagarFicheiro(idCapaAEliminar).catch(erro => console.warn('[SITES] A capa removida não foi eliminada do armazenamento.', erro));
                    }
                    sitesCapaFileId = '';
                    sitesCapaPublicadaFileId = '';
                    sitesLink.hidden = true;
                }
                ctx.dadosNotaOriginal.sites = { estado: sitesToggle.checked ? 'on' : 'off', ...obterConfiguracaoSites() };
                actualizarEstadoActualizacao();
            } catch (erro) {
                console.error('[SITES] Erro ao processar o toggle Publicar Site.', {
                    code: erro?.code || null,
                    message: erro?.message || String(erro),
                    name: erro?.name || null
                }, erro);
                sitesToggle.checked = !sitesToggle.checked;
                window.alert(erro.message || 'Não foi possível actualizar a publicação.');
            } finally { sitesToggle.disabled = false; }
        });
        const actualizarSitesPublico = async (forcar = false) => {
            if (!sitesToggle?.checked) return;
            if (!forcar && obterModoActualizacao() !== 'automatico') {
                actualizarEstadoActualizacao();
                return;
            }
            try {
                const configuracao = obterConfiguracaoSites();
                const capaUrl = configuracao.capaUrl;
                if (capaUrl && !/^https:\/\//i.test(capaUrl)) throw new Error('A imagem de capa tem de usar HTTPS.');
                const idCapaAnterior = sitesCapaPublicadaFileId;
                await guardarPublicacaoSites(ctx, configuracao);
                ctx.dadosNotaOriginal.sites = { estado: 'on', ...configuracao };
                sitesCapaPublicadaFileId = configuracao.capaFileId || '';
                if (idCapaAnterior && idCapaAnterior !== configuracao.capaFileId) {
                    apagarFicheiro(idCapaAnterior).catch(erro => console.warn('[SITES] A capa antiga não foi removida.', erro));
                }
                actualizarEstadoActualizacao();
            } catch (erro) { window.alert(erro.message || 'Não foi possível actualizar o Site.'); }
        };
        const actualizarEspacoCapa = async () => {
            if (!sitesCapaUploadStatus) return;
            try {
                const uso = await obterUsoArmazenamento();
                const restante = Math.max(0, Number(uso.remainingBytes || Number(uso.quotaBytes || 0) - Number(uso.usedBytes || 0)));
                sitesCapaUploadStatus.textContent = restante > 0
                    ? `Espaço disponível: ${formatarBytesCapa(restante)}. Limite por imagem: 10 MB.`
                    : 'Não tens espaço disponível no plano para carregar uma imagem.';
                if (sitesCapaUploadButton) sitesCapaUploadButton.disabled = restante <= 0;
            } catch (_) {
                sitesCapaUploadStatus.textContent = 'A quota será verificada ao carregar. Limite por imagem: 10 MB.';
            }
        };
        actualizarEspacoCapa();
        sitesCapaUploadButton?.addEventListener('click', () => sitesCapaUpload?.click());
        sitesCapaUpload?.addEventListener('change', async () => {
            const ficheiro = sitesCapaUpload.files?.[0];
            if (!ficheiro) return;
            const urlAnterior = sitesCapa.value;
            const idAnterior = sitesCapaFileId;
            let idNovo = '';
            try {
                if (!ficheiro.type.startsWith('image/')) throw new Error('Escolhe um ficheiro de imagem.');
                if (ficheiro.size > SITES_COVER_MAX_BYTES) throw new Error('A imagem de capa não pode ultrapassar 10 MB.');
                sitesCapaUploadButton.disabled = true;
                if (sitesCapaUploadStatus) sitesCapaUploadStatus.textContent = 'A verificar espaço disponível…';
                const uso = await obterUsoArmazenamento();
                const restante = Math.max(0, Number(uso.remainingBytes || Number(uso.quotaBytes || 0) - Number(uso.usedBytes || 0)));
                if (ficheiro.size > restante) throw new Error('Não tens espaço suficiente no plano para esta imagem.');

                if (!sitesToggle?.checked) throw new Error('Activa primeiro a opção “Publicar Site”.');
                if (sitesCapaUploadStatus) sitesCapaUploadStatus.textContent = 'A carregar a imagem…';
                const carregado = await enviarFicheiro(ficheiro, {
                    noteId: ctx.notaAbertaId,
                    contextType: 'site',
                    contextId: ctx.notaAbertaId
                });
                idNovo = carregado.id;
                sitesCapaFileId = idNovo;
                sitesCapa.value = SITES_COVER_URL;
                const configuracao = obterConfiguracaoSites();
                if (obterModoActualizacao() === 'automatico') {
                    await guardarPublicacaoSites(ctx, configuracao);
                    if (sitesCapaPublicadaFileId && sitesCapaPublicadaFileId !== sitesCapaFileId) {
                        apagarFicheiro(sitesCapaPublicadaFileId).catch(erro => console.warn('[SITES] A capa antiga não foi removida.', erro));
                    }
                    sitesCapaPublicadaFileId = sitesCapaFileId;
                } else {
                    await guardarConfiguracaoLocalSites(ctx, configuracao);
                }
                ctx.dadosNotaOriginal.sites = { estado: 'on', ...configuracao };
                actualizarLinkSites();
                if (sitesCapaUploadStatus) sitesCapaUploadStatus.textContent = obterModoActualizacao() === 'automatico'
                    ? 'Imagem carregada e publicada com sucesso.'
                    : 'Imagem carregada. Clique em “Actualizar Site agora” para a publicar.';
                actualizarEstadoActualizacao();
            } catch (erro) {
                if (idNovo) apagarFicheiro(idNovo).catch(() => {});
                sitesCapaFileId = idAnterior;
                sitesCapa.value = urlAnterior;
                window.alert(erro.message || 'Não foi possível carregar a imagem.');
                actualizarEspacoCapa();
            } finally {
                sitesCapaUpload.value = '';
                if (sitesCapaUploadButton) sitesCapaUploadButton.disabled = false;
            }
        });
        sitesBrowser?.addEventListener('change', actualizarSitesPublico);
        sitesCapa?.addEventListener('input', () => {
            if (sitesCapa.value.trim() !== SITES_COVER_URL) sitesCapaFileId = '';
        });
        sitesCapa?.addEventListener('change', actualizarSitesPublico);
        sitesCapaAltura.forEach(input => input.addEventListener('change', actualizarSitesPublico));
        sitesLargura?.addEventListener('change', actualizarSitesPublico);
        sitesModoAtualizacao?.addEventListener('change', () => {
            actualizarEstadoActualizacao();
            actualizarSitesPublico();
        });
        sitesPublicarAgora?.addEventListener('click', () => actualizarSitesPublico(true));

        window.carregarModelosDoUtilizador = async () => {
            const uid = ctx.authRef.currentUser?.uid;
            if (!uid) return;

            const listContainer = document.getElementById('lab-modelos-lista-itens');
            if (listContainer) {
                listContainer.innerHTML = '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px;">A carregar modelos...</div>';
            }

            try {
                const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                const q = query(collection(ctx.dbRef, "Modelos"), where("userId", "==", uid), where("estado", "==", "on"));
                const querySnapshot = await getDocs(q);
                
                if (listContainer) {
                    listContainer.innerHTML = "";
                    if (querySnapshot.empty) {
                        listContainer.innerHTML = '<div style="font-size:10px; color:var(--text-muted); text-align:center; padding:15px; border: 1px dashed rgba(255,255,255,0.05); border-radius:10px;">Nenhum modelo criado. Clica no "+" para criar.</div>';
                        return;
                    }
                    
                    querySnapshot.forEach((docSnap) => {
                        const modelo = { id: docSnap.id, ...docSnap.data() };
                        const card = document.createElement('div');
                        card.className = 'modelo-row-card';
                        card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; cursor: pointer; transition: 0.2s; margin-bottom: 6px;';
                        card.onclick = () => window.aplicarModelo(modelo);
                        
                        // Botão lápis para editar
                        const pencil = document.createElement('div');
                        pencil.className = 'modelo-edit-pencil';
                        pencil.style.cssText = 'color: rgba(255, 255, 255, 0.4); padding: 6px; cursor: pointer; transition: 0.2s;';
                        pencil.innerHTML = '<i class="fa-solid fa-pencil"></i>';
                        pencil.onclick = (e) => {
                            e.stopPropagation();
                            window.abrirEditarModeloPopup(modelo.id, modelo);
                        };

                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'modelo-nome-text';
                        nameSpan.style.cssText = 'font-size: 12px; font-weight: 600; color: #f8fafc;';
                        nameSpan.innerText = modelo.nome;

                        card.appendChild(nameSpan);
                        card.appendChild(pencil);
                        listContainer.appendChild(card);
                    });
                }
            } catch (err) {
                console.error("Erro ao carregar modelos:", err);
                if (listContainer) {
                    listContainer.innerHTML = '<div style="font-size:11px; color:#ef4444; text-align:center; padding:10px;">Erro ao carregar modelos.</div>';
                }
            } finally {
                ajustadorAlturaLab.atualizar();
            }
        };

        window.abrirCriarModeloPopup = () => {
            modeloSendoEditadoId = null;
            document.getElementById('modelo-popup-title').innerText = "CRIAR MODELO";
            document.getElementById('modelo-nome-input').value = "";
            document.getElementById('modelo-caixas-lista').innerHTML = "";
            document.getElementById('btn-apagar-modelo').style.display = "none";
            document.getElementById('modelo-confirm-apagar').style.display = "none";
            document.getElementById('popup-modelo-form-overlay').classList.add('active');
            
            window.adicionarAtalhoRow("", "contentor", "original", []);
        };

        window.abrirEditarModeloPopup = (modeloId, modeloData) => {
            modeloSendoEditadoId = modeloId;
            document.getElementById('modelo-popup-title').innerText = "EDITAR MODELO";
            document.getElementById('modelo-nome-input').value = modeloData.nome || "";
            document.getElementById('modelo-caixas-lista').innerHTML = "";
            document.getElementById('btn-apagar-modelo').style.display = "block";
            document.getElementById('modelo-confirm-apagar').style.display = "none";
            document.getElementById('popup-modelo-form-overlay').classList.add('active');
            
            if (modeloData.caixas && modeloData.caixas.length > 0) {
                modeloData.caixas.forEach(c => {
                    const conteudo = ["subnota", "questao", "raciocinio", "cartaovisita"].includes(c.tipo) ? (c.titulo || "") : (c.conteudo || "");
                    window.adicionarAtalhoRow(conteudo, c.tipo || "contentor", c.foco || "original", c.pastapai || [], c);
                });
            } else {
                window.adicionarAtalhoRow("", "contentor", "original", []);
            }
        };

        window.adicionarAtalhoRow = (conteudo = "", tipo = "contentor", foco = "original", pastapai = [], configuracao = null) => {
            const container = document.getElementById('modelo-caixas-lista');
            if (!container) return;

            const row = document.createElement('div');
            row.className = 'modelo-row';
            row.style.cssText = 'display: flex; gap: 8px; align-items: flex-start; padding: 10px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.01); border-radius: 10px;';

            const previewDiv = document.createElement('div');
            previewDiv.className = 'row-tool-preview';
            previewDiv.style.cssText = 'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 8px; flex-shrink: 0; font-size: 16px;';
            row.appendChild(previewDiv);

            const detailsDiv = document.createElement('div');
            detailsDiv.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 6px;';

            // Contentor para os campos específicos de input
            const inputContainer = document.createElement('div');
            inputContainer.className = 'row-input-fields';
            inputContainer.style.cssText = 'width: 100%;';
            detailsDiv.appendChild(inputContainer);

            const selectContainer = document.createElement('div');
            selectContainer.style.cssText = 'display: flex; gap: 6px; width: 100%;';

            const toolSelect = document.createElement('select');
            toolSelect.className = 'row-tool-select';
            
            FERRAMENTAS_LISTA.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.nome;
                if (t.id === tipo) opt.selected = true;
                toolSelect.appendChild(opt);
            });
            selectContainer.appendChild(toolSelect);

            const focoSelect = document.createElement('select');
            focoSelect.className = 'row-foco-select';
            selectContainer.appendChild(focoSelect);

            detailsDiv.appendChild(selectContainer);
            row.appendChild(detailsDiv);

            const trashBtn = document.createElement('button');
            trashBtn.className = 'btn-remove-row';
            trashBtn.style.cssText = 'background: none; border: none; color: rgba(255,255,255,0.3); padding: 8px 4px; cursor: pointer; font-size: 14px; align-self: center; transition: 0.2s;';
            trashBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            trashBtn.onclick = () => {
                row.remove();
            };
            row.appendChild(trashBtn);

            const atualizarFocoEDraw = () => {
                const selectedTipo = toolSelect.value;
                const toolMeta = FERRAMENTAS_LISTA.find(t => t.id === selectedTipo);
                
                if (toolMeta) {
                    previewDiv.innerHTML = `<i class="${toolMeta.icon}" style="color: ${toolMeta.cor};"></i>`;
                }

                inputContainer.innerHTML = "";
                
                if (selectedTipo === "bairro") {
                    const editorBairro = criarEditorBairroModelo(configuracao?.tipo === 'bairro'
                        ? configuracao
                        : { pastapai });
                    row.obterBairroModelo = () => editorBairro.obterModelo();
                    inputContainer.appendChild(editorBairro);
                } else if (selectedTipo === "elevador") {
                    // Interface de Hierarquia para Elevador
                    const hierDiv = document.createElement('div');
                    hierDiv.className = 'hierarchy-container';
                    hierDiv.style.cssText = 'display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 6px;';
                    
                    const addPaiBtn = document.createElement('button');
                    addPaiBtn.type = 'button';
                    addPaiBtn.className = 'btn-add-pai';
                    addPaiBtn.innerText = '+ Adicionar Pai';
                    addPaiBtn.style.cssText = 'align-self: flex-start; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #818cf8; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; transition: 0.2s;';
                    hierDiv.appendChild(addPaiBtn);

                    const paisLista = document.createElement('div');
                    paisLista.className = 'pais-lista';
                    paisLista.style.cssText = 'display: flex; flex-direction: column; gap: 8px; width: 100%;';
                    hierDiv.appendChild(paisLista);

                    const appendPaiRow = (paiNome = "", filhos = []) => {
                        const paiRow = document.createElement('div');
                        paiRow.className = 'pai-item-row';
                        paiRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; background: rgba(255,255,255,0.01);';
                        
                        const headerDiv = document.createElement('div');
                        headerDiv.style.cssText = 'display: flex; gap: 6px; align-items: center;';
                        
                        const pInput = document.createElement('input');
                        pInput.type = 'text';
                        pInput.className = 'pai-row-input';
                        pInput.value = paiNome;
                        pInput.placeholder = 'Nome do Pai...';
                        pInput.style.cssText = 'flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 4px 8px; color: white; font-size: 11px; outline: none;';
                        headerDiv.appendChild(pInput);
                        
                        const addFilhoBtn = document.createElement('button');
                        addFilhoBtn.type = 'button';
                        addFilhoBtn.className = 'btn-add-filho';
                        addFilhoBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Filho';
                        addFilhoBtn.style.cssText = 'background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;';
                        headerDiv.appendChild(addFilhoBtn);
                        
                        const delPaiBtn = document.createElement('button');
                        delPaiBtn.type = 'button';
                        delPaiBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                        delPaiBtn.style.cssText = 'background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 12px; padding: 4px;';
                        delPaiBtn.onclick = () => paiRow.remove();
                        headerDiv.appendChild(delPaiBtn);
                        
                        paiRow.appendChild(headerDiv);

                        const filhosLista = document.createElement('div');
                        filhosLista.className = 'filhos-lista';
                        filhosLista.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding-left: 15px;';
                        paiRow.appendChild(filhosLista);

                        const appendFilhoRow = (filhoNome = "") => {
                            const filhoRow = document.createElement('div');
                            filhoRow.className = 'filho-item-row';
                            filhoRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';
                            
                            const fInput = document.createElement('input');
                            fInput.type = 'text';
                            fInput.className = 'filho-row-input';
                            fInput.value = filhoNome;
                            fInput.placeholder = 'Nome do Filho...';
                            fInput.style.cssText = 'flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 3px 6px; color: #e2e8f0; font-size: 10px; outline: none;';
                            filhoRow.appendChild(fInput);
                            
                            const delFilhoBtn = document.createElement('button');
                            delFilhoBtn.type = 'button';
                            delFilhoBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                            delFilhoBtn.style.cssText = 'background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 10px; padding: 3px;';
                            delFilhoBtn.onclick = () => filhoRow.remove();
                            filhoRow.appendChild(delFilhoBtn);
                            
                            filhosLista.appendChild(filhoRow);
                        };

                        addFilhoBtn.onclick = () => appendFilhoRow("");
                        
                        filhos.forEach(f => {
                            const fName = typeof f === 'object' ? (f.nome || "") : f;
                            appendFilhoRow(fName);
                        });
                        
                        paisLista.appendChild(paiRow);
                    };

                    addPaiBtn.onclick = () => appendPaiRow("", []);
                    
                    pastapai.forEach(p => {
                        appendPaiRow(p.nome || "", p.pastafilho || p.filhos || []);
                    });
                    
                    inputContainer.appendChild(hierDiv);
                } else {
                    // Input Padrão Ajustado pelo Tipo
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'row-conteudo-input';
                    input.value = conteudo;
                    
                    if (selectedTipo === "contentor" || selectedTipo === "firmamento") {
                        input.placeholder = 'Descrição (conteúdo) padrão da caixa...';
                    } else if (["subnota", "questao", "raciocinio", "cartaovisita"].includes(selectedTipo)) {
                        input.placeholder = 'Título (título) padrão da caixa...';
                    } else if (selectedTipo === "webcard" || selectedTipo === "galeria") {
                        input.placeholder = 'Link(s) (separados por vírgula ou espaço)...';
                    } else if (selectedTipo === "citacaobiblica") {
                        input.placeholder = 'Texto Bíblico (ex: Génesis 1:1; Salmo 23:1)...';
                    } else {
                        input.placeholder = 'Conteúdo padrão da caixa...';
                    }
                    
                    inputContainer.appendChild(input);
                }

                const focos = FOCOS_MAPA[selectedTipo];
                focoSelect.innerHTML = "";
                if (focos) {
                    focoSelect.style.display = "block";
                    focos.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f.id;
                        opt.textContent = f.nome;
                        if (f.id === foco) opt.selected = true;
                        focoSelect.appendChild(opt);
                    });
                } else {
                    focoSelect.style.display = "none";
                }
            };

            toolSelect.onchange = () => {
                atualizarFocoEDraw();
            };

            container.appendChild(row);
            atualizarFocoEDraw();
        };

        const btnAddAtalho = document.getElementById('btn-adicionar-atalho');
        if (btnAddAtalho) {
            btnAddAtalho.onclick = () => {
                window.adicionarAtalhoRow("", "contentor", "original", []);
            };
        }

        const btnGravar = document.getElementById('btn-gravar-modelo');
        if (btnGravar) {
            btnGravar.onclick = () => {
                window.gravarModelo();
            };
        }

        window.confirmarApagarModelo = () => {
            console.log("🗑️ [MODELOS] Clique detetado no botão de apagar (lixeira). ID do Modelo:", modeloSendoEditadoId);
            const confirmPanel = document.getElementById('modelo-confirm-apagar');
            if (confirmPanel) {
                console.log("🗑️ [MODELOS] Painel de confirmação encontrado no DOM. Alterando display para 'flex'.");
                confirmPanel.style.display = 'flex';
            } else {
                console.warn("⚠️ [MODELOS] ERRO: Painel 'modelo-confirm-apagar' não existe no DOM.");
            }
        };

        window.cancelarApagarModelo = () => {
            console.log("🗑️ [MODELOS] Cancelamento de exclusão solicitado.");
            const confirmPanel = document.getElementById('modelo-confirm-apagar');
            if (confirmPanel) confirmPanel.style.display = 'none';
        };

        window.executarApagarModelo = async () => {
            console.log("🗑️ [MODELOS] Confirmação SIM clicada. Gravando estado = off para o modelo ID:", modeloSendoEditadoId);
            if (!modeloSendoEditadoId) return;
            try {
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                await updateDoc(doc(ctx.dbRef, "Modelos", modeloSendoEditadoId), {
                    estado: "off"
                });
                console.log("🗑️ [MODELOS] Sucesso: Firestore atualizado para estado = off");
                document.getElementById('popup-modelo-form-overlay').classList.remove('active');
                const confirmPanel = document.getElementById('modelo-confirm-apagar');
                if (confirmPanel) confirmPanel.style.display = 'none';
                window.carregarModelosDoUtilizador();
            } catch (err) {
                console.error("❌ Erro ao apagar modelo no Firestore:", err);
                alert("Erro ao apagar modelo.");
            }
        };

        window.gravarModelo = async () => {
            const uid = ctx.authRef.currentUser?.uid;
            if (!uid) return;

            const nome = document.getElementById('modelo-nome-input').value.trim();
            if (!nome) {
                alert("Por favor, introduz um nome para o modelo.");
                return;
            }

            const rows = document.querySelectorAll('#modelo-caixas-lista .modelo-row');
            const caixas = [];

            rows.forEach(row => {
                const tipo = row.querySelector('.row-tool-select').value;
                const focoSelect = row.querySelector('.row-foco-select');
                const foco = focoSelect && focoSelect.style.display !== 'none' ? focoSelect.value : "original";
                
                const caixaObj = {
                    id: crypto.randomUUID(),
                    estado: "on",
                    foco: foco,
                    protecao: "fechado",
                    timestamp: new Date().toISOString(),
                    tipo: tipo
                };

                if (tipo === "bairro") {
                    const configuracaoBairro = row.obterBairroModelo?.() || { pastapai: [] };
                    Object.assign(caixaObj, configuracaoBairro);
                    caixaObj.conteudo = "";
                } else if (tipo === "elevador") {
                    const pastapai = [];
                    row.querySelectorAll('.pai-item-row').forEach(paiEl => {
                        const pName = paiEl.querySelector('.pai-row-input').value.trim();
                        const pastafilho = [];
                        paiEl.querySelectorAll('.filho-item-row').forEach(filhoEl => {
                            const fName = filhoEl.querySelector('.filho-row-input').value.trim();
                            pastafilho.push({ nome: fName });
                        });
                        pastapai.push({ nome: pName, pastafilho: pastafilho });
                    });
                    caixaObj.pastapai = pastapai;
                    caixaObj.conteudo = "";
                } else {
                    const val = row.querySelector('.row-conteudo-input')?.value || "";
                    if (["subnota", "questao", "raciocinio", "cartaovisita"].includes(tipo)) {
                        caixaObj.titulo = val;
                        caixaObj.conteudo = "";
                    } else {
                        caixaObj.conteudo = val;
                    }
                }

                caixas.push(caixaObj);
            });

            try {
                const { collection, addDoc, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                const payload = {
                    userId: uid,
                    estado: "on",
                    timestamp: new Date().toISOString(),
                    nome: nome,
                    caixas: caixas
                };

                if (modeloSendoEditadoId) {
                    await setDoc(doc(ctx.dbRef, "Modelos", modeloSendoEditadoId), payload, { merge: true });
                } else {
                    await addDoc(collection(ctx.dbRef, "Modelos"), payload);
                }

                document.getElementById('popup-modelo-form-overlay').classList.remove('active');
                window.carregarModelosDoUtilizador();
            } catch (err) {
                console.error("Erro ao gravar modelo:", err);
                alert("Erro ao gravar modelo.");
            }
        };

        window.aplicarModelo = async (modelo) => {
            if (!ctx.notaAbertaId || !modelo || !modelo.caixas || modelo.caixas.length === 0) return;

            const { obterConfigNota } = await import('../../settings/preferences.js');
            const noteConfig = obterConfigNota(ctx.dadosNotaOriginal, ctx.authRef?.currentUser?.uid);

            if (!ctx.caixasAtuais) ctx.caixasAtuais = [];
            ctx.caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

            const { verificarLimiteCaixas } = await import('../../billing/box-limits.js');
            if (!(await verificarLimiteCaixas(ctx.authRef, ctx.caixasAtuais, modelo.caixas.length))) return;

            const novasCaixas = await Promise.all(modelo.caixas.map(async (c) => {
                const nova = {
                    id: crypto.randomUUID(),
                    tipo: c.tipo,
                    conteudo: c.conteudo || "",
                    estado: "on",
                    timestamp: new Date().toISOString(),
                    protecao: "fechado"
                };

                if (c.foco) {
                    nova.foco = c.foco;
                } else if (c.tipo !== "firmamento" && noteConfig.defaultFocos?.[c.tipo]) {
                    nova.foco = noteConfig.defaultFocos[c.tipo];
                } else {
                    nova.foco = "original";
                }

                if (["subnota", "questao", "raciocinio", "cartaovisita"].includes(c.tipo)) {
                    nova.titulo = c.titulo || "";
                }
                
                if (c.tipo === "webcard") {
                    if (c.conteudo) {
                        const urls = c.conteudo.split(/[\s,;]+/).map(u => u.trim()).filter(Boolean);
                        nova.links = urls.map(u => ({ url: u, titulo: u, site: "Link", imagem: "" }));
                    } else {
                        nova.links = [];
                    }
                }
                
                if (c.tipo === "citacaobiblica") {
                    if (c.conteudo) {
                        nova.textosanexados = await resolverTextosBiblicos(c.conteudo);
                    } else {
                        nova.textosanexados = [];
                    }
                }
                
                if (c.tipo === "firmamento") {
                    nova.foco = nova.foco || "original";
                    nova.corFirmamento = "#050505";
                    nova.textoFirmamento = "#ffffff";
                }
                
                if (c.tipo === "bairro") {
                    Object.assign(nova, criarCaixaBairroDoModelo(c));
                } else if (c.tipo === "elevador") {
                    const isBairro = false;
                    const criarId = (p) => p + '-' + crypto.randomUUID();
                    nova.corBairro = isBairro ? "#c084fc" : undefined;
                    
                    nova.pastapai = (c.pastapai || []).map(p => {
                        const paiId = criarId(isBairro ? 'pai' : 'elevador-pai');
                        const newPai = {
                            id: paiId,
                            nome: p.nome || "",
                            oculto: false,
                            timestamp: Date.now()
                        };

                        if (isBairro) {
                            newPai.check = "nenhum";
                            newPai.ocultarJaChecados = false;
                        } else {
                            newPai.links = [];
                        }

                        newPai.pastafilho = (p.pastafilho || []).map(f => {
                            const newFilho = {
                                id: criarId(isBairro ? 'casa' : 'elevador-filho'),
                                nome: f.nome || f || "",
                                oculto: false,
                                timestamp: Date.now()
                            };

                            if (isBairro) {
                                newFilho.check = "nenhum";
                                newFilho.concluido = false;
                                newFilho.ligaçãoBairro = [];
                            } else {
                                newFilho.url = "";
                            }
                            return newFilho;
                        });

                        return newPai;
                    });
                }
                
                if (c.tipo === "galeria") {
                    if (c.conteudo) {
                        nova.links = c.conteudo.split(/[\s,;]+/).map(u => u.trim()).filter(Boolean);
                    } else {
                        nova.links = [];
                    }
                    nova.urldimensao = "medias";
                }

                return nova;
            }));

            novasCaixas.forEach(nova => {
                ctx.caixasAtuais.push(nova);
            });

            ctx.caixasAtuais.forEach((c, i) => {
                c.ordem = i + 1;
            });

            if (ctx.dadosNotaOriginal?.onde === "share") {
                const uid = ctx.authRef?.currentUser?.uid;
                const userName = ctx.authRef?.currentUser?.displayName || ctx.authRef?.currentUser?.email || "Utilizador";
                ctx.dadosNotaOriginal.shareNovidades = ctx.dadosNotaOriginal.shareNovidades || {};
                novasCaixas.forEach(nova => {
                    ctx.dadosNotaOriginal.shareNovidades[nova.id] = {
                        tipo: "criado",
                        by: uid,
                        byName: userName,
                        viewedBy: uid ? [uid] : [],
                        timestamp: new Date().toISOString()
                    };
                });
            }

            await ctx.atualizarFeedEGravar(true);
            document.getElementById('popup-lab-overlay')?.classList.remove('active');
            console.log("🚀 Modelo aplicado com sucesso!");
        };
    }
};
