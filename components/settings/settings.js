import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

const FUSEIS_META = [
    { key: "topicos", label: "Tópicos", desc: "Taxonomia e vínculos de tópico" },
    { key: "destaques", label: "Destaques", desc: "Pesquisa por cores e destaques" },
    { key: "biblia", label: "Bíblia", desc: "Mosaico e navegação bíblica" },
    { key: "textosBiblicos", label: "Textos Bíblicos", desc: "Versículos estudados" },
    { key: "marcadores", label: "Marcadores", desc: "Marcadores rápidos" },
    { key: "livros", label: "Livros", desc: "Biblioteca e publicações" },
    { key: "cosmos", label: "Cosmos", desc: "Temas e constelações" },
    { key: "palco", label: "Palco", desc: "Portal cultural e registos do PALCO" }
];

let userPrefs = null;

export async function inicializarSettings(db, auth) {
    const user = auth.currentUser;
    if (!user) return;

    const overlay = document.getElementById('popup-settings-overlay');
    const btnAbrir = document.getElementById('btnDefinicoes');
    const btnFechar = document.getElementById('btn-fechar-settings');

    if (btnAbrir) btnAbrir.onclick = () => overlay?.classList.add('active');
    if (btnFechar) btnFechar.onclick = () => {
        overlay?.classList.remove('active');
        const refineContainer = document.getElementById('refine-search-container');
        if (refineContainer) refineContainer.style.display = 'none';
    };

    userPrefs = await carregarPreferenciasUtilizador(db, user.uid);
    window.NotaBookUserPrefs = userPrefs;

    iniciarControloColunaEsquerda();
    aplicarSliders(userPrefs.tamanholetra || {});
    aplicarToggles(userPrefs);
    renderFuseis(db, auth);
    ativarTabs(db, user.uid);
    bindSliders(db, user.uid);
    bindAvatares(db, user.uid, userPrefs.avatar || "gear");
    bindToggles(db, auth);
    bindLogout(auth);
    bindSearch(db, auth, overlay);
    inicializarAmigos(db, auth);
}

function ativarTabs(db, uid) {
    const tabs = document.querySelectorAll('.tab-settings');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.setting-content').forEach(c => c.style.display = 'none');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId)?.style.setProperty('display', 'block');
            if (targetId === 'set-reciclagem') {
                import('./recycle-manager.js').then(m => m.carregarTodaReciclagem(window.db, uid));
            }
        };
    });
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

    const noteCollapse = document.getElementById('check-colapso-titulo-nota');
    if (noteCollapse) noteCollapse.checked = Boolean(prefs.noteTitleCollapse);
    document.body.classList.toggle('modo-colapso-titulos-nota', Boolean(prefs.noteTitleCollapse));

    const shareAnswers = document.getElementById('check-partilhar-respostas');
    if (shareAnswers) shareAnswers.checked = prefs.shareAnswers === "on";

    const leftCollapse = document.getElementById('check-colapso-coluna-esquerda');
    if (leftCollapse) leftCollapse.checked = Boolean(prefs.leftColumnCollapseButton);
    aplicarPreferenciaBotaoColapsoColunaEsquerda(Boolean(prefs.leftColumnCollapseButton));

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

function bindAvatares(db, uid, currentAvatar) {
    document.querySelectorAll('.avatar-item').forEach(item => {
        item.classList.toggle('active', item.dataset.avatar === currentAvatar);
        item.onclick = async () => {
            const avatar = item.dataset.avatar;
            document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            atualizarIconeBotaoTopo(avatar);
            userPrefs.avatar = avatar;
            await guardarPreferenciasUtilizador(db, uid, { avatar });
        };
    });
}

function bindToggles(db, auth) {
    const uid = auth.currentUser?.uid;
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
    document.documentElement.style.setProperty('--fs-editor-texto-desktop', `${desktop}px`);
    document.documentElement.style.setProperty('--fs-editor-texto-mobile', `${mobile}px`);
    document.documentElement.style.setProperty('--fs-editor-texto', `${window.innerWidth <= 768 ? mobile : desktop}px`);
}

window.addEventListener('resize', () => {
    if (!userPrefs) return;
    aplicarFontesResponsivas(userPrefs.tamanholetra || {});
});

function bindLogout(auth) {
    const btnSair = document.getElementById('btnConfirmarSair');
    if (btnSair) btnSair.onclick = () => signOut(auth).then(() => window.location.reload());
}

function renderFuseis(db, auth) {
    const container = document.getElementById('fuseis-list');
    if (!container) return;

    const fuseis = normalizarFuseis(userPrefs?.listsFuseis);
    container.innerHTML = "";
    FUSEIS_META.forEach(item => {
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
    const prefixo = (avatar === 'discord' || avatar === 'xbox') ? 'fa-brands' : 'fa-solid';
    icone.className = `${prefixo} fa-${avatar}`;
}

function getCurrentNoteCtx() {
    return window.notaAtualContext || null;
}

export function syncCurrentNoteToggle() {
    const ctx = getCurrentNoteCtx();
    const checkDiario = document.getElementById('check-diario-linhas');
    if (!checkDiario) return;
    if (!ctx?.dadosNota || !ctx?.auth?.currentUser) {
        checkDiario.checked = false;
        checkDiario.disabled = true;
        return;
    }
    checkDiario.disabled = false;
    const config = obterConfigNota(ctx.dadosNota, ctx.auth.currentUser.uid);
    checkDiario.checked = Boolean(config.diarioLines);
    aplicarPreferenciasDeNota(obterConfigNotaEfetiva(ctx.dadosNota, ctx.auth.currentUser.uid, userPrefs));
}
