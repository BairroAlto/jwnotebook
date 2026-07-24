// components/local/ler-local.js
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';

window.pastaAtual = "root";
window.historicoPastas = [{ id: "root", nome: "Local" }];
let unsubscribeAtual = null;
let dbReferencia = null; 
let authReferencia = null;
let carregamentoLocalAtual = 0;
let timeoutCarregamentoLocal = null;


export function inicializarLeituraLocal(db, auth) {
    dbReferencia = db;
    authReferencia = auth;

    const navBackArea = document.getElementById('nav-back-click');
    if (navBackArea) {
        navBackArea.onclick = () => {
            if (window.historicoPastas.length > 1) {
                window.historicoPastas.pop();
                const pastaAnterior = window.historicoPastas[window.historicoPastas.length - 1];
                window.pastaAtual = pastaAnterior.id;
                atualizarUI();
                carregarPasta(window.pastaAtual);
            }
        };
    }

    carregarPasta(window.pastaAtual);
    atualizarUI();
}

function carregarPasta(idPasta) {
    const listaLocal = document.getElementById('lista-local');
    if (!listaLocal) return;

    const carregamentoId = ++carregamentoLocalAtual;
    clearTimeout(timeoutCarregamentoLocal);

    // 1. Mostrar o spinner (roldana) imediatamente
    listaLocal.innerHTML = `
        <div style="text-align:center; padding:30px; opacity:0.5;">
            <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary);"></i>
        </div>`;

    if (unsubscribeAtual) unsubscribeAtual();

    const userId = authReferencia?.currentUser?.uid;
    if (!userId) {
        mostrarErroListaLocal(idPasta, 'Não foi possível validar a sessão.');
        return;
    }
    const localRef = collection(dbReferencia, "Local");

    const q = query(
        localRef, 
        where("pastapai", "==", idPasta),
        where("userId", "==", userId),
        where("estado", "==", "on"),
        orderBy("ordem", "asc")
    );

    timeoutCarregamentoLocal = setTimeout(() => {
        if (carregamentoId !== carregamentoLocalAtual) return;
        mostrarErroListaLocal(idPasta, 'A lista demorou demasiado tempo a responder.');
    }, 12000);

    let timeoutCache = null;

    unsubscribeAtual = onSnapshot(q, (snapshot) => {
        if (carregamentoId !== carregamentoLocalAtual) return;
        clearTimeout(timeoutCarregamentoLocal);

        const executarRender = () => {
            if (carregamentoId !== carregamentoLocalAtual) return;
            const fragmento = document.createDocumentFragment();

            if (snapshot.empty) {
                const aviso = document.createElement("div");
                aviso.style.cssText = "text-align:center; color:gray; font-size:11px; padding:30px; opacity:0.6;";
                aviso.innerHTML = window.NotaBookMode === "book" ? "Pasta vazia." : "Pasta vazia.<br>Clica no '+' para criar.";
                fragmento.appendChild(aviso);
            } else {
                const itensParaDesenhar = [];
                snapshot.forEach((docSnap) => {
                    itensParaDesenhar.push({ idFirestore: docSnap.id, ...docSnap.data() });
                });

                itensParaDesenhar.sort((a, b) => {
                    const aTop = (a.Top && a.Top.estado === "on") ? 1 : 0;
                    const bTop = (b.Top && b.Top.estado === "on") ? 1 : 0;
                    if (aTop !== bTop) return bTop - aTop;
                    return (a.ordem || 0) - (b.ordem || 0);
                });

                itensParaDesenhar.forEach((d) => {
                    const docId = d.idFirestore; 
                    const item = document.createElement("div");
                    
                    const isAtivo = (docId === window.itemSelecionadoId);
                    
                    item.className = `item-local tipo-${d.tipo} ${isAtivo ? 'active' : ''}`;
                    item.setAttribute('data-id', docId);
                    
                    const isTop = (d.Top && d.Top.estado === "on");
                    if (isTop) {
                        item.style.background = "rgba(251, 191, 36, 0.04)";
                        item.style.borderRight = "3px solid #fbbf24";
                    }

                    let nomeIcone = (d.tipo === "pasta") ? (d.icon || "folder") : "note-sticky";
                    if (!nomeIcone.startsWith('fa-')) nomeIcone = `fa-${nomeIcone}`;
                    let corIcone = (d.tipo === "pasta") ? "#eab308" : "#6366f1";

                    const nomeEscapado = d.nome.replace(/'/g, "\\'").replace(/"/g, '&quot;');

                    item.innerHTML = `
                        <i class="fa-solid ${nomeIcone}" style="color: ${corIcone};"></i>
                        <div style="flex: 1; display: flex; align-items: center; overflow: hidden;">
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--fs-left-items); font-weight: ${isTop ? '700' : '500'};">
                                ${d.nome}
                            </span>
                        </div>
                        <i class="fa-solid fa-gear btn-edit-item-local" 
                           onclick="event.stopPropagation(); window.abrirEditorItemLocal('${docId}', '${d.tipo}', '${nomeEscapado}')">
                        </i>
                    `;
                    
                    item.onclick = () => {
                        if (d.tipo === "pasta") {
                            window.historicoPastas.push({ id: docId, nome: d.nome });
                            window.pastaAtual = docId;
                            atualizarUI();
                            carregarPasta(docId); 
                        } else {
                            window.itemSelecionadoId = docId; 
                            if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
                                window.abrirNotaNoBook(docId, { ...d, onde: "local" }, dbReferencia, authReferencia);
                            } else {
                                abrirNotaNoEditor(docId, d, dbReferencia, authReferencia);
                            }
                            document.querySelectorAll('.item-local').forEach(el => el.classList.remove('active'));
                            item.classList.add('active');
                        }
                    };

                    fragmento.appendChild(item);
                });
            }

            listaLocal.innerHTML = "";
            listaLocal.appendChild(fragmento);
        };

        // Gestão inteligente do cache-flash:
        if (!snapshot.metadata.fromCache) {
            if (timeoutCache) clearTimeout(timeoutCache);
            setTimeout(executarRender, 150); // Transição suave de 150ms do servidor
        } else {
            if (timeoutCache) clearTimeout(timeoutCache);
            // Aguarda até 450ms pelo sinal do servidor. Se demorar mais, mostra a cache.
            timeoutCache = setTimeout(executarRender, 450);
        }

    }, (error) => {
        if (carregamentoId !== carregamentoLocalAtual) return;
        clearTimeout(timeoutCarregamentoLocal);
        console.error("[LOCAL] Erro no Listener:", error);
        mostrarErroListaLocal(idPasta, "Erro de ligação ou permissão.");
    });
}

