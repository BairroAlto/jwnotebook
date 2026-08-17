const ID_BLOQUEIO = "bloqueio-operacao-reciclagem";

function criarEstrutura(total) {
    const overlay = document.createElement("div");
    overlay.id = ID_BLOQUEIO;
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", `${ID_BLOQUEIO}-titulo`);
    overlay.setAttribute("aria-describedby", `${ID_BLOQUEIO}-estado`);
    overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:24px",
        "background:rgba(3,7,18,.92)",
        "backdrop-filter:blur(8px)",
        "cursor:wait",
        "pointer-events:auto"
    ].join(";");

    overlay.innerHTML = `
        <section style="width:min(420px,100%); padding:28px; border:1px solid rgba(255,255,255,.12); border-radius:18px; background:#111827; color:#f8fafc; box-shadow:0 24px 80px rgba(0,0,0,.55); text-align:center; font-family:inherit;">
            <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" style="font-size:34px; color:var(--primary,#6366f1);"></i>
            <h2 id="${ID_BLOQUEIO}-titulo" style="margin:18px 0 8px; font-size:20px;">A esvaziar a reciclagem</h2>
            <p id="${ID_BLOQUEIO}-estado" aria-live="polite" style="margin:0; color:#cbd5e1; font-size:14px;">A preparar ${total} ${total === 1 ? "item" : "itens"}…</p>
            <div style="height:8px; margin-top:20px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.1);">
                <div data-progresso style="width:0%; height:100%; border-radius:inherit; background:var(--primary,#6366f1); transition:width .18s ease;"></div>
            </div>
            <p style="margin:12px 0 0; color:#94a3b8; font-size:11px;">Não feches a aplicação até o processo terminar.</p>
        </section>
    `;
    return overlay;
}

export function bloquearInterfaceDuranteReciclagem(total) {
    document.getElementById(ID_BLOQUEIO)?.remove();

    const overlay = criarEstrutura(total);
    const estado = overlay.querySelector(`#${ID_BLOQUEIO}-estado`);
    const progresso = overlay.querySelector("[data-progresso]");
    const elementosBloqueados = [...document.body.children].map(elemento => ({
        elemento,
        inert: elemento.inert
    }));
    const overflowHtml = document.documentElement.style.overflow;
    const overflowBody = document.body.style.overflow;

    document.body.appendChild(overlay);
    elementosBloqueados.forEach(({ elemento }) => { elemento.inert = true; });
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    overlay.focus({ preventScroll: true });

    let fechado = false;
    return {
        atualizar({ processados, total: totalAtual, falhas }) {
            if (fechado) return;
            const percentagem = totalAtual ? Math.round((processados / totalAtual) * 100) : 100;
            progresso.style.width = `${percentagem}%`;
            estado.textContent = `A eliminar ${processados} de ${totalAtual}${falhas ? ` · ${falhas} com erro` : ""}`;
        },
        concluir() {
            if (fechado) return;
            progresso.style.width = "100%";
            estado.textContent = "Reciclagem limpa. A atualizar…";
        },
        concluirComFalhas({ sucessos, falhas, total }) {
            if (fechado) return;
            progresso.style.width = "100%";
            progresso.style.background = falhas ? "#f59e0b" : "var(--primary,#6366f1)";
            estado.textContent = `${sucessos} de ${total} eliminados · ${falhas} com erro`;
        },
        fechar() {
            if (fechado) return;
            fechado = true;
            elementosBloqueados.forEach(({ elemento, inert }) => { elemento.inert = inert; });
            document.documentElement.style.overflow = overflowHtml;
            document.body.style.overflow = overflowBody;
            overlay.remove();
        }
    };
}
