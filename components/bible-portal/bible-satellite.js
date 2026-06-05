// components/bible-portal/bible-satellite.js
import { dispararPesquisaParabolica } from '../direita/xsat-controller.js';
import { BIBLE_DATA } from '../lists/bible-data.js';

export const BibleSatellite = {
    
    scanCapituloInteiro: async (livroNome, capNum) => {
        console.log(`📡 [BIBLE-SATELLITE] Iniciando varredura: ${livroNome} ${capNum}`);

        // 1. Localizar o número máximo de versículos deste capítulo
        const livroMeta = BIBLE_DATA.find(l => l.nome === livroNome);
        if (!livroMeta) return;
        
        const maxVersiculos = livroMeta.versiculos[capNum - 1];

        // 2. Criar a string de comando X-SAT (Génesis 1:1-31)
        const superReferencia = `${livroNome} ${capNum}:1-${maxVersiculos}`;

        // 3. Feedback Visual de Uplink
        BibleSatellite.mostrarAnimacaoUplink(true);

        // 4. Disparar o motor X-SAT existente
        // Como o portal Bíblia é modular, usamos a ponte para o controlador central
        try {
            if (typeof dispararPesquisaParabolica === 'function') {
                await new Promise(resolve => setTimeout(resolve, 80));
                await dispararPesquisaParabolica(superReferencia, false);
                
                // Opcional: Se estivermos numa página separada, podemos decidir 
                // se mostramos os resultados num popup local ou voltamos ao index
                console.log("✅ Pesquisa enviada para o Canal disponível.");
            } else {
                console.error("❌ Motor X-SAT não localizado.");
            }
        } catch (e) {
            console.error("Erro no Uplink:", e);
        } finally {
            setTimeout(() => BibleSatellite.mostrarAnimacaoUplink(false), 2000);
        }
    },

    mostrarAnimacaoUplink: (status) => {
        const btn = document.getElementById('btn-xsat-bible');
        if (status) {
            btn.classList.add('fa-spin');
            btn.style.color = "#fff";
            btn.style.filter = "drop-shadow(0 0 10px #fbbf24)";
        } else {
            btn.classList.remove('fa-spin');
            btn.style.color = "#fbbf24";
            btn.style.filter = "none";
        }
    }
};
