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
    // Chama a tua função que já tens para ler o Firebase
    if (typeof carregarPasta === 'function') {
        carregarPasta(id); 
    }
    // Chama a tua função que atualiza o nome no topo "Voltar a..."
    if (typeof atualizarUI === 'function') {
        atualizarUI(); 
    }
};

    carregarPasta(window.pastaAtual);
    atualizarUI();
}

function carregarPasta(idPasta) {
    const listaLocal = document.getElementById('lista-local');
    if (!listaLocal) return;

    // 1. ESTADO DE CARREGAMENTO (Visual)
    listaLocal.innerHTML = `
        <div style="text-align:center; padding:30px; opacity:0.5;">
            <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary);"></i>
        </div>`;

    // 2. LIMPEZA DE SEGURANÇA
    // Mata o "ouvinte" anterior para não haver conflitos de dados de pastas diferentes
    if (unsubscribeAtual) unsubscribeAtual();

    const userId = authReferencia.currentUser.uid;
    const localRef = collection(dbReferencia, "Local");

    // 3. QUERY DO FIREBASE
    // Filtramos por utilizador, localização (pastapai) e apenas itens ativos (não ocultos)
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
            
            // 3.1 RECOLHER E ORDENAR (Lógica TOP + ORDEM)
            const itensParaDesenhar = [];
            snapshot.forEach((docSnap) => {
                itensParaDesenhar.push({ idFirestore: docSnap.id, ...docSnap.data() });
            });

            // Ordenação: Itens marcados como TOP sobem, o resto respeita a ordem manual
            itensParaDesenhar.sort((a, b) => {
                const aTop = (a.Top && a.Top.estado === "ativo") ? 1 : 0;
                const bTop = (b.Top && b.Top.estado === "ativo") ? 1 : 0;
                if (aTop !== bTop) return bTop - aTop;
                return (a.ordem || 0) - (b.ordem || 0);
            });

            // 3.2 RENDERIZAÇÃO DOS ITENS
            itensParaDesenhar.forEach((d) => {
                const docId = d.idFirestore; 
                const item = document.createElement("div");
                
                // --- VERIFICAÇÃO DE SELEÇÃO ATIVA ---
                // Crucial para manter o destaque visual quando o Firebase redesenha a lista
                const isAtivo = (docId === window.itemSelecionadoId);
                
                // Configuração de Identidade do Elemento
                item.className = `item-local tipo-${d.tipo} ${isAtivo ? 'active' : ''}`;
                item.setAttribute('data-id', docId); // Usado pelo sincronizador global
                
                // Estilo Especial para Itens TOP
                const isTop = (d.Top && d.Top.estado === "ativo");
                if (isTop) {
                    item.style.background = "rgba(251, 191, 36, 0.04)";
                    item.style.borderRight = "3px solid #fbbf24";
                }

                // Definição de Ícones e Cores
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
                
                // LÓGICA DE CLIQUE
                item.onclick = () => {
                    // Atualiza o ID global para que outros Snapshots saibam que esta nota foi selecionada
                    window.itemSelecionadoId = docId; 

                    if (d.tipo === "pasta") {
                        // Navegação para dentro da pasta
                        window.historicoPastas.push({ id: docId, nome: d.nome });
                        window.pastaAtual = docId;
                        atualizarUI(); // Muda o rótulo do topo "Voltar a..."
                        carregarPasta(docId); 
                    } else {
                        // Abrir nota no editor central
                        abrirNotaNoEditor(docId, d, dbReferencia, authReferencia);
                        
                        // Atualização visual imediata (limpa outros e acende este)
                        document.querySelectorAll('.item-local').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                    }
                };

                fragmento.appendChild(item);
            });
        }

        // 4. INJEÇÃO FINAL NO DOM (Limpando o loader)
        listaLocal.innerHTML = "";
        listaLocal.appendChild(fragmento);

    }, (error) => {
        console.error("❌ [LOCAL] Erro no Listener:", error);
        listaLocal.innerHTML = `<p style="color:#ef4444; font-size:10px; text-align:center; padding:20px;">Erro de ligação ou permissão.</p>`;
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
