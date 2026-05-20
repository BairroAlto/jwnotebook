// components/direita/ai-view.js
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

const PROTOCOLOS = [
    {
        categoria: "Escrita & Qualidade",
        cor: "#6366f1",
        itens: [
            { id: "melhorar", nome: "Melhorar", icon: "fa-wand-magic-sparkles", cor: "#10b981" },
            { id: "origens", nome: "Gramática", icon: "fa-language", cor: "#a855f7" },
            { id: "oralidade", nome: "Oralidade", icon: "fa-microphone-lines", cor: "#f43f5e" },
            { id: "simplicidade", nome: "Crianças", icon: "fa-child-reaching", cor: "#fb923c" },
            { id: "titulos", nome: "Títulos", icon: "fa-heading", cor: "#22d3ee" },
            { id: "tom", nome: "Tom", icon: "fa-masks-theater", cor: "#a5f3fc" }
        ]
    },
    {
        categoria: "Estudo & Pesquisa",
        cor: "#fbbf24",
        itens: [
            { id: "investigar", nome: "Investigar", icon: "fa-microscope", cor: "#6366f1" },
            { id: "lexico", nome: "Léxico", icon: "fa-earth-africa", cor: "#8b5cf6" },
            { id: "cronologia", nome: "Tempo", icon: "fa-timeline", cor: "#94a3b8" },
            { id: "geografia", nome: "Geografia", icon: "fa-map-location-dot", cor: "#10b981" },
            { id: "profecia", nome: "Profecia", icon: "fa-scroll", cor: "#f59e0b" },
            { id: "critico", nome: "Analisar", icon: "fa-scale-balanced", cor: "#f87171" }
        ]
    },
    {
        categoria: "Ensino & Ministério",
        cor: "#ec4899",
        itens: [
            { id: "ilustrar", nome: "Ilustrar", icon: "fa-palette", cor: "#34d399" },
            { id: "analogias", nome: "Analogias", icon: "fa-lightbulb", cor: "#06b6d4" },
            { id: "ministerio", nome: "Ministério", icon: "fa-door-open", cor: "#ec4899" },
            { id: "objecoes", nome: "Objeções", icon: "fa-shield-halved", cor: "#ef4444" },
            { id: "pratico", nome: "Prático", icon: "fa-check-double", cor: "#60a5fa" },
            { id: "cosmos", nome: "Cosmos", icon: "fa-meteor", cor: "#db2777" }
        ]
    },
    {
        categoria: "Lógica & Memória",
        cor: "#22c55e",
        itens: [
            { id: "socratico", nome: "Desafiar", icon: "fa-brain", cor: "#f59e0b" },
            { id: "sintese", nome: "Resumir", icon: "fa-atom", cor: "#fbbf24" },
            { id: "mnemonica", nome: "Memória", icon: "fa-key", cor: "#fbbf24" },
            { id: "exame", nome: "Auto-teste", icon: "fa-file-signature", cor: "#6366f1" },
            { id: "contraste", nome: "Contraste", icon: "fa-circle-half-stroke", cor: "#475569" },
            { id: "estruturar", nome: "Esboço", icon: "fa-list-check", cor: "#1e293b" }
        ]
    }
];

