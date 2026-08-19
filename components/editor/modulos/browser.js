import {
    doc, getDoc, updateDoc,
    collection, query, where, getDocs, or, and
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor, forcarGravacaoImediata } from '../editor.js';
import { criarNotaLocal, removerNotaLocalCriada } from '../../local/criar-nota-service.js';
import {
    avaliarEspacoNasAbas,
    garantirAbaBrowser,
    normalizarAbasBrowser
} from './browser-tabs-service.js';
import { notaEstaVisivel } from '../../notes/note-visibility.js';

let dbRef = null;
let authRef = null;
let notaMaeIdLocal = null;
let notaAtivaIdGlobal = null;
let abaBrowserAtiva = "Local";
let criacaoNotaAbaBrowserEmCurso = false;
const browserFoldersOpen = new Set();

export function iniciarSistemaBrowser(db, auth) {
    dbRef = db;
    authRef = auth;

    const btnFechar = document.getElementById('btn-fechar-browser');
    if (btnFechar) {
        btnFechar.onclick = () => document.getElementById('popup-browser-overlay')?.classList.remove('active');
    }

    const btnCriarNota = document.getElementById('btn-criar-nota-browser');
    if (btnCriarNota) {
        btnCriarNota.onclick = () => criarNotaEmAbaBrowser(btnCriarNota);
    }

    document.querySelectorAll('.tab-browser').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-browser').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            abaBrowserAtiva = btn.dataset.origem;
            browserFoldersOpen.clear();
            carregarNotasParaBrowser();
        };
    });
}

export function abrirPopupEscolha() {
    const overlay = document.getElementById('popup-browser-overlay');
    if (!overlay) return;

    overlay.classList.add('active');
    abaBrowserAtiva = "Local";
    browserFoldersOpen.clear();
    document.querySelectorAll('.tab-browser').forEach(b => {
        b.classList.toggle('active', b.dataset.origem === "Local");
    });
    carregarNotasParaBrowser();
}

async function carregarNotasParaBrowser() {
    const container = document.getElementById('arvore-browser');
    const info = document.getElementById('browser-label-info');
    const db = dbRef || window.db;
    const auth = authRef || window.auth;

    if (!container || !db || !auth?.currentUser) return;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;
    if (info) info.textContent = `Seleciona uma nota ${abaBrowserAtiva}`;

    try {
        const uid = auth.currentUser.uid;
        let q;

        if (abaBrowserAtiva === "Local") {
            q = query(
                collection(db, "Local"),
                where("userId", "==", uid),
                where("estado", "==", "on")
            );
        } else {
            q = query(
                collection(db, "Share"),
                and(
                    where("estado", "==", "on"),
                    where("tipo", "in", ["nota", "pasta"]),
                    or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
                )
            );
        }

        const snap = await getDocs(q);
        const items = [];
        snap.forEach(docSnap => {
            if (docSnap.id === notaMaeIdLocal) return;
            const dados = docSnap.data();
            if (!notaEstaVisivel(dados)) return;
            items.push({ ...dados, id: docSnap.id, onde: abaBrowserAtiva.toLowerCase() });
        });

        container.innerHTML = "";
        if (!items.length) {
            container.innerHTML = `<p style="text-align:center; color:gray; padding:20px; font-size:12px;">Nenhuma nota encontrada.</p>`;
            return;
        }

        const rootId = abaBrowserAtiva === "Local" ? "root" : "home";
        renderizarArvoreBrowser(container, items, rootId, 0, uid);
    } catch (_) {
        container.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px; font-size:10px;">Erro ao carregar lista.</p>`;
    }
}

