import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { isMobileViewport } from '../ui/mobile-device.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { inicializarAmigos } from './amigos.js';
import {
    DEFAULT_LIST_FUSEIS,
    aplicarPreferenciasDeNota,
    carregarPreferenciasUtilizador,
    guardarConfigNota,
    guardarPreferenciasUtilizador,
    normalizarFuseis,
    obterConfigNota,
    obterConfigNotaEfetiva
} from './preferences.js';
import { aplicarPreferenciaBotaoColapsoColunaEsquerda, iniciarControloColunaEsquerda } from '../ui/left-column-collapse.js';
import { aplicarPreferenciaBotaoColapsoColunaDireita, iniciarControloColunaDireita } from '../ui/right-column-collapse.js';
import { inicializarArranque } from './startup.js';
import { inicializarManual } from '../manual/manual.js';
import { inicializarPlanos, obterPlanoAtual } from '../billing/billing-client.js';
import { inicializarAdminFeatures, obterFeaturesDisponiveis } from './feature-admin.js';
import { PAINEL_UTILIZADOR_ABAS } from './user-panel-tabs.js';
import { inicializarLoja } from '../store/tool-store.js';
import { criarAjustadorAlturaAbas } from '../ui/fixed-tabs-height.js';
import { carregarAcessoFuseisList, filtrarFuseisDisponiveis } from '../lists/list-fuseis.js';

let userPrefs = null;

export async function inicializarSettings(db, auth) {
    const user = auth.currentUser;
    if (!user) return;

    const overlay = document.getElementById('popup-settings-overlay');
    const btnAbrir = document.getElementById('btnDefinicoes');
    const btnFechar = document.getElementById('btn-fechar-settings');
    const settingsRoot = overlay || document;
    const areaPainelUtilizador = settingsRoot.querySelector('.settings-content-wrapper');
    const paineisUtilizador = [...document.querySelectorAll('.setting-content')];
    const ajustadorAlturaPainelUtilizador = criarAjustadorAlturaAbas({
        area: areaPainelUtilizador,
        paineis: paineisUtilizador,
        obterEstado: painel => painel.style.display !== 'none',
        definirVisivel: (painel, visivel) => { painel.style.display = visivel ? 'block' : 'none'; },
        alturaExtra: 40,
        limiteAltura: () => Math.floor(window.innerHeight * 0.70),
        observarAlteracoes: true
    });

    let sincronizarPainelAtivo = () => {};

    if (btnAbrir) btnAbrir.onclick = () => {
        overlay?.classList.add('active');
        sincronizarPainelAtivo();
        requestAnimationFrame(() => ajustadorAlturaPainelUtilizador.atualizar());
    };
    if (btnFechar) btnFechar.onclick = () => {
        overlay?.classList.remove('active');
        const refineContainer = document.getElementById('refine-search-container');
        if (refineContainer) refineContainer.style.display = 'none';
    };

    // Os separadores da janela não dependem das preferências nem do Firestore.
    // Devem ficar utilizáveis mesmo quando a leitura da conta está lenta ou falha.
    sincronizarPainelAtivo = ativarTabs(db, user.uid, overlay);

    try {
        userPrefs = await carregarPreferenciasUtilizador(db, user.uid);
    } catch (erro) {
        console.error('[SETTINGS] Não foi possível carregar as preferências do utilizador:', erro);
        userPrefs = {};
    }
    window.NotaBookUserPrefs = userPrefs;

    iniciarControloColunaEsquerda();
    iniciarControloColunaDireita();
    aplicarSliders(userPrefs.tamanholetra || {});
    aplicarToggles(userPrefs);
    renderFuseis(db, auth);
    window.addEventListener('notabook:list-feature-access-updated', () => renderFuseis(db, auth));
    aplicarAcessoAbasPainel(auth).catch(erro => {
        console.info('[SETTINGS] Não foi possível validar as abas do Painel de Utilizador:', erro.message);
    });
    ativarSubAbasDefinicoes();
    bindSliders(db, user.uid);
    bindAvatares(db, user.uid, userPrefs.avatar || "gear");
    bindToggles(db, auth);
    bindLogout(auth);
    bindSearch(db, auth, overlay);
    inicializarAmigos(db, auth);
    ativarFiltroDispositivo();
    inicializarArranque(db, auth, userPrefs);
    ativarVisibilidadeBarraSuperior();
    inicializarManual();
    inicializarPlanos();
    inicializarLoja(db, auth, userPrefs);
    inicializarAdminFeatures(auth);
    return userPrefs;
}

