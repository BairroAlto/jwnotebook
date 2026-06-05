// components/xray/xray-settings-manager.js
import { state, NOMES_SIGLAS } from './xray-state.js';
import { XRayUI } from './xray-ui.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function iniciarSettingsXRay(db, auth) {
    const overlay = document.getElementById('popup-settings-xray');
    
    document.getElementById('btn-xray-settings').onclick = () => {
        renderizarPiccards();
        overlay.classList.add('active');
    };

    document.getElementById('btn-fechar-xray-settings').onclick = () => overlay.classList.remove('active');

    // Troca de abas do popup
    document.querySelectorAll('.tab-settings-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-settings-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        };
    });

    // Sliders e Toggle Leitura (mantém igual ao anterior...)
}

export function renderizarPiccards() {
    const contB = document.getElementById('piccards-biblia');
    const contC = document.getElementById('piccards-categorias');
    if(!contB || !contC) return;

    // 1. ATUALIZAR CONTADOR
    const totalRefs = (state.resultadosCache?.referencias?.length || 0) + (state.palavrasDetetadas?.length || 0);
    document.getElementById('count-biblia').innerText = totalRefs;

    // 2. PICCARDS DE INVESTIGAÇÃO (BÍBLIA + TERMOS)
    let htmlInvestigacao = "";

    // Parte A: Versículos
    if (state.resultadosCache?.referencias) {
        htmlInvestigacao += state.resultadosCache.referencias.map(ref => {
            const nome = `${ref.livro} ${ref.cap}:${ref.ver}`;
            const sil = state.config.silenciados.has(nome);
            return `<div class="neuronio-pill ${sil?'silenciado':'active'}" onclick="window.toggleSilencioX('${nome}')">
                <i class="fa-solid ${sil?'fa-eye-slash':'fa-check'}"></i> ${nome}
            </div>`;
        }).join('');
    }

    // Parte B: Termos (Palavras-chave)
    if (state.palavrasDetetadas) {
        htmlInvestigacao += state.palavrasDetetadas.map(palavra => {
            const sil = state.config.silenciadosPalavras.has(palavra);
            return `<div class="neuronio-pill keyword ${sil?'silenciado':'active'}" onclick="window.toggleTermoX('${palavra}')" style="border-color: #818cf8;">
                <i class="fa-solid ${sil?'fa-microphone-slash':'fa-ear-listen'}"></i> ${palavra.toUpperCase()}
            </div>`;
        }).join('');
    }
    contB.innerHTML = htmlInvestigacao || `<p style="font-size:10px; opacity:0.3; padding:10px;">Aguardando Manifesto...</p>`;

    // 3. PICCARDS DE FONTES (DINÂMICO TOTAL)
    // Agregamos as fontes encontradas pelo satélite E pela varredura de termos
    const fontesEncontradas = new Map();

    const agregarFontes = (lista) => {
        if (!lista) return;
        lista.forEach(item => {
            const b = item.bridge;
            const idFonte = b.contexto === 'livro' ? b.sigla : `${b.sigla}_${b.ano}_${b.mes}`;
            if (!fontesEncontradas.has(idFonte)) {
                const nomeBase = NOMES_SIGLAS[b.sigla] || b.sigla.toUpperCase();
                const label = b.contexto === 'livro' ? nomeBase : `${nomeBase} ${b.mes}/${b.ano.substring(2)}`;
                fontesEncontradas.set(idFonte, label);
            }
        });
    };

    // Agregar de todas as fontes possíveis
    if(state.resultadosCache) {
        agregarFontes(state.resultadosCache.resultados.publicacoes);
        agregarFontes(state.resultadosCache.resultados.livros);
        agregarFontes(state.resultadosCache.resultados.multimedia);
    }
    if(state.resultadosPalavrasCache) {
        Object.values(state.resultadosPalavrasCache).forEach(lista => agregarFontes(lista));
    }

    if (fontesEncontradas.size === 0) {
        contC.innerHTML = `<p style="font-size:10px; opacity:0.3; padding:10px;">Nenhuma fonte detetada.</p>`;
    } else {
        contC.innerHTML = Array.from(fontesEncontradas).map(([id, label]) => {
            const sil = state.config.fontesOcultas.has(id);
            return `<div class="neuronio-pill ${sil?'silenciado':'active'}" onclick="window.toggleFonteEspecificaX('${id}')">
                <i class="fa-solid ${sil?'fa-power-off':'fa-tower-broadcast'}"></i> ${label}
            </div>`;
        }).join('');
    }
}

// HANDLERS GLOBAIS
window.toggleSilencioX = (n) => { 
    if(state.config.silenciados.has(n)) state.config.silenciados.delete(n); 
    else state.config.silenciados.add(n); 
    renderizarPiccards(); refreshWorkspace(); 
};

window.toggleTermoX = (p) => {
    if(state.config.silenciadosPalavras.has(p)) state.config.silenciadosPalavras.delete(p);
    else state.config.silenciadosPalavras.add(p);
    renderizarPiccards(); refreshWorkspace();
};

window.toggleFonteEspecificaX = (id) => {
    if(state.config.fontesOcultas.has(id)) state.config.fontesOcultas.delete(id);
    else state.config.fontesOcultas.add(id);
    renderizarPiccards(); refreshWorkspace();
};

function refreshWorkspace() {
    const a = document.querySelector('.tab-btn-right.active');
    if(a) XRayUI.renderizarResultados(a.dataset.tab);
}