function renderizarArvoreBrowser(container, items, paiId, level, uid) {
    const filhos = items
        .filter(item => obterPaiItem(item, uid) === paiId)
        .sort((a, b) => {
            if (a.tipo !== b.tipo) return a.tipo === "pasta" ? -1 : 1;
            return (obterOrdemItem(a, uid) - obterOrdemItem(b, uid)) || (a.nome || "").localeCompare(b.nome || "");
        });

    filhos.forEach(item => {
        if (item.tipo === "pasta") {
            const wrapper = document.createElement('div');
            const isOpen = browserFoldersOpen.has(item.id);
            wrapper.innerHTML = `
                <div class="tree-item tree-folder-header" style="padding-left:${8 + (level * 18)}px; text-transform:none; margin-top:0;">
                    <i class="fa-solid ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" style="width: 10px; font-size: 8px;"></i>
                    <i class="fa-solid fa-folder-tree" style="color:${abaBrowserAtiva === 'Local' ? '#eab308' : '#f87171'};"></i>
                    <span style="font-size:12px; font-weight:700; color:var(--text-muted);">${item.nome || "Pasta"}</span>
                </div>
            `;
            wrapper.firstElementChild.onclick = () => {
                if (browserFoldersOpen.has(item.id)) browserFoldersOpen.delete(item.id);
                else browserFoldersOpen.add(item.id);
                carregarNotasParaBrowser();
            };
            container.appendChild(wrapper);

            if (isOpen) {
                const subContainer = document.createElement('div');
                subContainer.className = 'tree-folder-content open';
                wrapper.appendChild(subContainer);
                renderizarArvoreBrowser(subContainer, items, item.id, level + 1, uid);
            }
            return;
        }

        const row = document.createElement('div');
        row.className = 'tree-item';
        row.style.paddingLeft = `${8 + (level * 18)}px`;
        row.innerHTML = `
            <i class="fa-solid fa-file-lines" style="color:${abaBrowserAtiva === 'Local' ? '#6366f1' : '#ef4444'};"></i>
            <span style="font-size:12px; color:#e2e8f0;">${item.nome || "Sem tÃ­tulo"}</span>
        `;

        row.onclick = async () => {
            const resultado = await abrirNotaEmAbaBrowser(item.id, abaBrowserAtiva.toLowerCase());
            if (!resultado?.ok && resultado?.motivo === 'limite') {
                window.alert(`O Browser já tem ${resultado.limite} abas abertas. Fecha uma aba antes de continuar.`);
                return;
            }
            if (resultado?.ok) document.getElementById('popup-browser-overlay')?.classList.remove('active');
        };

        container.appendChild(row);
    });
}

function obterPaiItem(item, uid) {
    if (abaBrowserAtiva === "Local") return item.pastapai || "root";
    return item?.[uid]?.pastapai || "home";
}

function obterOrdemItem(item, uid) {
    if (abaBrowserAtiva === "Local") return item.ordem || 999999;
    return item?.[uid]?.ordem || 999999;
}

export async function carregarAbasDaNota(maeId, dadosNota, notaAtivaId) {
    console.log("📂 [TABS-DEBUG] carregarAbasDaNota iniciada:", { maeId, notaAtivaId });
    notaMaeIdLocal = maeId;
    notaAtivaIdGlobal = notaAtivaId;
    const container = document.getElementById('editor-tabs-list');
    if (!container) return;
    container.innerHTML = `<div id="tab-spinner" style="display:flex; align-items:center; padding:0 15px; color:var(--primary);"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:14px;"></i></div>`;

    const resMae = (maeId === notaAtivaId && dadosNota) 
        ? { dados: dadosNota, colecao: dadosNota.onde === 'share' ? 'Share' : 'Local' } 
        : await buscarNotaHibrida(maeId);

    console.log("📂 [TABS-DEBUG] resMae carregada:", resMae);
    if (!resMae) {
        container.innerHTML = "";
        return;
    }

    const listaAbas = normalizarAbasBrowser(resMae.dados.browser);
    console.log("📂 [TABS-DEBUG] listaAbas da nota mãe:", listaAbas);
    const fragmento = document.createDocumentFragment();
    fragmento.appendChild(criarElementoAba(maeId, resMae.dados.nome, true, false, resMae.dados.onde || "local", (maeId === notaAtivaId)));

    const promessas = listaAbas.map(async (item) => {
        const idAba = (typeof item === 'string') ? item : item.id;
        try {
            const res = await buscarNotaHibrida(idAba);
            console.log(`📂 [TABS-DEBUG] buscarNotaHibrida para idAba=${idAba} resultou em:`, res);
            return res ? { id: idAba, data: res.dados, onde: res.dados.onde || "local" } : null;
        } catch (e) {
            console.error(`📂 [TABS-DEBUG] Erro em buscarNotaHibrida para idAba=${idAba}:`, e);
            return null;
        }
    });

    const resultados = await Promise.all(promessas);
    console.log("📂 [TABS-DEBUG] resultados Finais das Abas:", resultados);
    const abasValidas = listaAbas.filter((_, indice) => resultados[indice]);
    if (abasValidas.length !== listaAbas.length) {
        const db = dbRef || window.db;
        if (db) {
            updateDoc(doc(db, resMae.colecao, maeId), { browser: abasValidas })
                .then(() => console.info('[BROWSER] Referências de abas inexistentes removidas:', {
                    antes: listaAbas.length,
                    depois: abasValidas.length
                }))
                .catch(erro => console.warn('[BROWSER] Não foi possível limpar referências de abas inexistentes:', erro));
        }
    }
    resultados.forEach(item => {
        if (item) {
            console.log("📂 [TABS-DEBUG] Renderizando aba secundária:", item.id, "ActiveState:", (item.id === notaAtivaId));
            fragmento.appendChild(criarElementoAba(item.id, item.data.nome, false, true, item.onde, (item.id === notaAtivaId)));
        }
    });
    container.innerHTML = "";
    container.appendChild(fragmento);
}

