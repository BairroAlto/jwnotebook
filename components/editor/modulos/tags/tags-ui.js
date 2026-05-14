// components/editor/modulos/tags/tags-ui.js
import { IDENTIDADE_FERRAMENTAS } from '../../../constants/ferramentas.js';

/**
 * Renderiza as etiquetas (pills) de Bíblia e Cosmos no topo do popup (Itens já adicionados)
 */
export function renderizarNeuroniosNoPopup(caixa) {
    const bibaCont = document.getElementById('selected-biblia-neuronios');
    const cosmosCont = document.getElementById('selected-cosmos-neuronios');

    if (bibaCont) {
        bibaCont.innerHTML = (caixa.neuroniosBiba || []).map(ref => `
            <div class="neuronio-pill biblia">
                <i class="fa-solid fa-book-bible"></i>
                <span>${ref}</span>
                <i class="fa-solid fa-circle-xmark remove-icon" onclick="window.desvincularBiblia('${ref}')"></i>
            </div>
        `).join('');
    }

    if (cosmosCont) {
        cosmosCont.innerHTML = (caixa.neuroniosCosmos || []).map(tema => `
            <div class="neuronio-pill cosmos">
                <i class="fa-solid fa-meteor"></i>
                <span>${tema.nome}</span>
                <i class="fa-solid fa-circle-xmark remove-icon" onclick="window.desvincularCosmos('${tema.id}')"></i>
            </div>
        `).join('');
    }
}

/**
 * Renderiza a lista de itens associados (Notas e Caixas) na aba Associar
 */