function ativarVisibilidadeBarraSuperior() {
    const aplicar = () => {
        const desktopHidden = userPrefs?.barraSuperiorDesktop === false;
        const mobileHidden = window.notaAtualContext
            ? userPrefs?.barraSuperiorMobileNota === false
            : userPrefs?.barraSuperiorMobilePrincipal === false;
        document.body.classList.toggle('barra-superior-oculta-desktop', desktopHidden);
        document.body.classList.toggle('barra-superior-oculta-mobile', mobileHidden);
    };

    window.addEventListener('nota:aberta', aplicar);
    window.addEventListener('nota:fechada', aplicar);
    aplicar();
    window.atualizarVisibilidadeBarraSuperior = aplicar;
}

function ativarFiltroDispositivo() {
    const filters = document.querySelectorAll('[data-device-filter]');
    const options = document.querySelectorAll('#set-fontes .font-info');

    filters.forEach(filter => {
        filter.onclick = () => {
            const device = filter.dataset.deviceFilter;
            filters.forEach(item => {
                const active = item === filter;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', String(active));
            });

            options.forEach(option => {
                const control = option.closest('.field-font')?.querySelector('input');
                const varName = control?.dataset.var || '';
                const optionDevice = option.dataset.deviceOption
                    || ((control?.id || '').endsWith('-mobile') || varName.endsWith('-mobile') ? 'mobile' : varName.includes('editor-texto-desktop') || varName.includes('biblia') || varName === '--fs-left-items' || varName === '--fs-right-results' || control?.id === 'check-colapso-titulos' || control?.id === 'check-colapso-titulo-nota' ? 'desktop' : 'shared');
                const visible = optionDevice === 'shared' || optionDevice === device;
                option.closest('.field-font').style.display = visible ? '' : 'none';
            });
        };
    });

    filters[0]?.click();
}

function ativarTabs(db, uid, overlay) {
    const settingsRoot = overlay || document;
    const tabs = settingsRoot.querySelectorAll('.tab-settings:not(#btn-abrir-manual)');
    // Os painéis podem ser inseridos por um carregador de componentes fora da
    // raiz inicialmente encontrada. A classe é exclusiva deste popup, por isso
    // a procura global mantém compatibilidade com as versões anteriores.
    const paineisPorClasse = [...document.querySelectorAll('.setting-content')];
    const paineisPorAlvo = [...tabs]
        .map(tab => tab.dataset.target)
        .filter(Boolean)
        .map(id => document.getElementById(id))
        .filter(Boolean);
    const paineis = [...new Set([...paineisPorClasse, ...paineisPorAlvo])];

    const aplicarPainelAtivo = (targetId) => {
        const painelAlvo = [...paineis].find(painel => painel.id === targetId);
        const abaAlvo = [...tabs].find(tab => (
            tab.dataset.target === targetId
            && !tab.hidden
            && tab.dataset.adminAuthorized !== 'false'
        ));
        const primeiroAlvo = [...tabs].find(tab => (
            tab.dataset.target
            && !tab.hidden
            && tab.dataset.adminAuthorized !== 'false'
            && [...paineis].some(painel => painel.id === tab.dataset.target)
        ));
        const alvo = painelAlvo && abaAlvo ? targetId : primeiroAlvo?.dataset.target;

        tabs.forEach(tab => {
            const ativo = Boolean(alvo && tab.dataset.target === alvo);
            tab.classList.toggle('active', ativo);
            tab.setAttribute('aria-selected', String(ativo));
        });
        paineis.forEach(painel => {
            const ativo = painel.id === alvo;
            painel.style.display = ativo ? 'block' : 'none';
            painel.setAttribute('aria-hidden', String(!ativo));
        });
    };

    tabs.forEach(tab => {
        tab.onclick = () => {
            const targetId = tab.getAttribute('data-target');
            const acessoAdminPendente = targetId === 'set-admin-features'
                && tab.dataset.adminAuthorized !== 'true';

            if (targetId === 'set-planos') {
                console.log('[SETTINGS][clique-planos]', {
                    painelEncontrado: Boolean(document.getElementById(targetId)),
                    paineisEncontrados: paineis.length
                });
            }

            if (tab.hidden || acessoAdminPendente) return;

            aplicarPainelAtivo(targetId);

            if (targetId === 'set-reciclagem') {
                import('./recycle-manager.js')
                    .then(modulo => modulo.carregarTodaReciclagem(db, uid))
                    .catch(erro => {
                        console.error('[SETTINGS] Não foi possível carregar a Reciclagem:', erro);
                        const container = document.getElementById('lista-reciclagem-expirada');
                        if (container) container.textContent = 'Não foi possível carregar a Reciclagem.';
                    });
            }
        };
    });

    const abaInicial = [...tabs].find(tab => tab.classList.contains('active') && tab.dataset.target)
        || [...tabs].find(tab => tab.dataset.target);
    aplicarPainelAtivo(abaInicial?.dataset.target || 'set-geral');
    return () => aplicarPainelAtivo(
        settingsRoot.querySelector('.tab-settings.active[data-target]')?.dataset.target || 'set-geral'
    );
}

