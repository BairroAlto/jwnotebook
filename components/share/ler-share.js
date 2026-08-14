// components/share/ler-share.js
import { 
    collection, query, where, onSnapshot, or, and, doc, updateDoc, arrayUnion, arrayRemove, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';
import { ICONS } from '../constants/icons.js';
import { temNovidadesShareNaoVistas } from './share-notification-state.js';

// --- ESTADO DE NAVEGAÇÃO E INTERFACE ---
window.pastaShareAtual = "home"; 
window.historicoPastasShare = [{ id: "home", nome: "Share" }]; 

let unsubscribeShare = null;
let dbRef = null;
let authRef = null;
let modoEdicaoShare = false;
let listenersInterfaceAtivos = false;
let unsubscribeConvitesPendentes = null;

/**
 * 1. INICIALIZAR O MÓDULO
 */
export function inicializarShare(db, auth) {
    dbRef = db; 
    authRef = auth;

    // DELEGAÇÃO DE CLIQUES GLOBAL PARA NAVEGAÇÃO
    if (!listenersInterfaceAtivos) document.addEventListener('click', (e) => {
        
        // A) BOTÃO VOLTAR (BACK)
        const btnBack = e.target.closest('#nav-back-share-click');
        if (btnBack) {
            if (window.historicoPastasShare.length > 1) {
                window.historicoPastasShare.pop();
                const anterior = window.historicoPastasShare[window.historicoPastasShare.length - 1];
                window.pastaShareAtual = anterior.id;
                atualizarUIShare();
                carregarDadosShare();
            }
            return;
        }

        // B) BOTÃO LÁPIS (EDITAR)
        const btnEditToggle = e.target.closest('#btn-editar-share-toggle');
        if (btnEditToggle) {
            e.stopPropagation();
            modoEdicaoShare = !modoEdicaoShare;
            btnEditToggle.classList.toggle('active', modoEdicaoShare);
            carregarDadosShare(); 
        }
    });
    listenersInterfaceAtivos = true;

    window.dispararLeituraShare = () => { 
        if (auth.currentUser) carregarDadosShare(); 
    };
}

/**
 * 2. FUNÇÃO EM FALTA: MOSTRAR PAINEL
 * Esta função é chamada pelo index.html quando o utilizador clica na aba Share
 */
export function mostrarPainelShare() {
    if (window.dispararLeituraShare) {
        window.dispararLeituraShare();
    }
}

/**
 * 3. ATUALIZAR TEXTO DO CABEÇALHO DA ABA
 */
function atualizarUIShare() {
    const labelNome = document.getElementById('nav-share-nome');
    const iconeVoltar = document.getElementById('nav-icon-voltar-share');
    if (!labelNome || !iconeVoltar) return;

    if (window.historicoPastasShare.length > 1) {
        const destino = window.historicoPastasShare[window.historicoPastasShare.length - 2];
        labelNome.innerText = "Voltar a " + (destino ? destino.nome : "Share");
        iconeVoltar.style.display = "inline-block";
    } else {
        labelNome.innerText = "SHARE";
        iconeVoltar.style.display = "none";
    }
}

let carregamentoShareAtual = 0;

/**
 * 4. LEITURA DOS DADOS COM SNAPSHOT E LÓGICA DE NOTIFICAÇÃO (PONTO VERMELHO & TEXTO VERMELHO)
 */
function carregarDadosShare() {
    const listaCont = document.getElementById('lista-share');
    if (!listaCont || !authRef.currentUser) return;

    const carregamentoId = ++carregamentoShareAtual;

    // 1. Mostrar o spinner (roldana) imediatamente
    listaCont.innerHTML = `
        <div style="text-align:center; padding:30px; opacity:0.5;">
            <i class="fa-solid fa-circle-notch fa-spin" style="color: #ef4444;"></i>
        </div>`;

    // 2. LIMPEZA DE SEGURANÇA
    if (unsubscribeShare) unsubscribeShare();
    const uid = authRef.currentUser.uid;

    // 3. QUERY DO FIREBASE
    const q = query(
        collection(dbRef, "Share"),
        and(
            where("onde", "==", "share"),
            where("estado", "==", "on"),
            or(
                where("userId", "==", uid), 
                where("aprovado", "array-contains", uid), 
                where("convidado", "array-contains", uid)
            )
        )
    );

    let timeoutCache = null;

    unsubscribeShare = onSnapshot(q, (snapshot) => {
        if (carregamentoId !== carregamentoShareAtual) return;

        const executarRender = () => {
            if (carregamentoId !== carregamentoShareAtual) return;
            const fragmento = document.createDocumentFragment();
            
            listaCont.classList.toggle('lista-modo-edicao', modoEdicaoShare);

            const todosOsDocumentos = [];
            const idsComNovidades = new Set();
            const pastasComNovidades = new Set();
            const convitesPendentes = [];

            // PROCESSAMENTO INICIAL (Notificações e Convites)
            snapshot.forEach(docSnap => {
                const d = docSnap.data();
                const id = docSnap.id;
                todosOsDocumentos.push({ id, ...d });

                if (d.convidado && d.convidado.includes(uid)) {
                    convitesPendentes.push({ id, ...d });
                    return;
                }

                // Lógica de Novidades não lidas (no documento ou em caixas internas)
                const naoViAinda = d.tipo === "nota" && temNovidadesShareNaoVistas(d, uid);

                if (naoViAinda) {
                    idsComNovidades.add(id);
                    let paiId = d[uid]?.pastapai;
                    while (paiId && paiId !== "home") {
                        pastasComNovidades.add(paiId);
                        const pastaDoc = snapshot.docs.find(s => s.id === paiId);
                        paiId = pastaDoc ? pastaDoc.data()[uid]?.pastapai : null;
                    }
                }
            });

            console.info('[SHARE-NOTIF][coluna]', {
                uid,
                documentosComNovidades: [...idsComNovidades],
                pastasComNovidades: [...pastasComNovidades],
                convites: convitesPendentes.map(item => item.id)
            });

            // RENDERIZAR CARDS DE CONVITE
            convitesPendentes.forEach(c => {
                const card = document.createElement('div');
                card.style.cssText = "background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 15px;";
                card.innerHTML = `
                    <p style="font-size:11px; font-weight:700; color:white; margin-bottom:10px;">
                        <i class="fa-solid fa-envelope-open-text"></i> Convite: 
                        <span style="opacity:0.8; font-weight:400;">"${c.nome}"</span>
                    </p>
                    <div style="display:flex; gap:8px;">
                        <button onclick="window.aceitarPartilha('${c.id}')" style="flex:1; background:#22c55e; color:black; border:none; padding:6px; border-radius:4px; font-size:10px; font-weight:800; cursor:pointer;">ACEITAR</button>
                        <button onclick="window.rejeitarPartilha('${c.id}')" style="flex:1; background:transparent; border:1px solid #ef4444; color:#ef4444; padding:6px; border-radius:4px; font-size:10px; cursor:pointer;">REJEITAR</button>
                    </div>`;
                fragmento.appendChild(card);
            });

            // FILTRAR E ORDENAR ITENS DA PASTA ATUAL
            const itensParaMostrar = todosOsDocumentos.filter(item => {
                const minhaPosicao = item[uid]?.pastapai || "home";
                return minhaPosicao === window.pastaShareAtual && !item.convidado?.includes(uid);
            });

            itensParaMostrar.sort((a, b) => {
                const aTop = (a[uid]?.Top && a[uid].Top.estado === "on") ? 1 : 0;
                const bTop = (b[uid]?.Top && b[uid].Top.estado === "on") ? 1 : 0;
                if (aTop !== bTop) return bTop - aTop;
                return (a[uid]?.ordem || 99) - (b[uid]?.ordem || 99);
            });

            // RENDERIZAÇÃO FINAL DOS ITENS
            itensParaMostrar.forEach(item => {
                const div = document.createElement('div');
                
                const isAtivo = (item.id === window.itemSelecionadoId);
                const souTop = (item[uid]?.Top && item[uid].Top.estado === "on");

                div.className = `item-local ${isAtivo ? 'active' : ''}`; 
                div.setAttribute('data-id', item.id);
                
                if (souTop) {
                    div.style.background = "rgba(239, 68, 68, 0.04)"; 
                    div.style.borderRight = "3px solid #ef4444";     
                }

                const temNovidadeAqui = (item.tipo === "nota" && idsComNovidades.has(item.id)) || 
                                       (item.tipo === "pasta" && pastasComNovidades.has(item.id));
                if (temNovidadeAqui) div.classList.add('has-update');

                const souDono = item.userId === uid;
                let nomeIcone = "";
                let corIcone = "";

                if (item.tipo === "pasta") {
                    nomeIcone = item.icon || "folder";
                    corIcone = "#fca5a5"; 
                } else {
                    nomeIcone = souDono ? "share-nodes" : "user-group";
                    corIcone = souDono ? "#ef4444" : "#fca5a5";
                }

                const iconeLimpo = nomeIcone.replace('fa-', '');
                const classeFinal = `fa-solid fa-${iconeLimpo}`;

                const corTextoItem = temNovidadeAqui ? "#ef4444" : "inherit";
                const pesoTextoItem = temNovidadeAqui ? "800" : (souTop ? '700' : '500');
                const nomeEscapado = item.nome.replace(/'/g, "\\'").replace(/"/g, '&quot;');

                div.innerHTML = `
                    <i class="${classeFinal}" style="color: ${corIcone}; width: 20px; text-align: center;"></i>
                    <div style="flex:1; display:flex; align-items:center; overflow:hidden;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--fs-left-items); font-weight: ${pesoTextoItem}; color: ${corTextoItem};">
                            ${item.nome}
                        </span>
                    </div>
                    <i class="fa-solid fa-gear btn-edit-item-local" 
                       onclick="event.stopPropagation(); window.abrirGestaoItemShare('${item.id}', '${item.tipo}', '${nomeEscapado}')">
                    </i>
                `;

                // LÓGICA DE CLIQUE
                div.onclick = () => {
                    if (item.tipo === "nota" && temNovidadeAqui) {
                        updateDoc(doc(dbRef, "Share", item.id), {
                            vistoPor: arrayUnion(uid)
                        }).catch(err => console.error("Erro ao marcar vistoPor:", err));
                    }

                    if (item.tipo === "pasta") {
                        window.historicoPastasShare.push({ id: item.id, nome: item.nome });
                        window.pastaShareAtual = item.id;
                        atualizarUIShare();
                        carregarDadosShare();
                    } else {
                        window.itemSelecionadoId = item.id;
                        if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
                            window.abrirNotaNoBook(item.id, { ...item, onde: "share" }, dbRef, authRef);
                        } else {
                            abrirNotaNoEditor(item.id, item, dbRef, authRef);
                        }
                        document.querySelectorAll('#lista-share .item-local').forEach(el => el.classList.remove('active'));
                        div.classList.add('active');
                    }
                };
                fragmento.appendChild(div);
            });

            listaCont.innerHTML = ""; 
            listaCont.appendChild(fragmento);
        };

        // Gestão inteligente do cache-flash no Share:
        if (!snapshot.metadata.fromCache) {
            if (timeoutCache) clearTimeout(timeoutCache);
            setTimeout(executarRender, 150); // Transição suave de 150ms do servidor
        } else {
            if (timeoutCache) clearTimeout(timeoutCache);
            // Aguarda até 450ms pelo sinal do servidor. Se demorar mais, mostra a cache.
            timeoutCache = setTimeout(executarRender, 450);
        }

    }, (error) => {
        console.error("❌ [SHARE] Erro no Listener:", error);
    });
}

