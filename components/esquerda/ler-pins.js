// components/esquerda/ler-pins.js
import { 
    collection, query, where, onSnapshot, orderBy, getDocs, getDoc, doc, deleteDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';

let modoEdicaoPins = false;
let pinAtualParaGestao = null;

/**
 * 1. INICIALIZAÇÃO DA ABA PINS
 */
export function inicializarLeituraPins(db, auth) {
    const listaPins = document.getElementById('lista-pins');
    const btnToggle = document.getElementById('btn-editar-pins-toggle');
    if (!listaPins || !btnToggle) return;

    // TOGGLE MODO EDIÇÃO
    btnToggle.onclick = () => {
        modoEdicaoPins = !modoEdicaoPins;
        btnToggle.classList.toggle('active', modoEdicaoPins);
        listaPins.classList.toggle('lista-modo-edicao', modoEdicaoPins);
    };

    // ESCUTA EM TEMPO REAL
    const q = query(collection(db, "Atalho"), where("userId", "==", auth.currentUser.uid), orderBy("ordem", "asc"));
    onSnapshot(q, (snapshot) => {
        listaPins.innerHTML = "";
        if (snapshot.empty) {
            listaPins.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; padding:30px; opacity:0.6;">Nenhum item fixado.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const idDocFirebase = docSnap.id;
            const div = document.createElement('div');
            const isAtivo = (data.itemId === window.itemSelecionadoId);
            div.setAttribute('data-itemid', data.itemId); 
            div.className = `item-local ${isAtivo ? 'active' : ''}`;
            
            const cor = data.onde === "Local" ? (data.tipo === "pasta" ? "#eab308" : "#6366f1") : "#ef4444";
            const icone = data.tipo === "pasta" ? "fa-folder" : "fa-note-sticky";

            div.innerHTML = `
                <i class="fa-solid ${icone}" style="color: ${cor};"></i>
                <div style="flex:1; overflow:hidden;">
                    <span style="font-size:13.5px; font-weight:500;">${data.nome}</span>
                </div>
                <i class="fa-solid fa-gear btn-edit-item-local" 
                   onclick="event.stopPropagation(); window.abrirGestaoPinInterna('${idDocFirebase}', '${data.nome.replace(/'/g, "\\'")}')">
                </i>
            `;

            div.onclick = () => { if (!modoEdicaoPins) viajarParaItem(data, db, auth); };
            listaPins.appendChild(div);
        });
    });

    /**
     * 2. GESTÃO DO POPUP (LIMPEZA DE CAMPOS)
     */
    window.abrirGestaoPinInterna = (docId, nome) => {
        pinAtualParaGestao = docId;
        const overlay = document.getElementById('popup-gestao-item-overlay');

        // Referências de elementos para esconder/mostrar
        const areaNome = document.getElementById('input-gestao-nome').parentElement;
        const btnMover = document.getElementById('btn-gestao-mover');
        const btnOcultar = document.getElementById('btn-gestao-ocultar');
        const btnSalvar = document.getElementById('btn-salvar-gestao-item');
        const btnRemover = document.getElementById('btn-gestao-pin');
        const btnOrdenar = document.getElementById('btn-gestao-ordenar');

        // Configurar Título e Esconder o que não é PIN
        document.getElementById('gestao-item-titulo').innerText = "Gerir Atalho (PIN)";
        if (areaNome) areaNome.style.display = 'none';
        if (btnMover) btnMover.style.display = 'none';
        if (btnOcultar) btnOcultar.style.display = 'none';
        if (btnSalvar) btnSalvar.style.display = 'none';

        // Configurar Botão Remover
        btnRemover.style.display = 'flex';
        btnRemover.innerHTML = '<i class="fa-solid fa-thumbtack-slash"></i> Remover Pin';
        btnRemover.classList.add('pin-ativo');

        btnRemover.onclick = async (e) => {
            e.stopPropagation();
            await deleteDoc(doc(db, "Atalho", pinAtualParaGestao));
            overlay.classList.remove('active');
            resetPopupLayout();
        };

        // Configurar Botão Ordenar
        btnOrdenar.onclick = (e) => {
            e.stopPropagation();
            overlay.classList.remove('active');
            abrirOrdenacaoPins(db, auth);
        };

        overlay.classList.add('active');

        // FUNÇÃO DE RESET: Volta a mostrar tudo para quando o utilizador abrir o Local/Share
        const resetPopupLayout = () => {
            if (areaNome) areaNome.style.display = 'block';
            if (btnMover) btnMover.style.display = 'flex';
            if (btnOcultar) btnOcultar.style.display = 'flex';
            if (btnSalvar) btnSalvar.style.display = 'block';
            btnRemover.classList.remove('pin-ativo');
            btnRemover.innerHTML = '<i class="fa-solid fa-thumbtack"></i> Fixar Pin';
        };

        // Reset ao fechar no X
        const btnX = overlay.querySelector('.fa-xmark').parentElement;
        btnX.onclick = () => { overlay.classList.remove('active'); resetPopupLayout(); };
    };
}

