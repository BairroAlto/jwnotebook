// components/direita/ai-interaction.js
export const AIInteraction = {
    isManualScroll: false,

    initScrollSpy: (caixasAtivas, onHighlight) => {
        const editor = document.querySelector('.center-col');
        if (!editor || window._aiScrollInited) return;

        editor.addEventListener('scroll', () => {
            if (AIInteraction.isManualScroll) return;
            const blocos = document.querySelectorAll('[id^="bloco-"]');
            let maisProximo = null;
            let menorDist = Infinity;

            blocos.forEach(b => {
                const rect = b.getBoundingClientRect();
                const dist = Math.abs(rect.top - (window.innerHeight * 0.3));
                if (dist < menorDist) { menorDist = dist; maisProximo = b.id.replace('bloco-', ''); }
            });

            if (maisProximo) onHighlight(maisProximo);
        });
        window._aiScrollInited = true;
    },

    focarBloco: (id, callback) => {
        const el = document.getElementById(`bloco-${id}`);
        if (!el) return callback ? callback() : null;
        AIInteraction.isManualScroll = true;
        AIInteraction.destacarCard(id);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { 
            AIInteraction.isManualScroll = false; 
            if(callback) callback();
        }, 600);
    },

    destacarCard: (id) => {
        document.querySelectorAll('#ai-blocks-list .indice-card').forEach(c => c.classList.remove('active'));
        const card = document.getElementById(`ai-nav-${id}`);
        if (card) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
};