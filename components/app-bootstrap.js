

        
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
    import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
    import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
    
    import { firebaseConfig } from '../firebase-config.js';
    import { iniciarAutenticacao } from './biblioteca-brain/auth/auth.js';
    import { inicializarCriacaoPasta } from './local/criar-pasta.js';
    import { inicializarCriacaoNota } from './local/criar-nota.js';
    import { inicializarLeituraLocal } from './local/ler-local.js';
    import { inicializarLists } from './lists/ler-lists.js'; 
    import { inicializarSettings } from './settings/settings.js?v=20260817-paineis-completos-1';
    import { abrirNotaDaUrl, abrirNotaDeArranque, precarregarNotaArranque } from './settings/startup.js';
    import { iniciarCodexBrowser } from './editor/modulos/codex-browser.js';
    import { mostrarBrainIdle } from './direita/brain-idle.js';
    import { mostrarEyeIdle } from './direita/eye-idle.js';
    import { iniciarXSat } from './direita/xsat-controller.js';
    import { mostrarXSatIdle, ocultarXSatIdle } from './direita/xsat-idle.js';
    import { vigiarConvitesPendentes } from './share/ler-share.js';
    import { iniciarControladorEsquerda } from './esquerda/esquerda-controller.js';
    import { inicializarLeituraShare } from './share/ler-share.js';
    import { inicializarCriacaoShare } from './share/criar-share.js';
    import './share/gestao-itens-share.js';
    import { inicializarAmigos } from './settings/amigos.js';
    import { inicializarGestaoLocal } from './local/gestao-local.js';
    import { vigiarConvitesEntrada } from './local/convites-manager.js';
    import { inicializarLeituraPins } from './esquerda/ler-pins.js';
    import { iniciarSelectorBiblia } from './editor/modulos/biblia-selector.js';
    import { MobileBottomSheet } from './ui/mobile-bottom-sheet.js';
    import { MobilePanelManager } from './ui/mobile-panel-manager.js';
    import { MobileBibleBar } from "./editor/modulos/mobile-bible-bar.js";
    import { isMobileViewport } from './ui/mobile-device.js';
