// components/share/ler-share.js
import { 
    collection, query, where, onSnapshot, or, and, doc, updateDoc, arrayUnion, arrayRemove, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';
import { ICONS } from '../constants/icons.js';

// --- ESTADO DE NAVEGAÇÃO E INTERFACE ---
window.pastaShareAtual = "home"; 
window.historicoPastasShare = [{ id: "home", nome: "Share" }]; 

let unsubscribeShare = null;
let dbRef = null;
let authRef = null;
let modoEdicaoShare = false;

/**
 * 1. INICIALIZAR O MÓDULO
 */
export function inicializarShare(db, auth) {
    dbRef = db; 
    authRef = auth;

    // DELEGAÇÃO DE CLIQUES GLOBAL PARA NAVEGAÇÃO
    document.addEventListener('click', (e) => {
        
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
    
    // USAR TOGGLE DE CLASSE (Igual ao Local)
    btnEditToggle.classList.toggle('active', modoEdicaoShare);
    
    // Removemos as linhas antigas que forçavam style.opacity = "1" ou "0.6"
    
    carregarDadosShare(); 
}
    });

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

/**
 * 4. LEITURA DOS DADOS COM SNAPSHOT E LÓGICA DE NOTIFICAÇÃO (PONTO VERMELHO)
 */
function carregarDadosShare() {
    const listaCont = document.getElementById('lista-share');
    if (!listaCont || !authRef.currentUser) return;
    if (unsubscribeShare) unsubscribeShare();
    const uid = authRef.currentUser.uid;

    const q = query(
        collection(dbRef, "Share"),
        and(
            where("onde", "==", "share"),
            where("estado", "==", "ativo"),
            or(
                where("userId", "==", uid), 
                where("aprovado", "array-contains", uid), 
                where("convidado", "array-contains", uid)
            )
        )
    );

 unsubscribeShare = onSnapshot(q, (snapshot) => {
    const listaCont = document.getElementById('lista-share');
    if (!listaCont) return;

    // 1. SINCRONIZAR MODO DE EDIÇÃO
    listaCont.classList.toggle('lista-modo-edicao', modoEdicaoShare);

    const fragmento = document.createDocumentFragment();
    const uid = authRef.currentUser.uid;
    
    const todosOsDocumentos = [];
    const idsComNovidades = new Set();
    const pastasComNovidades = new Set();
    const convitesPendentes = [];

    // 2. PROCESSAMENTO INICIAL E NOTIFICAÇÕES (PONTO VERMELHO)
    snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        todosOsDocumentos.push({ id, ...d });

        // Identificar convites para o topo
        if (d.convidado && d.convidado.includes(uid)) {
            convitesPendentes.push({ id, ...d });
            return;
        }

        // Lógica de novidades (ponto vermelho)
        const naoViAinda = d.tipo === "nota" && d.vistoPor && !d.vistoPor.includes(uid);
        if (naoViAinda) {
            idsComNovidades.add(id);
            // Propagar novidade para as pastas pai para mostrar o caminho
            let paiId = d[uid]?.pastapai;
            while (paiId && paiId !== "home") {
                pastasComNovidades.add(paiId);
                const pastaDoc = snapshot.docs.find(s => s.id === paiId);
                paiId = pastaDoc ? pastaDoc.data()[uid]?.pastapai : null;
            }
        }
    });

    // 3. RENDERIZAR CARDS DE CONVITE NO TOPO
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

    // 4. FILTRAR ITENS DA PASTA ATUAL
    const itensParaMostrar = todosOsDocumentos.filter(item => {
        const minhaPosicao = item[uid]?.pastapai || "home";
        return minhaPosicao === window.pastaShareAtual && !item.convidado?.includes(uid);
    });

    // 5. NOVA LÓGICA DE ORDENAÇÃO: TOP PRIVADO -> ORDEM PRIVADA
    itensParaMostrar.sort((a, b) => {
        const aTop = (a[uid]?.Top && a[uid].Top.estado === "ativo") ? 1 : 0;
        const bTop = (b[uid]?.Top && b[uid].Top.estado === "ativo") ? 1 : 0;

        // Regra 1: Favoritos (Top) do utilizador atual sobem
        if (aTop !== bTop) return bTop - aTop;

        // Regra 2: Respeita a ordem manual/cronológica do utilizador
        return (a[uid]?.ordem || 99) - (b[uid]?.ordem || 99);
    });

    // 6. RENDERIZAR OS ITENS DA LISTA
    itensParaMostrar.forEach(item => {
        const div = document.createElement('div');
        
        // Verificação de estados: Selecionado e Top Privado
        const isAtivo = (item.id === window.itemSelecionadoId);
        const souTop = (item[uid]?.Top && item[uid].Top.estado === "ativo");

        div.className = `item-local ${isAtivo ? 'active' : ''}`; 
        
        // Estilo visual de destaque para notas/pastas TOP (Vermelho Share)
        if (souTop) {
            div.style.background = "rgba(239, 68, 68, 0.04)"; 
            div.style.borderRight = "3px solid #ef4444";     
        }

        // Lógica do ponto vermelho de novidade
        const temNovidadeAqui = (item.tipo === "nota" && idsComNovidades.has(item.id)) || 
                               (item.tipo === "pasta" && pastasComNovidades.has(item.id));
        if (temNovidadeAqui) div.classList.add('has-update');

        // Definição de Ícones e Cores
        const souDono = item.userId === uid;
        let iconeClasse = "";
        let corIcone = "";

        if (item.tipo === "pasta") {
            iconeClasse = item.icon || "fa-folder";
            if (!iconeClasse.startsWith('fa-')) iconeClasse = `fa-${iconeClasse}`;
            corIcone = "#fca5a5"; // Rosa suave para pastas Share
        } else {
            iconeClasse = souDono ? "fa-share-nodes" : "fa-user-group";
            corIcone = souDono ? "#ef4444" : "#fca5a5";
        }

        div.innerHTML = `
            <i class="fa-solid ${iconeClasse}" style="color: ${corIcone};"></i>
            <div style="flex:1; display:flex; align-items:center; overflow:hidden;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--fs-left-items); font-weight: ${souTop ? '700' : '500'};">
                    ${item.nome}
                </span>
            </div>
            <i class="fa-solid fa-gear btn-edit-item-local" 
               onclick="event.stopPropagation(); window.abrirGestaoItemShare('${item.id}', '${item.tipo}', '${item.nome.replace(/'/g, "\\'")}')">
            </i>
        `;

        div.onclick = () => {
            window.itemSelecionadoId = item.id;
            if (item.tipo === "pasta") {
                window.historicoPastasShare.push({ id: item.id, nome: item.nome });
                window.pastaShareAtual = item.id;
                atualizarUIShare(); 
                carregarDadosShare();
            } else {
                abrirNotaNoEditor(item.id, item, dbRef, authRef);
                document.querySelectorAll('#lista-share .item-local').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
            }
        };
        fragmento.appendChild(div);
    });

    // Injeção final no DOM
    listaCont.innerHTML = ""; 
    listaCont.appendChild(fragmento);

}, (error) => {
    console.error("Erro no Listener Share:", error);
});
}

