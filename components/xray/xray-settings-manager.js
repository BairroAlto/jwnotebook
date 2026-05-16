// components/xray/xray-settings-manager.js
import { state, NOMES_SIGLAS } from './xray-state.js';
import { XRayUI } from './xray-ui.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function iniciarSettingsXRay(db, auth) {
    const overlay = document.getElementById('popup-settings-xray');
    
    // Abrir Definições
    document.getElementById('btn-xray-settings').onclick = () => {
        renderizarPiccards();
        overlay.classList.add('active');
    };

    // Fechar Definições
    document.getElementById('btn-fechar-xray-settings').onclick = () => 
        overlay.classList.remove('active');

    // LÓGICA DE TROCA DE ABAS
    const tabBtns = document.querySelectorAll('.tab-settings-btn');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        };
    });

    // Sliders de Fonte
    const configSlider = (id, varName, dbField) => {
        const slider = document.getElementById(id);
        const valLabel = document.getElementById(`val-${id}`);
        
        slider.oninput = (e) => {
            const val = e.target.value;
            valLabel.innerText = val + "px";
            document.documentElement.style.setProperty(varName, val + "px");
            
            // Gravação com debounce para não sobrecarregar o Firebase
            clearTimeout(slider.timer);
            slider.timer = setTimeout(() => {
                updateDoc(doc(db, "users", auth.currentUser.uid), { [dbField]: val });
            }, 500);
        };
    };

    configSlider('range-xray-font-esq', '--xray-esq-font', 'xraytext');
    configSlider('range-xray-font-dir', '--xray-dir-font', 'xrayresultsfont');

    // Visor na Direita
    document.getElementById('check-leitura-direita').onchange = (e) => {
        const isDir = e.target.checked;
        state.config.leituraDireita = isDir;
        document.body.classList.toggle('modo-leitura-direita', isDir);
        
        // Sincronizar visibilidade das abas de leitura
        document.getElementById('tab-leitura-dir').style.display = isDir ? 'flex' : 'none';
        document.getElementById('tab-leitura-esq').style.display = isDir ? 'none' : 'flex';

        // Mover o conteúdo se houver algo aberto
        XRayUI.sincronizarPosicaoLeitura();
    };
}

export function renderizarPiccards() {
    const contB = document.getElementById('piccards-biblia');
    const contC = document.getElementById('piccards-categorias');
    if(!contB || !contC) return;

    // 1. PICCARDS BÍBLIA (TEXTOS DETETADOS)
    if (state.resultadosCache) {
        contB.innerHTML = state.resultadosCache.referencias.map(ref => {
            const nome = `${ref.livro} ${ref.cap}:${ref.ver}`;
            const sil = state.config.silenciados.has(nome);
            return `<div class="neuronio-pill ${sil?'silenciado':'active'}" onclick="window.toggleSilencioX('${nome}')">
                <i class="fa-solid ${sil?'fa-eye-slash':'fa-check'}"></i> ${nome}
            </div>`;
        }).join('');
    }

    // 2. PICCARDS DE FONTES ESPECÍFICAS (DINÂMICO)
    if (state.resultadosCache) {
        // Unificar todos os resultados para extrair as fontes únicas
        const todosResultados = [
            ...state.resultadosCache.resultados.publicacoes, 
            ...state.resultadosCache.resultados.livros, 
            ...state.resultadosCache.resultados.multimedia
        ];

        // Criar lista de fontes únicas (ex: w_2024_01)
        const fontesEncontradas = [];
        const idsVistos = new Set();

        todosResultados.forEach(item => {
            const b = item.bridge;
            const idFonte = b.contexto === 'livro' ? b.sigla : `${b.sigla}_${b.ano}_${b.mes}`;
            
            if (!idsVistos.has(idFonte)) {
                idsVistos.add(idFonte);
                
                // Gerar Label Bonita: "Sentinela 01/24" ou "Livro: cl"
                const nomeBase = NOMES_SIGLAS[b.sigla] || b.sigla.toUpperCase();
                const label = b.contexto === 'livro' ? nomeBase : `${nomeBase} ${b.mes}/${b.ano.substring(2)}`;
                
                fontesEncontradas.push({ id: idFonte, label: label });
            }
        });

        if (fontesEncontradas.length === 0) {
            contC.innerHTML = `<p style="font-size:10px; opacity:0.3; padding:10px;">Nenhuma fonte para filtrar.</p>`;
        } else {
            contC.innerHTML = fontesEncontradas.map(f => {
                const sil = state.config.fontesOcultas.has(f.id);
                return `<div class="neuronio-pill ${sil?'silenciado':'active'}" 
                             onclick="window.toggleFonteEspecificaX('${f.id}')">
                            <i class="fa-solid ${sil?'fa-power-off':'fa-tower-broadcast'}"></i> ${f.label}
                        </div>`;
            }).join('');
        }
    }
}

// Global para o clique no Piccard de Fonte Específica
window.toggleFonteEspecificaX = (idFonte) => {
    if(state.config.fontesOcultas.has(idFonte)) state.config.fontesOcultas.delete(idFonte);
    else state.config.fontesOcultas.add(idFonte);
    
    renderizarPiccards();
    // Atualizar a coluna da direita imediatamente
    const a = document.querySelector('.tab-btn-right.active');
    if(a) XRayUI.renderizarResultados(a.dataset.tab);
};