chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[WOL-GERADOR-SCRIPT] 📩 Dados recebidos na página do gerador:", request);

  if (request.action === "FILL_GERADOR") {
    const { refBase, rawText } = request.data;

    const inpRef = document.getElementById('inp-ref-base');
    const rawInput = document.getElementById('raw-input');

    if (inpRef && rawInput) {
      console.log(`[WOL-GERADOR-SCRIPT] 📝 A preencher Referência: "${refBase}"...`);

      // 1. Preencher a referência completa (ex: mwb25 janeiro pp. 12-13)
      if (refBase) {
        inpRef.value = refBase;
        inpRef.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 2. Preencher o texto bruto da semana
      if (rawText) {
        rawInput.value = rawText;
        rawInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      console.log("%c[WOL-GERADOR-SCRIPT] ✅ Preenchimento concluído e pré-visualização atualizada!", "color: #2ecc71; font-weight: bold;");
      sendResponse({ status: "OK", message: "Aba ativa preenchida com sucesso!" });
    } else {
      console.error("[WOL-GERADOR-SCRIPT] ❌ Elementos do formulário não encontrados na página.");
      sendResponse({ status: "ERROR", message: "Elementos do formulário não encontrados na página." });
    }

    return true;
  }
});
