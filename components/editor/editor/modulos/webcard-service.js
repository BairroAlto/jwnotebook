// components/editor/modulos/webcard-service.js

export const WebCardService = {
    abrirConfigurador: (caixaAtual) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('popup-webcard-overlay');
            const inputs = overlay.querySelectorAll('.input-url-web');
            const btnConfirmar = document.getElementById('btn-confirmar-webcard');
            const btnCancelar = document.getElementById('btn-cancelar-webcard');

            const linksAtuais = caixaAtual.links || [];
            inputs.forEach((input, i) => {
                input.value = linksAtuais[i] ? linksAtuais[i].url : "";
            });

            overlay.classList.add('active');

            const fechar = (dados) => {
                overlay.classList.remove('active');
                btnConfirmar.onclick = null;
                resolve(dados);
            };

            btnConfirmar.onclick = () => {
                const urls = Array.from(inputs)
                    .map(i => i.value.trim())
                    .filter(val => val !== "");
                
                // Retorna apenas as URLs brutas imediatamente
                fechar(urls);
            };

            btnCancelar.onclick = () => fechar(null);
        });
    },

    // Função que será chamada em segundo plano para cada link
    obterMetadados: async (url) => {
        if (!url.startsWith('http')) url = 'https://' + url;
        try {
            const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            if (data.status === 'success') {
                return {
                    url: url,
                    titulo: data.data.title || url,
                    imagem: data.data.image?.url || data.data.logo?.url || `https://www.google.com/s2/favicons?domain=${url}&sz=128`,
                    site: data.data.publisher || url.split('/')[2].replace('www.', ''),
                    loading: false
                };
            }
        } catch (e) { console.error("Erro no scrape:", e); }
        
        // Fallback rápido
        return {
            url: url,
            titulo: url.split('/')[2].replace('www.', ''),
            imagem: `https://www.google.com/s2/favicons?domain=${url}&sz=128`,
            site: "",
            loading: false
        };
    }
};