async function aplicarAcessoAbasPainel(auth) {
    const dados = await obterFeaturesDisponiveis(auth);
    const porChave = new Map(dados.map(feature => [feature.feature_key, feature]));
    const abasVisiveis = [];

    PAINEL_UTILIZADOR_ABAS.forEach(aba => {
        const elemento = aba.buttonId
            ? document.getElementById(aba.buttonId)
            : document.querySelector(`.tab-settings[data-target="${aba.target}"]`);
        if (!elemento) return;

        // A ausência da migração mantém a aba acessível até a feature ser criada.
        const feature = porChave.get(aba.key);
        const permitido = !feature || (Number(feature.active) === 1 && feature.allowed !== false);
        elemento.hidden = !permitido;
        if (permitido) abasVisiveis.push(elemento);
    });

    const abaActiva = document.querySelector('.tab-settings.active');
    if (abaActiva?.hidden) abasVisiveis[0]?.click();
}

function ativarSubAbasDefinicoes() {
    const root = document.getElementById('set-fontes');
    const nav = root?.querySelector('.settings-subtabs');
    if (!root || !nav || nav.dataset.organizado === 'true') return;

    const mapaSecoes = [
        { chave: 'paineis', icone: 'fa-table-columns' },
        { chave: 'notas', icone: 'fa-boxes-stacked' },
        { chave: 'biblia', icone: 'fa-book-open' },
        { chave: 'arranque', icone: 'fa-power-off' },
        { chave: 'barra-topo', icone: 'fa-bars' },
        { chave: 'partilhar', icone: 'fa-comments' }
    ];

    const filhos = Array.from(root.children);
    const titulos = filhos.filter(elemento => elemento.classList.contains('set-section-title'));
    const grupos = new Map();

    titulos.forEach((titulo, indice) => {
        const icone = titulo.querySelector('i')?.classList;
        const secao = mapaSecoes.find(item => item.chave === titulo.dataset.settingsSection)
            || mapaSecoes.find(item => icone?.contains(item.icone));
        if (!secao) return;

        const proximoTitulo = titulos[indice + 1];
        const grupo = [titulo];
        let elemento = titulo.nextElementSibling;
        while (elemento && elemento !== proximoTitulo) {
            grupo.push(elemento);
            elemento = elemento.nextElementSibling;
        }
        grupos.set(secao.chave, grupo);
    });

    // Não deixar conteúdo órfão desaparecer se for acrescentada uma secção
    // nova sem ainda existir uma subaba correspondente.
    const elementosAtribuidos = new Set([...grupos.values()].flat());
    const conteudoOrfao = filhos.filter(elemento => (
        elemento !== nav
        && elemento !== root.querySelector('.settings-device-filters')
        && !elementosAtribuidos.has(elemento)
    ));
    if (conteudoOrfao.length) {
        const grupoPrincipal = grupos.get('paineis') || [];
        grupos.set('paineis', [...grupoPrincipal, ...conteudoOrfao]);
    }

    const filtrosDispositivo = root.querySelector('.settings-device-filters');
    const fragmento = document.createDocumentFragment();
    fragmento.appendChild(nav);
    if (filtrosDispositivo) fragmento.appendChild(filtrosDispositivo);

    mapaSecoes.forEach((secao, indice) => {
        const painel = document.createElement('div');
        painel.className = 'settings-subpanel';
        painel.dataset.settingsPanel = secao.chave;
        painel.hidden = indice !== 0;
        (grupos.get(secao.chave) || []).forEach(elemento => {
            if (elemento !== filtrosDispositivo) painel.appendChild(elemento);
        });
        fragmento.appendChild(painel);
    });
    root.replaceChildren(fragmento);

    const botoes = root.querySelectorAll('[data-settings-subtab]');
    const paineis = root.querySelectorAll('[data-settings-panel]');
    botoes.forEach(botao => {
        botao.onclick = () => {
            const alvo = botao.dataset.settingsSubtab;
            botoes.forEach(item => {
                const ativo = item === botao;
                item.classList.toggle('active', ativo);
                item.setAttribute('aria-selected', String(ativo));
            });
            paineis.forEach(painel => {
                painel.hidden = painel.dataset.settingsPanel !== alvo;
            });
            if (filtrosDispositivo) filtrosDispositivo.hidden = alvo === 'partilhar';
        };
    });
    if (filtrosDispositivo) filtrosDispositivo.hidden = false;
    nav.dataset.organizado = 'true';
}

