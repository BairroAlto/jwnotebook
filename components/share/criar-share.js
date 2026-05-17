// components/share/criar-share.js
import { 
    collection, addDoc, getDocs, query, where, serverTimestamp, and 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';

export function inicializarCriacaoShare(db, auth) {
    const btnAddShare = document.getElementById('btn-add-share'); // O + na barra lateral Share
    const overlayOpcoes = document.getElementById('popup-criar-share-overlay');
    const btnFechar = document.getElementById('btn-fechar-popup-share');
    
    const btnCriarNota = document.getElementById('btn-criar-nota-share');
    const btnAbrirPastaForm = document.getElementById('btn-abrir-pasta-share');

    // Elementos do popup de nome (reutilizado do sistema Local)
    const popupNome = document.getElementById('popup-nome-pasta-overlay');
    const inputNome = document.getElementById('input-nome-pasta');
    const btnConfirmarPasta = document.getElementById('btn-confirmar-pasta');

    if (!btnAddShare) return;

    // 1. ABRIR POPUP DE OPÇÕES (Nota ou Pasta)
    btnAddShare.onclick = () => overlayOpcoes.classList.add('active');
    btnFechar.onclick = () => overlayOpcoes.classList.remove('active');

    // 2. LÓGICA PARA CRIAR NOTA
    btnCriarNota.onclick = async () => {
        if (!auth.currentUser) return;
        
        const uid = auth.currentUser.uid;
        const pastaPai = window.pastaShareAtual || "home";

        try {
            btnCriarNota.disabled = true;
            btnCriarNota.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A criar...';

            // CALCULAR ORDEM: Filtramos por userId para respeitar as Regras de Segurança
            const qOrdem = query(
                collection(db, "Share"), 
                and(
                    where("userId", "==", uid), 
                    where("onde", "==", "share"),
                    where(`${uid}.pastapai`, "==", pastaPai)
                )
            );
            const snapOrdem = await getDocs(qOrdem);
            const novaOrdem = snapOrdem.size + 1;

            const idBlocoInicial = crypto.randomUUID();
            const dadosNovaNota = {
                userId: uid,
                timestamp: serverTimestamp(),
                tipo: "nota",
                onde: "share", 
                estado: "ativo",
                nome: "Nova Nota Partilhada",
                aprovado: [],
                convidado: [],
                modo: ["normal"],
                vistoPor: [uid],
                caixas: [{
                    id: idBlocoInicial,
                    tipo: "contentor",
                    conteudo: "",
                    timestamp: new Date().toISOString(),
                    protecao: "fechado",
                    estado: "ativa",
                    ordem: 1
                }],
                // Localização e Ordem Privada
                [uid]: {
                    pastapai: pastaPai,
                    ordem: novaOrdem
                }
            };

            const docRef = await addDoc(collection(db, "Share"), dadosNovaNota);
            
            overlayOpcoes.classList.remove('active');
            abrirNotaNoEditor(docRef.id, dadosNovaNota, db, auth);

        } catch (e) {
            console.error("Erro ao criar nota no Share:", e);
        } finally {
            btnCriarNota.disabled = false;
            btnCriarNota.innerHTML = '<i class="fa-solid fa-note-sticky" style="color: #ef4444;"></i> Criar Nota';
        }
    };

    // 3. LÓGICA PARA ABRIR FORMULÁRIO DE PASTA
    btnAbrirPastaForm.onclick = () => {
        overlayOpcoes.classList.remove('active');
        popupNome.classList.add('active');
        inputNome.focus();
        // Sinalizamos ao botão global que estamos em modo Share
        btnConfirmarPasta.dataset.modo = "share";
    };

    // 4. LÓGICA DE CONFIRMAÇÃO DA PASTA
    btnConfirmarPasta.addEventListener('click', async () => {
        if (btnConfirmarPasta.dataset.modo !== "share") return;

        const nome = inputNome.value.trim();
        if (!nome || !auth.currentUser) return;
        
        const uid = auth.currentUser.uid;
        const pastaPai = window.pastaShareAtual || "home";

        btnConfirmarPasta.innerText = "A criar...";

        try {
            // CALCULAR ORDEM: Filtramos por userId para respeitar as Regras de Segurança
            const qOrdem = query(
                collection(db, "Share"), 
                and(
                    where("userId", "==", uid), 
                    where("onde", "==", "share"),
                    where(`${uid}.pastapai`, "==", pastaPai)
                )
            );
            const snapOrdem = await getDocs(qOrdem);
            const novaOrdem = snapOrdem.size + 1;

            const dadosNovaPasta = {
                userId: uid,
                timestamp: serverTimestamp(),
                tipo: "pasta",
                onde: "share",
                estado: "ativo",
                nome: nome,
                icon: "folder",
                pin: "nao",
                aprovado: [],
                // Localização e Ordem Privada
                [uid]: {
                    pastapai: pastaPai,
                    ordem: novaOrdem
                }
            };

            await addDoc(collection(db, "Share"), dadosNovaPasta);
            
            popupNome.classList.remove('active');
            inputNome.value = "";
            btnConfirmarPasta.innerText = "Criar Pasta";
            btnConfirmarPasta.dataset.modo = "local"; // Reset

        } catch (e) {
            console.error("Erro ao criar pasta no Share:", e);
            btnConfirmarPasta.innerText = "Criar Pasta";
        }
    });
}
