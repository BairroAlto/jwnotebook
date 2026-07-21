// components/updates/checker.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';

let db = null;
let auth = null;
let currentUserId = null;

// Corrige o caso da raiz "/" do servidor local e remove caminhos vazios
const pathSegment = window.location.pathname.split('/').pop();
const paginaAtual = (pathSegment === "" || !pathSegment) ? "index.html" : pathSegment;

// Lista de atualizações que o utilizador escolheu "Ver mais tarde" nesta sessão
const verMaisTardeIds = new Set();

export function iniciarVerificadorDeAtualizacoes() {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            vigiarColecaoUpdates();
        }
    });
}

function vigiarColecaoUpdates() {
    // Ordenamos por timestamp ascendente (do mais antigo para o mais recente)
    // para mostrar primeiro as atualizações mais antigas.
    const q = query(
        collection(db, "updates"),
        where("pagina", "==", paginaAtual),
        where("estado", "==", "ativo"),
        where("naovisto", "array-contains", currentUserId),
        orderBy("timestamp", "asc")
    );

    onSnapshot(q, (snapshot) => {
        // Filtramos apenas as atualizações que o utilizador ainda não adiou nesta sessão
        const elegiveis = snapshot.docs.filter(docSnap => !verMaisTardeIds.has(docSnap.id));
        const ativosNestaPaginaCont = elegiveis.length;

        // Mostrar apenas a primeira elegível (a mais antiga da lista)
        const proximoDoc = elegiveis[0] || null;

        if (proximoDoc) {
            // Se houver mais de 1 update ativo elegível restante para o utilizador, pinta com cor especial (#312e81)
            const corFinal = (ativosNestaPaginaCont > 1) ? "#312e81" : "#0f172a";
            exibirPopupAtualizacao(proximoDoc.id, proximoDoc.data(), corFinal);
        } else {
            // Fechar o popup existente se já não houver atualizações elegíveis
            const existente = document.getElementById('popup-update-alerta');
            if (existente) existente.remove();
        }
    });
}

function exibirPopupAtualizacao(docId, data, corSistema) {
    let existente = document.getElementById('popup-update-alerta');
    if (existente) existente.remove();

    const popup = document.createElement('div');
    popup.id = 'popup-update-alerta';
    popup.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(2, 6, 23, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        padding: 20px;
        box-sizing: border-box;
    `;

    let mediaHtml = "";
    if (data.imagem) {
        mediaHtml += `<img src="${data.imagem}" alt="Imagem de atualização" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.08);">`;
    }
    if (data.video) {
        const videoUrl = data.video.trim();
        let ytId = null;

        // Expressões Regulares para capturar ID de vídeos do YouTube
        const regExpLong = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = videoUrl.match(regExpLong);

        if (match && match[2].length === 11) {
            ytId = match[2];
        }

        if (ytId) {
            // Renderiza iframe do YouTube
            mediaHtml += `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.08);">
                <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
            </div>`;
        } else {
            // Link direto normal, renderiza tag video clássica
            mediaHtml += `<video src="${videoUrl}" controls style="width: 100%; max-height: 200px; border-radius: 8px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.08);"></video>`;
        }
    }

    // Usar a cor de decisão automática do sistema (ex: #312e81 se houver múltiplos ativos)
    const corFundoCard = corSistema || "#0f172a";

    popup.innerHTML = `
        <div style="background: ${corFundoCard}; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; max-width: 440px; width: 100%; max-height: calc(100vh - 40px); overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 15px; box-sizing: border-box; -webkit-overflow-scrolling: touch;">
            <div style="display: flex; align-items: center; gap: 10px; color: #f43f5e;">
                <i class="fa-solid fa-bullhorn fa-bounce" style="font-size: 18px; color: #fff;"></i>
                <h4 style="margin: 0; font-weight: 800; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; color: #fff;">${data.titulo || "Nova Atualização!"}</h4>
            </div>
            
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #cbd5e1; white-space: pre-wrap;">${data.texto}</p>
            
            ${mediaHtml}

            <div style="display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap;">
                <button id="btn-update-mais-tarde" style="flex: 1; min-width: 120px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; border-radius: 8px; padding: 12px 10px; font-weight: 700; cursor: pointer; font-size: 12px; transition: 0.2s;">
                    Ver mais tarde
                </button>
                <button id="btn-update-visto" style="flex: 1; min-width: 120px; background: #f43f5e; border: none; color: white; border-radius: 8px; padding: 12px 10px; font-weight: 800; cursor: pointer; font-size: 12px; transition: 0.2s; text-transform: uppercase; box-shadow: 0 4px 10px rgba(244,63,94,0.3);">
                    Visto
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Acção: Ver mais tarde (fecha na sessão atual sem marcar como lido no DB)
    popup.querySelector('#btn-update-mais-tarde').onclick = () => {
        verMaisTardeIds.add(docId);
        popup.remove();
        // O onSnapshot vai disparar novamente e o loop vai carregar o próximo elegível se houver
    };

    // Acção: Visto (remove de naovisto e adiciona em visto no DB)
    popup.querySelector('#btn-update-visto').onclick = async () => {
        popup.remove();
        try {
            const novosNaoVistos = (data.naovisto || []).filter(uid => uid !== currentUserId);
            const novoEstado = (novosNaoVistos.length === 0) ? "desativo" : "ativo";

            await updateDoc(doc(db, "updates", docId), {
                naovisto: arrayRemove(currentUserId),
                visto: arrayUnion(currentUserId),
                estado: novoEstado
            });
        } catch (e) {
            console.error("Erro ao marcar atualização como vista:", e);
        }
    };
}

// Inicializar imediatamente
iniciarVerificadorDeAtualizacoes();