function criarElementoAba(id, nome, isMae, canClose, onde, isActive) {
    const LIMITE_CARATERES = 18;
    const nomeFormatado = nome.length > LIMITE_CARATERES
        ? nome.substring(0, LIMITE_CARATERES).trim() + "..."
        : nome;

    const aba = document.createElement('div');
    aba.dataset.browserNotaId = String(id);
    const corDestaque = (onde === "share") ? "#ef4444" : "#6366f1";

    aba.style.cssText = `
        padding: 6px 15px;
        background: rgba(255,255,255,0.08);
        border-radius: 4px;
        font-size: 12px;
        color: ${isActive ? '#fff' : '#94a3b8'};
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        border-top: 2px solid ${isActive ? corDestaque : 'transparent'};
        white-space: nowrap;
        margin-right: 4px;
        transition: 0.2s;
    `;

    aba.innerHTML = `
        <span title="${nome}" style="${isActive ? 'font-weight:700;' : 'font-weight:400;'}">
            ${nomeFormatado}
        </span>
    `;

    if (canClose) {
        const btnX = document.createElement('i');
        btnX.className = "fa-solid fa-xmark";
        btnX.style.cssText = "font-size: 10px; opacity: 0.4; padding: 2px;";
        btnX.onmouseenter = () => btnX.style.opacity = "1";
        btnX.onmouseleave = () => btnX.style.opacity = "0.4";
        btnX.onclick = (e) => {
            e.stopPropagation();
            fecharAba(id, onde);
        };
        aba.appendChild(btnX);
    }

    aba.onclick = () => {
        if (id !== notaAtivaIdGlobal) {
            Promise.all([
                buscarNotaHibrida(id),
                buscarNotaHibrida(notaMaeIdLocal)
            ]).then(async ([res, resMae]) => {
                if (!res || !resMae) return;
                sincronizarLateralComNotaMae(notaMaeIdLocal, resMae.dados, authRef || window.auth);
                await abrirNotaNoEditor(
                    id,
                    res.dados,
                    dbRef || window.db,
                    authRef || window.auth,
                    null,
                    notaMaeIdLocal,
                    { sincronizarBarraLateral: false }
                );
                sincronizarLateralComNotaMae(notaMaeIdLocal, resMae.dados, authRef || window.auth);
            });
        }
    };

    return aba;
}

async function fecharAba(idAlvo, ondeAba) {
    await fecharNotaEmAbaBrowser(idAlvo, notaMaeIdLocal);
}

function obterNotaMaeBrowserId() {
    return notaMaeIdLocal || window.notaAtualContext?.maeId || window.notaAtualContext?.notaId || null;
}

function aplicarPastaPaiNaNotaParaSincronizacao(dadosNotaMae, auth, pastaPaiForcada) {
    if (pastaPaiForcada === undefined || pastaPaiForcada === null || !String(pastaPaiForcada).trim()) {
        return dadosNotaMae;
    }

    const dados = { ...dadosNotaMae };
    const onde = (dados.onde || 'local').toLowerCase();
    const uid = auth?.currentUser?.uid || authRef?.currentUser?.uid || window.auth?.currentUser?.uid;

    if (onde === 'share') {
        if (!uid) return dados;
        dados[uid] = { ...(dados[uid] || {}), pastapai: String(pastaPaiForcada) };
    } else {
        dados.pastapai = String(pastaPaiForcada);
    }

    return dados;
}

