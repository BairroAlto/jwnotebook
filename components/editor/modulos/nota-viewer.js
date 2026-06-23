import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { MobileUI } from '../../ui/mobile-manager.js';
import { aplicarPreferenciasDeNota, obterConfigNota } from '../../settings/preferences.js';

export function ajustarAlturasCampos() {
    const campos = document.querySelectorAll('.tool-title-input, #editor-feed textarea');
    campos.forEach(el => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    });
}

export function configurarBotaoShare(notaId, dadosNota, auth) {
    const btnShareNota = document.querySelector('i[title="Partilhar"]');
    if (!btnShareNota) return;

    btnShareNota.onclick = null;
    if (dadosNota.onde === "share") {
        const souDono = dadosNota.userId === auth.currentUser.uid;
        if (souDono) {
            btnShareNota.style.display = "block";
            btnShareNota.style.color = "#ef4444";
            btnShareNota.onclick = () => {
                import('../../share/gestao-share.js').then(m => m.abrirGestaoPartilha(notaId, auth));
            };
        } else {
            btnShareNota.style.display = "none";
        }
        return;
    }

    btnShareNota.style.display = "block";
    btnShareNota.style.color = "var(--text-muted)";
    btnShareNota.onclick = () => {
        import('./partilhar-v2.js').then(m => {
            m.iniciarPartilhaV2(window.db, window.auth);
            m.abrirPopupPartilharV2(dadosNota);
        });
    };
}

export async function processarAberturaNota(ctx) {
    const { notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride, stateManager } = ctx;

    const placeholder = document.getElementById('editor-placeholder');
    const container = document.getElementById('editor-container');
    const loading = document.getElementById('editor-loading');

    if (!container || !loading) {
        setTimeout(() => processarAberturaNota(ctx), 150);
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    container.style.display = 'none';
    loading.style.display = 'flex';
    if (typeof MobileUI !== 'undefined') MobileUI.fecharColunaEsquerda();

    if (typeof window.sincronizarBarraLateralComNota === 'function') {
        window.sincronizarBarraLateralComNota(notaId, dadosNota, auth);
    }

    if (dadosNota.onde === "share") {
        const uid = auth.currentUser.uid;
        window.sessaoUltimaLeitura = dadosNota[uid]?.ultimaLeitura || 0;
        try {
            await updateDoc(doc(db, "Share", notaId), {
                vistoPor: arrayUnion(uid),
                [`${uid}.ultimaLeitura`]: new Date().toISOString()
            });
        } catch (_) {}
    }

    await stateManager.inicializarDadosNota(notaId, dadosNota, maeIdOverride);

    const tituloEditor = document.getElementById('editor-titulo');
    if (tituloEditor) tituloEditor.innerText = dadosNota.nome || "Sem Título";
    if (auth?.currentUser) {
        const noteConfig = obterConfigNota(dadosNota, auth.currentUser.uid);
        aplicarPreferenciasDeNota({
            ...noteConfig,
            collapseNoteTitle: noteConfig.collapseNoteTitle || Boolean(window.NotaBookUserPrefs?.noteTitleCollapse)
        });
    }

    container.style.visibility = 'hidden';
    container.style.display = 'block';
    await new Promise(res => requestAnimationFrame(res));
    ajustarAlturasCampos();
    container.style.visibility = 'visible';
    loading.style.display = 'none';

    const primeiraCaixaVazia = (dadosNota.caixas || []).length === 1 &&
        !(dadosNota.caixas?.[0]?.conteudo || "").trim() &&
        !(dadosNota.caixas?.[0]?.titulo || "").trim();
    if (!idCaixaFoco && primeiraCaixaVazia) {
        setTimeout(() => {
            container.querySelector('#editor-feed textarea, #editor-feed input')?.focus();
        }, 80);
    }

    if (idCaixaFoco) {
        setTimeout(() => {
            document.getElementById(`bloco-${idCaixaFoco}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
    }
}