export function renderizarAssociados(caixa) {
    const container = document.getElementById('lista-associados-vivos');
    if (!container) return;

    if (!caixa.associados || caixa.associados.length === 0) {
        container.innerHTML = `<p style="font-size:11px; color:gray; text-align:center; padding:20px; border:1px dashed rgba(255,255,255,0.05); border-radius:8px;">Nenhum item associado.</p>`;
        return;
    }

    container.innerHTML = caixa.associados.map(item => {
        const isNota = item.tipo === 'nota';
        const config = !isNota ? (IDENTIDADE_FERRAMENTAS[item.tipo] || IDENTIDADE_FERRAMENTAS.contentor) : null;
        
        const icone = isNota ? 'fa-solid fa-file-lines' : config.icon;
        const cor = isNota ? 'var(--primary)' : config.cor;

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:12px 15px; border-radius:10px; border: 1px solid rgba(255,255,255,0.05); margin-bottom:8px; border-left: 4px solid ${cor};">
                <div style="display:flex; align-items:center; gap:12px; overflow:hidden; flex:1;">
                    <i class="${icone}" style="color: ${cor}; font-size: 13px;"></i>
                    <span style="font-size:12px; color:#f8fafc; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.titulo || "Sem título"}</span>
                </div>
                <div style="display:flex; gap:15px; align-items:center; margin-left:15px;">
                    ${isNota ? `
                        <i class="fa-solid fa-arrow-up-right-from-square" title="Abrir Nota" onclick="window.abrirNoBrowserExterno('${item.id}')" 
                           style="cursor:pointer; font-size:11px; color:#94a3b8; transition:0.2s;"></i>
                    ` : ''}
                    <i class="fa-solid fa-trash-can" title="Remover" onclick="window.removerAssociado('${item.id}')" 
                       style="cursor:pointer; font-size:11px; color:#f87171; transition:0.2s;"
                       onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#f87171'"></i>
                </div>
            </div>
        `;
    }).join('');
}

// --- FUNÇÕES DE RESULTADOS DE PESQUISA (DESIGN MODERNO) ---

export function renderizarResultadosBiblia(lista, caixa) {
    const div = document.getElementById('results-biblia-neuronios');
    if (!div) return;
    const anexados = caixa.neuroniosBiba || [];
    
    div.innerHTML = lista.filter(i => !anexados.includes(i)).map(item => `
        <div class="neuronio-result-item" onclick="window.vincularBiblia('${item}')">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="result-icon-box biblia"><i class="fa-solid fa-book-bible"></i></div>
                <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${item}</span>
            </div>
            <i class="fa-solid fa-plus-circle" style="opacity:0.3; font-size:14px;"></i>
        </div>
    `).join('') || '<div style="padding:20px; font-size:11px; color:gray; text-align:center;">Nenhum texto encontrado.</div>';
    div.style.display = 'block';
}

export function renderizarResultadosCosmos(lista, caixa) {
    const div = document.getElementById('results-cosmos-neuronios');
    if (!div) return;
    const anexadosIds = (caixa.neuroniosCosmos || []).map(t => t.id);
    
    div.innerHTML = lista.filter(t => !anexadosIds.includes(t.id)).map(tema => `
        <div class="neuronio-result-item" onclick="window.vincularCosmos('${tema.id}', '${tema.nome}')">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="result-icon-box cosmos"><i class="fa-solid fa-${tema.simbolo || 'meteor'}"></i></div>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${tema.nome}</span>
                    <small style="font-size:9px; color:var(--text-muted); text-transform:uppercase;">${tema.categoria || 'Sem Categoria'}</small>
                </div>
            </div>
            <i class="fa-solid fa-plus-circle" style="opacity:0.3; font-size:14px;"></i>
        </div>
    `).join('') || '<div style="padding:20px; font-size:11px; color:gray; text-align:center;">Nenhum tema encontrado.</div>';
    div.style.display = 'block';
}

/**
 * Renderiza resultados de Tópicos (Pai)
 */
export function renderizarResultadosTopicos(lista) {
    const div = document.getElementById('results-tags-topico');
    if (!div) return;
    
    div.innerHTML = lista.map(item => `
        <div class="neuronio-result-item" onclick="window.setTopicoPai('${item.id}', '${item.nome}')">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="result-icon-box biblia"><i class="fa-solid fa-layer-group"></i></div>
                <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${item.nome}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="opacity:0.3; font-size:12px;"></i>
        </div>
    `).join('') || '<div style="padding:15px; font-size:11px; color:gray; text-align:center;">Nenhum tópico encontrado.</div>';
    div.style.display = 'block';
}

/**
 * Renderiza resultados de Subtópicos
 */
export function renderizarResultadosSubtopicos(lista) {
    const div = document.getElementById('results-tags-subtopico');
    if (!div) return;
    
    div.innerHTML = lista.map(item => `
        <!-- Passamos o DocID do Firebase, o UUID interno e o Nome -->
        <div class="neuronio-result-item" onclick="window.vincularSubtopicoFinal('${item.docIdFirebase}', '${item.id}', '${item.nome}')">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="result-icon-box cosmos" style="background:rgba(52, 211, 153, 0.1); color:#34d399;">
                    <i class="fa-solid fa-hashtag"></i>
                </div>
                <span style="font-size:13px; font-weight:600; color:#f1f5f9;">${item.nome}</span>
            </div>
            <i class="fa-solid fa-link" style="opacity:0.3; font-size:12px;"></i>
        </div>
    `).join('') || '<div style="padding:15px; font-size:11px; color:gray; text-align:center;">Nenhum subtópico encontrado.</div>';
    div.style.display = 'block';
}

export function renderizarVinculosTopicos(caixa) {
    const container = document.getElementById('lista-vinc-topicos');
    if (!container) return;

    if (!caixa.vincTopicos || caixa.vincTopicos.length === 0) {
        container.innerHTML = "";
        return;
    }

    // Agora iteramos sobre objetos {id, nome, firebaseId}
    container.innerHTML = caixa.vincTopicos.map(topico => `
        <div class="neuronio-pill" style="background: rgba(52, 211, 153, 0.1); color: #34d399; border-color: rgba(52, 211, 153, 0.2);">
            <i class="fa-solid fa-hashtag"></i>
            <span>${topico.nome}</span>
            <i class="fa-solid fa-circle-xmark remove-icon" onclick="window.removerVincTopico('${topico.id}')"></i>
        </div>
    `).join('');
}

export function perguntarRemoverVinculo(nome) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-vinculo-overlay');
        const msg = document.getElementById('msg-confirmar-vinculo');
        const btnSim = document.getElementById('btn-confirmar-vinculo');
        const btnNao = document.getElementById('btn-cancelar-vinculo');

        if (msg) msg.innerHTML = `Deseja remover o vínculo com o tópico <b>"${nome}"</b>?`;
        
        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

// Dentro de components/editor/modulos/tags/tags-utils.js

export function abrirPopupImagemCartao(urlAtual, dimensaoAtual) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-cv-imagem-overlay');
        const inputUrl = document.getElementById('cv-input-url');
        const inputDim = document.getElementById('cv-input-dimensao');
        const btnGuardar = document.getElementById('cv-btn-guardar');
        const btnCancelar = document.getElementById('cv-btn-cancelar');

        inputUrl.value = urlAtual || "";
        inputDim.value = dimensaoAtual || "pequena";
        overlay.classList.add('active');

        const fechar = (dados) => {
            overlay.classList.remove('active');
            btnGuardar.onclick = null;
            btnCancelar.onclick = null;
            resolve(dados);
        };

        btnGuardar.onclick = () => fechar({ url: inputUrl.value, dimensao: inputDim.value });
        btnCancelar.onclick = () => fechar(null);
    });
}