/**
 * 5. VIGIAR CONVITES PARA O BOTÃO DA ABA
 */
export function vigiarConvitesPendentes(db, auth) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    // A CORREÇÃO ESTÁ AQUI: Envolver os filtros num and(...)
    const q = query(
        collection(db, "Share"),
        and( // Adicionado este wrapper
            where("estado", "==", "ativo"),
            or(
                where("userId", "==", uid),
                where("aprovado", "array-contains", uid),
                where("convidado", "array-contains", uid)
            )
        )
    );

    onSnapshot(q, (snapshot) => {
        const btnShare = Array.from(document.querySelectorAll('#left-buttons button'))
                              .find(b => b.innerText.trim().toUpperCase() === 'SHARE');
        if (!btnShare) return;

        let temNovidade = false;
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            // Verifica se sou convidado ou se alguém editou e eu não vi
            if ((d.convidado && d.convidado.includes(uid)) || (d.vistoPor && !d.vistoPor.includes(uid))) {
                temNovidade = true;
            }
        });

        // Aplica o estilo vermelho no texto do botão da aba
        btnShare.style.color = temNovidade ? "#ef4444" : "";
        btnShare.style.fontWeight = temNovidade ? "900" : "";
    }, (error) => {
        console.error("Erro na vigilância de convites:", error);
    });
}

// ... rest of the file (aceitar/rejeitar partilha)
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