/**
 * 5. VIGIAR CONVITES PARA O BOTÃO DA ABA
 */
export function vigiarConvitesPendentes(db, auth) {
    if (!auth.currentUser) return Promise.resolve();
    const uid = auth.currentUser.uid;
    
    const q = query(
        collection(db, "Share"),
        and(
            where("estado", "==", "on"),
            or(
                where("userId", "==", uid),
                where("aprovado", "array-contains", uid),
                where("convidado", "array-contains", uid)
            )
        )
    );

    if (unsubscribeConvitesPendentes) unsubscribeConvitesPendentes();
    return new Promise((resolve) => {
        unsubscribeConvitesPendentes = onSnapshot(q, (snapshot) => {
            const btnShare = Array.from(document.querySelectorAll('#left-buttons button'))
                                  .find(b => b.innerText.trim().toUpperCase() === 'SHARE');
            if (!btnShare) {
                resolve();
                return;
            }

            let temNovidade = false;
            snapshot.forEach(docSnap => {
                const d = docSnap.data();
                if ((d.convidado && d.convidado.includes(uid)) || temNovidadesShareNaoVistas(d, uid)) {
                    temNovidade = true;
                }
            });

            btnShare.style.color = temNovidade ? "#ef4444" : "";
            btnShare.style.fontWeight = temNovidade ? "900" : "";
            console.info('[SHARE-NOTIF][botao-share]', { uid, temNovidade });
            resolve();
        }, (error) => {
        console.error("Erro na vigilância de convites:", error);
            resolve();
        });
    });
}

window.aceitarPartilha = async (docId) => {
    const uid = authRef.currentUser.uid;
    const q = query(collection(dbRef, "Share"), and(where("userId", "==", uid), where(`${uid}.pastapai`, "==", "home")));
    const snap = await getDocs(q);
    
    await updateDoc(doc(dbRef, "Share", docId), {
        convidado: arrayRemove(uid), 
        aprovado: arrayUnion(uid),
        vistoPor: arrayUnion(uid),
        [uid]: { pastapai: "home", ordem: snap.size + 1 }
    });
};

window.rejeitarPartilha = async (docId) => { 
    await updateDoc(doc(dbRef, "Share", docId), { convidado: arrayRemove(authRef.currentUser.uid) }); 
};

export const inicializarLeituraShare = inicializarShare;
