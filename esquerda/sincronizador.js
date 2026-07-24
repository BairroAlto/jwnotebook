/**
 * SINCRONIZADOR DA BARRA LATERAL
 * Faz a coluna da esquerda "viajar" até à localização da nota aberta
 */
window.sincronizarBarraLateralComNota = async (idNota, dados, auth) => {
    const onde = dados.onde || "local"; // 'local' ou 'share'
    const uid = auth.currentUser.uid;

    // 1. CLICAR NA ABA CERTA (LOCAL ou SHARE)
    const botoesAba = document.querySelectorAll('#left-buttons button');
    const nomeProcurado = onde.toUpperCase();
    const btnAlvo = Array.from(botoesAba).find(b => b.innerText.trim().toUpperCase() === nomeProcurado);
    
    if (btnAlvo && !btnAlvo.classList.contains('active')) {
        btnAlvo.click(); // Muda de aba automaticamente
    }

    // 2. VIAJAR ATÉ À PASTA DA NOTA
    // Se for LOCAL
    if (onde === "local") {
        const pastaDestino = dados.pastapai || "root";
        if (window.pastaAtual !== pastaDestino) {
            console.log("📂 Viajando para pasta local:", pastaDestino);
            window.pastaAtual = pastaDestino;
            // Reset do histórico para não quebrar o botão "Voltar"
            window.historicoPastas = [{ id: "root", nome: "Local" }];
            if (pastaDestino !== "root") window.historicoPastas.push({ id: pastaDestino, nome: "Pasta" });
            
            // Forçar re-leitura do Firebase para esta pasta
            if (typeof window.carregarPastaLocalManual === 'function') {
                window.carregarPastaLocalManual(pastaDestino);
            }
        }
    } 
    // Se for SHARE
    else {
        const pastaDestinoShare = dados[uid]?.pastapai || "home";
        if (window.pastaShareAtual !== pastaDestinoShare) {
            console.log("📂 Viajando para pasta share:", pastaDestinoShare);
            window.pastaShareAtual = pastaDestinoShare;
            window.historicoPastasShare = [{ id: "home", nome: "Share" }];
            if (pastaDestinoShare !== "home") window.historicoPastasShare.push({ id: pastaDestinoShare, nome: "Pasta" });

            // Forçar re-leitura da aba Share
            if (typeof window.dispararLeituraShare === 'function') {
                window.dispararLeituraShare();
            }
        }
    }

    // 3. ILUMINAR O ITEM (Apenas os que já estão no DOM)
    // Um pequeno delay para dar tempo ao Firebase de renderizar a lista
    setTimeout(() => {
        document.querySelectorAll('.item-local').forEach(el => {
            const elId = el.getAttribute('data-id') || el.dataset.itemid;
            el.classList.toggle('active', elId === idNota);
        });
    }, 300);
};