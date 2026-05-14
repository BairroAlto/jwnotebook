// components/direita/cosmos-ancora.js
import { collection, addDoc, doc, updateDoc, query, where, onSnapshot, serverTimestamp, getDocs, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let modoEdicaoAncora = false;
let currentTema = null;
let currentDb = null;
let currentAuth = null;
let unsubAncoras = null;
let ultimoSnapshot = [];

export function abrirPopupAncoras(tema, db, auth) {
    currentTema = tema; currentDb = db; currentAuth = auth;
    modoEdicaoAncora = false;
    
    const overlay = document.getElementById('popup-ancora-lista-overlay');
    const container = document.getElementById('lista-ancoras-container');

    // 1. MOSTRAR RODINHA DE CARREGAMENTO IMEDIATAMENTE
    container.innerHTML = `
        <div id="ancora-loader" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; color: var(--text-muted);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; margin-bottom: 10px; color: var(--primary);"></i>
            <span style="font-size: 11px; font-weight: 600; letter-spacing: 0.5px;">A SINCRONIZAR...</span>
        </div>
    `;

    overlay.classList.add('active');
    
    escutarAncoras();

    document.getElementById('btn-nova-ancora-trigger').onclick = () => abrirFormAncora();
    document.getElementById('btn-edit-ancoras-toggle').onclick = () => {
        modoEdicaoAncora = !modoEdicaoAncora;
        renderizarListaAncoras(ultimoSnapshot);
    };
}

function escutarAncoras() {
    const q = query(
        collection(currentDb, "Ancora"), 
        where("userId", "==", currentAuth.currentUser.uid), 
        where("estado", "==", "ativo")
    );
    
    if(unsubAncoras) unsubAncoras();
    
    unsubAncoras = onSnapshot(q, (snapshot) => {
        ultimoSnapshot = [];
        snapshot.forEach(d => ultimoSnapshot.push({ docId: d.id, ...d.data() }));
        
        // 2. RENDERIZAR A LISTA (O spinner será removido automaticamente pelo innerHTML="")
        renderizarListaAncoras(ultimoSnapshot);
    }, (error) => {
        console.error("Erro ao carregar âncoras:", error);
        document.getElementById('lista-ancoras-container').innerHTML = `<p style="color: #ef4444; font-size: 12px; text-align: center;">Erro de permissão.</p>`;
    });
}

function renderizarListaAncoras(lista) {
    const container = document.getElementById('lista-ancoras-container');
    container.innerHTML = ""; // Remove o spinner aqui

    if (lista.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Nenhuma categoria criada.</p>`;
        return;
    }

    lista.forEach(ancora => {
        const isSelected = ancora.cosmos?.includes(currentTema.id);
        const div = document.createElement('div');
        div.className = "menu-item-list";
        div.style.cssText = `justify-content: space-between; padding: 12px; margin-bottom: 5px; background: rgba(255,255,255,0.02); border-radius: 6px;`;
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; overflow: hidden;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="cursor:pointer; width: 16px; height: 16px;" ${modoEdicaoAncora ? 'disabled' : ''}>
                <span style="font-size:13px; color:white; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ancora.nome}</span>
            </div>
            ${modoEdicaoAncora ? `<i class="fa-solid fa-pen-to-square btn-edit-sub" style="color:var(--primary); cursor:pointer; padding: 5px;"></i>` : ''}
        `;

        if (!modoEdicaoAncora) {
            div.onclick = () => vincularCosmoAncora(ancora, !isSelected);
        } else {
            div.querySelector('.btn-edit-sub').onclick = (e) => {
                e.stopPropagation();
                abrirFormAncora(ancora);
            };
        }

        container.appendChild(div);
    });
}

async function vincularCosmoAncora(ancora, vincular) {
    const ancoraRef = doc(currentDb, "Ancora", ancora.docId);
    const cosmoRef = doc(currentDb, "Cosmo", currentTema.docIdFirebase);

    try {
        await updateDoc(ancoraRef, {
            cosmos: vincular ? arrayUnion(currentTema.id) : arrayRemove(currentTema.id)
        });

        // Verificação imediata do estado do campo "ancora" no Cosmo
        const q = query(collection(currentDb, "Ancora"), 
                        where("userId", "==", currentAuth.currentUser.uid), 
                        where("cosmos", "array-contains", currentTema.id));
        
        const snap = await getDocs(q);
        await updateDoc(cosmoRef, { ancora: !snap.empty ? "sim" : "nao" });
        
    } catch (e) {
        console.error("Erro ao vincular:", e);
    }
}

function abrirFormAncora(existente = null) {
    const overlay = document.getElementById('popup-ancora-form-overlay');
    const input = document.getElementById('input-nome-ancora');
    const btn = document.getElementById('btn-gravar-ancora-final');
    
    document.getElementById('ancora-form-titulo').innerText = existente ? "Editar Âncora" : "Nova Âncora";
    input.value = existente ? existente.nome : "";
    overlay.classList.add('active');
    input.focus();

    btn.onclick = async () => {
        const nome = input.value.trim();
        if(!nome) return;

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;

        try {
            if(existente) {
                await updateDoc(doc(currentDb, "Ancora", existente.docId), { nome });
            } else {
                await addDoc(collection(currentDb, "Ancora"), {
                    id: crypto.randomUUID(),
                    nome,
                    userId: currentAuth.currentUser.uid,
                    estado: "ativo",
                    timestamp: serverTimestamp(),
                    cosmos: []
                });
            }
            overlay.classList.remove('active');
        } catch (e) {
            alert("Erro ao gravar. Verifica as permissões.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "Gravar";
        }
    };
}