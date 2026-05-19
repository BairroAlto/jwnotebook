// components/editor/modulos/imagens-service.js

export const ImagensService = {
    abrirConfigurador: (caixa) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('popup-imagens-overlay');
            const inputs = overlay.querySelectorAll('.input-img-url');
            const select = document.getElementById('select-dimensao-galeria');
            const btnConfirmar = document.getElementById('btn-confirmar-imagens');
            const btnCancelar = document.getElementById('btn-cancelar-imagens');

            // Preencher dados atuais
            const linksAtuais = caixa.links || [];
            inputs.forEach((input, i) => { input.value = linksAtuais[i] || ""; });
            select.value = caixa.urldimensao || "medias";

            overlay.classList.add('active');

            const fechar = (dados) => {
                overlay.classList.remove('active');
                btnConfirmar.onclick = null;
                resolve(dados);
            };

            btnConfirmar.onclick = () => {
                const urls = Array.from(inputs).map(i => i.value.trim()).filter(v => v !== "");
                fechar({ links: urls, urldimensao: select.value });
            };

            btnCancelar.onclick = () => fechar(null);
        });
    }
};