function mostrarErroListaLocal(idPasta, mensagem) {
    const listaLocal = document.getElementById('lista-local');
    if (!listaLocal) return;

    listaLocal.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <p style="color:#ef4444; font-size:10px; margin-bottom:10px;">${mensagem}</p>
            <button type="button" id="btn-retry-lista-local" style="background:var(--primary); color:white; border-radius:6px; padding:7px 12px; font-size:10px;">
                Tentar novamente
            </button>
        </div>
`;

    listaLocal.querySelector('#btn-retry-lista-local')?.addEventListener('click', () => carregarPasta(idPasta), { once: true });
}

window.carregarPastaLocalManual = (idPasta) => {
    window.pastaAtual = idPasta || "root";
    carregarPasta(window.pastaAtual);
};

function atualizarUI() {
    const navPastaNome = document.getElementById('nav-pasta-nome');
    const navIconVoltar = document.getElementById('nav-icon-voltar');
    if (!navPastaNome || !navIconVoltar) return;

    if (window.historicoPastas.length > 1) {
        const pai = window.historicoPastas[window.historicoPastas.length - 2];
        navPastaNome.innerText = "Voltar a " + pai.nome;
        navIconVoltar.style.display = "inline-block";
    } else {
        navPastaNome.innerText = "LOCAL";
        navIconVoltar.style.display = "none";
    }
}