/**
 * 3. MOTOR DE ORDENAÇÃO
 */
async function abrirOrdenacaoPins(db, auth) {
    const overlay = document.getElementById('popup-ordenar-itens-overlay');
    const container = document.getElementById('lista-reordenar-container');
    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    const q = query(collection(db, "Atalho"), where("userId", "==", auth.currentUser.uid), orderBy("ordem", "asc"));
    const snap = await getDocs(q);
    let lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));

    const render = () => {
        container.innerHTML = lista.map((p, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); margin-bottom:5px; border-radius:6px;">
                <span style="font-size:12px; color:white;">${p.nome}</span>
                <div style="display:flex; gap:15px; color:#6366f1; font-size:14px;">
                    <i class="fa-solid fa-circle-chevron-up" onclick="window.moverPin(${i}, -1)" style="cursor:pointer;"></i>
                    <i class="fa-solid fa-circle-chevron-down" onclick="window.moverPin(${i}, 1)" style="cursor:pointer;"></i>
                </div>
            </div>`).join('');
    };

    window.moverPin = async (idx, dir) => {
        const target = idx + dir;
        if (target < 0 || target >= lista.length) return;
        [lista[idx], lista[target]] = [lista[target], lista[idx]];
        render();
        // Gravar no Firebase (Corrigido: agora updateDoc está definido)
        for (let i = 0; i < lista.length; i++) {
            await updateDoc(doc(db, "Atalho", lista[i].id), { ordem: i + 1 });
        }
    };
    render();
}

/**
 * 4. NAVEGAÇÃO AUTOMÁTICA
 */
async function viajarParaItem(data, db, auth) {
    const { itemId, tipo, onde, nome } = data;
    window.itemSelecionadoId = itemId;

    const botoesEsquerda = document.querySelectorAll('#left-buttons button');
    const btnAlvo = Array.from(botoesEsquerda).find(b => b.innerText.trim().toUpperCase() === onde.toUpperCase());
    if (btnAlvo) btnAlvo.click();

    try {
        if (tipo === "nota") {
            const docRef = doc(db, onde, itemId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const d = docSnap.data();
                const pastaDaNota = (onde === "Local") ? d.pastapai : (d[auth.currentUser.uid]?.pastapai || "home");
                
                if (onde === "Local") {
                    window.pastaAtual = pastaDaNota;
                    window.historicoPastas = [{ id: "root", nome: "Local" }];
                    if (pastaDaNota !== "root") window.historicoPastas.push({ id: pastaDaNota, nome: "Pasta" });
                    if (typeof window.carregarPastaLocalManual === 'function') window.carregarPastaLocalManual(pastaDaNota);
                } else {
                    window.pastaShareAtual = pastaDaNota;
                    window.historicoPastasShare = [{ id: "home", nome: "Share" }];
                    if (pastaDaNota !== "home") window.historicoPastasShare.push({ id: pastaDaNota, nome: "Pasta" });
                    if (typeof window.dispararLeituraShare === 'function') window.dispararLeituraShare();
                }
                abrirNotaNoEditor(docSnap.id, d, db, auth);
            }
        } else {
            // Lógica de Pasta
            if (onde === "Local") {
                window.pastaAtual = itemId;
                window.historicoPastas = [{ id: "root", nome: "Local" }, { id: itemId, nome: nome }];
                if (typeof window.carregarPastaLocalManual === 'function') window.carregarPastaLocalManual(itemId);
            } else {
                window.pastaShareAtual = itemId;
                window.historicoPastasShare = [{ id: "home", nome: "Share" }, { id: itemId, nome: nome }];
                if (typeof window.dispararLeituraShare === 'function') window.dispararLeituraShare();
            }
        }
    } catch (e) { console.error(e); }
}