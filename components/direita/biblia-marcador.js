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

function escutarMarcadores() {
    const q = query(
        collection(currentDb, "Marcador"), 
        where("userId", "==", currentAuth.currentUser.uid), 
        where("estado", "==", "ativo")
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
            estado: "ativo", 
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
                estado: "ativo", timestamp: serverTimestamp(), textosbiblia: []
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
