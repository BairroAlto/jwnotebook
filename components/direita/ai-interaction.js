// components/direita/ai-interaction.js
export const AIInteraction = {
    isManualScroll: false,

    /**
     * MONITORIZA O SCROLL DO EDITOR PARA DESTACAR CARDS NA DIREITA
     */
    initScrollSpy: (caixasAtivas, onHighlight) => {
        const editor = document.querySelector('.center-col');
        // Prevenir duplicação de listeners
        if (!editor || window._aiScrollInited) return;

        editor.addEventListener('scroll', () => {
            // Se o scroll foi disparado por um clique num card, ignoramos a lógica automática
            if (AIInteraction.isManualScroll) return;

            const scrollPos = editor.scrollTop;
            
            // Sensor de Topo
            if (scrollPos < 50 && caixasAtivas[0]) {
                onHighlight(caixasAtivas[0].id);
                return;
            }

            // Deteção de proximidade por bloco
            const blocos = document.querySelectorAll('[id^="bloco-"]');
            let maisProximo = null;
            let menorDist = Infinity;

            blocos.forEach(b => {
                const rect = b.getBoundingClientRect();
                const dist = Math.abs(rect.top - (window.innerHeight * 0.3)); // 30% do ecrã
                if (dist < menorDist) { 
                    menorDist = dist; 
                    maisProximo = b.id.replace('bloco-', ''); 
                }
            });

            if (maisProximo) onHighlight(maisProximo);
        });

        window._aiScrollInited = true;
    },

    /**
     * FAZ O EDITOR (CENTRO) ROLAR ATÉ AO BLOCO SELECIONADO
     */
    focarNoEditor: (id, callback) => {
        const el = document.getElementById(`bloco-${id}`);
        if (!el) {
            if(callback) callback();
            return;
        }

        // Ativa a trava para o Scroll-Spy não tentar re-posicionar durante a animação
        AIInteraction.isManualScroll = true;
        
        // Destaca logo o card na direita
        AIInteraction.aplicarDestaqueUI(id);

        // Executa o scroll suave
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Liberta a trava e chama a próxima ação (protocolos) após o fim do scroll
        setTimeout(() => { 
            AIInteraction.isManualScroll = false; 
            if(callback) callback();
        }, 600);
    },

    /**
     * DESTACA O CARD NA LISTA DA IA (DIREITA)
     */
    aplicarDestaqueUI: (id) => {
        const todosCards = document.querySelectorAll('#ai-blocks-list .indice-card');
        todosCards.forEach(c => c.classList.remove('active'));

        const card = document.getElementById(`ai-nav-${id}`);
        if (card) {
            card.classList.add('active');
            // Faz o card ser visível na lista lateral se houver muitos
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
};
