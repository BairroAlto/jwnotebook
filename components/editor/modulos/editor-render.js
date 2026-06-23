function formatarMesDiario(date) {
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(date);
}

function formatarDiaDiario(date) {
    return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export async function renderizarFeed(params) {
    const {
        caixasAtuais, feed, acionarGravacao, onApagar, abrirPaleta,
        abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao,
        notaAbertaId, dadosNota, dbRef, authRef
    } = params;

    if (!feed) return;

    const modos = Array.isArray(dadosNota?.modo) ? dadosNota.modo : [dadosNota?.modo || 'normal'];
    const isModoSentinela = modos.includes('sentinela');
    const isModoPost = modos.includes('post');
    const isModoDiario = modos.includes('diario');
    const isModoSocial = modos.includes('social') && dadosNota?.onde === "share";

    const caixasParaMostrar = caixasAtuais.filter(c => {
        if (c.estado !== "on") return false;
        const temRef = c.referenciacodex !== undefined && c.referenciacodex !== null;
        return isModoSentinela ? temRef : !temRef;
    });

    feed.style.minHeight = feed.offsetHeight + "px";
    feed.innerHTML = "";

    if (isModoPost) caixasParaMostrar.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
    else caixasParaMostrar.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const raciociniosVivos = caixasParaMostrar.filter(c => c.tipo === "raciocinio");
    let mesAtual = "";
    let diaAtual = "";

    for (const caixa of caixasParaMostrar) {
        if (isModoDiario) {
            const dataBase = new Date(caixa.timestamp || Date.now());
            const labelMes = formatarMesDiario(dataBase);
            const labelDia = formatarDiaDiario(dataBase);
            if (labelMes !== mesAtual) {
                mesAtual = labelMes;
                const mesEl = document.createElement('div');
                mesEl.className = 'diario-grupo-mes';
                mesEl.textContent = mesAtual;
                feed.appendChild(mesEl);
                diaAtual = "";
            }
            if (labelDia !== diaAtual) {
                diaAtual = labelDia;
                const diaEl = document.createElement('div');
                diaEl.className = 'diario-grupo-dia';
                diaEl.textContent = diaAtual;
                feed.appendChild(diaEl);
            }
        }

        const el = await renderizarCaixa(caixa, raciociniosVivos, {
            acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao
        });
        if (!el) continue;
        el.id = `bloco-${caixa.id}`;
        if (isModoSocial) {
            adicionarReacoesAoBloco(el, caixa, dadosNota, notaAbertaId, dbRef, authRef);
        }
        aplicarMarcadorNovidade(el, caixa, dadosNota, notaAbertaId, dbRef, authRef);
        feed.appendChild(el);
    }

    setTimeout(() => { feed.style.minHeight = ""; }, 200);
}

async function renderizarCaixa(caixa, raciociniosVivos, handlers) {
    const { acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao } = handlers;
    let modulo;
    switch (caixa.tipo) {
        case "subnota":
            modulo = await import('../ferramentas/subnota.js');
            return modulo.criarSubNotaAzul(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        case "questao":
            modulo = await import('../ferramentas/questao.js');
            return modulo.criarQuestaoVerde(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        case "raciocinio":
            modulo = await import('../ferramentas/raciocinio.js');
            return modulo.criarRaciocinioAmarelo(caixa, raciociniosVivos.findIndex(r => r.id === caixa.id) + 1, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        case "elevador":
            modulo = await import('../ferramentas/elevador.js');
            return modulo.criarElevadorVermelho(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        case "cartaovisita":
            modulo = await import('../ferramentas/cartaovisita.js');
            return modulo.criarCartaoVisita(caixa, acionarGravacao, onApagar, moverCaixa, prepararInsercao);
        case "citacaobiblica":
            modulo = await import('../ferramentas/citacaobiblica.js');
            return modulo.criarCitacaoBiblica(caixa, onApagar, moverCaixa, prepararInsercao);
        case "webcard":
            modulo = await import('../ferramentas/webcard.js');
            return modulo.criarWebCardRoxo(caixa, onApagar, moverCaixa, prepararInsercao, acionarGravacao);
        case "galeria":
            modulo = await import('../ferramentas/imagens.js');
            return modulo.criarGaleriaRosa(caixa, onApagar, moverCaixa, prepararInsercao, acionarGravacao);
        case "sumariar":
            modulo = await import('../ferramentas/sumariar.js');
            return modulo.criarSumariarIA(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        default:
            modulo = await import('../ferramentas/contentor.js');
            return modulo.criarContentorLaranja(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
    }
}

function adicionarReacoesAoBloco(el, caixa, dadosNota, notaId, db, auth) {
    const header = el.firstElementChild;
    if (!header || header.querySelector('.social-reaction-wrap')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'social-reaction-wrap';
    wrapper.style.cssText = 'display:flex; align-items:center; gap:8px; margin-left:10px;';

    const reactions = (dadosNota.reactions?.[caixa.id] || []);
    const count = reactions.length;
    wrapper.innerHTML = `
        <button type="button" class="btn-social-reaction" style="background:none; color:#fb7185; display:flex; align-items:center; gap:6px; font-size:13px;">
            <i class="fa-solid fa-heart"></i><span class="reaction-count">${count}</span>
        </button>
    `;

    header.firstElementChild?.appendChild(wrapper);
    wrapper.querySelector('.btn-social-reaction')?.addEventListener('click', (event) => {
        event.stopPropagation();
        abrirPopupReacoes(caixa, dadosNota, notaId, db, auth, wrapper);
    });
}

function abrirPopupReacoes(caixa, dadosNota, notaId, db, auth, anchor) {
    const existente = document.getElementById('popup-reacoes-inline');
    if (existente) existente.remove();

    const popup = document.createElement('div');
    popup.id = 'popup-reacoes-inline';
    popup.style.cssText = 'position:absolute; right:16px; top:42px; background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:10px; z-index:30; display:flex; flex-direction:column; gap:10px; min-width:220px; box-shadow:0 10px 25px rgba(0,0,0,0.28);';
    const reactions = dadosNota.reactions?.[caixa.id] || [];
    const minhas = reactions.find(item => item.uid === auth.currentUser.uid);
    const opcoes = [
        ['coracao', 'fa-heart', '#fb7185'],
        ['like', 'fa-thumbs-up', '#60a5fa'],
        ['dislike', 'fa-thumbs-down', '#f87171'],
        ['surpresa', 'fa-face-surprise', '#fbbf24'],
        ['choro', 'fa-face-sad-tear', '#38bdf8'],
        ['raiva', 'fa-face-angry', '#f97316']
    ];

    popup.innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${opcoes.map(([tipo, icon, cor]) => `<button data-reaction="${tipo}" style="width:32px; height:32px; border-radius:999px; background:rgba(255,255,255,0.05); color:${cor};"><i class="fa-solid ${icon}"></i></button>`).join('')}
        </div>
        <div style="max-height:140px; overflow:auto; display:flex; flex-direction:column; gap:6px;">
            ${reactions.length ? reactions.map(item => `<div style="font-size:11px; color:#e2e8f0;"><b>${item.nome}</b> • ${item.tipo}</div>`).join('') : `<div style="font-size:11px; color:#94a3b8;">Sem reações ainda.</div>`}
        </div>
        ${minhas ? `<button data-remove-reaction style="background:rgba(248,113,113,0.12); color:#fca5a5; padding:8px; border-radius:8px; font-size:11px;">Remover a minha reação</button>` : ``}
    `;

    if (anchor.closest('[id^="bloco-"]')) {
        anchor.closest('[id^="bloco-"]').style.position = 'relative';
        anchor.closest('[id^="bloco-"]').appendChild(popup);
    }

    popup.querySelectorAll('[data-reaction]').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            await gravarReacao(caixa.id, btn.dataset.reaction, dadosNota, notaId, db, auth);
            popup.remove();
        });
    });
    popup.querySelector('[data-remove-reaction]')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        await gravarReacao(caixa.id, null, dadosNota, notaId, db, auth);
        popup.remove();
    });

    const close = (event) => {
        if (!popup.contains(event.target)) {
            popup.remove();
            document.removeEventListener('click', close);
        }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
}

async function gravarReacao(caixaId, tipo, dadosNota, notaId, db, auth) {
    if (!db || !auth?.currentUser || !notaId) return;
    const lista = [...(dadosNota.reactions?.[caixaId] || [])].filter(item => item.uid !== auth.currentUser.uid);
    if (tipo) {
        lista.push({
            uid: auth.currentUser.uid,
            nome: auth.currentUser.displayName || auth.currentUser.email || "Utilizador",
            tipo
        });
    }
    dadosNota.reactions = {
        ...(dadosNota.reactions || {}),
        [caixaId]: lista
    };
    await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(async mod => {
        await mod.updateDoc(mod.doc(db, "Share", notaId), { reactions: dadosNota.reactions });
    });
    window.atualizarFeedEGravarGlobal?.(false);
}

function aplicarMarcadorNovidade(el, caixa, dadosNota, notaId, db, auth) {
    const novidades = dadosNota.shareNovidades || {};
    const novidade = novidades[caixa.id];
    const uid = auth?.currentUser?.uid;
    if (!novidade || !uid || novidade.by === uid || (novidade.viewedBy || []).includes(uid)) return;

    const dot = document.createElement('span');
    dot.className = `share-change-dot ${novidade.tipo === 'criado' ? 'criado' : 'editado'}`;
    const header = el.querySelector('span')?.parentElement || el.firstElementChild;
    if (header) header.appendChild(dot);

    const observer = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setTimeout(async () => {
            dot.remove();
            if (!db || !notaId) return;
            const updated = {
                ...(dadosNota.shareNovidades || {})
            };
            updated[caixa.id] = {
                ...novidade,
                viewedBy: [...new Set([...(novidade.viewedBy || []), uid])]
            };
            dadosNota.shareNovidades = updated;
            await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(async mod => {
                await mod.updateDoc(mod.doc(db, "Share", notaId), { shareNovidades: updated });
            });
        }, 2600);
    }, { threshold: 0.55 });
    observer.observe(el);
}
