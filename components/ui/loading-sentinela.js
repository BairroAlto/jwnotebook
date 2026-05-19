// components/ui/loading-sentinela.js

export const SentinelaLoader = {
    show: (tituloArtigo = "") => {
        let el = document.getElementById('sentinela-loader');
        
        if (!el) {
            el = document.createElement('div');
            el.id = 'sentinela-loader';
            document.body.appendChild(el);
        }

        // Injetar os elementos necessários para a animação
        el.innerHTML = `
            <div class="tower-visual-container">
                <div class="radar-ring"></div>
                <div class="radar-ring"></div>
                <div class="radar-ring"></div>
                <i class="fa-solid fa-tower-observation"></i>
            </div>
            <div class="loader-text">A SINTONIZAR ESTUDO</div>
            <div class="loader-subtext">${tituloArtigo.toUpperCase()}</div>
        `;

        el.style.display = 'flex';
    },

    hide: () => {
        const el = document.getElementById('sentinela-loader');
        if (el) el.style.display = 'none';
    }
};