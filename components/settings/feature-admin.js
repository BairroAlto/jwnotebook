import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';
import { MODOS_NOTA, chaveAcessoModoNota } from '../editor/modulos/nota-modes.js';
import { PAINEL_UTILIZADOR_ABAS } from './user-panel-tabs.js';

const FEATURE_API_URL = 'https://storage.notabook.site';

const PLAN_LABELS = {
    free: 'Free',
    premium: 'Premium',
    premium_plus: 'Premium Plus'
};

const FEATURE_GROUPS = {
    painel: { label: 'Painel de Utilizador', icon: 'fa-user-gear' },
    ferramentas: { label: 'Ferramentas', icon: 'fa-toolbox' },
    plugs: { label: 'Plugs', icon: 'fa-plug' },
    conexoes: { label: 'Centro de Conexões', icon: 'fa-diagram-project' },
    partilha: { label: 'Partilhar Secção', icon: 'fa-share-nodes' },
    personalizacao: { label: 'Personalização', icon: 'fa-palette' },
    posto: { label: 'Posto de Ligação', icon: 'fa-city' },
    ia: { label: 'AI', icon: 'fa-wand-magic-sparkles' },
    outros: { label: 'Outras', icon: 'fa-layer-group' }
};

const FEATURE_GROUP_ORDER = ['painel', 'ferramentas', 'plugs', 'conexoes', 'partilha', 'personalizacao', 'posto', 'ia', 'outros'];
const PAINEL_UTILIZADOR_CHAVES = new Set(PAINEL_UTILIZADOR_ABAS.map(aba => aba.key));
const FEATURES_ESTRUTURAIS_CHAVES = new Set([
    ...PAINEL_UTILIZADOR_CHAVES,
    'ferramenta_agenda_nota',
    'ferramenta_noticias',
    'ferramenta_tempo',
    'ferramenta_inspirador',
    'ferramenta_gmail',
    'ferramenta_habito',
    'plug_wikipedia',
    'plug_wikidata',
    'plug_wikimedia'
]);

function isFeatureModoNota(feature) {
    return String(feature?.feature_key || '').startsWith('modo_');
}

function grupoDaFeature(feature) {
    const key = String(feature.feature_key || '');
    if (PAINEL_UTILIZADOR_CHAVES.has(key)) return 'painel';
    if (key.startsWith('conexoes_') || key === 'centro_conexoes') return 'conexoes';
    if (key.startsWith('partilhar_') || key === 'partilhar_secao') return 'partilha';
    if (key.startsWith('personalizacao_') || key === 'centro_personalizacao') return 'personalizacao';
    if (key.startsWith('posto_') || key === 'posto_ligacao_bairro') return 'posto';
    if (key.startsWith('ai_')) return 'ia';
    if (key.startsWith('plug_')) return 'plugs';
    if (key.startsWith('ferramenta_') || ['contentor', 'questao', 'google_calendar'].includes(key)) return 'ferramentas';
    return 'outros';
}

function slugificar(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
}

