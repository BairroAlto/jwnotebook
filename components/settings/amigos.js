// components/settings/amigos.js
import { 
    getFirestore, collection, addDoc, query, where, getDocs, 
    doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let db, auth;
let unsubAmigos = null;
let unsubBadge = null;

export function inicializarAmigos(firestore, firebaseAuth) {
    db = firestore;
    auth = firebaseAuth;

    const btnConvidar = document.getElementById('btn-convidar-amigo');
    if (btnConvidar) {
        btnConvidar.onclick = processarConvite;
    }

    // 1. Escuta a lista para o painel interno (aceitar/remover)
    escutarListaAmigos();

    // 2. Escuta para o ponto vermelho no ícone do topo
    vigiarNotificacoesPedidos();
}

/**
 * VIGIA PEDIDOS PENDENTES PARA O PONTO VERMELHO NO TOPO
 */
function vigiarNotificacoesPedidos() {
    if (unsubBadge) unsubBadge();
    if (!auth.currentUser) {
        console.warn("⚠️ [NOTIFICAÇÕES] Não foi possível vigiar: utilizador não autenticado.");
        return;
    }

    const uid = auth.currentUser.uid;
    const badge = document.getElementById('notificacao-amigos-badge');

    console.log(`🕵️ [NOTIFICAÇÕES] A iniciar vigilância para o UID: ${uid}`);

    if (!badge) {
        console.error("❌ [NOTIFICAÇÕES] ERRO: Elemento HTML '#notificacao-amigos-badge' não encontrado no index.html!");
    }

    const q = query(
        collection(db, "Amigos"), 
        where("destinatarioId", "==", uid), 
        where("status", "==", "pendente")
    );

    unsubBadge = onSnapshot(q, (snapshot) => {
        console.log(`📡 [NOTIFICAÇÕES] O Firebase respondeu. Pedidos encontrados: ${snapshot.size}`);

        if (!badge) return;

        if (!snapshot.empty) {
            badge.style.display = "block";
            console.log("🔴 [NOTIFICAÇÕES] Badge ativado (display: block)");
            
            // Log extra para ver quem enviou
            snapshot.forEach(doc => {
                console.log(`✉️ Pedido pendente de: ${doc.data().emailRemetente}`);
            });
        } else {
            badge.style.display = "none";
            console.log("⚪ [NOTIFICAÇÕES] Badge escondido (display: none)");
        }
    }, (error) => {
        console.error("❌ [NOTIFICAÇÕES] Erro fatal no Firebase:", error);
    });
}

/**
 * ESCUTAR LISTA PARA A INTERFACE (PAINEL AMIGOS)
 */
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
                ${isPendente ? 
                    `<button class="btn-aceitar-amigo" data-id="${idDoc}" style="background:#34d399; color:black; border:none; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800; cursor:pointer;">ACEITAR</button>` 
                    : `<i class="fa-solid fa-trash-can btn-remover-amigo" data-id="${idDoc}" style="color:#f87171; cursor:pointer; padding:5px; font-size:12px;"></i>`
                }
            </div>
        </div>
    `;
}

/**
 * FUNÇÃO AUXILIAR: Abre o popup e espera pela resposta do utilizador
 */
function perguntarConfirmacaoRemocao(email) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-amigo-overlay');
        const btnSim = document.getElementById('btn-confirmar-amigo-rem');
        const btnNao = document.getElementById('btn-cancelar-amigo-rem');
        const texto = document.getElementById('texto-confirmar-amigo');

        if (!overlay) return resolve(confirm("Remover este amigo?")); // Fallback

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
    // Ação de Aceitar
    document.querySelectorAll('.btn-aceitar-amigo').forEach(btn => {
        btn.onclick = () => updateDoc(doc(db, "Amigos", btn.dataset.id), { status: "aceite" });
    });

    // Ação de Remover (Agora com o novo Popup)
    document.querySelectorAll('.btn-remover-amigo').forEach(btn => {
        btn.onclick = async () => {
            const idDoc = btn.dataset.id;
            const itemElemento = btn.closest('.menu-item-list');
            const email = itemElemento ? itemElemento.querySelector('span').innerText : "este amigo";

            // CHAMADA AO NOVO POPUP EM VEZ DE confirm()
            const confirmou = await perguntarConfirmacaoRemocao(email);
            
            if (confirmou) {
                console.log("🗑️ [SISTEMA] Removendo ligação:", idDoc);
                await deleteDoc(doc(db, "Amigos", idDoc));
            }
        };
    });
}

async function processarConvite() {
    const input = document.getElementById('input-amigo-email');
    const feedback = document.getElementById('msg-amigos-feedback');
    const emailAlvo = input.value.trim().toLowerCase();
    const meuUser = auth.currentUser;

    if (!meuUser || !emailAlvo) return;
    if (emailAlvo === meuUser.email?.toLowerCase()) {
        feedback.innerText = "Não podes convidar-te a ti mesmo.";
        feedback.style.display = "block";
        feedback.style.color = "#ef4444";
        return;
    }

    feedback.style.display = "block";
    feedback.style.color = "var(--text-muted)";
    feedback.innerText = "A procurar utilizador...";

    try {
        const qUser = query(collection(db, "users"), where("email", "==", emailAlvo));
        const snapUser = await getDocs(qUser);

        if (snapUser.empty) {
            feedback.innerText = "Utilizador não encontrado.";
            feedback.style.color = "#ef4444";
            return;
        }

        const docAmigo = snapUser.docs[0];
        const dadosAmigo = docAmigo.data();
        const amigoUid = dadosAmigo.uid || dadosAmigo.id || docAmigo.id;

        const qExistente = query(collection(db, "Amigos"), where("usuarios", "array-contains", meuUser.uid));
        const snapExistente = await getDocs(qExistente);
        
        let jaExiste = false;
        snapExistente.forEach(d => {
            if (d.data().usuarios.includes(amigoUid)) jaExiste = true;
        });

        if (jaExiste) {
            feedback.innerText = "Pedido já enviado ou já são amigos.";
            feedback.style.color = "#fbbf24";
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

        feedback.innerText = "Pedido de amizade enviado!";
        feedback.style.color = "#34d399";
        input.value = "";

    } catch (e) {
        console.error(e);
        feedback.innerText = "Erro ao processar convite.";
    }
}