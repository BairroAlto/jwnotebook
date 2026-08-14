import { doc, updateDoc, onSnapshot, collection, query, where, getDocs, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let unsubNotaAncora = null;
let unsubsCosmosAtivos = [];
let colapsados = {};

export function iniciarAbaAncora(notaId, db, auth) {
    const container = document.getElementById('ancora-nota-container');
    if (!container) return;
    const readOnlyBook = document.body.classList.contains('book-readonly');

    if (unsubNotaAncora) unsubNotaAncora();
    limparListenersCosmos();

    container.innerHTML = `
        <div id="ancora-ui-wrapper" style="display:flex; flex-direction:column; height:100%; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 15px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="font-size:10px; color:#818cf8; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin:0;">ÂNCORA INTELLIGENCE</p>
                <button id="btn-add-ancora-nota" style="background:#6366f1; color:white; border:none; width:32px; height:32px; border-radius:6px; cursor:pointer; display:${readOnlyBook ? 'none' : 'flex'}; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
                    <i class="fa-solid fa-plus" style="font-size:16px;"></i>
                </button>
            </div>
            <div id="feed-cosmos-ancorados" style="flex:1; padding:10px; overflow-y:auto;"></div>
        </div>
    `;

    const feed = document.getElementById('feed-cosmos-ancorados');
    const btnPlus = document.getElementById('btn-add-ancora-nota');

    unsubNotaAncora = onSnapshot(doc(db, "Local", notaId), docSnap => {
        if (!docSnap.exists()) return;
        const dados = docSnap.data();
        const ancorasIds = dados.ancora || [];

        if (btnPlus) {
            btnPlus.onclick = e => {
                e.stopPropagation();
                abrirPopupSelecaoAncoras(notaId, ancorasIds, db, auth);
            };
        }

        if (ancorasIds.length === 0) {
            feed.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; opacity:0.3; text-align:center; padding:0 20px; color:white;">
                    <i class="fa-solid fa-anchor-lock" style="font-size:50px; margin-bottom:20px; color:#818cf8;"></i>
                    <p style="font-size:12px; line-height:1.5; font-weight:500;">${readOnlyBook ? 'Esta nota não tem âncoras associadas.' : 'Esta nota não tem âncoras.<br>Clica no + para começar.'}</p>
                </div>`;
            return;
        }

        buscarECarregarCosmos(ancorasIds, db, auth);
    });
}

async function buscarECarregarCosmos(ancorasIds, db, auth) {
    const feed = document.getElementById('feed-cosmos-ancorados');
    const uid = auth.currentUser?.uid;
    if (!feed || !uid) return;

    try {
        const qAncoras = query(
            collection(db, "Ancora"),
            where("userId", "==", uid),
            where("estado", "==", "on"),
            where("id", "in", ancorasIds)
        );

        const snapAncoras = await getDocs(qAncoras);
        const cosmosIdsSet = new Set();
        snapAncoras.forEach(d => (d.data().cosmos || []).forEach(id => cosmosIdsSet.add(id)));

        const idsArray = Array.from(cosmosIdsSet);
        if (idsArray.length === 0) {
            feed.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; margin-top:20px;">Nenhum tema ativo encontrado.</p>`;
            return;
        }

        limparListenersCosmos();
        for (let i = 0; i < idsArray.length; i += 30) {
            const chunk = idsArray.slice(i, i + 30);
            const qCosmos = query(
                collection(db, "Cosmo"),
                where("userId", "==", uid),
                where("estado", "==", "on"),
                where("id", "in", chunk)
            );

            const unsub = onSnapshot(qCosmos, snapshot => {
                feed.innerHTML = "";
                snapshot.forEach(docSnap => feed.appendChild(criarCardCosmoEye(docSnap.data())));
            });
            unsubsCosmosAtivos.push(unsub);
        }
    } catch (e) {
        console.error("Erro Ancora Filter:", e);
    }
}

function criarCardCosmoEye(cosmo) {
    const id = cosmo.id;
    if (colapsados[id] === undefined) colapsados[id] = true;
    const isColapsado = colapsados[id];
    const div = document.createElement('div');
    div.className = "indice-card";
    div.style.cssText = "border-left:4px solid #6366f1; padding:12px; margin-bottom:12px; background:rgba(255,255,255,0.02); border-radius:8px; cursor:default;";

    const quadros = cosmo.Puzzle?.quadros || [];
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" class="header-click">
            <div style="display:flex; align-items:center; gap:10px; pointer-events:none;">
                <i class="fa-solid fa-${cosmo.simbolo || 'cat'}" style="color:#818cf8; font-size:14px;"></i>
                <span style="font-size:12px; font-weight:800; color:white; text-transform:uppercase;">${cosmo.nome}</span>
            </div>
            <i class="fa-solid ${isColapsado ? 'fa-chevron-down' : 'fa-chevron-up'} arrow-icon" style="color:#94a3b8; font-size:11px;"></i>
        </div>
        <div class="body-content" style="display:${isColapsado ? 'none' : 'block'}; margin-top:12px;">
            ${cosmo.descricao ? `<p style="font-size:11px; color:#94a3b8; margin-bottom:12px; font-style:italic;">${cosmo.descricao}</p>` : ''}
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${quadros.map(q => `<div style="font-size:12px; color:#cbd5e1; line-height:1.5; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.03); white-space:pre-wrap; word-break:break-word;">${q.conteudo}</div>`).join('')}
            </div>
        </div>
    `;

    div.querySelector('.header-click').onclick = e => {
        e.preventDefault();
        colapsados[id] = !colapsados[id];
        const body = div.querySelector('.body-content');
        const icon = div.querySelector('.arrow-icon');
        if (colapsados[id]) {
            body.style.display = 'none';
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        } else {
            body.style.display = 'block';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        }
    };

    return div;
}

async function abrirPopupSelecaoAncoras(notaId, ancorasAtuais, db, auth) {
    const overlay = document.getElementById('popup-ancora-nota-overlay');
    const container = document.getElementById('lista-ancoras-nota-selection');
    const readOnlyBook = document.body.classList.contains('book-readonly');
    if (!overlay || !container) return;

    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    const q = query(
        collection(db, "Ancora"),
        where("userId", "==", auth.currentUser.uid),
        where("estado", "==", "on")
    );
    const snap = await getDocs(q);

    container.innerHTML = "";
    if (snap.empty) {
        container.innerHTML = `<p style="color:gray; font-size:12px; text-align:center; padding:20px;">Não tens categorias Âncora ativas.</p>`;
        return;
    }

    snap.forEach(d => {
        const item = d.data();
        const isChecked = ancorasAtuais.includes(item.id);
        const div = document.createElement('div');
        div.style.cssText = "padding:12px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:8px; display:flex; align-items:center; gap:12px; cursor:pointer;";
        div.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;"><span style="color:white; font-size:14px; font-weight:500;">${item.nome}</span>`;

        if (readOnlyBook) {
            div.style.cursor = 'default';
            div.querySelector('input').disabled = true;
        } else {
            div.onclick = async e => {
                const cb = div.querySelector('input');
                if (e.target !== cb) cb.checked = !cb.checked;
                const ref = doc(db, "Local", notaId);
                if (cb.checked) await updateDoc(ref, { ancora: arrayUnion(item.id) });
                else await updateDoc(ref, { ancora: arrayRemove(item.id) });
            };
        }
        container.appendChild(div);
    });
}

function limparListenersCosmos() {
    unsubsCosmosAtivos.forEach(u => u());
    unsubsCosmosAtivos = [];
}