async function pedidoAdmin(auth, caminho, opcoes = {}) {
    const utilizador = auth.currentUser;
    if (!utilizador) throw new Error('Sessão não autenticada.');
    const token = await utilizador.getIdToken();
    const resposta = await fetch(`${FEATURE_API_URL}${caminho}`, {
        ...opcoes,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...cabecalhosComPrevisualizacao(),
            ...(opcoes.headers || {})
        }
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(dados.error || 'Não foi possível comunicar com a administração.');
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

function mostrarEstado(mensagem, tipo = 'info') {
    const estado = document.getElementById('feature-admin-status');
    if (!estado) return;
    estado.textContent = mensagem;
    estado.dataset.tipo = tipo;
}

function mostrarEstadoModo(mensagem, tipo = 'info') {
    const estado = document.getElementById('note-mode-admin-status');
    if (!estado) return;
    estado.textContent = mensagem;
    estado.dataset.tipo = tipo;
}

function linhaModoNota(modo, feature, recarregar) {
    const linha = document.createElement('article');
    linha.className = 'note-mode-admin-row';
    linha.innerHTML = `
        <div class="note-mode-admin-info">
            <strong>${modo.nome}</strong>
            <small>${modo.descricao}</small>
        </div>
        <select class="note-mode-admin-plan" aria-label="Plano mínimo para ${modo.nome}">
            <option value="free">Free</option>
            <option value="premium">Premium</option>
        </select>
        <button class="note-mode-admin-save" type="button"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
    `;

    const plano = linha.querySelector('.note-mode-admin-plan');
    const guardar = linha.querySelector('.note-mode-admin-save');
    plano.value = feature?.min_plan === 'premium' ? 'premium' : 'free';

    guardar.onclick = async () => {
        const featureKey = chaveAcessoModoNota(modo.id);
        const payload = {
            key: featureKey,
            label: modo.nome,
            description: modo.descricao,
            minPlan: plano.value,
            active: true
        };
        guardar.disabled = true;
        try {
            const existe = Boolean(feature?.feature_key);
            await pedidoAdmin(window.auth, existe
                ? `/admin/features/${encodeURIComponent(featureKey)}`
                : '/admin/features', {
                    method: existe ? 'PUT' : 'POST',
                    body: JSON.stringify(payload)
                });
            mostrarEstadoModo('Permissão do modo guardada.', 'sucesso');
            await recarregar();
        } catch (erro) {
            mostrarEstadoModo(erro.message, 'erro');
        } finally {
            guardar.disabled = false;
        }
    };

    return linha;
}

function linhaFeature(feature, recarregar) {
    const linha = document.createElement('article');
    linha.className = 'feature-admin-row';
    linha.innerHTML = `
        <div class="feature-admin-main">
            <input class="feature-admin-label" type="text" value="" maxlength="80" aria-label="Nome da ferramenta">
            <input class="feature-admin-key" type="text" value="" maxlength="64" aria-label="Chave da ferramenta" spellcheck="false">
            <input class="feature-admin-description" type="text" value="" maxlength="180" placeholder="Descrição opcional">
        </div>
        <div class="feature-admin-controls">
            <select class="feature-admin-plan" aria-label="Plano mínimo">
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="premium_plus">Premium Plus</option>
            </select>
            <label class="feature-admin-active"><input type="checkbox"> Ativa</label>
            <button class="feature-admin-save" type="button"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
            <button class="feature-admin-delete" type="button" title="Remover ferramenta"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;

    const label = linha.querySelector('.feature-admin-label');
    const key = linha.querySelector('.feature-admin-key');
    const description = linha.querySelector('.feature-admin-description');
    const plan = linha.querySelector('.feature-admin-plan');
    const active = linha.querySelector('.feature-admin-active input');
    const save = linha.querySelector('.feature-admin-save');
    const remove = linha.querySelector('.feature-admin-delete');

    label.value = feature.label || '';
    key.value = feature.feature_key || '';
    description.value = feature.description || '';
    plan.value = feature.min_plan || 'free';
    active.checked = Number(feature.active) === 1 || feature.active === true;
    key.readOnly = Boolean(feature.feature_key);
    remove.hidden = FEATURES_ESTRUTURAIS_CHAVES.has(feature.feature_key);

    save.onclick = async () => {
        const auth = window.auth;
        const payload = {
            label: label.value.trim(),
            description: description.value.trim(),
            minPlan: plan.value,
            active: active.checked
        };
        if (!payload.label) {
            mostrarEstado('Indica o nome da ferramenta.', 'erro');
            label.focus();
            return;
        }
        if (!feature.feature_key) {
            payload.key = slugificar(key.value || label.value);
        }
        if (!payload.key && !feature.feature_key) {
            mostrarEstado('Indica uma chave válida para a ferramenta.', 'erro');
            key.focus();
            return;
        }

        save.disabled = true;
        try {
            const caminho = feature.feature_key
                ? `/admin/features/${encodeURIComponent(feature.feature_key)}`
                : '/admin/features';
            await pedidoAdmin(auth, caminho, {
                method: feature.feature_key ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            mostrarEstado('Ferramenta guardada.', 'sucesso');
            await recarregar();
        } catch (erro) {
            mostrarEstado(erro.message, 'erro');
        } finally {
            save.disabled = false;
        }
    };

    remove.onclick = async () => {
        if (!feature.feature_key) {
            linha.remove();
            return;
        }
        if (!window.confirm(`Remover “${feature.label}” da configuração de planos?`)) return;
        remove.disabled = true;
        try {
            await pedidoAdmin(window.auth, `/admin/features/${encodeURIComponent(feature.feature_key)}`, { method: 'DELETE' });
            mostrarEstado('Ferramenta removida.', 'sucesso');
            await recarregar();
        } catch (erro) {
            mostrarEstado(erro.message, 'erro');
            remove.disabled = false;
        }
    };

    return linha;
}

export async function inicializarAdminFeatures(auth) {
    const tab = document.getElementById('tab-admin-features');
    const area = document.getElementById('set-admin-features');
    const lista = document.getElementById('feature-admin-list');
    const tabs = document.getElementById('feature-admin-tabs');
    const adicionar = document.getElementById('feature-admin-add');
    const listaModos = document.getElementById('note-mode-admin-list');
    if (!tab || !area || !lista || !tabs || !adicionar || !listaModos) return;

    tab.hidden = true;
    area.hidden = true;
    delete tab.dataset.adminAuthorized;

    let grupoAtivo = 'painel';
    let featuresAtuais = [];

    const aplicarFiltro = () => {
        lista.querySelectorAll('.feature-admin-row').forEach(linha => {
            linha.hidden = linha.dataset.group !== grupoAtivo;
        });
    };

    const renderizarTabs = () => {
        const grupos = new Map();
        featuresAtuais.forEach(feature => {
            const grupo = grupoDaFeature(feature);
            grupos.set(grupo, (grupos.get(grupo) || 0) + 1);
        });
        if (!grupos.has(grupoAtivo)) grupoAtivo = FEATURE_GROUP_ORDER.find(grupo => grupos.has(grupo)) || 'outros';
        tabs.replaceChildren();
        FEATURE_GROUP_ORDER.filter(grupo => grupos.has(grupo)).forEach(grupo => {
            const definicao = FEATURE_GROUPS[grupo];
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = `feature-admin-tab${grupo === grupoAtivo ? ' is-active' : ''}`;
            botao.setAttribute('role', 'tab');
            botao.setAttribute('aria-selected', String(grupo === grupoAtivo));
            botao.innerHTML = `<i class="fa-solid ${definicao.icon}"></i> ${definicao.label}<span class="feature-admin-group-count">${grupos.get(grupo)}</span>`;
            botao.onclick = () => {
                grupoAtivo = grupo;
                renderizarTabs();
                aplicarFiltro();
            };
            tabs.appendChild(botao);
        });
    };

    const renderizar = (features) => {
        featuresAtuais = features.filter(feature => !isFeatureModoNota(feature));
        renderizarTabs();
        lista.replaceChildren();
        featuresAtuais.forEach(feature => {
            const linha = linhaFeature(feature, carregar);
            linha.dataset.group = grupoDaFeature(feature);
            lista.appendChild(linha);
        });
        aplicarFiltro();
        if (!featuresAtuais.length) {
            lista.innerHTML = '<p class="section-desc">Ainda não existem ferramentas configuradas.</p>';
        }

        const porChave = new Map(features.map(feature => [feature.feature_key, feature]));
        listaModos.replaceChildren();
        MODOS_NOTA.forEach(modo => {
            listaModos.appendChild(linhaModoNota(modo, porChave.get(chaveAcessoModoNota(modo.id)), carregar));
        });
    };

    const carregar = async () => {
        const dados = await pedidoAdmin(auth, '/admin/features');
        renderizar(dados.features || []);
    };

    adicionar.onclick = () => {
        if (lista.querySelector('.feature-admin-new')) return;
        const nova = linhaFeature({ active: true }, carregar);
        nova.classList.add('feature-admin-new');
        nova.dataset.group = grupoAtivo;
        lista.prepend(nova);
        nova.querySelector('.feature-admin-key')?.focus();
    };

    const subTabs = area.querySelectorAll('[data-admin-subtab]');
    const subPanels = area.querySelectorAll('[data-admin-panel]');
    subTabs.forEach(botao => {
        botao.onclick = () => {
            const alvo = botao.dataset.adminSubtab;
            subTabs.forEach(item => {
                const ativo = item === botao;
                item.classList.toggle('is-active', ativo);
                item.setAttribute('aria-selected', String(ativo));
            });
            subPanels.forEach(painel => {
                painel.hidden = painel.dataset.adminPanel !== alvo;
            });
        };
    });

    try {
        await carregar();
        tab.dataset.adminAuthorized = 'true';
        area.hidden = false;
        tab.hidden = false;
    } catch (erro) {
        tab.hidden = true;
        area.hidden = true;
        delete tab.dataset.adminAuthorized;
        if (erro.status !== 403) console.info('[FEATURES] Administração indisponível:', erro.message);
        return;
    }

    document.querySelector('[data-target="set-admin-features"]')?.addEventListener('click', () => {
        carregar().catch(erro => mostrarEstado(erro.message, 'erro'));
    });
}

export async function obterFeaturesDisponiveis(auth) {
    const utilizador = auth?.currentUser;
    if (!utilizador) return [];
    const token = await utilizador.getIdToken();
    const resposta = await fetch(`${FEATURE_API_URL}/features`, {
        headers: {
            Authorization: `Bearer ${token}`,
            ...cabecalhosComPrevisualizacao()
        }
    });
    if (!resposta.ok) throw new Error('Não foi possível carregar as permissões das ferramentas.');
    const dados = await resposta.json();
    return dados.features || [];
}

export async function obterAcessoFerramenta(auth, featureKey) {
    const features = await obterFeaturesDisponiveis(auth);
    return Boolean(features.find(feature => feature.feature_key === featureKey)?.allowed);
}

export async function exigirAcessoFerramenta(auth, featureKey, mensagem) {
    try {
        const permitido = await obterAcessoFerramenta(auth, featureKey);
        if (permitido) return true;
        window.alert(mensagem || 'Esta funcionalidade não está disponível no teu plano.');
    } catch (erro) {
        console.error(`[FEATURES] Não foi possível validar ${featureKey}:`, erro);
        window.alert('Não foi possível verificar o teu plano. Tenta novamente.');
    }
    return false;
}
