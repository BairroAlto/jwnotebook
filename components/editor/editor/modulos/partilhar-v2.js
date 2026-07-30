// components/editor/modulos/partilhar-v2.js
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../../constants/ferramentas.js';

let db, auth;
let notaOriginal = null;
let amigoAlvo = null; // { id, email }
let modoFluxo = "amigo"; // "amigo" ou "rua"
let cacheProtecao = {}; // { idCaixa: "aberto" | "fechado" }
let unsubLinksPublicos = null;

/**
 * INICIALIZAÇÃO DO MÓDULO
 */
export function iniciarPartilhaV2(firestore, firebaseAuth) {
    db = firestore; 
    auth = firebaseAuth;
    configurarCliquesGlobais();
}

/**
 * 1. ABRIR POPUP PRINCIPAL
 */
export async function abrirPopupPartilharV2(nota) {
    notaOriginal = nota;
    cacheProtecao = {};
    
    const overlay = document.getElementById('popup-partilhar-v2-overlay');
    const listaAmigos = document.getElementById('lista-amigos-partilha');

    if (!overlay) return console.error("Popup V2 não encontrado no DOM.");

    overlay.classList.add('active');
    listaAmigos.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    // A) Iniciar vigilância de links públicos já existentes para esta nota
    escutarLinksPublicos(nota.id);

    // B) Carregar Lista de Amigos para o convite
    try {
        const uid = auth.currentUser.uid;
        const q = query(collection(db, "Amigos"), where("usuarios", "array-contains", uid), where("status", "==", "aceite"));
        const snap = await getDocs(q);

        listaAmigos.innerHTML = "";
        if (snap.empty) {
            listaAmigos.innerHTML = `<p style="color:gray; font-size:11px; text-align:center; padding:10px;">Nenhum amigo disponível para convite.</p>`;
        }

        snap.forEach(d => {
            const data = d.data();
            const amigoEmail = data.remetenteId === uid ? data.emailDestinatario : data.emailRemetente;
            const amigoId = data.remetenteId === uid ? data.destinatarioId : data.remetenteId;

            const div = document.createElement('div');
            div.className = "menu-item-list";
            div.style.cssText = "background: rgba(255,255,255,0.02); justify-content: space-between; margin-bottom: 5px;";
            div.innerHTML = `
                <span style="font-size:13px; color:white;">${amigoEmail}</span>
                <button style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; font-size:10px; font-weight:800; cursor:pointer;">CONVIDAR</button>
            `;
            div.querySelector('button').onclick = () => {
                modoFluxo = "amigo";
                abrirOpcoesConvite({ id: amigoId, email: amigoEmail });
            };
            listaAmigos.appendChild(div);
        });
    } catch (e) { console.error("Erro ao carregar amigos:", e); }
}

/**
 * 2. VIGIAR LINKS PÚBLICOS ATIVOS (RUA)
 */
function escutarLinksPublicos(noteId) {
    if (unsubLinksPublicos) unsubLinksPublicos();

    const container = document.getElementById('lista-links-publicos-ativos');
    if (!container) return;

    const q = query(collection(db, "RUA"), where("origemId", "==", noteId));

    unsubLinksPublicos = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        
        snapshot.forEach(docSnap => {
            const idDoc = docSnap.id;
            const url = `${window.location.origin}/shareout.html?id=${idDoc}`;

            const item = document.createElement('div');
            item.style.cssText = "display:flex; align-items:center; gap:10px; background:rgba(52, 211, 153, 0.05); padding:8px 12px; border-radius:6px; border: 1px solid rgba(52, 211, 153, 0.2); margin-bottom:5px;";
            item.innerHTML = `
                <i class="fa-solid fa-globe" style="color:#34d399; font-size:12px;"></i>
                <a href="${url}" target="_blank" style="flex:1; color:#34d399; font-size:11px; text-decoration:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:monospace;">${url}</a>
                <i class="fa-solid fa-trash-can btn-del-rua" style="color:#ef4444; cursor:pointer; font-size:12px; padding:5px;"></i>
            `;

            item.querySelector('.btn-del-rua').onclick = () => window.eliminarCopiaPublica(idDoc);
            container.appendChild(item);
        });
    });
}

