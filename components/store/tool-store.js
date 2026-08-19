import { guardarPreferenciasUtilizador } from '../settings/preferences.js';
import { obterFeaturesDisponiveis } from '../settings/feature-admin.js';
import { FERRAMENTAS_LOJA } from './tool-catalog.js';
import { acessoDoItem, criarCartaoLoja } from './store-card.js';
import { iniciarAbasLoja } from './store-tabs.js';
import { inicializarLojaPlugs } from './plug-store.js';

export { FERRAMENTAS_LOJA } from './tool-catalog.js';

const CHAVE_APRESENTACAO_LOJA = 'lojaApresentacaoVista';

function normalizarInstaladas(valores) {
    const idsValidos = new Set(FERRAMENTAS_LOJA.map(ferramenta => ferramenta.id));
    return [...new Set((Array.isArray(valores) ? valores : []).filter(id => idsValidos.has(id)))];
}

function renderizarPopupFerramentas(instaladas, acessos) {
    const lista = document.getElementById('popup-ferramentas-loja-lista');
    if (!lista) return;

    const ferramentas = FERRAMENTAS_LOJA.filter(ferramenta => {
        const acesso = acessoDoItem(ferramenta, acessos);
        return instaladas.includes(ferramenta.id)
            && acesso.allowed !== false
            && Number(acesso.active) !== 0;
    });

    lista.replaceChildren(...ferramentas.map(ferramenta => {
        const item = document.createElement('div');
        item.className = 'tool-item tool-item--store';
        item.dataset.toolType = ferramenta.id;
        item.innerHTML = `
            <i class="${ferramenta.icon}" style="font-size:20px; color:${ferramenta.corInterface};"></i>
            <span style="font-size:8.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; text-align:center;">${ferramenta.nome}</span>
        `;
        item.onclick = () => window.inserirFerramentaNoEditor?.(ferramenta.id);
        return item;
    }));
}

function mostrarApresentacaoLoja(db, uid, userPrefs) {
    if (userPrefs?.[CHAVE_APRESENTACAO_LOJA] === true) return;

    let overlay = document.getElementById('popup-loja-introducao');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'popup-loja-introducao';
        overlay.className = 'popup-overlay active';
        overlay.style.zIndex = '10080';
        overlay.innerHTML = `
            <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="popup-loja-introducao-titulo" style="width:min(460px, 94vw); padding:18px; text-align:center;">
                <img src="components/assets/notebook-store-galaxy.png" alt="A personagem NotaBook numa loja galática a descobrir novas ferramentas" style="display:block; width:min(360px, 78vw); aspect-ratio:1; object-fit:cover; margin:0 auto 16px; border:1px solid rgba(165,106,67,.45); border-radius:14px; box-shadow:0 14px 34px rgba(0,0,0,.35);">
                <p style="margin:0 0 6px; color:#d6a47f; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;"><i class="fa-solid fa-store"></i> Loja NotaBook</p>
                <h3 id="popup-loja-introducao-titulo" style="margin:0; color:var(--text-main); font-size:19px;">Descobre ferramentas e Plugs</h3>
                <p style="margin:10px 0 18px; color:var(--text-muted); font-size:12px; line-height:1.6;">As Ferramentas entram nas caixas da nota. Os Plugs ligam serviços de pesquisa à coluna EYE.</p>
                <button type="button" data-loja-introducao-entendi style="width:100%; padding:11px 14px; border:0; border-radius:9px; background:#5b3824; color:#fff; font-weight:800; cursor:pointer;">Entendi</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    overlay.classList.add('active');
    overlay.querySelector('[data-loja-introducao-entendi]').onclick = async () => {
        userPrefs[CHAVE_APRESENTACAO_LOJA] = true;
        if (window.NotaBookUserPrefs) window.NotaBookUserPrefs[CHAVE_APRESENTACAO_LOJA] = true;
        overlay.classList.remove('active');
        try {
            await guardarPreferenciasUtilizador(db, uid, { [CHAVE_APRESENTACAO_LOJA]: true });
        } catch (erro) {
            console.info('[LOJA] Não foi possível guardar a confirmação da apresentação:', erro.message);
        }
    };
}

export function obterFerramentasInstaladas() {
    return normalizarInstaladas(window.NotaBookFerramentasInstaladas);
}

export async function inicializarLoja(db, auth, userPrefs = {}) {
    const lista = document.getElementById('tool-store-list');
    if (!lista || !auth?.currentUser) return;

    iniciarAbasLoja();
    const areaLoja = document.getElementById('set-loja');
    if (areaLoja && areaLoja.dataset.planPreviewListener !== 'true') {
        areaLoja.dataset.planPreviewListener = 'true';
        window.addEventListener('notabook:plan-preview-changed', () => {
            inicializarLoja(db, auth, userPrefs)
                .catch(erro => console.info('[LOJA] Não foi possível atualizar o plano de teste:', erro.message));
        });
    }

    const abaLoja = document.querySelector('.tab-settings[data-target="set-loja"]');
    if (abaLoja && abaLoja.dataset.apresentacaoLigada !== 'true') {
        abaLoja.dataset.apresentacaoLigada = 'true';
        abaLoja.addEventListener('click', () => {
            mostrarApresentacaoLoja(db, auth.currentUser.uid, userPrefs);
        });
    }

    const instaladasGuardadas = Array.isArray(userPrefs.ferramentasInstaladas)
        ? userPrefs.ferramentasInstaladas
        : [];
    let instaladas = normalizarInstaladas(instaladasGuardadas);
    if (instaladas.length !== instaladasGuardadas.length) {
        guardarPreferenciasUtilizador(db, auth.currentUser.uid, {
            ferramentasInstaladas: instaladas
        }).catch(erro => console.info('[LOJA] Não foi possível limpar ferramentas antigas:', erro.message));
    }
    let acessos = new Map();
    try {
        const features = await obterFeaturesDisponiveis(auth);
        acessos = new Map(features.map(feature => [feature.feature_key, feature]));
    } catch (erro) {
        console.info('[LOJA] Planos das ferramentas indisponíveis:', erro.message);
    }

    window.NotaBookFerramentasInstaladas = instaladas;
    renderizarPopupFerramentas(instaladas, acessos);

    const atualizar = () => {
        lista.replaceChildren(...FERRAMENTAS_LOJA.map(ferramenta => (
            criarCartaoLoja(ferramenta, instaladas, acessoDoItem(ferramenta, acessos), async (id) => {
                const estavaInstalada = instaladas.includes(id);
                instaladas = normalizarInstaladas(estavaInstalada
                    ? instaladas.filter(item => item !== id)
                    : [...instaladas, id]);
                userPrefs.ferramentasInstaladas = [...instaladas];
                window.NotaBookFerramentasInstaladas = instaladas;
                atualizar();
                renderizarPopupFerramentas(instaladas, acessos);
                try {
                    await guardarPreferenciasUtilizador(db, auth.currentUser.uid, {
                        ferramentasInstaladas: instaladas
                    });
                } catch (erro) {
                    console.error('[LOJA] Não foi possível guardar a ferramenta instalada:', erro);
                    instaladas = normalizarInstaladas(estavaInstalada
                        ? [...instaladas, id]
                        : instaladas.filter(item => item !== id));
                    userPrefs.ferramentasInstaladas = [...instaladas];
                    window.NotaBookFerramentasInstaladas = instaladas;
                    atualizar();
                    renderizarPopupFerramentas(instaladas, acessos);
                }
            })
        )));
    };

    atualizar();
    await inicializarLojaPlugs({ db, auth, userPrefs, acessos });
}