function aplicarSliders(values) {
    Object.entries(values).forEach(([varName, value]) => {
        document.documentElement.style.setProperty(varName, `${value}px`);
        const input = document.querySelector(`input[data-var="${varName}"]`);
        if (input) input.value = value;
    });
    aplicarFontesResponsivas(values);
}

function aplicarToggles(prefs) {
    const toolCollapse = document.getElementById('check-colapso-titulos');
    if (toolCollapse) toolCollapse.checked = Boolean(prefs.colapsoTitulos);
    document.body.classList.toggle('modo-colapso-titulos', Boolean(prefs.colapsoTitulos));

    const toolCollapseMobile = document.getElementById('check-colapso-titulos-mobile');
    if (toolCollapseMobile) toolCollapseMobile.checked = Boolean(prefs.colapsoTitulosMobile);
    document.body.classList.toggle('modo-colapso-titulos-mobile', Boolean(prefs.colapsoTitulosMobile));

    const noteCollapse = document.getElementById('check-colapso-titulo-nota');
    if (noteCollapse) noteCollapse.checked = Boolean(prefs.noteTitleCollapse);
    document.body.classList.toggle('modo-colapso-titulos-nota', Boolean(prefs.noteTitleCollapse));

    const noteCollapseMobile = document.getElementById('check-colapso-titulo-nota-mobile');
    if (noteCollapseMobile) noteCollapseMobile.checked = Boolean(prefs.noteTitleCollapseMobile);
    document.body.classList.toggle('modo-colapso-titulos-nota-mobile', Boolean(prefs.noteTitleCollapseMobile));

    const topDesktop = document.getElementById('check-barra-superior-desktop');
    if (topDesktop) topDesktop.checked = prefs.barraSuperiorDesktop !== false;
    const topMobileNota = document.getElementById('check-barra-superior-mobile-nota');
    if (topMobileNota) topMobileNota.checked = prefs.barraSuperiorMobileNota !== false;
    const topMobilePrincipal = document.getElementById('check-barra-superior-mobile-principal');
    const mobileBibleHelper = document.getElementById("check-barra-biblica-teclado-mobile");
    if (mobileBibleHelper) mobileBibleHelper.checked = prefs.mobileBibleHelperBar !== false;
    if (topMobilePrincipal) topMobilePrincipal.checked = prefs.barraSuperiorMobilePrincipal !== false;

    const shareAnswers = document.getElementById('check-partilhar-respostas');
    if (shareAnswers) shareAnswers.checked = prefs.shareAnswers === "on";

    const sublinhadosBibliaLists = document.getElementById('check-sublinhados-biblia-lists');
    if (sublinhadosBibliaLists) sublinhadosBibliaLists.checked = prefs.sublinhadosBibliaLists === true;

    const leftCollapse = document.getElementById('check-colapso-coluna-esquerda');
    if (leftCollapse) leftCollapse.checked = Boolean(prefs.leftColumnCollapseButton);
    aplicarPreferenciaBotaoColapsoColunaEsquerda(Boolean(prefs.leftColumnCollapseButton));

    const rightCollapse = document.getElementById('check-colapso-coluna-direita');
    if (rightCollapse) rightCollapse.checked = Boolean(prefs.rightColumnCollapseButton);
    aplicarPreferenciaBotaoColapsoColunaDireita(Boolean(prefs.rightColumnCollapseButton));

    atualizarIconeBotaoTopo(prefs.avatar || "gear");
    syncCurrentNoteToggle();
}

function bindSliders(db, uid) {
    const sliders = document.querySelectorAll('input[data-var]');
    sliders.forEach(slider => {
        slider.addEventListener('input', async () => {
            const varName = slider.dataset.var;
            const value = Number(slider.value);
            document.documentElement.style.setProperty(varName, `${value}px`);
            userPrefs.tamanholetra = { ...(userPrefs.tamanholetra || {}), [varName]: value };
            aplicarFontesResponsivas(userPrefs.tamanholetra);
            await guardarPreferenciasUtilizador(db, uid, { tamanholetra: userPrefs.tamanholetra });
        });
    });
}