/**
 * 3. ELIMINAR CÓPIA PÚBLICA (COLEÇÃO RUA)
 */
window.eliminarCopiaPublica = async (docId) => {
    // Chamamos o nosso popup personalizado em vez do confirm()
    const confirmou = await confirmarRemocaoLinkPublico();
    
    if (confirmou) {
        try {
            await deleteDoc(doc(db, "RUA", docId));
            console.log("✅ [SISTEMA] Link público removido da coleção RUA.");
        } catch (e) { 
            console.error("Erro ao apagar da RUA:", e); 
            alert("Erro ao remover link. Verifica a tua ligação.");
        }
    }
};

/**
 * 4. POPUP DE OPÇÕES (TUDO OU PERSONALIZAR)
 */
function abrirOpcoesConvite(amigo) {
    amigoAlvo = amigo;
    document.getElementById('nome-amigo-convite').innerText = amigo.email;
    document.getElementById('popup-opcoes-convite-overlay').classList.add('active');
}

/**
 * 5. POPUP DE PERSONALIZAÇÃO (LISTA DE CAIXAS COM TOGGLE)
 */
function abrirPersonalizacao() {
    const container = document.getElementById('lista-caixas-personalizar');
    container.innerHTML = "";
    
    notaOriginal.caixas.forEach(c => {
        if (c.estado !== "on") return;
        
        const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        cacheProtecao[c.id] = c.protecao; // Valor inicial da caixa

        const div = document.createElement('div');
        div.style.cssText = `display:flex; align-items:center; gap:15px; padding:12px; background:rgba(255,255,255,0.02); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${config.cor}`;
        div.innerHTML = `
            <div style="flex:1; overflow:hidden;">
                <p style="font-size:9px; color:${config.cor}; font-weight:800; text-transform:uppercase; margin-bottom:3px;">${config.nome}</p>
                <p style="font-size:12px; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.titulo || (c.conteudo ? c.conteudo.substring(0,60) : 'Sem título')}</p>
            </div>
            <label class="switch-container">
                <input type="checkbox" class="toggle-cache" data-id="${c.id}" ${c.protecao === 'aberto' ? 'checked' : ''}>
                <span class="switch-slider"></span>
            </label>
        `;
        
        div.querySelector('input').onchange = (e) => {
            cacheProtecao[c.id] = e.target.checked ? "aberto" : "fechado";
        };
        container.appendChild(div);
    });

    document.getElementById('popup-personalizar-partilha-overlay').classList.add('active');
}

/**
 * 6. MOTOR DE CLONAGEM FINAL (PROCESSO DE FILTRAGEM E ESCRITA)
 */
