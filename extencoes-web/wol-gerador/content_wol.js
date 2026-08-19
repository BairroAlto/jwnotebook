(function () {
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  function showToast(message, type = "success") {
    const existing = document.querySelector(".wol-gerador-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `wol-gerador-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast) toast.remove();
    }, 4000);
  }

  function extractWolData() {
    console.log("%c[WOL-GERADOR] 🔍 A iniciar extração de dados...", "color: #3498db; font-weight: bold;");

    let refBase = "";

    // 1. Procurar o texto do elemento da migalha de pão (suporta span, a, div dentro de .navLeft e topo do WOL)
    const headerElements = Array.from(document.querySelectorAll('.navLeft, .navLeft *, .contextTitle, .breadcrumbNav, .breadcrumbNav *, header, header *, #siteNav *'));
    
    let textSource = "";
    for (const el of headerElements) {
      const txt = el.innerText ? el.innerText.trim() : "";
      if (txt.toLowerCase().includes("mwb")) {
        textSource = txt;
        break;
      }
    }

    if (!textSource) {
      textSource = document.title + " " + document.body.innerText;
    }

    console.log("[WOL-GERADOR] 📌 Fonte de texto da navegação capturada:", textSource);

    // Extração dinâmica de componentes
    const pubMatch = textSource.match(/\b(mwb\d{2})\b/i) || (document.title + " " + document.body.innerText).match(/\b(mwb\d{2})\b/i);
    const pubCode = pubMatch ? pubMatch[1].toLowerCase() : "mwb25";

    const pageMatch = textSource.match(/(pp?\.\s*\d+(?:\s*[-–—]\s*(?:[a-zçáàãâéêíóôõú]+\s+)?\d+)?)/i) || 
                      (document.title + " " + document.body.innerText).match(/(pp?\.\s*\d+(?:\s*[-–—]\s*(?:[a-zçáàãâéêíóôõú]+\s+)?\d+)?)/i);
    const pageRange = pageMatch ? pageMatch[1].toLowerCase() : "";

    let foundMonth = "";
    for (const m of months) {
      if (textSource.toLowerCase().includes(m)) {
        foundMonth = m;
        break;
      }
    }
    if (!foundMonth) {
      for (const m of months) {
        if (document.body.innerText.toLowerCase().includes(m)) {
          foundMonth = m;
          break;
        }
      }
    }

    if (foundMonth && pageRange) {
      refBase = `${pubCode} ${foundMonth} ${pageRange}`;
    } else if (pageRange) {
      refBase = `${pubCode} ${pageRange}`;
    } else {
      refBase = textSource.replace(/^[<>\s]+/, '').replace(/[\s🎧]+$/, '').trim();
    }

    console.log("%c[WOL-GERADOR] 🎯 Referência Completa Dinâmica capturada:", "color: #2ecc71; font-weight: bold;", refBase);

    // 2. Extração do Conteúdo do Artigo
    const mainContainer = document.querySelector('#article, article, #articleContent, .docClass-20, .items, #content, main') || document.body;

    const textLines = [];
    const elements = mainContainer.querySelectorAll('[data-pid], [id^="p"], h1, h2, h3, h4, p, li');

    if (elements.length > 0) {
      elements.forEach(el => {
        if (el.closest('#siteNav, .audioPlayer, #footer, .siteFooter, #wol-to-gerador-btn, .textTools, .utilityNav')) return;

        const text = el.innerText ? el.innerText.trim() : "";
        
        const lowerText = text.toLowerCase();
        if (
          !text ||
          lowerText.includes("tamanho da letra") ||
          lowerText.includes("opções de descarregamento") ||
          lowerText.includes("partilhar") ||
          lowerText.includes("imprimir") ||
          lowerText.includes("biblioteca online") ||
          lowerText.includes("digite um assunto")
        ) {
          return;
        }

        if (!textLines.includes(text)) {
          textLines.push(text);
        }
      });
    }

    if (textLines.length === 0) {
      console.log("[WOL-GERADOR] ⚠️ Seleção por blocos vazia. A usar extração de linhas simples...");
      const rawInnerText = mainContainer.innerText || "";
      rawInnerText.split('\n').forEach(line => {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (
          trimmed &&
          !lower.includes("biblioteca online") &&
          !lower.includes("digite um assunto") &&
          !lower.includes("tamanho da letra") &&
          !lower.includes("opções de descarregamento") &&
          !lower.includes("partilhar") &&
          !lower.includes("imprimir")
        ) {
          textLines.push(trimmed);
        }
      });
    }

    const rawText = textLines.join('\n');
    console.log(`[WOL-GERADOR] 📄 Extraídas ${textLines.length} linhas de texto do artigo.`);

    return { refBase, rawText };
  }

  function initButton() {
    if (document.getElementById("wol-to-gerador-btn")) return;

    const btn = document.createElement("button");
    btn.id = "wol-to-gerador-btn";
    btn.innerHTML = `📥 Enviar para o NotaBook`;

    btn.addEventListener("click", () => {
      console.log("[WOL-GERADOR] 🖱️ Botão clicado. A extrair dados...");
      const data = extractWolData();

      if (!data.rawText) {
        console.error("[WOL-GERADOR] ❌ Erro: rawText está vazio!");
        showToast("⚠️ Não foi possível extrair o texto do artigo.", "error");
        return;
      }

      console.log("[WOL-GERADOR] 🚀 A enviar dados para a extensão (background worker)...", data);

      chrome.runtime.sendMessage({ action: "SEND_TO_GERADOR", data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[WOL-GERADOR] ❌ Erro de comunicação runtime:", chrome.runtime.lastError);
          showToast("❌ Erro ao enviar. Certifique-se de que a extensão está ativa.", "error");
        } else if (response && response.success) {
          console.log("%c[WOL-GERADOR] ✅ Sucesso! Dados enviados para a aba do gerador.", "color: #2ecc71; font-weight: bold;");
          showToast("✅ Artigo enviado com sucesso para a aba do Gerador!", "success");
        } else {
          console.warn("[WOL-GERADOR] ⚠️ Aviso recebido:", response?.error);
          showToast(`⚠️ ${response?.error || "Aba do gerador_manual.html não encontrada."}`, "error");
        }
      });
    });

    document.body.appendChild(btn);
    console.log("[WOL-GERADOR] 🔘 Botão 'Enviar para o NotaBook' injetado na página com sucesso.");
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    initButton();
  } else {
    document.addEventListener("DOMContentLoaded", initButton);
  }
})();