async function bindAvatares(db, uid, currentAvatar) {
    const niveisPlano = { free: 0, premium: 1, premium_plus: 2 };
    let planoAtual = 'free';

    const aplicarAcesso = async () => {
        try {
            const dadosPlano = await obterPlanoAtual();
            planoAtual = Object.prototype.hasOwnProperty.call(niveisPlano, dadosPlano?.plan)
                ? dadosPlano.plan
                : 'free';
        } catch (erro) {
            console.warn('[SETTINGS] Não foi possível verificar o plano dos avatares:', erro.message);
            planoAtual = 'free';
        }

        const itens = [...document.querySelectorAll('.avatar-item')];
        const itensPermitidos = [];
        itens.forEach(item => {
            const planoMinimo = item.dataset.minPlan || 'free';
            const permitido = niveisPlano[planoAtual] >= (niveisPlano[planoMinimo] ?? 0);
            item.hidden = false;
            item.classList.toggle('avatar-item--locked', !permitido);
            item.setAttribute('aria-hidden', 'false');
            item.setAttribute('aria-disabled', String(!permitido));
            if (permitido) itensPermitidos.push(item);
        });

        let avatarSelecionado = currentAvatar;
        const avatarAtualPermitido = itensPermitidos.some(item => item.dataset.avatar === avatarSelecionado);
        if (avatarSelecionado !== 'gear' && !avatarAtualPermitido) {
            avatarSelecionado = 'user';
            currentAvatar = avatarSelecionado;
            userPrefs.avatar = avatarSelecionado;
            await guardarPreferenciasUtilizador(db, uid, { avatar: avatarSelecionado });
            atualizarIconeBotaoTopo(avatarSelecionado);
        }

        itens.forEach(item => {
            const podeEscolher = itensPermitidos.includes(item);
            item.classList.toggle('active', podeEscolher && item.dataset.avatar === avatarSelecionado);
            item.onclick = podeEscolher
                ? async () => {
                    const avatar = item.dataset.avatar;
                    itens.forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    atualizarIconeBotaoTopo(avatar);
                    userPrefs.avatar = avatar;
                    await guardarPreferenciasUtilizador(db, uid, { avatar });
                }
                : () => window.alert(`Este avatar requer o plano ${item.dataset.minPlan === 'premium_plus' ? 'Premium Plus' : 'Premium'}.`);
        });
    };

    await aplicarAcesso();
    window.addEventListener('notabook:plan-preview-changed', aplicarAcesso);
}