function sincronizarLateralComNotaMae(maeId, dadosNotaMae, auth, pastaPaiForcada = null) {
    if (!maeId || !dadosNotaMae || typeof window.sincronizarBarraLateralComNota !== 'function') return;
    const authActual = auth || authRef || window.auth;
    const dadosParaSincronizar = aplicarPastaPaiNaNotaParaSincronizacao(dadosNotaMae, authActual, pastaPaiForcada);
    window.sincronizarBarraLateralComNota(maeId, dadosParaSincronizar, authActual);
}

export async function verificarEspacoNasAbasBrowser(notaId = '__nova_nota__') {
    const maeId = obterNotaMaeBrowserId();
    if (!maeId) return { disponivel: false, motivo: 'sem-contexto', total: 0, limite: 15, abas: [] };
    const resMae = await buscarNotaHibrida(maeId);
    if (!resMae) return { disponivel: false, motivo: 'sem-contexto', total: 0, limite: 15, abas: [] };
    return avaliarEspacoNasAbas(resMae.dados, notaId);
}

export async function garantirNotaEmAbaBrowser(notaId, onde = 'local', maeIdOverride = null) {
    const db = dbRef || window.db;
    const maeId = maeIdOverride || obterNotaMaeBrowserId();
    if (!db || !maeId || !notaId) return { ok: false, motivo: 'sem-contexto' };

    const resMae = await buscarNotaHibrida(maeId);
    if (!resMae) return { ok: false, motivo: 'nota-raiz-inexistente' };

    const estado = await garantirAbaBrowser({
        db,
        colecaoMae: resMae.colecao,
        maeId,
        dadosNotaMae: resMae.dados,
        notaId,
        onde
    });
    if (!estado.disponivel) return { ok: false, motivo: 'limite', ...estado };

    const browser = estado.browser || estado.abas;
    const notaAtivaId = window.notaAtualContext?.notaId || notaAtivaIdGlobal || maeId;
    await carregarAbasDaNota(maeId, { ...resMae.dados, browser }, notaAtivaId);
    return { ok: true, ...estado };
}

export async function fecharNotaEmAbaBrowser(notaId, maeIdOverride = null) {
    const db = dbRef || window.db;
    const auth = authRef || window.auth;
    const maeId = maeIdOverride || obterNotaMaeBrowserId();
    if (!db || !maeId || !notaId) return { ok: false, motivo: 'sem-contexto' };

    const abaVisual = Array.from(document.querySelectorAll('[data-browser-nota-id]'))
        .find(elemento => elemento.dataset.browserNotaId === String(notaId));
    if (abaVisual) abaVisual.hidden = true;

    try {
        const resMae = await buscarNotaHibrida(maeId);
        if (!resMae) {
            if (abaVisual) abaVisual.hidden = false;
            return { ok: false, motivo: 'nota-raiz-inexistente' };
        }

        const abasActuais = normalizarAbasBrowser(resMae.dados.browser);
        const browser = abasActuais.filter(aba => String(aba.id) !== String(notaId));
        if (browser.length === abasActuais.length) return { ok: true, removida: false };

        await updateDoc(doc(db, resMae.colecao, maeId), { browser });
        const dadosMaeActualizados = { ...resMae.dados, browser };
        const notaAtivaId = window.notaAtualContext?.notaId || notaAtivaIdGlobal;

        if (String(notaAtivaId || '') === String(notaId)) {
            sincronizarLateralComNotaMae(maeId, dadosMaeActualizados, auth);
            await abrirNotaNoEditor(
                maeId,
                dadosMaeActualizados,
                db,
                auth,
                null,
                null,
                { sincronizarBarraLateral: false }
            );
        } else {
            await carregarAbasDaNota(maeId, dadosMaeActualizados, notaAtivaId || maeId);
        }
        return { ok: true, removida: true };
    } catch (erro) {
        if (abaVisual?.isConnected) abaVisual.hidden = false;
        throw erro;
    }
}

