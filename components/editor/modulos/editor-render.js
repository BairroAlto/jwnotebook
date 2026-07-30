import { marcarFerramentaShareComoVista } from '../../share/share-notification-state.js';

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

        let el;
        try {
            el = await renderizarCaixa(caixa, raciociniosVivos, {
                acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao
            });
        } catch (error) {
            console.error(`[EDITOR-RENDER] Falha ao carregar a caixa ${caixa.id} (${caixa.tipo}):`, error, error?.stack || '');
            el = criarAvisoFalhaCaixa(caixa);
        }
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

function criarAvisoFalhaCaixa(caixa) {
    const aviso = document.createElement('section');
    aviso.className = 'tool-box';
    aviso.style.cssText = 'padding:14px; border:1px solid #ef4444; border-radius:8px; background:rgba(239,68,68,.08); color:#fecaca;';

    const titulo = document.createElement('strong');
    titulo.textContent = `Não foi possível carregar a ferramenta ${caixa.tipo || 'desconhecida'}.`;

    const detalhe = document.createElement('small');
    detalhe.style.cssText = 'display:block; margin-top:5px; color:#fca5a5;';
    detalhe.textContent = `ID: ${caixa.id || 'sem ID'}`;

    aviso.append(titulo, detalhe);
    return aviso;
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
        case "bairro": {
            try {
                modulo = await import('../ferramentas/bairro.js?v=30');
            } catch (error) {
                console.error('[BAIRRO] Falha ao importar o módulo visual principal:', error);
                throw error;
            }
            return modulo.criarBairro(
                caixa,
                acionarGravacao,
                onApagar,
                alvo => import('./bairro-paleta.js?v=30')
                    .then(({ abrirPaletaBairro }) => abrirPaletaBairro(alvo, acionarGravacao))
                    .catch(error => console.error('[BAIRRO] Falha ao abrir a paleta:', error)),
                moverCaixa,
                prepararInsercao
            );
        }
        case "firmamento": {
            modulo = await import('../ferramentas/firmamento.js');
            const { abrirPaletaFirmamento } = await import('./firmamento-paleta.js');
            return modulo.criarFirmamento(
                caixa,
                acionarGravacao,
                onApagar,
                moverCaixa,
                prepararInsercao,
                alvo => abrirPaletaFirmamento(alvo, acionarGravacao)
            );
        }
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

    // Procura o input/textarea do tÃ­tulo da ferramenta
    const titleInput = el.querySelector('.tool-title-input') || el.querySelector('textarea, input[type="text"]');
    
    // Ponto visual de novidade
    const dot = document.createElement('span');
    dot.className = `share-change-dot ${novidade.tipo === 'criado' ? 'criado' : 'editado'}`;
    const header = el.querySelector('span')?.parentElement || el.firstElementChild;
    if (header) header.appendChild(dot);

    let corOriginalTitulo = "";

    if (titleInput) {
        corOriginalTitulo = titleInput.style.color;
        titleInput.style.color = "#ef4444"; // ðŸ”´ TÃ­tulo fica vermelho!
        titleInput.style.transition = "color 0.4s ease";
    }

    const limparNovidade = async () => {
        if (titleInput) {
            titleInput.style.color = corOriginalTitulo || "white";
        }
        dot.remove();

        el.removeEventListener('mouseenter', limparNovidade);
        el.removeEventListener('touchstart', limparNovidade);

        if (!db || !notaId) return;
        await marcarFerramentaShareComoVista({
            db,
            notaId,
            caixaId: caixa.id,
            dadosNota,
            uid
        }).catch(err => console.error("Erro ao atualizar viewedBy da ferramenta:", err));
    };

    // ðŸ–±ï¸ / ðŸ“± Ao passar com o rato ou tocar no ecrÃ£ (mobile), limpa o vermelho!
    el.addEventListener('mouseenter', limparNovidade, { once: true });
    el.addEventListener('touchstart', limparNovidade, { once: true });
}

