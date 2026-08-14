// components/share/criar-share.js
import { 
    collection, addDoc, getDocs, query, where, serverTimestamp, and, writeBatch, doc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirNotaNoEditor } from '../editor/editor.js';
import { guardarCaixasShareDaNota } from './share-caixas-repository.js';

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

    // 1. ABRIR POPUP DE OPÃ‡Ã•ES (Nota ou Pasta)
    btnAddShare.onclick = () => overlayOpcoes.classList.add('active');
    btnFechar.onclick = () => overlayOpcoes.classList.remove('active');

    // 2. LÃ“GICA PARA CRIAR NOTA
    btnCriarNota.onclick = async () => {
        if (!auth.currentUser) return;
        
        const uid = auth.currentUser.uid;
        const pastaPai = window.pastaShareAtual || "home";

        try {
            btnCriarNota.disabled = true;
            btnCriarNota.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A criar...';

            // CALCULAR ORDEM: Filtramos por userId para respeitar as Regras de SeguranÃ§a
            const qOrdem = query(
                collection(db, "Share"), 
                and(
                    where("userId", "==", uid), 
                    where("onde", "==", "share"),
                    where(`${uid}.pastapai`, "==", pastaPai)
                )
            );
            const snapOrdem = await getDocs(qOrdem);
            const novaOrdem = 1;

            if (!snapOrdem.empty) {
                const batch = writeBatch(db);
                snapOrdem.forEach(item => {
                    const ordemAtual = item.data()?.[uid]?.ordem || 0;
                    batch.update(doc(db, "Share", item.id), {
                        [`${uid}.ordem`]: ordemAtual + 1
                    });
                });
                await batch.commit();
            }

            const idBlocoInicial = crypto.randomUUID();
            const dadosNovaNota = {
                userId: uid,
                timestamp: serverTimestamp(),
                tipo: "nota",
                onde: "share", 
                estado: "on",
                nome: "Nova Nota Partilhada",
                aprovado: [],
                convidado: [],
                modo: ["normal"],
                vistoPor: [uid],

                // LocalizaÃ§Ã£o e Ordem Privada
                [uid]: {
                    pastapai: pastaPai,
                    ordem: novaOrdem
                }
            };

            const docRef = await addDoc(collection(db, "Share"), dadosNovaNota);
            await guardarCaixasShareDaNota({
                db,
                ownerId: uid,
                notaId: docRef.id,
                caixas: [{
                    id: idBlocoInicial,
                    tipo: "contentor",
                    conteudo: "",
                    timestamp: new Date().toISOString(),
                    protecao: "fechado",
                    estado: "on",
                    ordem: 1
                }],
                removerLegacy: true
            });
            
            dadosNovaNota.CaixasOut = [idBlocoInicial];
            dadosNovaNota.caixaIds = [idBlocoInicial];
            dadosNovaNota.caixasMigradas = true;
            dadosNovaNota.caixas = [{ id: idBlocoInicial, tipo: "contentor", conteudo: "", timestamp: new Date().toISOString(), protecao: "fechado", estado: "on", ordem: 1 }];

            overlayOpcoes.classList.remove('active');
            abrirNotaNoEditor(docRef.id, dadosNovaNota, db, auth);

        } catch (e) {
            console.error("Erro ao criar nota no Share:", e);
        } finally {
            btnCriarNota.disabled = false;
            btnCriarNota.innerHTML = '<i class="fa-solid fa-note-sticky" style="color: #ef4444;"></i> Criar Nota';
        }
    };

    // 3. LÃ“GICA PARA ABRIR FORMULÃRIO DE PASTA
    btnAbrirPastaForm.onclick = () => {
        overlayOpcoes.classList.remove('active');
        popupNome.classList.add('active');
        inputNome.focus();
        // Sinalizamos ao botÃ£o global que estamos em modo Share
        btnConfirmarPasta.dataset.modo = "share";
    };

    // 4. LÃ“GICA DE CONFIRMAÃ‡ÃƒO DA PASTA
    btnConfirmarPasta.addEventListener('click', async () => {
        if (btnConfirmarPasta.dataset.modo !== "share") return;

        const nome = inputNome.value.trim();
        if (!nome || !auth.currentUser) return;
        
        const uid = auth.currentUser.uid;
        const pastaPai = window.pastaShareAtual || "home";

        btnConfirmarPasta.innerText = "A criar...";

        try {
            // CALCULAR ORDEM: Filtramos por userId para respeitar as Regras de SeguranÃ§a
            const qOrdem = query(
                collection(db, "Share"), 
                and(
                    where("userId", "==", uid), 
                    where("onde", "==", "share"),
                    where(`${uid}.pastapai`, "==", pastaPai)
                )
            );
            const snapOrdem = await getDocs(qOrdem);
            const novaOrdem = 1;

            if (!snapOrdem.empty) {
                const batch = writeBatch(db);
                snapOrdem.forEach(item => {
                    const ordemAtual = item.data()?.[uid]?.ordem || 0;
                    batch.update(doc(db, "Share", item.id), {
                        [`${uid}.ordem`]: ordemAtual + 1
                    });
                });
                await batch.commit();
            }

            const dadosNovaPasta = {
                userId: uid,
                timestamp: serverTimestamp(),
                tipo: "pasta",
                onde: "share",
                estado: "on",
                nome: nome,
                icon: "folder",
                pin: "nao",
                aprovado: [],
                // LocalizaÃ§Ã£o e Ordem Privada
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