export async function abrirNotaEmAbaBrowser(notaId, ondePreferida = null, maeIdOverride = null, pastaPaiForcada = null) {
    const db = dbRef || window.db;
    const auth = authRef || window.auth;
    const maeId = maeIdOverride || obterNotaMaeBrowserId();
    console.info('[BROWSER][BAIRRO-NOTAS] A preparar abertura:', {
        notaId,
        ondePreferida,
        maeId,
        temDb: Boolean(db),
        temSessao: Boolean(auth?.currentUser)
    });
    if (!db || !auth || !maeId || !notaId) return { ok: false, motivo: 'sem-contexto' };

    const [resMae, resAlvo] = await Promise.all([
        buscarNotaHibrida(maeId),
        buscarNotaHibrida(notaId, ondePreferida)
    ]);
    console.info('[BROWSER][BAIRRO-NOTAS] Resultado das procuras:', {
        mae: resMae ? { id: maeId, colecao: resMae.colecao, nome: resMae.dados?.nome } : null,
        alvo: resAlvo ? {
            idPedido: notaId,
            idFirestore: resAlvo.id,
            colecao: resAlvo.colecao,
            nome: resAlvo.dados?.nome
        } : null
    });
    if (!resMae || !resAlvo) return { ok: false, motivo: 'nota-inexistente' };

    const idAlvo = resAlvo.id || notaId;
    const estado = await garantirAbaBrowser({
        db,
        colecaoMae: resMae.colecao,
        maeId,
        dadosNotaMae: resMae.dados,
        notaId: idAlvo,
        onde: ondePreferida || resAlvo.colecao
    });
    console.info('[BROWSER][BAIRRO-NOTAS] Estado da aba:', estado);
    if (!estado.disponivel) return { ok: false, motivo: 'limite', ...estado };

    sincronizarLateralComNotaMae(maeId, resMae.dados, auth, pastaPaiForcada);
    await abrirNotaNoEditor(
        idAlvo,
        resAlvo.dados,
        db,
        auth,
        null,
        maeId,
        { sincronizarBarraLateral: false }
    );
    sincronizarLateralComNotaMae(maeId, resMae.dados, auth, pastaPaiForcada);
    requestAnimationFrame(() => {
        document.querySelector('.center-col')?.scrollTo({ top: 0, behavior: 'auto' });
        window.scrollTo({ top: 0, behavior: 'auto' });
        document.getElementById('editor-container')?.scrollIntoView({ block: 'start' });
    });
    return {
        ok: true,
        ...estado,
        notaId: idAlvo,
        onde: resAlvo.colecao.toLowerCase()
    };
}

async function criarNotaEmAbaBrowser(btn) {
    const db = dbRef || window.db;
    const auth = authRef || window.auth;
    const maeId = obterNotaMaeBrowserId();
    if (!db || !auth?.currentUser || !maeId) return;
    if (criacaoNotaAbaBrowserEmCurso) return;

    const textoOriginal = btn.innerHTML;
    criacaoNotaAbaBrowserEmCurso = true;
    btn.disabled = true;
    btn.style.pointerEvents = "none";
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A criar...';
    let notaCriada = null;
    let abaBrowserCriada = false;

    try {
        const notaActualId = notaAtivaIdGlobal || window.notaAtualContext?.notaId || maeId;
        const [resMae, resActual] = await Promise.all([
            buscarNotaHibrida(maeId),
            buscarNotaHibrida(notaActualId)
        ]);
        if (!resMae) throw new Error('Não foi possível encontrar a nota actual.');
        if (!resActual || resMae.colecao !== 'Local' || resActual.colecao !== 'Local') {
            throw new Error('A criação automática está disponível quando a nota actual é Local.');
        }

        const estado = avaliarEspacoNasAbas(resMae.dados, '__nova_nota__');
        if (!estado.disponivel) {
            window.alert(`O Browser já tem ${estado.limite} abas abertas. Fecha uma aba antes de criares outra.`);
            return;
        }

        await forcarGravacaoImediata();
        notaCriada = await criarNotaLocal(db, auth, {
            pastapai: resActual.dados.pastapai || 'root'
        });

        await garantirAbaBrowser({
            db,
            colecaoMae: resMae.colecao,
            maeId,
            dadosNotaMae: resMae.dados,
            notaId: notaCriada.id,
            onde: 'local'
        });
        abaBrowserCriada = true;

        sincronizarLateralComNotaMae(maeId, resMae.dados, auth);
        await abrirNotaNoEditor(
            notaCriada.id,
            notaCriada.dados,
            db,
            auth,
            null,
            maeId,
            { sincronizarBarraLateral: false }
        );
        sincronizarLateralComNotaMae(maeId, resMae.dados, auth);
        document.getElementById('popup-browser-overlay')?.classList.remove('active');
    } catch (erro) {
        console.error('[BROWSER] Não foi possível criar a nota na aba:', erro);
        if (notaCriada?.id) {
            try {
                if (abaBrowserCriada) await removerAbaBrowserCriada(db, maeId, notaCriada.id);
                await removerNotaLocalCriada(db, notaCriada);
            } catch (erroRollback) {
                console.error('[BROWSER] Não foi possível desfazer a nota criada:', erroRollback);
            }
        }
        window.alert(erro.message || 'Não foi possível criar a nota.');
    } finally {
        criacaoNotaAbaBrowserEmCurso = false;
        btn.disabled = false;
        btn.style.pointerEvents = "auto";
        btn.innerHTML = textoOriginal;
    }
}

