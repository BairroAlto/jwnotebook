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

    // TOGGLE MODO EDIÇÃO (Lápis)
    btnToggle.onclick = (e) => {
        e.stopPropagation();
        modoEdicaoPins = !modoEdicaoPins;
        btnToggle.classList.toggle('active', modoEdicaoPins);
        listaPins.classList.toggle('lista-modo-edicao', modoEdicaoPins);
    };

    // ESCUTA EM TEMPO REAL (Snapshot)
    const q = query(collection(db, "Atalho"), where("userId", "==", auth.currentUser.uid), orderBy("ordem", "asc"));
    
    onSnapshot(q, async (snapshot) => {
        // --- MOTOR DE VERIFICAÇÃO DE INTEGRIDADE (Anti-Fantasmas) ---
        // Verificamos em paralelo se a nota/pasta original ainda está ativa
        const verificacoes = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const idAtalho = docSnap.id;
            
            try {
                // Tenta ler o documento de origem (na coleção Local ou Share)
                const refOrigem = doc(db, data.onde, data.itemId);
                const snapOrigem = await getDoc(refOrigem);

                if (snapOrigem.exists()) {
                    const status = snapOrigem.data().estado;
                    // Só retorna como válido se o estado for "ativa" (Local) ou "ativo" (Share)
                    if (status === "on" || status === "on") {
                        return { idAtalho, data, valido: true };
                    }
                }
                return { idAtalho, valido: false };
            } catch (e) {
                return { idAtalho, valido: false };
            }
        });

        // Aguarda que todas as consultas ao Firebase terminem
        const resultados = await Promise.all(verificacoes);
        const pinsValidos = resultados.filter(r => r.valido);

        // RENDERIZAÇÃO
        listaPins.innerHTML = "";
        
        if (pinsValidos.length === 0) {
            listaPins.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; padding:30px; opacity:0.6;">Nenhum item ativo fixado.</p>`;
            return;
        }

        const fragmento = document.createDocumentFragment();

        pinsValidos.forEach(itemObj => {
            const { data, idAtalho } = itemObj;
            const itemIdReal = data.itemId;
            
            const div = document.createElement('div');
            // Verifica se esta nota é a que está aberta no editor para iluminar
            const isAtivo = (itemIdReal === window.itemSelecionadoId);
            
            div.className = `item-local ${isAtivo ? 'active' : ''}`;
            div.setAttribute('data-id', itemIdReal);
            div.setAttribute('data-itemid', itemIdReal); 

            // Estilo visual consistente
            const cor = data.onde === "Local" ? (data.tipo === "pasta" ? "#eab308" : "#6366f1") : "#ef4444";
            const icone = data.tipo === "pasta" ? "fa-folder" : "fa-note-sticky";

            div.innerHTML = `
                <i class="fa-solid ${icone}" style="color: ${cor}; width: 20px; text-align: center;"></i>
                <div style="flex:1; overflow:hidden; display: flex; align-items: center;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13.5px; font-weight: 500;">
                        ${data.nome}
                    </span>
                </div>
                <i class="fa-solid fa-gear btn-edit-item-local" 
                   onclick="event.stopPropagation(); window.abrirGestaoPinInterna('${idAtalho}', '${data.nome.replace(/'/g, "\\'")}')">
                </i>
            `;

            div.onclick = () => { 
                if (!modoEdicaoPins) {
                    window.itemSelecionadoId = itemIdReal;
                    viajarParaItem(data, db, auth); 
                    // Feedback visual imediato
                    document.querySelectorAll('#lista-pins .item-local').forEach(el => el.classList.remove('active'));
                    div.classList.add('active');
                }
            };
            fragmento.appendChild(div);
        });

        listaPins.appendChild(fragmento);
    });

    /**
     * 2. GESTÃO DO POPUP (CUSTOMIZADO PARA PINS)
     */
    window.abrirGestaoPinInterna = (docId, nome) => {
        pinAtualParaGestao = docId;
        const overlay = document.getElementById('popup-gestao-item-overlay');

        const inputNomeArea = document.getElementById('input-gestao-nome')?.parentElement;
        const btnMover = document.getElementById('btn-gestao-mover');
        const btnOcultar = document.getElementById('btn-gestao-ocultar');
        const btnSalvar = document.getElementById('btn-salvar-gestao-item');
        const btnRemover = document.getElementById('btn-gestao-pin'); 
        const btnOrdenar = document.getElementById('btn-gestao-ordenar');

        document.getElementById('gestao-item-titulo').innerText = "Gerir Atalho";
        if (inputNomeArea) inputNomeArea.style.display = 'none';
        if (btnMover) btnMover.style.display = 'none';
        if (btnOcultar) btnOcultar.style.display = 'none';
        if (btnSalvar) btnSalvar.style.display = 'none';

        btnRemover.style.display = 'flex';
        btnRemover.innerHTML = '<i class="fa-solid fa-thumbtack-slash"></i> Desafixar';
        btnRemover.classList.add('pin-ativo');

        btnRemover.onclick = async (e) => {
            e.stopPropagation();
            await deleteDoc(doc(db, "Atalho", pinAtualParaGestao));
            overlay.classList.remove('active');
            resetPopupLayout();
        };

        btnOrdenar.onclick = (e) => {
            e.stopPropagation();
            overlay.classList.remove('active');
            import('./ler-pins.js').then(() => abrirOrdenacaoPins(db, auth));
        };

        overlay.classList.add('active');

        const resetPopupLayout = () => {
            if (inputNomeArea) inputNomeArea.style.display = 'block';
            if (btnMover) btnMover.style.display = 'flex';
            if (btnOcultar) btnOcultar.style.display = 'flex';
            if (btnSalvar) btnSalvar.style.display = 'block';
            btnRemover.classList.remove('pin-ativo');
            btnRemover.innerHTML = '<i class="fa-solid fa-thumbtack"></i> Pin';
        };

        const btnX = overlay.querySelector('.popup-header button');
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
    const uid = auth.currentUser.uid;

    const botoesEsquerda = document.querySelectorAll('#left-buttons button');
    const btnAlvo = Array.from(botoesEsquerda).find(b => b.innerText.trim().toUpperCase() === onde.toUpperCase());
    if (btnAlvo) btnAlvo.click();

    try {
        if (tipo === "nota") {
            const docSnap = await getDoc(doc(db, onde, itemId));
            if (docSnap.exists()) {
                const d = docSnap.data();
                const pastaDaNota = (onde === "Local") ? d.pastapai : (d[uid]?.pastapai || "home");
                
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