import { inicializarSeletorFerramentas } from './editor/modulos/tool-picker.js';
    

     // 2. LOGO A SEGUIR, O MONITOR DE INTERNET
    const banner = document.getElementById('offline-banner');
    const VERSAO_COMPONENTES = '20260819-sites-capa';

    function atualizarEstadoConexao() {
        if (navigator.onLine) {
            if (banner && banner.style.display === 'block') {
                banner.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Ligação restabelecida. Sincronizando...';
                banner.classList.add('online-success');
                setTimeout(() => {
                    banner.style.display = 'none';
                    banner.classList.remove('online-success');
                }, 3000);
            }
        } else {
            if (banner) {
                banner.innerHTML = '<i class="fa-solid fa-plane-slash"></i> Estás offline. Modo de segurança ativo.';
                banner.style.display = 'block';
                banner.classList.remove('online-success');
            }
        }
    }

    window.addEventListener('online', atualizarEstadoConexao);
    window.addEventListener('offline', atualizarEstadoConexao);
    atualizarEstadoConexao();
 


    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app); 
    const authInstance = getAuth(app);
    
    window.db = db;
    window.auth = authInstance;

    async function carregarComponente(idElemento, caminhoFicheiro) {
        const el = document.getElementById(idElemento);
        if (!el) throw new Error(`Contentor de componente inexistente: ${idElemento}`);

        const url = new URL(caminhoFicheiro, document.baseURI);
        url.searchParams.set('v', VERSAO_COMPONENTES);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Falha ao carregar ${caminhoFicheiro} (${response.status})`);

        const html = await response.text();
        if (!html.trim()) throw new Error(`Componente vazio: ${caminhoFicheiro}`);
        el.innerHTML = html;
        return caminhoFicheiro;
    }

    // 1. CARREGAR HTML PRIMEIRO
    try {
        await Promise.all([
        carregarComponente('area-editor', 'components/editor/editor.html'), 
        carregarComponente('area-popup-criar', 'components/popup/popup-criar.html'), 
        carregarComponente('area-popup-confirmar', 'components/popup/popup-confirmar.html'), 
        carregarComponente('area-popup-restaurar', 'components/popup/popup-restaurar.html'), 
        carregarComponente('area-popup-cores', 'components/popup/popup-cores.html'), 
        carregarComponente('area-popup-firmamento-cores', 'components/popup/popup-firmamento-cores.html'),
        carregarComponente('area-popup-bairro-cores', 'components/popup/popup-bairro-cores.html'),
        carregarComponente('area-popup-bairro-posto', 'components/popup/popup-bairro-posto.html'),
        carregarComponente('area-popup-editar-cor', 'components/popup/popup-editar-cor.html'), 
        carregarComponente('area-popup-partilhar', 'components/popup/popup-partilhar.html'),
        carregarComponente('area-popup-settings', 'components/settings/settings.partial'),
        carregarComponente('area-popup-manual', 'components/manual/manual.html'),
        carregarComponente('area-popup-browser', 'components/popup/popup-browser.html'),
        carregarComponente('area-popup-tags', 'components/popup/popup-tags.html'),
        carregarComponente('area-popup-codex-browser', 'components/popup/popup-codex-browser.html'),
        carregarComponente('area-popup-confirmar-remover', 'components/popup/popup-confirmar-remover.html'),
        carregarComponente('area-popup-confirmar-acta', 'components/popup/popup-confirmar-acta.html'),
        carregarComponente('area-popup-cosmos', 'components/popup/popup-cosmos.html'),
        carregarComponente('area-pasta', 'components/local/criar-pasta.html'), 
        carregarComponente('area-topo', 'components/topo/menu.html'),
        carregarComponente('area-esquerda', 'components/esquerda/menu.html'),
        carregarComponente('area-direita', 'components/direita/menu.html'),
        carregarComponente('area-popup-ferramentas-inline', 'components/popup/popup-ferramentas.html'),
        carregarComponente('area-popup-confirmar-brain', 'components/popup/popup-confirmar-brain.html'),
        carregarComponente('area-popup-confirmar-vinculo', 'components/popup/popup-confirmar-vinculo.html'),
        carregarComponente('area-popup-topicos', 'components/popup/popup-topicos.html'),    
        carregarComponente('area-popup-confirmar-topico', 'components/popup/popup-confirmar-topico.html'),
        carregarComponente('area-popup-cv-imagem', 'components/popup/popup-cartaovisita-imagem.html'),
        carregarComponente('area-popup-confirmar-restauro', 'components/popup/popup-confirmar-restauro.html'),
        carregarComponente('area-popup-tags-nota', 'components/popup/popup-tags-nota.html'),
        carregarComponente('area-popup-aviso', 'components/popup/popup-aviso.html'),
        carregarComponente('area-popup-link-topico', 'components/popup/popup-link-topico.html'),
        carregarComponente('area-popup-edit-codex-topico', 'components/popup/popup-edit-codex-topico.html'),
        carregarComponente('area-popup-biblia-citacao', 'components/popup/popup-biblia-citacao.html'),
        carregarComponente('area-popup-cosmos-fontes', 'components/popup/popup-cosmos-fontes.html'),
        carregarComponente('area-popup-ancora-nota', 'components/popup/popup-ancora-nota.html'),
        carregarComponente('area-popup-lab', 'components/popup/popup-lab.html'),
        carregarComponente('area-popup-importar-texto', 'components/popup/popup-importar-texto.html'),
        carregarComponente('area-popup-confirmar-arquivo-remover', 'components/popup/popup-confirmar-arquivo-remover.html'),
        carregarComponente('area-popup-arquivo-form', 'components/popup/popup-arquivo-form.html'),
        carregarComponente('area-popup-criar-share', 'components/popup/popup-criar-share.html'),
        carregarComponente('area-popup-confirmar-amigo', 'components/popup/popup-confirmar-amigo.html'),
        carregarComponente('area-popup-gestao-share', 'components/popup/popup-share-nota.html'),
        carregarComponente('area-popup-gestao-avisos', 'components/popup/popup-gestao-avisos.html'),
        carregarComponente('area-popup-gestao-item-local', 'components/local/popups-gestao.html'),
        carregarComponente('area-popup-partilhar-v2', 'components/popup/popup-partilhar-v2.html'),
        carregarComponente('area-popup-blackbox', 'components/popup/popup-confirmar-blackbox.html'),
        carregarComponente('area-popup-recycle-viewer', 'components/popup/popup-recycle-viewer.html'),
        carregarComponente('area-popup-webcard', 'components/popup/popup-webcard-form.html'),
        carregarComponente('area-popup-imagens', 'components/popup/popup-imagens-form.html'),
        carregarComponente('area-popup-noticias', 'components/popup/popup-noticias-form.html'),
        carregarComponente('area-popup-tempo', 'components/popup/popup-tempo-form.html'),
        carregarComponente('area-popup-inspirador', 'components/popup/popup-inspirador-form.html'),
        carregarComponente('area-popup-gmail', 'components/popup/popup-gmail-form.html'),
        carregarComponente('area-popup-sumariar', 'components/popup/popup-sumariar-form.html'),
            carregarComponente('area-popup-sumar-global', 'components/popup/popup-sumariar-global.html')
        ]);
    } catch (erro) {
        console.error('[BOOT] Não foi possível carregar a interface:', erro);
        const texto = document.querySelector('#loading-screen .loading-text');
        if (texto) texto.textContent = 'Não foi possível carregar a aplicação.';
        throw erro;
    }

    inicializarSeletorFerramentas();
    mostrarEyeIdle();
    mostrarXSatIdle();

    // 2. INICIAR MOTORES
    MobileBottomSheet.iniciar(); 
    MobilePanelManager.iniciar();
    iniciarAutenticacao(app, db, { gerirLoading: false }); 
    iniciarCodexBrowser(); 
    iniciarXSat();
    iniciarControladorEsquerda();

    // 3. VIGIAR LOGIN
    async function removerEcraCarregamento(loadingScreen) {
        if (!loadingScreen) return;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        loadingScreen.style.opacity = '0';
        await new Promise((resolve) => setTimeout(resolve, 500));
        loadingScreen.style.display = 'none';
    }

    onAuthStateChanged(authInstance, async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');
        const areaEsquerda = document.getElementById('area-esquerda');
        const overlay = document.getElementById('mobile-overlay');

        if (user) {
            console.log("🚀 Sessão ativa:", user.email);
            
            // 1. Esconder ecrã de login
            if (loginScreen) loginScreen.style.display = 'none';

            const hasUrlNota = new URLSearchParams(window.location.search).has('nota');
            const preCargaNotaArranque = hasUrlNota ? null : precarregarNotaArranque(db, authInstance);
            const promessaNotaUrl = hasUrlNota ? abrirNotaDaUrl(db, authInstance) : Promise.resolve(false);
            const preCargaResolved = hasUrlNota ? null : await preCargaNotaArranque;
            const hasArranqueMobile = isMobileViewport() && (!!preCargaResolved || hasUrlNota);

            // 2. FORÇAR BARRA ABERTA NO MOBILE
            if (isMobileViewport()) {
                if (hasArranqueMobile) {
                    areaEsquerda.classList.add('closed');
                    overlay.classList.remove('active');
                } else {
                    areaEsquerda.classList.remove('closed');
                    overlay.classList.add('active');
                }
            }

            // 3. INICIALIZAR TUDO
            const promessaLeituraLocal = inicializarLeituraLocal(db, authInstance);
            inicializarCriacaoPasta(db, authInstance);
            inicializarCriacaoNota(db, authInstance);
            const promessaLists = inicializarLists(db, authInstance);

            const [preferencias, abriuNotaDaUrl] = await Promise.all([
                inicializarSettings(db, authInstance),
                promessaNotaUrl,
                promessaLeituraLocal,
                promessaLists
            ]);
            if (!abriuNotaDaUrl) await abrirNotaDeArranque(db, authInstance, preferencias, preCargaResolved);

            MobileBibleBar.iniciar();
            inicializarLeituraShare(db, authInstance);
            inicializarCriacaoShare(db, authInstance);
            inicializarAmigos(db, authInstance);
            inicializarGestaoLocal();
            inicializarLeituraPins(db, authInstance);
            iniciarSelectorBiblia();
            const promessaNotificacoesShare = vigiarConvitesPendentes(db, authInstance);
            vigiarConvitesEntrada(db, authInstance);

            // Só fechar depois de o Share entregar o primeiro estado das notificações.
            await promessaNotificacoesShare;

            await removerEcraCarregamento(loadingScreen);

        } else {
            setTimeout(() => {
                if (!authInstance.currentUser) {
                    if (loadingScreen) loadingScreen.style.display = 'none';
                    if (loginScreen) loginScreen.style.display = 'flex';
                }
            }, 1000);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-fechar-popup')) {
            document.getElementById('popup-criar-overlay')?.classList.remove('active');
            return;
        }

        if (e.target.closest('#btn-add-novo-inline, #btn-add-share')) {
            const popupId = e.target.closest('#btn-add-share') ? 'popup-criar-share-overlay' : 'popup-criar-overlay';
            const popup = document.getElementById(popupId);
            if (popup) popup.classList.add('active');
            return;
        }

        const btnBrain = e.target.closest('#header-action-biblia button, #header-action-container button, #biblio-header-action-container button');
        if (btnBrain) {
            const icon = btnBrain.querySelector('i');
            if (!icon) return;

            if (icon.classList.contains('fa-plus')) {
                const abaAtiva = document.querySelector('.cosmos-nav-icons i.active')?.dataset.aba;
                if (abaAtiva === 'puzzle') {
                    window.dispatchEvent(new CustomEvent('bible:adicionarTexto'));
                    window.dispatchEvent(new CustomEvent('cosmos:adicionarTexto'));
                } else if (abaAtiva === 'dossie') {
                    window.dispatchEvent(new CustomEvent('brain:abrirReferenciaMica'));
                }
            } else if (icon.classList.contains('fa-link')) {
                window.dispatchEvent(new CustomEvent('brain:abrirPopupFontes'));
            } else if (icon.classList.contains('fa-folder-plus')) {
                window.dispatchEvent(new CustomEvent('brain:abrirMicaPopup'));
            }
            return;
        }

        const btnNexo = e.target.closest('.btn-nexo-ai');
        if (btnNexo) {
            const containerPai = btnNexo.closest('div[style*="border-radius"]'); 
            const areaTexto = containerPai.querySelector('textarea');
            if (areaTexto && typeof window.dispararNexoAI === 'function') {
                window.dispararNexoAI(areaTexto.value);
            }
            return; 
        }

    if (e.target.id === 'mobile-overlay') {
    // 1. Fecha o menu da esquerda normalmente
    if (window.MobilePanelManager) window.MobilePanelManager.fechar('left');
    else document.getElementById('area-esquerda').classList.add('closed');
    
    // 2. 🚀 NÃO FECHA A DIREITA (Comenta ou apaga a linha abaixo se ela existir)
    // document.getElementById('area-direita').classList.remove('active');

    // 3. Só remove o overlay se a direita também estiver fechada (clicada no X)
    const dir = document.getElementById('area-direita');
    if (!dir.classList.contains('active')) {
        document.getElementById('mobile-overlay').classList.remove('active');
    }
}
    });

window.switchPanel = (p) => {

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.segmented-control button').forEach(b => b.classList.remove('active'));
    
    const targetPanel = document.getElementById('panel-' + p);
    const targetBtn = document.getElementById('btn-' + p);
    
    if(targetPanel) targetPanel.classList.add('active');
    if(targetBtn) targetBtn.classList.add('active');

    if (p === 'xsat') {
        const temNotaAtiva = Boolean(window.notaAtualContext?.notaId || window.notaAbertaId);
        if (!temNotaAtiva) {
            mostrarXSatIdle();
            return;
        }

        ocultarXSatIdle();
        // 🚀 O SEGREDO: Sempre que clicas no botão X-SAT lá no topo:
        const btnXSat = document.querySelector('.xsat-num[data-num="1"]');
        if (btnXSat) btnXSat.click();
    }

    if (isMobileViewport()) window.MobilePanelManager?.abrir('right');

    if (p === 'brain' && !document.querySelector('.cosmos-brain-wrapper')) {
        mostrarBrainIdle();
    }
};

    document.getElementById('btn-mobile-esquerda').onclick = () => window.MobilePanelManager?.abrir('left');
    document.getElementById('btn-mobile-direita').onclick = () => window.MobilePanelManager?.abrir('right');