export const AIView = {
    /**
     * RENDERIZA O CONTENTOR DA LISTA DE BLOCOS (VISTA INICIAL)
     */
    renderContainer: (display, isSentinela) => {
        display.innerHTML = `
            <div class="ai-container" id="ai-container-main">
                <p style="font-size:9px; color:#10b981; font-weight:900; text-transform:uppercase; text-align:center; margin-bottom:15px; letter-spacing:1px;">
                    <i class="fa-solid fa-robot"></i> Scanner BookAI: ${isSentinela ? 'ESTUDO' : 'NOTAS'}
                </p>
                <div id="ai-blocks-list" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>`;
    },

    /**
     * CRIA UM CARD INDIVIDUAL PARA A LISTA
     */
    criarCard: (c, onClick) => {
        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        const div = document.createElement('div');
        div.className = "indice-card";
        div.id = `ai-nav-${c.id}`;
        div.style.borderLeft = `4px solid ${config.cor}`;
        div.innerHTML = `
            <div class="label-tipo" style="color:${config.cor}; margin-bottom:5px;">
                <i class="${config.icon}"></i> ${config.nome}
            </div>
            <div class="resumo-texto" id="ai-txt-${c.id}" style="opacity:0.8; color:white;">...</div>`;
        div.onclick = onClick;
        return div;
    },

    /**
     * RENDERIZA O PAINEL DE ESCOLHA DE PROTOCOLOS
     */
    renderProtocolos: (display, caixa, onVoltar, onExecutar, incluirTitulo) => {
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        const isContentor = caixa.tipo === 'contentor';

        // 1. SELETOR DE MODO DE PESQUISA (Escondido se for Contentor)
        const seletorTituloHtml = isContentor ? '' : `
    <div style="display:flex; gap:5px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 10px; margin-bottom: 25px;">
        <!-- Fica inativo por defeito -->
        <button class="btn-amt ${incluirTitulo ? 'active' : ''}" id="btn-com-titulo" style="flex:1; height:28px; font-size:9px; font-weight:800;">COM TÍTULO</button>
        
        <!-- Fica ATIVO por defeito porque incluirTitulo é false -->
        <button class="btn-amt ${!incluirTitulo ? 'active' : ''}" id="btn-sem-titulo" style="flex:1; height:28px; font-size:9px; font-weight:800;">SEM TÍTULO</button>
    </div>
`;

        // 2. GERAÇÃO DAS CATEGORIAS E BOTÕES
        let htmlCategorias = PROTOCOLOS.map(cat => `
            <div style="margin-bottom: 25px;">
                <p style="font-size:9px; color:${cat.cor}; font-weight:900; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px; border-bottom: 1px solid ${cat.cor}33; padding-bottom:5px;">${cat.categoria}</p>
                <div class="btn-protocolo-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    ${cat.itens.map(it => `
                        <button class="btn-protocolo" data-m="${it.id}" style="border-color:${it.cor};">
                            <i class="fa-solid ${it.icon}" style="color:${it.cor};"></i>
                            <span>${it.nome}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // 3. MONTAGEM FINAL
        display.innerHTML = `
            <div class="ai-container" style="padding-bottom: 50px;">
                <button class="btn-voltar-ai" id="ai-back-btn"><i class="fa-solid fa-arrow-left"></i> Voltar à Lista</button>
                
                <div class="ai-target-card" style="border-left: 4px solid ${config.cor}; margin-bottom:15px;">
                    <span class="ai-target-label" style="color:${config.cor}">Alvo: ${config.nome}</span>
                    <p style="font-size:12px; color:white; opacity:0.8; line-height:1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${caixa.conteudo || 'Sem conteúdo para analisar.'}
                    </p>
                </div>

                ${seletorTituloHtml}
                ${htmlCategorias}
            </div>`;
        
        // 4. ATRIBUIÇÃO DE EVENTOS
        display.querySelector('#ai-back-btn').onclick = onVoltar;
        
        if (!isContentor) {
            display.querySelector('#btn-com-titulo').onclick = () => window.dispatchEvent(new CustomEvent('ai:toggleTitulo', {detail: true}));
            display.querySelector('#btn-sem-titulo').onclick = () => window.dispatchEvent(new CustomEvent('ai:toggleTitulo', {detail: false}));
        }

        display.querySelectorAll('.btn-protocolo').forEach(btn => {
            btn.onclick = () => onExecutar(btn.dataset.m);
        });
    },

    /**
     * FORMATA O MARKDOWN DA IA PARA HTML ELEGANTE
     */
    formatarTexto: (t) => {
        if (!t) return "";
        return t.replace(/^### (.*$)/gim, '<h4 style="color:#10b981; margin:15px 0 5px 0; font-weight:800; font-size:11px; text-transform:uppercase;">$1</h4>')
                .replace(/\*\*(.*?)\*\*/g, '<b style="color:white; font-weight:700;">$1</b>')
                .replace(/^\s*[\-\*]\s+(.*)$/gim, '<div style="margin-left:10px; margin-bottom:5px; display:flex; gap:8px; line-height:1.5;"><span style="color:#10b981;">•</span><span>$1</span></div>');
    }
};
