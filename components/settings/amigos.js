import {
    collection, addDoc, query, where, getDocs,
    doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let db, auth;
let unsubAmigos = null;
let unsubBadge = null;

export function inicializarAmigos(firestore, firebaseAuth) {
    db = firestore;
    auth = firebaseAuth;

    const btnConvidar = document.getElementById('btn-convidar-amigo');
    if (btnConvidar) btnConvidar.onclick = processarConvite;

    escutarListaAmigos();
    vigiarNotificacoesPedidos();
}

function vigiarNotificacoesPedidos() {
    if (unsubBadge) unsubBadge();
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const badge = document.getElementById('notificacao-amigos-badge');
    const q = query(
        collection(db, "Amigos"),
        where("destinatarioId", "==", uid),
        where("status", "==", "pendente")
    );

    unsubBadge = onSnapshot(q, (snapshot) => {
        if (!badge) return;
        badge.style.display = snapshot.empty ? "none" : "block";
    });
}

function escutarListaAmigos() {
    if (unsubAmigos) unsubAmigos();
    if (!auth.currentUser) return;

    const q = query(collection(db, "Amigos"), where("usuarios", "array-contains", auth.currentUser.uid));
    unsubAmigos = onSnapshot(q, (snapshot) => {
        const pendentesCont = document.getElementById('lista-amigos-pendentes');
        const confirmadosCont = document.getElementById('lista-amigos-confirmados');
        const seccaoPendentes = document.getElementById('seccao-pedidos-pendentes');
        if (!pendentesCont || !confirmadosCont) return;

        let htmlPendentes = "";
        let htmlConfirmados = "";
        let temPendentes = false;

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const idDoc = docSnap.id;
            const souDestinatario = d.destinatarioId === auth.currentUser.uid;

            if (d.status === "pendente") {
                if (souDestinatario) {
                    temPendentes = true;
                    htmlPendentes += criarItemUI(d.emailRemetente, idDoc, true);
                }
            } else if (d.status === "aceite") {
                const emailMostrar = d.remetenteId === auth.currentUser.uid ? d.emailDestinatario : d.emailRemetente;
                htmlConfirmados += criarItemUI(emailMostrar, idDoc, false);
            }
        });

        if (seccaoPendentes) seccaoPendentes.style.display = temPendentes ? "block" : "none";
        pendentesCont.innerHTML = htmlPendentes;
        confirmadosCont.innerHTML = htmlConfirmados || '<p style="color:gray; font-size:12px; text-align:center; padding:20px;">Nenhum amigo na lista.</p>';
        vincularAcoesAmigos();
    });
}

function criarItemUI(email, idDoc, isPendente) {
    return `
        <div class="menu-item-list" style="background: rgba(255,255,255,0.02); justify-content: space-between; margin-bottom: 5px;">
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                <i class="fa-solid fa-user" style="opacity:0.5; font-size:12px;"></i>
                <span style="font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${email}</span>
            </div>
            <div style="display:flex; gap:8px;">
                ${isPendente
                    ? `<button class="btn-aceitar-amigo" data-id="${idDoc}" style="background:#34d399; color:black; border:none; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800; cursor:pointer;">ACEITAR</button>`
                    : `<i class="fa-solid fa-trash-can btn-remover-amigo" data-id="${idDoc}" style="color:#f87171; cursor:pointer; padding:5px; font-size:12px;"></i>`
                }
            </div>
        </div>
    `;
}

function perguntarConfirmacaoRemocao(email) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-amigo-overlay');
        const btnSim = document.getElementById('btn-confirmar-amigo-rem');
        const btnNao = document.getElementById('btn-cancelar-amigo-rem');
        const texto = document.getElementById('texto-confirmar-amigo');

        if (!overlay || !btnSim || !btnNao || !texto) return resolve(confirm("Remover este amigo?"));

        texto.innerHTML = `Desejas remover <b>${email}</b> da tua lista de amigos?`;
        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

function vincularAcoesAmigos() {
    document.querySelectorAll('.btn-aceitar-amigo').forEach(btn => {
        btn.onclick = () => updateDoc(doc(db, "Amigos", btn.dataset.id), { status: "aceite" });
    });

    document.querySelectorAll('.btn-remover-amigo').forEach(btn => {
        btn.onclick = async () => {
            const idDoc = btn.dataset.id;
            const itemElemento = btn.closest('.menu-item-list');
            const email = itemElemento ? itemElemento.querySelector('span')?.innerText : "este amigo";
            const confirmou = await perguntarConfirmacaoRemocao(email);
            if (confirmou) await deleteDoc(doc(db, "Amigos", idDoc));
        };
    });
}

async function processarConvite() {
    const input = document.getElementById('input-amigo-email');
    const feedback = document.getElementById('msg-amigos-feedback');
    const emailAlvo = input?.value?.trim().toLowerCase();
    const meuUser = auth.currentUser;

    const showFeedback = (texto, cor = "var(--text-muted)") => {
        if (!feedback) {
            console.log(`[AMIGOS] ${texto}`);
            return;
        }
        feedback.innerText = texto;
        feedback.style.display = "block";
        feedback.style.color = cor;
    };
    const normalizarEmail = (valor) => (valor || "").trim().toLowerCase();

    if (!meuUser || !emailAlvo) return;
    if (emailAlvo === meuUser.email?.toLowerCase()) {
        showFeedback("NÃ£o podes convidar-te a ti mesmo.", "#ef4444");
        return;
    }

    showFeedback("A procurar utilizador...");

    try {
        const snapUser = await getDocs(collection(db, "users"));
        const docAmigo = snapUser.docs.find((userDoc) => {
            const dados = userDoc.data() || {};
            return normalizarEmail(dados.email) === emailAlvo;
        });

        if (!docAmigo) {
            showFeedback("Utilizador nÃ£o encontrado.", "#ef4444");
            return;
        }

        const dadosAmigo = docAmigo.data();
        const amigoUid = dadosAmigo.uid || dadosAmigo.id || docAmigo.id;

        const qExistente = query(collection(db, "Amigos"), where("usuarios", "array-contains", meuUser.uid));
        const snapExistente = await getDocs(qExistente);
        let jaExiste = false;
        snapExistente.forEach(d => {
            if ((d.data().usuarios || []).includes(amigoUid)) jaExiste = true;
        });

        if (jaExiste) {
            showFeedback("Pedido jÃ¡ enviado ou jÃ¡ sÃ£o amigos.", "#fbbf24");
            return;
        }

        await addDoc(collection(db, "Amigos"), {
            id: crypto.randomUUID(),
            usuarios: [meuUser.uid, amigoUid],
            remetenteId: meuUser.uid,
            destinatarioId: amigoUid,
            emailRemetente: meuUser.email,
            emailDestinatario: emailAlvo,
            status: "pendente",
            timestamp: serverTimestamp()
        });

        showFeedback("Pedido de amizade enviado!", "#34d399");
        if (input) input.value = "";
    } catch (e) {
        console.error(e);
        showFeedback("Erro ao processar convite.", "#ef4444");
    }
}