function bindToggles(db, auth) {
    const uid = auth.currentUser?.uid;
    const sublinhadosBibliaLists = document.getElementById('check-sublinhados-biblia-lists');
    if (sublinhadosBibliaLists) {
        sublinhadosBibliaLists.onchange = async () => {
            userPrefs.sublinhadosBibliaLists = sublinhadosBibliaLists.checked;
            window.NotaBookUserPrefs = { ...(window.NotaBookUserPrefs || {}), sublinhadosBibliaLists: sublinhadosBibliaLists.checked };
            await guardarPreferenciasUtilizador(db, uid, { sublinhadosBibliaLists: sublinhadosBibliaLists.checked });
            window.dispatchEvent(new CustomEvent('preferencias:sublinhados-biblia-lists'));
        };
    }
    const checkColapso = document.getElementById('check-colapso-titulos');
    if (checkColapso) {
        checkColapso.onchange = async (e) => {
            const checked = e.target.checked;
            document.body.classList.toggle('modo-colapso-titulos', checked);
            userPrefs.colapsoTitulos = checked;
            await guardarPreferenciasUtilizador(db, uid, { colapsoTitulos: checked });
            window.refreshNotaAtualBook?.();
        };
    }

    const checkColapsoNota = document.getElementById('check-colapso-titulo-nota');
    if (checkColapsoNota) {
        checkColapsoNota.onchange = async (e) => {
            const checked = e.target.checked;
            document.body.classList.toggle('modo-colapso-titulos-nota', checked);
            userPrefs.noteTitleCollapse = checked;
            await guardarPreferenciasUtilizador(db, uid, { noteTitleCollapse: checked });
            window.refreshNotaAtualBook?.();
        };
    }

    const checkColapsoMobile = document.getElementById('check-colapso-titulos-mobile');
    if (checkColapsoMobile) {
        checkColapsoMobile.onchange = async (e) => {
            const checked = e.target.checked;
            document.body.classList.toggle('modo-colapso-titulos-mobile', checked);
            userPrefs.colapsoTitulosMobile = checked;
            await guardarPreferenciasUtilizador(db, uid, { colapsoTitulosMobile: checked });
            window.refreshNotaAtualBook?.();
        };
    }

    const checkColapsoNotaMobile = document.getElementById('check-colapso-titulo-nota-mobile');
    if (checkColapsoNotaMobile) {
        checkColapsoNotaMobile.onchange = async (e) => {
            const checked = e.target.checked;
            document.body.classList.toggle('modo-colapso-titulos-nota-mobile', checked);
            userPrefs.noteTitleCollapseMobile = checked;
            await guardarPreferenciasUtilizador(db, uid, { noteTitleCollapseMobile: checked });
            window.refreshNotaAtualBook?.();
        };
    }

    const barraSuperior = [
        ['check-barra-superior-desktop', 'barraSuperiorDesktop'],
        ['check-barra-superior-mobile-nota', 'barraSuperiorMobileNota'],
        ['check-barra-superior-mobile-principal', 'barraSuperiorMobilePrincipal']
    ];
    barraSuperior.forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.onchange = async () => {
            userPrefs[key] = input.checked;
            await guardarPreferenciasUtilizador(db, uid, { [key]: input.checked });
            window.atualizarVisibilidadeBarraSuperior?.();
        };
    });

    const mobileBibleHelper = document.getElementById("check-barra-biblica-teclado-mobile");
    if (mobileBibleHelper) {
        mobileBibleHelper.onchange = async () => {
            userPrefs.mobileBibleHelperBar = mobileBibleHelper.checked;
            if (window.NotaBookUserPrefs) window.NotaBookUserPrefs.mobileBibleHelperBar = mobileBibleHelper.checked;
            await guardarPreferenciasUtilizador(db, uid, { mobileBibleHelperBar: mobileBibleHelper.checked });
            document.body.dispatchEvent(new CustomEvent("mobile-bible-helper-preference", { detail: { enabled: mobileBibleHelper.checked } }));
        };
    }

    const checkShare = document.getElementById('check-partilhar-respostas');
    if (checkShare) {
        checkShare.onchange = async (e) => {
            const checked = e.target.checked;
            userPrefs.shareAnswers = checked ? "on" : "off";
            await guardarPreferenciasUtilizador(db, uid, { shareAnswers: userPrefs.shareAnswers });
        };
    }

    const checkColapsoEsquerda = document.getElementById('check-colapso-coluna-esquerda');
    if (checkColapsoEsquerda) {
        checkColapsoEsquerda.onchange = async (e) => {
            const checked = e.target.checked;
            userPrefs.leftColumnCollapseButton = checked;
            aplicarPreferenciaBotaoColapsoColunaEsquerda(checked);
            await guardarPreferenciasUtilizador(db, uid, { leftColumnCollapseButton: checked });
        };
    }

    const checkColapsoDireita = document.getElementById('check-colapso-coluna-direita');
    if (checkColapsoDireita) {
        checkColapsoDireita.onchange = async (e) => {
            const checked = e.target.checked;
            userPrefs.rightColumnCollapseButton = checked;
            aplicarPreferenciaBotaoColapsoColunaDireita(checked);
            await guardarPreferenciasUtilizador(db, uid, { rightColumnCollapseButton: checked });
        };
    }

    const checkDiarioLinhas = document.getElementById('check-diario-linhas');
    if (checkDiarioLinhas) {
        checkDiarioLinhas.onchange = async (e) => {
            const current = getCurrentNoteCtx();
            if (!current) {
                e.target.checked = false;
                return;
            }
            const merged = await guardarConfigNota(db, current.notaId, current.dadosNota, uid, {
                diarioLines: e.target.checked
            });
            current.dadosNota = { ...current.dadosNota };
            aplicarPreferenciasDeNota({
                ...merged,
                collapseNoteTitle: merged.collapseNoteTitle,
                collapseToolTitles: merged.collapseToolTitles
            });
            syncCurrentNoteToggle();
            window.refreshNotaAtualBook?.();
            if (typeof window.atualizarFeedEGravarGlobal === 'function') {
                window.atualizarFeedEGravarGlobal(false);
            }
        };
    }
}

