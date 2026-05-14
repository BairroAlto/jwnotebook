// components/local/ler-local.js
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';

window.pastaAtual = "root";
window.historicoPastas = [{ id: "root", nome: "Local" }];
let unsubscribeAtual = null;
let dbReferencia = null; 
let authReferencia = null;


export function inicializarLeituraLocal(db, auth) {
    if (!auth.currentUser) return;
    dbReferencia = db;
    authReferencia = auth;

    // Navegação: Voltar Atrás
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

    // Função de Teleporte para PINS
    window.carregarPastaLocalManual = (id) => {
        carregarPasta(id);
        atualizarUI();
    };

    carregarPasta(window.pastaAtual);
    atualizarUI();
}

function carregarPasta(idPasta) {
    const listaLocal = document.getElementById('lista-local');
    if (!listaLocal) return;

    // Mostrar loading inicial
    listaLocal.innerHTML = `<div style="text-align:center; padding:30px; opacity:0.5;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    // Limpar listener anterior para evitar duplicados
    if (unsubscribeAtual) unsubscribeAtual();

    const userId = authReferencia.currentUser.uid;
    const localRef = collection(dbReferencia, "Local");

    // Query base: filtramos por pasta pai, utilizador e estado ativo
    const q = query(
        localRef, 
        where("pastapai", "==", idPasta),
        where("userId", "==", userId),
        where("estado", "==", "ativa"),
        orderBy("ordem", "asc")
    );

    unsubscribeAtual = onSnapshot(q, (snapshot) => {
        const fragmento = document.createDocumentFragment();

        if (snapshot.empty) {
            const aviso = document.createElement("div");
            aviso.style.cssText = "text-align:center; color:gray; font-size:11px; padding:30px; opacity:0.6;";
            aviso.innerHTML = "Pasta vazia.<br>Clica no '+' para criar.";
            fragmento.appendChild(aviso);
        } else {
            
            // 1. RECOLHER DADOS NUM ARRAY PARA PODERMOS REORDENAR NO CLIENTE
// 1. RECOLHER DADOS
const docsParaOrdenar = [];
snapshot.forEach((docSnap) => {
    docsParaOrdenar.push({ idFirestore: docSnap.id, ...docSnap.data() });
});

// 2. LÓGICA DE ORDENAÇÃO MELHORADA
docsParaOrdenar.sort((a, b) => {
    const aTop = (a.Top && a.Top.estado === "ativo") ? 1 : 0;
    const bTop = (b.Top && b.Top.estado === "ativo") ? 1 : 0;

    // REGRA 1: Se um for TOP e o outro não, o TOP sobe (Fica no topo da pasta atual)
    if (aTop !== bTop) return bTop - aTop;

    // REGRA 2: Se ambos tiverem o mesmo status de TOP, respeita estritamente a 'ordem'
    // Não importa se é pasta ou nota, quem tiver o número menor de ordem fica acima.
    return (a.ordem || 0) - (b.ordem || 0);
});

            // 3. RENDERIZAR OS ITENS JÁ ORDENADOS
            docsParaOrdenar.forEach((d) => {
                const docId = d.idFirestore; 
                
                const item = document.createElement("div");
                const isAtivo = (docId === window.itemSelecionadoId);
                item.setAttribute('data-id', docId);
                const isTop = (d.Top && d.Top.estado === "ativo");
                
                item.className = `item-local tipo-${d.tipo} ${isAtivo ? 'active' : ''}`;
                
                // Estilo visual diferenciado para itens TOP
                if (isTop) {
                    item.style.background = "rgba(251, 191, 36, 0.04)";
                    item.style.borderRight = "3px solid #fbbf24";
                }

                // Configuração de Ícone e Cor
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
                    window.itemSelecionadoId = docId;
                    if (d.tipo === "pasta") {
                        // Navegação para dentro da pasta
                        window.historicoPastas.push({ id: docId, nome: d.nome });
                        window.pastaAtual = docId;
                        atualizarUI();
                        carregarPasta(docId); 
                    } else {
                        // Abrir nota no editor central
                        abrirNotaNoEditor(docId, d, dbReferencia, authReferencia);
                        document.querySelectorAll('#lista-local .item-local').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                    }
                };

                fragmento.appendChild(item);
            });
        }

        // Injetar o fragmento final na lista
        listaLocal.innerHTML = "";
        listaLocal.appendChild(fragmento);
    });
}


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