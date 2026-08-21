import { obterPlanoPrevisualizacao } from '../billing/plan-preview.js';
import { obterFeaturesDisponiveis } from '../settings/feature-admin.js';

export const LIST_FUSEIS_META = [
    { key: 'topicos', label: 'Tópicos', desc: 'Taxonomia e vínculos de tópico' },
    { key: 'destaques', label: 'Destaques', desc: 'Pesquisa por cores e destaques' },
    { key: 'biblia', label: 'Bíblia', desc: 'Mosaico e navegação bíblica' },
    { key: 'textosBiblicos', label: 'Textos Bíblicos', desc: 'Versículos estudados' },
    { key: 'marcadores', label: 'Marcadores', desc: 'Marcadores rápidos' },
    { key: 'livros', label: 'Livros', desc: 'Biblioteca e publicações' },
    { key: 'cosmos', label: 'Cosmos', desc: 'Temas e constelações' },
    {
        key: 'sites',
        label: 'Sites',
        desc: 'Notas publicadas como páginas de leitura',
        featureKey: 'sites_publicos'
    },
    { key: 'palco', label: 'Palco', desc: 'Portal cultural e registos do PALCO' }
];

const EVENTO_ACESSO_ACTUALIZADO = 'notabook:list-feature-access-updated';

let authActual = null;
let assinaturaCache = '';
let pedidoEmCurso = null;
let featuresPermitidas = new Set();

function assinaturaDoAcesso(auth) {
    const uid = auth?.currentUser?.uid || '';
    const planoPrevisualizado = obterPlanoPrevisualizacao() || '';
    return `${uid}:${planoPrevisualizado}`;
}

function guardarAcessos(features) {
    featuresPermitidas = new Set(
        (Array.isArray(features) ? features : [])
            .filter(feature => feature?.allowed === true)
            .map(feature => feature.feature_key)
    );
}

export async function carregarAcessoFuseisList(auth, { forcar = false } = {}) {
    authActual = auth || authActual;
    const assinatura = assinaturaDoAcesso(authActual);
    if (!authActual?.currentUser?.uid) {
        guardarAcessos([]);
        return featuresPermitidas;
    }
    if (!forcar && assinatura === assinaturaCache && !pedidoEmCurso) return featuresPermitidas;
    if (!forcar && assinatura === assinaturaCache && pedidoEmCurso) return pedidoEmCurso;

    assinaturaCache = assinatura;
    pedidoEmCurso = obterFeaturesDisponiveis(authActual)
        .then(features => {
            guardarAcessos(features);
            window.dispatchEvent(new CustomEvent(EVENTO_ACESSO_ACTUALIZADO));
            return featuresPermitidas;
        })
        .catch(erro => {
            guardarAcessos([]);
            window.dispatchEvent(new CustomEvent(EVENTO_ACESSO_ACTUALIZADO));
            throw erro;
        })
        .finally(() => {
            pedidoEmCurso = null;
        });
    return pedidoEmCurso;
}

export function fusivelDisponivelNoPlano(key) {
    const item = LIST_FUSEIS_META.find(meta => meta.key === key);
    return Boolean(item && (!item.featureKey || featuresPermitidas.has(item.featureKey)));
}

export function filtrarFuseisDisponiveis() {
    return LIST_FUSEIS_META.filter(item => fusivelDisponivelNoPlano(item.key));
}

window.addEventListener('notabook:plan-preview-changed', () => {
    if (!authActual?.currentUser) return;
    carregarAcessoFuseisList(authActual, { forcar: true }).catch(erro => {
        console.info('[LISTS] Não foi possível actualizar os fusíveis para o plano previsualizado:', erro.message);
    });
});