function aplicarFontesResponsivas(values = {}) {
    const desktop = Number(values['--fs-editor-texto-desktop'] ?? values['--fs-editor-texto'] ?? 15);
    const mobile = Number(values['--fs-editor-texto-mobile'] ?? values['--fs-editor-texto'] ?? desktop);
    const bibleEyeMobile = Number(values['--fs-biblia-coluna-inteligente-mobile'] ?? values['--fs-biblia-coluna-inteligente'] ?? 13);
    const bibleBoxMobile = Number(values['--fs-biblia-box-mobile'] ?? values['--fs-biblia-box'] ?? 45);
    const bibleVersesMobile = Number(values['--fs-biblia-versiculos-mobile'] ?? values['--fs-biblia-versiculos'] ?? 14);
    const leftItemsMobile = Number(values['--fs-left-items-mobile'] ?? values['--fs-left-items'] ?? 13);
    const rightResultsMobile = Number(values['--fs-right-results-mobile'] ?? values['--fs-right-results'] ?? 13);
    document.documentElement.style.setProperty('--fs-editor-texto-desktop', `${desktop}px`);
    document.documentElement.style.setProperty('--fs-editor-texto-mobile', `${mobile}px`);
    document.documentElement.style.setProperty('--fs-biblia-coluna-inteligente-mobile', `${bibleEyeMobile}px`);
    document.documentElement.style.setProperty('--fs-biblia-box-mobile', `${bibleBoxMobile}px`);
    document.documentElement.style.setProperty('--fs-biblia-versiculos-mobile', `${bibleVersesMobile}px`);
    document.documentElement.style.setProperty('--fs-left-items-mobile', `${leftItemsMobile}px`);
    document.documentElement.style.setProperty('--fs-right-results-mobile', `${rightResultsMobile}px`);
    document.documentElement.style.setProperty('--fs-editor-texto', `${isMobileViewport() ? mobile : desktop}px`);
}

window.addEventListener('resize', () => {
    if (!userPrefs) return;
    aplicarFontesResponsivas(userPrefs.tamanholetra || {});
});

function bindLogout(auth) {
    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) btnSair.onclick = () => signOut(auth).then(() => window.location.reload());
}

async function renderFuseis(db, auth) {
    const container = document.getElementById('fuseis-list');
    if (!container) return;

    container.textContent = 'A validar as funcionalidades do teu plano…';
    try {
        await carregarAcessoFuseisList(auth);
    } catch (erro) {
        console.info('[SETTINGS] Não foi possível validar os fusíveis condicionados pelo plano:', erro.message);
    }

    const fuseis = normalizarFuseis(userPrefs?.listsFuseis);
    container.innerHTML = "";
    filtrarFuseisDisponiveis().forEach(item => {
        const row = document.createElement('div');
        row.className = 'fuse-row';
        row.innerHTML = `
            <div class="fuse-copy">
                <strong>${item.label}</strong>
                <span>${item.desc}</span>
            </div>
            <label class="switch-container">
                <input type="checkbox" data-fuse-key="${item.key}" ${fuseis[item.key] ? 'checked' : ''}>
                <span class="switch-slider"></span>
            </label>
        `;
        container.appendChild(row);
    });

    container.querySelectorAll('input[data-fuse-key]').forEach(input => {
        input.onchange = async () => {
            const key = input.dataset.fuseKey;
            userPrefs.listsFuseis = {
                ...normalizarFuseis(userPrefs?.listsFuseis),
                [key]: input.checked
            };
            window.NotaBookUserPrefs = userPrefs;
            await guardarPreferenciasUtilizador(db, auth.currentUser.uid, { listsFuseis: userPrefs.listsFuseis });
            window.renderizarMenuPrincipalLists?.();
            window.refreshOfficeLists?.();
        };
    });
}

