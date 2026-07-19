// components/share/gestao-share.js
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const db = getFirestore();

export async function abrirGestaoPartilha(notaId, auth) {
    const overlay = document.getElementById('popup-share-nota-overlay');
    const contAmigos = document.getElementById('lista-amigos-para-convite');
    const contAtivos = document.getElementById('lista-colaboradores-ativos');

    if (!overlay) {
        console.error("Popup #popup-share-nota-overlay não encontrado!");
        return;
    }

    overlay.classList.add('active');
    contAmigos.innerHTML = `<div style="text-align:center; padding:10px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
    contAtivos.innerHTML = "";

    const uid = auth.currentUser.uid;

    try {
        const notaSnap = await getDoc(doc(db, "Share", notaId));
        const dadosNota = notaSnap.data();
        const aprovados = dadosNota.aprovado || [];
        const convidados = dadosNota.convidado || [];

        // 1. BUSCAR AMIGOS (Só quem aceitou a amizade)
        const qAmigos = query(collection(db, "Amigos"), where("usuarios", "array-contains", uid), where("status", "==", "aceite"));
        const snapAmigos = await getDocs(qAmigos);
        
        contAmigos.innerHTML = "";
        
        snapAmigos.forEach(docAmigo => {
            const d = docAmigo.data();
            const amigoUid = d.remetenteId === uid ? d.destinatarioId : d.remetenteId;
            const amigoEmail = d.remetenteId === uid ? d.emailDestinatario : d.emailRemetente;

            // Se já está na nota, não aparece na lista de convite
            if (aprovados.includes(amigoUid) || convidados.includes(amigoUid)) return;

            const div = document.createElement('div');
            div.className = "menu-item-list";
            div.style.background = "rgba(255,255,255,0.02)";
            div.innerHTML = `
                <span style="font-size:12px; flex:1;">${amigoEmail}</span>
                <button onclick="window.executarConvite('${notaId}', '${amigoUid}')" style="background:#6366f1; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:10px; font-weight:700; cursor:pointer;">CONVIDAR</button>
            `;
            contAmigos.appendChild(div);
        });

        if (contAmigos.innerHTML === "") contAmigos.innerHTML = "<p style='color:gray; font-size:11px; text-align:center;'>Sem mais amigos para convidar.</p>";

        // 2. BUSCAR APROVADOS (Quem já edita)
        for (const colabUid of aprovados) {
            const uSnap = await getDoc(doc(db, "users", colabUid));
            const email = uSnap.exists() ? uSnap.data().email : colabUid;
            
            const div = document.createElement('div');
            div.className = "menu-item-list";
            div.innerHTML = `
                <i class="fa-solid fa-user-check" style="color:#22c55e; font-size:12px;"></i>
                <span style="font-size:12px; flex:1; margin-left:10px;">${email}</span>
                <i class="fa-solid fa-user-minus" onclick="window.executarRemocaoColab('${notaId}', '${colabUid}')" style="color:#ef4444; cursor:pointer; padding:5px;"></i>
            `;
            contAtivos.appendChild(div);
        }

    } catch (e) { console.error("Erro ao carregar gestão:", e); }
}

/**
 * PROMISE: Popup de Confirmação de Remoção
 */
function confirmarRemocaoColaborador(email) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-remocao-colab-overlay');
        const btnSim = document.getElementById('btn-confirmar-remocao-colab');
        const btnNao = document.getElementById('btn-cancelar-remocao-colab');
        const txt = document.getElementById('texto-confirmar-remocao-colab');

        txt.innerHTML = `Desejas remover o acesso de <br><b>${email}</b>?`;
        overlay.classList.add('active');

        const fechar = (r) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(r);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

/**
 * FUNÇÃO: Mostrar Sucesso
 */
function mostrarSucessoConvite() {
    document.getElementById('popup-sucesso-convite-overlay').classList.add('active');
}

// Funções globais para os botões do popup
window.executarConvite = async (notaId, amigoUid) => {
    try {
        await updateDoc(doc(db, "Share", notaId), { convidado: arrayUnion(amigoUid) });
        
        // Substituído alert() por popup
        mostrarSucessoConvite();
        
        document.getElementById('popup-share-nota-overlay').classList.remove('active');
    } catch (e) { console.error(e); }
};

window.executarRemocaoColab = async (notaId, colabUid) => {
    // 1. Tentar pegar o email do colaborador na UI para o popup
    const itens = document.querySelectorAll('#lista-colaboradores-ativos .menu-item-list');
    let email = "este colaborador";
    itens.forEach(it => {
        if (it.innerHTML.includes(colabUid) || it.innerText.includes('@')) {
            email = it.querySelector('span').innerText;
        }
    });

    // 2. Substituído confirm() por popup Promise
    const confirmou = await confirmarRemocaoColaborador(email);
    
    if (confirmou) {
        try {
            await updateDoc(doc(db, "Share", notaId), { aprovado: arrayRemove(colabUid) });
            document.getElementById('popup-share-nota-overlay').classList.remove('active');
            // Opcional: mostrar outro aviso de "Removido com sucesso"
        } catch (e) { console.error(e); }
    }
};