async function removerAbaBrowserCriada(db, maeId, notaId) {
    const resMae = await buscarNotaHibrida(maeId);
    if (!resMae || resMae.colecao !== 'Local') return;

    const abasActuais = normalizarAbasBrowser(resMae.dados.browser);
    const abasSemNota = abasActuais.filter(aba => String(aba.id) !== String(notaId));
    if (abasSemNota.length === abasActuais.length) return;

    await updateDoc(doc(db, resMae.colecao, maeId), { browser: abasSemNota });
}

export async function buscarNotaHibrida(id, ondePreferida = null) {
    const db = dbRef || window.db;
    if (!db) return null;
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout ao buscar nota hibrida")), 5000)
        );
        
        const buscar = async () => {
            const primeiro = String(ondePreferida || '').toLowerCase() === 'share' ? 'Share' : 'Local';
            const colecoes = primeiro === 'Share' ? ['Share', 'Local'] : ['Local', 'Share'];
            for (const colecao of colecoes) {
                try {
                    const snap = await getDoc(doc(db, colecao, id));
                    if (snap.exists()) {
                        return {
                            id: snap.id,
                            dados: { ...snap.data(), onde: colecao === 'Share' ? 'share' : 'local' },
                            colecao
                        };
                    }
                } catch (erroColecao) {
                    // Uma regra de segurança pode rejeitar a consulta numa
                    // colecção; isso não deve impedir a tentativa na outra.
                    console.warn(`[BROWSER] Não foi possível consultar ${colecao} para ${id}:`, erroColecao?.code || erroColecao?.message || erroColecao);
                }
            }

            const auth = authRef || window.auth;
            const uid = auth?.currentUser?.uid;
            if (!uid) return null;

            // Compatibilidade com notas antigas: alguns registos guardavam o
            // UUID do campo `id`, em vez do ID real do documento Firestore.
            for (const colecao of colecoes) {
                try {
                    const consulta = colecao === 'Local'
                        ? query(
                            collection(db, 'Local'),
                            where('userId', '==', uid),
                            where('estado', '==', 'on')
                        )
                        : query(
                            collection(db, 'Share'),
                            and(
                                where('estado', '==', 'on'),
                                where('tipo', 'in', ['nota', 'pasta']),
                                or(
                                    where('userId', '==', uid),
                                    where('aprovado', 'array-contains', uid)
                                )
                            )
                        );
                    const antigos = await getDocs(consulta);
                    for (const snap of antigos.docs) {
                        const dados = snap.data() || {};
                        const idsInternos = [dados.id, dados.idFirestore, dados.docIdFirebase]
                            .filter(Boolean)
                            .map(String);
                        if (idsInternos.includes(String(id))) {
                            console.info('[BROWSER][BAIRRO-NOTAS] ID antigo resolvido:', {
                                idPedido: id,
                                idFirestore: snap.id,
                                colecao
                            });
                            return {
                                id: snap.id,
                                dados: { ...dados, onde: colecao === 'Share' ? 'share' : 'local' },
                                colecao
                            };
                        }
                    }
                } catch (erroLegado) {
                    console.warn(`[BROWSER][BAIRRO-NOTAS] Falha na compatibilidade ${colecao}:`, erroLegado?.code || erroLegado?.message || erroLegado);
                }
            }
            return null;
        };

        return await Promise.race([buscar(), timeoutPromise]);
    } catch (e) {
        console.error("📂 [TABS-DEBUG] Erro em buscarNotaHibrida:", e);
    }
    return null;
}