function bindSearch(db, auth, overlay) {
    const btnBusca = document.getElementById('btn-executar-tab-search');
    const inputBusca = document.getElementById('input-tab-search');
    const inputRefine = document.getElementById('input-tab-refine');
    const refineContainer = document.getElementById('refine-search-container');
    const listaUI = document.getElementById('list-results-gps');
    const statusInfo = document.getElementById('search-status-info');
    if (!btnBusca || !inputBusca || !listaUI || !statusInfo || !inputRefine || !refineContainer) return;

    const executarBuscaGps = async (termo) => {
        if (!termo) return;

        btnBusca.disabled = true;
        btnBusca.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        listaUI.style.opacity = "0.4";
        statusInfo.innerHTML = `<div style="text-align:center; padding:10px; color:var(--primary);"><i class="fa-brands fa-mailchimp fa-bounce" style="font-size:30px; margin-bottom:10px; display:block;"></i><p style="font-family:monospace; font-size:9px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">VARRENDO A REDE...</p></div>`;

        try {
            const { AISearchEngine } = await import('../direita/ai-search-engine.js');
            const resultados = await AISearchEngine.procurar(termo, db, auth.currentUser.uid);

            listaUI.innerHTML = "";
            listaUI.style.opacity = "1";

            if (!resultados || resultados.length === 0) {
                statusInfo.innerHTML = `<span style="color:#f87171;">Nenhuma correspondência encontrada.</span>`;
            } else {
                statusInfo.innerHTML = `Encontrei <b>${resultados.length}</b> resultados:`;
                resultados.forEach(nota => {
                    const card = document.createElement('div');
                    const isShare = (nota.source && nota.source.toUpperCase() === "SHARE");
                    const corPrimaria = isShare ? "#ef4444" : "var(--primary)";
                    const bgCard = isShare ? "rgba(239, 68, 68, 0.08)" : "rgba(99, 102, 241, 0.08)";
                    const borderCard = isShare ? "rgba(239, 68, 68, 0.2)" : "rgba(99, 102, 241, 0.2)";

                    card.style.cssText = `background:${bgCard}; border:1px solid ${borderCard}; border-left:4px solid ${corPrimaria}; margin-bottom:10px; padding:15px; cursor:pointer; display:flex; flex-direction:column; gap:8px; border-radius:12px; transition:0.2s;`;
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <i class="fa-solid ${isShare ? 'fa-share-nodes' : 'fa-file-lines'}" style="color:${corPrimaria}; font-size:14px;"></i>
                                <span style="font-weight:800; color:white; font-size:15px; letter-spacing:0.3px;">${nota.title}</span>
                            </div>
                            <span style="font-size:8px; font-weight:900; color:${corPrimaria}; opacity:0.7; border:1px solid ${corPrimaria}; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${isShare ? 'SHARE' : 'LOCAL'}</span>
                        </div>
                        <div style="font-size:12.5px; color:var(--text-muted); padding-left:26px; font-style: italic; line-height:1.4; opacity:0.9;">
                            "${nota.snippet}..."
                        </div>
                    `;

                    card.onclick = async () => {
                        const idNotaLimpo = nota.id ? String(nota.id).trim() : null;
                        const idBlocoLimpo = nota.blockId ? String(nota.blockId).trim() : null;
                        if (!idNotaLimpo) return;
                        overlay?.classList.remove('active');

                        const noteRefLocal = doc(db, "Local", idNotaLimpo);
                        const localSnap = await getDoc(noteRefLocal);
                        if (localSnap.exists()) {
                            const { abrirNotaNoEditor } = await import('../editor/editor.js');
                            await abrirNotaNoEditor(idNotaLimpo, localSnap.data(), db, auth, idBlocoLimpo);
                            return;
                        }
                        const noteRefShare = doc(db, "Share", idNotaLimpo);
                        const shareSnap = await getDoc(noteRefShare);
                        if (shareSnap.exists()) {
                            const { abrirNotaNoEditor } = await import('../editor/editor.js');
                            await abrirNotaNoEditor(idNotaLimpo, shareSnap.data(), db, auth, idBlocoLimpo);
                        }
                    };
                    listaUI.appendChild(card);
                });

                refineContainer.style.display = 'block';
                inputRefine.value = "";
            }
        } catch (_) {
            statusInfo.innerHTML = `<span style="color:#ef4444;">Erro na varredura do satélite.</span>`;
        } finally {
            btnBusca.disabled = false;
            btnBusca.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
        }
    };

    btnBusca.onclick = () => executarBuscaGps(inputBusca.value.trim());
    inputBusca.onkeydown = (e) => { if (e.key === 'Enter') btnBusca.click(); };
    inputRefine.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const contextoExtra = inputRefine.value.trim();
            if (contextoExtra) executarBuscaGps(`No contexto anterior, foca agora em: ${contextoExtra}`);
        }
    };
}

function atualizarIconeBotaoTopo(avatar) {
    const btn = document.getElementById('btnDefinicoes');
    if (!btn) return;
    const icone = btn.querySelector('i');
    if (!icone) return;
    if (!avatar || avatar === "gear") {
        icone.className = "fa-solid fa-gear";
        return;
    }
    const prefixo = (avatar === 'discord' || avatar === 'xbox' || avatar === 'android' || avatar === 'web-awesome')
        ? 'fa-brands'
        : 'fa-solid';
    icone.className = `${prefixo} fa-${avatar}`;
}

function getCurrentNoteCtx() {
    return window.notaAtualContext || null;
}

export function syncCurrentNoteToggle() {
    const ctx = getCurrentNoteCtx();
    const checkDiario = document.getElementById('check-diario-linhas');
    if (!ctx?.dadosNota || !ctx?.auth?.currentUser) {
        if (checkDiario) {
            checkDiario.checked = false;
            checkDiario.disabled = true;
        }
        return;
    }
    const config = obterConfigNota(ctx.dadosNota, ctx.auth.currentUser.uid);
    if (checkDiario) {
        checkDiario.disabled = false;
        checkDiario.checked = Boolean(config.diarioLines);
    }
    aplicarPreferenciasDeNota(obterConfigNotaEfetiva(ctx.dadosNota, ctx.auth.currentUser.uid, userPrefs));
}
