chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[WOL-BACKGROUND] 📩 Mensagem recebida no Service Worker:", request);

  if (request.action === "SEND_TO_GERADOR") {
    // Procura por todas as abas abertas que correspondam ao gerador_manual.html
    chrome.tabs.query({}, (tabs) => {
      console.log(`[WOL-BACKGROUND] 🔎 A pesquisar abas abertas (${tabs.length} abas encontradas)...`);
      const targetTab = tabs.find(tab => tab.url && tab.url.includes("gerador_manual.html"));

      if (targetTab) {
        console.log(`[WOL-BACKGROUND] 🎯 Aba do gerador encontrada! ID: ${targetTab.id}, URL: ${targetTab.url}`);

        // Envia os dados para a aba do gerador encontrada
        chrome.tabs.sendMessage(targetTab.id, {
          action: "FILL_GERADOR",
          data: request.data
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("[WOL-BACKGROUND] ❌ Erro ao enviar para a aba do gerador:", chrome.runtime.lastError);
            sendResponse({
              success: false,
              error: "Aba do gerador encontrada, mas não respondeu. Recarregue a página do gerador."
            });
          } else {
            console.log("[WOL-BACKGROUND] ✅ Resposta da aba do gerador:", response);
            // Ativa/Foca a aba do gerador para facilitar o trabalho do utilizador
            chrome.tabs.update(targetTab.id, { active: true });
            sendResponse({ success: true });
          }
        });
      } else {
        console.warn("[WOL-BACKGROUND] ⚠️ Nenhuma aba com 'gerador_manual.html' foi encontrada.");
        sendResponse({
          success: false,
          error: "Aba do gerador_manual.html não encontrada! Por favor, abra a página do Gerador no seu navegador."
        });
      }
    });

    return true; // Mantém o canal de mensagens aberto para resposta assíncrona
  }
});