async function executarProcessoFinal() {
    const btn = document.getElementById('btn-finalizar-clonagem');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A processar...';
    btn.disabled = true;

    try {
        // --- FILTRAGEM ESTREITA (Lógica 1 a 7 do pedido) ---
        const caixasClonadas = notaOriginal.caixas
            .filter(c => c.estado === "on" && cacheProtecao[c.id] === "aberto")
            .map(c => {
                // Campos a excluir (Lógica 3, 4, 5) + Bloqueios de escrita
                const { associados, neuroniosCosmos, vincTopicos, bloqueio, ...limpo } = c;
                
                const base = {
                    ...limpo,
                    fora: "partilhado" // Lógica 7
                };

                // Manter integridade de ferramentas específicas
                if (c.tipo === "elevador") base.pastapai = c.pastapai || [];
                if (c.tipo === "cartaovisita") { base.url = c.url; base.urldimensao = c.urldimensao; }
                
                return base;
            });

        if (caixasClonadas.length === 0) {
            alert("Não podes partilhar uma nota sem caixas desbloqueadas.");
            btn.innerHTML = "Confirmar Envio";
            btn.disabled = false;
            return;
        }

        // --- PREPARAÇÃO DO OBJETO FINAL ---
        const dadosClonados = {
            nome: notaOriginal.nome,
            modo: notaOriginal.modo || "normal",
            tipo: "nota",
            caixas: caixasClonadas,
            timestamp: serverTimestamp(),
            origemId: notaOriginal.id,
            userId: auth.currentUser.uid
        };

        if (modoFluxo === "amigo") {
            // Lógica 8: Dados de transferência para Amigos
            dadosClonados.userOriginal = auth.currentUser.email;
            dadosClonados.userConvidado = amigoAlvo.id;
            
            await addDoc(collection(db, "OUT"), dadosClonados);
        } 
        else {
            // MODO RUA (Link Público)
            await addDoc(collection(db, "RUA"), dadosClonados);
        }
        
        // Fechar todos os popups de partilha
        document.querySelectorAll('.popup-overlay').forEach(p => {
            if (p.id.includes('partilhar') || p.id.includes('convite') || p.id.includes('personalizar')) {
                p.classList.remove('active');
            }
        });

    } catch (e) {
        console.error("Erro crítico na clonagem:", e);
        alert("Erro ao processar partilha.");
    } finally {
        btn.innerHTML = "Confirmar Envio";
        btn.disabled = false;
    }
}

/**
 * 7. GESTÃO DE CLIQUES GLOBAIS
 */
function configurarCliquesGlobais() {
    const fecharPopups = () => {
        document.getElementById('popup-partilhar-v2-overlay').classList.remove('active');
        document.getElementById('popup-opcoes-convite-overlay').classList.remove('active');
        document.getElementById('popup-personalizar-partilha-overlay').classList.remove('active');
    };

    const btnFechar = document.getElementById('btn-fechar-partilhar-v2');
    if (btnFechar) btnFechar.onclick = fecharPopups;

    const btnGerarRua = document.getElementById('btn-gerar-link-rua');
    if (btnGerarRua) {
        btnGerarRua.onclick = () => {
            modoFluxo = "rua";
            abrirOpcoesConvite({ email: "Link Público", id: "PUBLIC" });
        };
    }

    const btnConviteTotal = document.getElementById('btn-convite-total');
    if (btnConviteTotal) {
        btnConviteTotal.onclick = () => {
            notaOriginal.caixas.forEach(c => cacheProtecao[c.id] = "aberto");
            executarProcessoFinal();
        };
    }

    const btnConvitePerso = document.getElementById('btn-convite-personalizar');
    if (btnConvitePerso) {
        btnConvitePerso.onclick = () => {
            document.getElementById('popup-opcoes-convite-overlay').classList.remove('active');
            abrirPersonalizacao();
        };
    }

    const btnCancelarPerso = document.getElementById('btn-cancelar-personalizacao');
    if (btnCancelarPerso) btnCancelarPerso.onclick = fecharPopups;

    const btnFinalizar = document.getElementById('btn-finalizar-clonagem');
    if (btnFinalizar) btnFinalizar.onclick = executarProcessoFinal;
}


/**
 * PROMISE: Abre o popup de confirmação e aguarda resposta
 */
function confirmarRemocaoLinkPublico() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-remover-overlay');
        const btnSim = document.getElementById('btn-confirmar-remover-final');
        const btnNao = document.getElementById('btn-cancelar-remover');
        
        // --- A SOLUÇÃO: FORÇAR PARA A FRENTE ---
        overlay.style.zIndex = "11000"; 

        // Personalizar o texto
        overlay.querySelector('h3').innerText = "Desativar Link?";
        overlay.querySelector('p').innerText = "Este link deixará de funcionar e ninguém poderá visualizar esta nota publicamente.";
        btnSim.innerText = "Sim, Desativar";

        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            
            // Resetar o z-index ao fechar para não quebrar outros usos do popup
            setTimeout(() => { overlay.style.zIndex = "9999"; }, 200);
            
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}