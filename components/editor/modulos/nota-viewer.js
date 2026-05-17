// components/editor/modulos/nota-viewer.js
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { MobileUI } from '../../ui/mobile-manager.js';
import { LockManager } from './lock-manager.js';
import { LockUI } from './lock-ui.js';
import { EditorUI } from './ui-utils.js';

/**
 * AJUSTADOR DE ALTURAS (Helper)
 */
export function ajustarAlturasCampos() {
    const campos = document.querySelectorAll('.tool-title-input, #editor-feed textarea');
    campos.forEach(el => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    });
}

/**
 * CONFIGURAÇÃO DO BOTÃO DE PARTILHA
 */
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
    } else {
        btnShareNota.style.display = "block";
        btnShareNota.style.color = "var(--text-muted)";
        btnShareNota.onclick = () => {
            import('./partilhar-v2.js').then(m => {
                m.iniciarPartilhaV2(window.db, window.auth);
                m.abrirPopupPartilharV2(dadosNota);
            });
        };
    }
}

/**
 * FUNÇÃO MESTRE: ABRIR NOTA (COM PROTEÇÃO GITHUB PAGES)
 */
export async function processarAberturaNota(ctx) {
    const { notaId, dadosNota, db, auth, idCaixaFoco, maeIdOverride, stateManager } = ctx;

    const placeholder = document.getElementById('editor-placeholder');
    const container = document.getElementById('editor-container');
    const loading = document.getElementById('editor-loading');

    // 🛡️ PROTEÇÃO ANTI-CRASH (Se o HTML ainda não carregou no GitHub Pages)
    if (!container || !loading) {
        console.warn("⏳ [VIEWER] HTML do editor ausente. Re-tentando...");
        setTimeout(() => processarAberturaNota(ctx), 150);
        return;
    }

    // 1. UI Setup
    if (placeholder) placeholder.style.display = 'none';
    container.style.display = 'none';
    loading.style.display = 'flex';

    // 2. Fechar Menus Mobile
    if (typeof MobileUI !== 'undefined') MobileUI.fecharColunaEsquerda();

    // 3. Sincronizar Sidebar
    if (typeof window.sincronizarBarraLateralComNota === 'function') {
        window.sincronizarBarraLateralComNota(notaId, dadosNota, auth);
    }

    // 4. Lógica Share (Visto por / Lock)
    if (dadosNota.onde === "share") {
        const uid = auth.currentUser.uid;
        window.sessaoUltimaLeitura = dadosNota[uid]?.ultimaLeitura || 0;
        try {
            await updateDoc(doc(db, "Share", notaId), { 
                vistoPor: arrayUnion(uid),
                [`${uid}.ultimaLeitura`]: new Date().toISOString()
            });
        } catch (e) {}
    }

    // 5. Chamar o gerenciador de estado do Editor para carregar os dados
    await stateManager.inicializarDadosNota(notaId, dadosNota, maeIdOverride);

    // 6. Finalizar Visualização
    const tituloEditor = document.getElementById('editor-titulo');
    if (tituloEditor) tituloEditor.innerText = dadosNota.nome || "Sem Título";

    container.style.visibility = 'hidden';
    container.style.display = 'block';
    
    // Pequeno fôlego para o browser desenhar
    await new Promise(res => requestAnimationFrame(res));
    ajustarAlturasCampos();
    
    container.style.visibility = 'visible';
    loading.style.display = 'none';

    // 7. Focar em bloco se solicitado
    if (idCaixaFoco) {
        setTimeout(() => {
            const el = document.getElementById(`bloco-${idCaixaFoco}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
    }
}
