// components/xray/xray-ui.js
import { state } from './xray-state.js';

export const XRayUI = {

    /**
     * 1. FEEDBACK VISUAL: SATÉLITE EM ÓRBITA
     */
    mostrarLoading: () => {
        const container = document.getElementById('xray-results-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align:center; padding:100px 20px; color:var(--xray-primary); animation: fadeIn 0.5s ease;">
                <div style="position:relative; width:80px; height:80px; margin: 0 auto 30px auto; display: flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-satellite fa-spin" style="font-size:45px; color:white; filter: drop-shadow(0 0 15px var(--xray-primary));"></i>
                    <div class="radar-ping"></div>
                </div>
                <p style="font-family:monospace; font-size:10px; font-weight:900; letter-spacing:3px; color:var(--xray-primary);">SINCRO-SATÉLITE ATIVO</p>
                <p style="font-size:9px; opacity:0.5; margin-top:8px; text-transform:uppercase; letter-spacing:1px;">A sintonizar referências e palavras-chave...</p>
            </div>
        `;
    },

    /**
     * 2. RENDERIZADOR PRINCIPAL (AGRUPAMENTO HÍBRIDO)
     */
    renderizarResultados: (filtro) => {
        const container = document.getElementById('xray-results-container');
        if (!state.resultadosCache || !container) return;

        container.innerHTML = "";

        // --- CASOS ESPECIAIS (BÍBLIA E RESUMO) ---
        if (filtro === 'biblia') { XRayUI.renderAbaBiblia(container); return; }
        if (filtro === 'resumo') { XRayUI.renderAbaResumo(container); return; }

        let encontrouAlgo = false;

        // --- A) AGRUPAMENTO POR VERSÍCULO BÍBLICO ---
        state.resultadosCache.referencias.forEach(ref => {
            const refNome = `${ref.livro} ${ref.cap}:${ref.ver}`;
            if (state.config.silenciados.has(refNome)) return;

            const itensDesteTexto = (state.resultadosCache.resultados[filtro] || [])
                .filter(item => item.referencia === refNome);

            if (itensDesteTexto.length > 0) {
                encontrouAlgo = true;
                XRayUI.injetarCabecalhoGrupo(container, refNome, "bible");
                itensDesteTexto.forEach(item => XRayUI.injetarCardResultado(container, item));
            }
        });

        // --- B) AGRUPAMENTO POR PALAVRA-CHAVE (SEMÂNTICA) ---
     if (state.resultadosPalavrasCache) {
            Object.entries(state.resultadosPalavrasCache).forEach(([palavra, itens]) => {
                
                // 🚀 NOVO FILTRO: Verifica se a palavra está silenciada nas definições
                if (state.config.silenciadosPalavras.has(palavra)) return;

                const itensDaAba = itens.filter(it => {
                    const ctx = it.bridge.contexto;
                    return (filtro === 'publicacoes' && ctx === 'publicacao') || 
                           (filtro === 'livros' && ctx === 'livro') || 
                           (filtro === 'media' && ctx === 'multimedia');
                });

                if (itensDaAba.length > 0) {
                    encontrouAlgo = true;
                    XRayUI.injetarCabecalhoGrupo(container, palavra, "keyword");
                    itensDaAba.forEach(item => XRayUI.injetarCardResultado(container, item));
                }
            });
        }

        if (!encontrouAlgo) {
            container.innerHTML = `<p style="text-align:center; padding:60px 20px; opacity:0.3; font-size:12px;">Nenhuma correlação encontrada em ${filtro.toUpperCase()}.</p>`;
        }
    },

    /**
     * 3. AUXILIARES DE CONSTRUÇÃO DE UI
     */
    injetarCabecalhoGrupo: (container, titulo, tipo) => {
        const header = document.createElement('div');
        // bible -> ambar/laranja | keyword -> indigo/azul
        header.className = tipo === "bible" ? "group-header-bible" : "group-header-keyword";
        header.innerHTML = `<i class="fa-solid ${tipo==='bible'?'fa-quote-left':'fa-magnifying-glass'}"></i> ${titulo.toUpperCase()}`;
        container.appendChild(header);
    },

    injetarCardResultado: (container, item) => {
        const b = item.bridge;
        const idFonteItem = b.contexto === 'livro' ? b.sigla : `${b.sigla}_${b.ano}_${b.mes}`;
        
        // Filtro de silêncio de fonte específica (Sentinela 01/24, etc)
        if (state.config.fontesOcultas.has(idFonteItem)) return;

        const card = document.createElement('div');
        card.className = 'xray-result-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="font-size:9px; color:var(--xray-primary); font-weight:900; text-transform:uppercase;">${item.contexto}</span>
                <i class="fa-solid fa-up-right-from-square" style="font-size:10px; opacity:0.3;"></i>
            </div>
            <div style="font-size:14px; font-weight:700; color:white; line-height:1.4;">${item.titulo}</div>
            <div style="font-size:12px; color:#94a3b8; margin-top:10px; font-style:italic; line-height:1.6;">"${item.resumo}"</div>`;
        
        card.onclick = () => XRayUI.abrirLeituraCompleta(item);
        container.appendChild(card);
    },

    /**
     * 4. ABAS ESPECÍFICAS (BÍBLIA E RESUMO)
     */
    renderAbaBiblia: (container) => {
        if (state.resultadosCache.referencias.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; opacity:0.3;">Aguardando deteção de textos no Manifesto...</p>`;
            return;
        }
        state.resultadosCache.referencias.forEach(ref => {
            const nome = `${ref.livro} ${ref.cap}:${ref.ver}`;
            if (state.config.silenciados.has(nome)) return;
            container.innerHTML += `
                <div class="xray-result-card" style="border-left-color: #818cf8; cursor:default; background: rgba(129, 140, 248, 0.03);">
                    <div style="font-size:11px; font-weight:900; color:#818cf8; text-transform:uppercase; margin-bottom:8px;">${nome}</div>
                    <div style="font-size:var(--xray-dir-font); line-height:1.6; color:#cbd5e1;">${state.textosBiblicosCache[nome] || "Sincronizando..."}</div>
                </div>`;
        });
    },

    renderAbaResumo: (container) => {
        let html = `
            <div class="resumo-header-tools">
                <i class="fa-solid fa-grip-lines ${state.modoResumo === 'linhas' ? 'active' : ''}" onclick="window.setModoResumoX('linhas')"></i>
                <i class="fa-solid fa-align-left ${state.modoResumo === 'paragrafos' ? 'active' : ''}" onclick="window.setModoResumoX('paragrafos')"></i>
            </div>`;

        state.resultadosCache.referencias.forEach(ref => {
            const nome = `${ref.livro} ${ref.cap}:${ref.ver}`;
            if (state.config.silenciados.has(nome)) return;
            const frases = [...state.resultadosCache.resultados.publicacoes, ...state.resultadosCache.resultados.livros, ...state.resultadosCache.resultados.multimedia].filter(r => r.referencia === nome);
            if (frases.length > 0) {
                html += `<div style="margin-bottom:35px;"><h3 style="color:#fbbf24; font-size:12px; font-weight:900; text-transform:uppercase; margin-bottom:15px;"><i class="fa-solid fa-quote-left" style="font-size:8px;"></i> ${nome}</h3>`;
                if (state.modoResumo === 'linhas') {
                    frases.forEach(f => { html += `<p style="font-size:var(--xray-dir-font); line-height:1.7; opacity:0.8; margin-bottom:10px; padding:12px; background:rgba(255,255,255,0.02); border-radius:10px; border-left:2px solid #fbbf24;">"${f.resumo}"</p>`; });
                } else {
                    html += `<div style="font-size:var(--xray-dir-font); line-height:1.8; color:#cbd5e1; background:rgba(255,255,255,0.03); padding:20px; border-radius:12px; text-align:justify; border:1px solid rgba(255,255,255,0.05);">${frases.map(f => f.resumo).join(" ")}</div>`;
                }
                html += `</div>`;
            }
        });
        container.innerHTML = html;
    },

    /**
     * 5. VISOR DE LEITURA (ARTIGO INTEGRAL)
     */
    abrirLeituraCompleta: async (item) => {
        const isDireita = state.config.leituraDireita;
        const displayId = isDireita ? 'xray-results-container' : 'leitura-display';
        const display = document.getElementById(displayId);

        if (isDireita) document.querySelector('.tab-btn-right[data-tab="leitura"]').click();
        else document.querySelector('.tab-btn-left[data-target="leitura-display"]').click();

        display.innerHTML = `<div style="text-align:center; padding:50px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:30px;"></i><p style="font-size:11px; margin-top:10px; opacity:0.5;">A SINTONIZAR FONTE INTEGRAL...</p></div>`;

        try {
            const p = (item.bridge.sigla === 'mwb') ? 'mwb' : (item.bridge.contexto === 'livro' ? 'livros' : 'w');
            const url = item.bridge.contexto === 'livro' ? `data/livros/${item.bridge.sigla}.json` : `data/publicacoes/${p}/${item.bridge.ano}/${item.bridge.mes}.json`;
            const res = await fetch(url);
            const json = await res.json();
            const blocos = json.artigos || json.capitulos || [json.video];
            const art = blocos.find(a => (a.titulo === item.bridge.artigo) || (String(a.capitulo) === item.bridge.capitulo));

            const htmlCorpo = art.conteudo.map(b => {
                const isAlvo = (b.numero_ref == item.bridge.paragrafos[0]);
                return `<div ${isAlvo ? 'id="paragrafo-foco-xray"' : ''} class="leitura-paragrafo" 
                             style="${isAlvo ? 'background:rgba(99, 102, 241, 0.15); border-left: 4px solid var(--xray-primary); padding:15px; border-radius: 8px;' : 'padding: 8px 0; border-left: 4px solid transparent;'} margin-bottom:15px; font-size:var(--xray-esq-font); line-height:1.8; color:#e2e8f0; transition: background 0.5s;">
                            <b style="color:var(--xray-primary); font-size:10px; margin-right:12px; opacity:0.5;">${b.numero_ref || ''}</b> ${b.texto}
                        </div>`;
            }).join('');

            display.innerHTML = `
                <div class="leitura-artigo-wrapper" style="animation:fadeIn 0.6s ease; padding-bottom:150px;">
                    ${isDireita ? `<button onclick="document.querySelector('.tab-btn-right[data-tab=\\'publicacoes\\']').click()" style="background:rgba(255,255,255,0.05); border:none; color:var(--xray-primary); padding:8px 15px; border-radius:8px; font-size:10px; font-weight:800; cursor:pointer; margin-bottom:20px; text-transform:uppercase;"><i class="fa-solid fa-arrow-left"></i> Voltar à Pesquisa</button>` : ''}
                    <p style="font-size:10px; color:var(--xray-primary); font-weight:800; text-transform:uppercase; margin-bottom:10px; letter-spacing:1px;">${item.contexto}</p>
                    <h2 style="font-size:26px; color:white; margin-bottom:40px; font-weight:700; line-height:1.3;">${art.titulo}</h2>
                    ${htmlCorpo}
                </div>`;

            setTimeout(() => {
                const el = document.getElementById('paragrafo-foco-xray');
                if(el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.background = "rgba(99, 102, 241, 0.4)";
                    setTimeout(() => { el.style.background = "rgba(99, 102, 241, 0.15)"; }, 1000);
                }
            }, 400);

        } catch (e) { display.innerHTML = `<p style="color:#ef4444; text-align:center; padding:40px;">Erro ao carregar fonte original.</p>`; }
    },

    /**
     * 6. SINCRONIZADOR DE POSIÇÃO (Transporta o visor entre colunas)
     */
    sincronizarPosicaoLeitura: () => {
        const wrapper = document.querySelector('.leitura-artigo-wrapper');
        if (!wrapper) return;
        const isDireita = state.config.leituraDireita;
        const novoAlvo = document.getElementById(isDireita ? 'xray-results-container' : 'leitura-display');
        if (novoAlvo) {
            novoAlvo.innerHTML = "";
            novoAlvo.appendChild(wrapper);
            if (isDireita) document.querySelector('.tab-btn-right[data-tab="leitura"]').click();
            else document.querySelector('.tab-btn-left[data-target="leitura-display"]').click();
        }
    }
};