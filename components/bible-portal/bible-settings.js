// components/bible-portal/bible-settings.js

export const BibleSettings = {
    /**
     * ESTADO DE PREFERÊNCIAS (Fonte da verdade para a UI)
     */
    state: {
        verseSize: 16,
        titleSize: 22,
        viewMode: "grid", // "grid" (linha a linha) ou "sequence" (parágrafo)
        aiFloating: false
    },

    /**
     * INICIALIZAÇÃO
     */
    iniciar: () => {
        console.log("%c⚙️ [SETTINGS] Iniciando motores de personalização...", "color: #8b5cf6; font-weight: bold;");
        
        BibleSettings.vincularSliders();
        BibleSettings.vincularModoVisao();
        BibleSettings.vincularFloatingAI();
        
        console.log("✅ [SETTINGS] Configurações vinculadas.");
    },

    /**
     * 1. CONTROLO DE TAMANHO DE LETRA (SLIDERS)
     */
    vincularSliders: () => {
        const rangeV = document.getElementById('range-bible-font-verses');
        const rangeT = document.getElementById('range-bible-font-books');

        // Slider para Versículos
        if (rangeV) {
            rangeV.oninput = (e) => {
                const val = e.target.value;
                const label = document.getElementById('val-font-verses');
                
                // Atualizar CSS e UI
                document.documentElement.style.setProperty('--bible-verse-size', val + "px");
                if (label) label.innerText = val + "px";
                
                BibleSettings.state.verseSize = val;
                console.log(`📏 [FONT] Versículos: ${val}px`);
            };
        }

        // Slider para Títulos (Livros)
        if (rangeT) {
            rangeT.oninput = (e) => {
                const val = e.target.value;
                const label = document.getElementById('val-font-books');
                
                // Atualizar CSS e UI
                document.documentElement.style.setProperty('--bible-title-size', val + "px");
                if (label) label.innerText = val + "px";
                
                BibleSettings.state.titleSize = val;
                console.log(`📏 [FONT] Títulos: ${val}px`);
            };
        }
    },

    /**
     * 2. MODO DE VISUALIZAÇÃO (GRELHA VS SEQUÊNCIA)
     */
    vincularModoVisao: () => {
        const btns = document.querySelectorAll('.view-opt');
        const feed = document.getElementById('bible-feed');

        btns.forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode; // "grid" ou "sequence"
                
                // 1. Atualizar Botões (Visual)
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 2. Aplicar Classe ao Feed
                if (feed) {
                    feed.className = (mode === 'sequence') ? 'view-sequence' : 'view-grid';
                }

                BibleSettings.state.viewMode = mode;
                console.log(`🎨 [LAYOUT] Modo alterado para: ${mode.toUpperCase()}`);
            };
        });
    },

    /**
     * 3. COMPORTAMENTO DO BOOKAI (BARRA VS FLUTUANTE)
     */
    vincularFloatingAI: () => {
        const check = document.getElementById('check-ai-floating');
        if (!check) return;

        check.onchange = (e) => {
            const isFloating = e.target.checked;
            BibleSettings.state.aiFloating = isFloating;

            const iconBarra = document.getElementById('btn-abrir-ai-biblia');
            const zonaFlutuante = document.getElementById('bookai-floating-zone');

            if (isFloating) {
                // MODO FLUTUANTE ATIVO
                console.log("🤖 [AI] BookAI movido para o canto inferior.");
                if (iconBarra) {
                    iconBarra.style.setProperty('display', 'none', 'important');
                }
                if (zonaFlutuante) {
                    zonaFlutuante.classList.remove('hidden');
                    zonaFlutuante.style.display = 'flex';
                }
            } else {
                // MODO BARRA ATIVO
                console.log("🤖 [AI] BookAI restaurado para a barra superior.");
                if (iconBarra) {
                    // Só mostra se houver um capítulo carregado (lógica do BibleUI)
                    if (window.livroAtivo) {
                        iconBarra.style.setProperty('display', 'inline-flex', 'important');
                    }
                }
                if (zonaFlutuante) {
                    zonaFlutuante.classList.add('hidden');
                    zonaFlutuante.style.display = 'none';
                }
            }
        };

        // Lógica de clique no botão flutuante (abre o mesmo popup de chat)
        const btnFloat = document.getElementById('btn-bookai-float');
        if (btnFloat) {
            btnFloat.onclick = () => {
                const popup = document.getElementById('popup-ai-bible');
                if (popup) popup.classList.add('active');
            };
        }
    }
};