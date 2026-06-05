// components/direita/biblia-marcador.js
import { collection, addDoc, doc, updateDoc, query, where, onSnapshot, serverTimestamp, getDocs, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let modoEdicaoMarcador = false;
let currentVerseInfo = null;
let currentDb = null;
let currentAuth = null;
let unsubMarcadores = null;
let ultimoSnapMarcadores = [];

/**
 * ABRE O POPUP PRINCIPAL DE MARCADORES
 */
export async function abrirPopupMarcadores(verseInfo, db, auth) {
    currentVerseInfo = verseInfo; currentDb = db; currentAuth = auth;
    modoEdicaoMarcador = false;
    garantirPopupsMarcadorBiblia();

    const overlay = document.getElementById('popup-ancora-lista-overlay'); // Reutilizamos o container visual
    const container = document.getElementById('lista-ancoras-container');
    const titulo = overlay.querySelector('h3');

    if (!overlay || !container) return;

    titulo.innerText = "Marcadores Bíblicos";
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;
    overlay.classList.add('active');

    // Configurar botões do topo do popup (Reutilizando os IDs do popup de âncoras do Cosmos)
    document.getElementById('btn-nova-ancora-trigger').onclick = () => abrirFormMarcador();
    document.getElementById('btn-edit-ancoras-toggle').onclick = () => {
        modoEdicaoMarcador = !modoEdicaoMarcador;
        renderizarLista(ultimoSnapMarcadores);
    };

    escutarMarcadores();
}

function garantirPopupsMarcadorBiblia() {
    if (!document.getElementById('popup-ancora-lista-overlay')) {
        const listaOverlay = document.createElement('div');
        listaOverlay.id = 'popup-ancora-lista-overlay';
        listaOverlay.className = 'popup-overlay';
        listaOverlay.style.zIndex = '10200';
        listaOverlay.innerHTML = `
            <div class="popup-content" style="max-width:420px; width:92%; border-radius:18px; overflow:hidden;">
                <div class="popup-header">
                    <h3>Marcadores Bíblicos</h3>
                    <div style="display:flex; align-items:center; gap:16px;">
                        <i class="fa-solid fa-pen-to-square" id="btn-edit-ancoras-toggle" title="Editar" style="cursor:pointer; color:var(--text-muted);"></i>
                        <i class="fa-solid fa-plus" id="btn-nova-ancora-trigger" title="Novo marcador" style="cursor:pointer; color:var(--primary);"></i>
                        <button onclick="document.getElementById('popup-ancora-lista-overlay').classList.remove('active')">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <div id="lista-ancoras-container" style="padding:15px; max-height:360px; overflow-y:auto; background:var(--bg-body);"></div>
            </div>
        `;
        document.body.appendChild(listaOverlay);
    }

    if (!document.getElementById('popup-ancora-form-overlay')) {
        const formOverlay = document.createElement('div');
        formOverlay.id = 'popup-ancora-form-overlay';
        formOverlay.className = 'popup-overlay';
        formOverlay.style.zIndex = '10300';
        formOverlay.innerHTML = `
            <div class="popup-content" style="max-width:340px; width:90%; border-radius:18px; padding:18px;">
                <h4 id="ancora-form-titulo" style="margin-bottom:15px; font-size:14px; color:var(--primary);">Novo Marcador</h4>
                <input id="input-nome-ancora" type="text" placeholder="Nome do marcador" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.25); border:1px solid var(--border-color); color:white; padding:12px; border-radius:8px; margin-bottom:14px;">
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('popup-ancora-form-overlay').classList.remove('active')" style="flex:1; background:transparent; border:1px solid var(--border-color); color:white; padding:10px; border-radius:8px; cursor:pointer;">Cancelar</button>
                    <button id="btn-gravar-ancora-final" style="flex:1; background:var(--primary); border:none; color:white; padding:10px; border-radius:8px; cursor:pointer; font-weight:800;">Gravar</button>
                </div>
            </div>
        `;
        document.body.appendChild(formOverlay);
    }
}

function escutarMarcadores() {
    const q = query(
        collection(currentDb, "Marcador"), 
        where("userId", "==", currentAuth.currentUser.uid), 
        where("estado", "==", "on")
    );
    
    if(unsubMarcadores) unsubMarcadores();
    
    unsubMarcadores = onSnapshot(q, (snapshot) => {
        ultimoSnapMarcadores = [];
        snapshot.forEach(d => ultimoSnapMarcadores.push({ docId: d.id, ...d.data() }));
        renderizarLista(ultimoSnapMarcadores);
    });
}

async function renderizarLista(lista) {
    const container = document.getElementById('lista-ancoras-container');
    container.innerHTML = "";

    if (!lista.length) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:30px 10px; font-size:12px;">Ainda não criaste categorias de marcadores.</p>`;
        return;
    }

    // Obter ID do TextosBiblia atual (se existir)
    const verseId = await obterIdVersiculoAtual();

    lista.forEach(m => {
        const isSelected = verseId && m.textosbiblia?.includes(verseId);
        const div = document.createElement('div');
        div.className = "menu-item-list";
        div.style.cssText = `justify-content: space-between; padding: 12px; margin-bottom: 5px; background: rgba(255,255,255,0.02); border-radius: 6px;`;
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; overflow: hidden;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="cursor:pointer; width: 16px; height: 16px;" ${modoEdicaoMarcador ? 'disabled' : ''}>
                <span style="font-size:13px; color:white; font-weight: 500;">${m.nome}</span>
            </div>
            ${modoEdicaoMarcador ? `<i class="fa-solid fa-pen-to-square btn-edit-sub" style="color:var(--primary); cursor:pointer; padding: 5px;"></i>` : ''}
        `;

        if (!modoEdicaoMarcador) {
            div.onclick = () => vincularVersiculoMarcador(m, !isSelected);
        } else {
            div.querySelector('.btn-edit-sub').onclick = (e) => { e.stopPropagation(); abrirFormMarcador(m); };
        }
        container.appendChild(div);
    });
}

async function vincularVersiculoMarcador(marcador, vincular) {
    let verseId = await obterIdVersiculoAtual();

    // 1. Garantir que o versículo tem um documento mestre
    if (!verseId) {
        const docRef = await addDoc(collection(currentDb, "TextosBiblia"), {
            id: crypto.randomUUID(),
            nome: `${currentVerseInfo.livro} ${currentVerseInfo.cap}:${currentVerseInfo.ver}`,
            livro: currentVerseInfo.livro, 
            capitulo: currentVerseInfo.cap, 
            versiculo: currentVerseInfo.ver,
            userId: currentAuth.currentUser.uid, 
            estado: "on", 
            tipo: "textobiblico", 
            timestamp: serverTimestamp(),
            marcador: "sim" // Já nasce marcado
        });
        const novoSnap = await getDoc(docRef);
        verseId = novoSnap.data().id;
    }

    // 2. Atualizar a Categoria (Array de Versículos)
    const marcadorRef = doc(currentDb, "Marcador", marcador.docId);
    await updateDoc(marcadorRef, {
        textosbiblia: vincular ? arrayUnion(verseId) : arrayRemove(verseId)
    });

    // 3. ATUALIZAÇÃO CRUCIAL: Verificar se ainda resta algum marcador para este versículo
    // Procuramos em todas as categorias do utilizador se este verseId aparece
    const qCheck = query(
        collection(currentDb, "Marcador"), 
        where("userId", "==", currentAuth.currentUser.uid), 
        where("textosbiblia", "array-contains", verseId)
    );
    
    const snapCheck = await getDocs(qCheck);
    const aindaTemMarcadores = !snapCheck.empty;

    // 4. Atualizar o campo "marcador" no documento mestre do versículo
    // Isto é o que faz o ícone no topo mudar de cor
    const qVerse = query(
        collection(currentDb, "TextosBiblia"), 
        where("id", "==", verseId),
        where("userId", "==", currentAuth.currentUser.uid)
    );
    const snapVerse = await getDocs(qVerse);
    
    if (!snapVerse.empty) {
        await updateDoc(snapVerse.docs[0].ref, { 
            marcador: aindaTemMarcadores ? "sim" : "nao" 
        });
        console.log(`✅ Status mestre atualizado: ${aindaTemMarcadores ? 'Marcado' : 'Desmarcado'}`);
    }
}

/**
 * POPUP PARA CRIAR / EDITAR CATEGORIA
 */
function abrirFormMarcador(existente = null) {
    const overlay = document.getElementById('popup-ancora-form-overlay');
    const input = document.getElementById('input-nome-ancora');
    const btn = document.getElementById('btn-gravar-ancora-final');
    
    document.getElementById('ancora-form-titulo').innerText = existente ? "Editar Marcador" : "Novo Marcador";
    input.value = existente ? existente.nome : "";
    overlay.classList.add('active');

    btn.onclick = async () => {
        const nome = input.value.trim();
        if(!nome) return;
        if(existente) {
            await updateDoc(doc(currentDb, "Marcador", existente.docId), { nome });
        } else {
            await addDoc(collection(currentDb, "Marcador"), {
                id: crypto.randomUUID(), nome, userId: currentAuth.currentUser.uid,
                estado: "on", timestamp: serverTimestamp(), textosbiblia: []
            });
        }
        overlay.classList.remove('active');
    };
}

async function obterIdVersiculoAtual() {
    const q = query(collection(currentDb, "TextosBiblia"), 
                    where("userId", "==", currentAuth.currentUser.uid), 
                    where("nome", "==", `${currentVerseInfo.livro} ${currentVerseInfo.cap}:${currentVerseInfo.ver}`));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data().id;
}
