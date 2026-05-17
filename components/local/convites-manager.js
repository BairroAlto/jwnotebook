// components/local/convites-manager.js
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp, getDocs, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { pedirPastaDestino } from './local-tree-mover.js';

export function vigiarConvitesEntrada(db, auth) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "OUT"), where("userConvidado", "==", uid));

    onSnapshot(q, (snapshot) => {
        document.querySelectorAll('.card-convite-entrada').forEach(el => el.remove());

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const idDoc = docSnap.id;
            const card = document.createElement('div');
            card.className = "card-convite-entrada";
            card.style.cssText = "background: rgba(99, 102, 241, 0.1); border: 1px solid var(--primary); padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid var(--primary);";
            card.innerHTML = `
                <p style="font-size:10px; font-weight:800; color:var(--primary); text-transform:uppercase; margin-bottom:5px;">Convite Recebido</p>
                <p style="font-size:12px; color:white; margin-bottom:10px;"><b>${data.userOriginal.split('@')[0]}</b> enviou "${data.nome}"</p>
                <div style="display:flex; gap:8px;">
                    <button class="btn-aceitar" style="flex:1; background:var(--primary); color:white; border:none; padding:8px; border-radius:4px; font-size:10px; font-weight:800; cursor:pointer;">ACEITAR</button>
                    <button class="btn-rejeitar" style="flex:1; background:transparent; border:1px solid #ef4444; color:#ef4444; padding:8px; border-radius:4px; font-size:10px; cursor:pointer;">REJEITAR</button>
                </div>`;

            card.querySelector('.btn-rejeitar').onclick = () => deleteDoc(doc(db, "OUT", idDoc));
            card.querySelector('.btn-aceitar').onclick = () => processarFluxoAceitacao(idDoc, data, db, auth);

            document.getElementById('lista-local').prepend(card);
        });
    });
}

/**
 * FLUXO COMPLETO: Escolher Pasta -> Clonar -> Integrar Bíblia -> Limpar OUT
 */
async function processarFluxoAceitacao(idOut, data, db, auth) {
    // 1. Abrir popup de árvore e esperar que o user escolha a pasta
    const idPastaDestino = await pedirPastaDestino();
    if (!idPastaDestino) return; // User cancelou

    try {
        console.log("📂 Destino escolhido:", idPastaDestino);

        // 2. Preparar objeto para Local (ID novo é gerado automaticamente pelo addDoc)
        const novaNota = {
            ...data,
            userId: auth.currentUser.uid,
            pastapai: idPastaDestino,
            timestamp: serverTimestamp(),
            onde: "local",
            estado: "ativa",
            ordem: 1
        };

        // Limpar metadados de transferência
        delete novaNota.userConvidado;
        delete novaNota.userConvidadoEmail;
        delete novaNota.userOriginal;
        delete novaNota.statusConvite;

        // 3. Gravar no Firebase (Criação da cópia local)
        const docRef = await addDoc(collection(db, "Local"), novaNota);
        const novoIdNota = docRef.id;

        // 4. Lógica de Integração de Textos Bíblicos (NeuroniosBiba)
        for (const c of (novaNota.caixas || [])) {
            if (c.neuroniosBiba && c.neuroniosBiba.length > 0) {
                for (const nomeTexto of c.neuroniosBiba) {
                    await vincularAoBrainDoDestinatario(nomeTexto, novoIdNota, c.id, db, auth);
                }
            }
        }

        // 5. Eliminar ficheiro do OUT (Missão cumprida)
        await deleteDoc(doc(db, "OUT", idOut));
        console.log("✅ Nota clonada e integrada com sucesso.");

    } catch (e) {
        console.error("Erro no processo de aceitação:", e);
    }
}

/**
 * Verifica se o user já tem o texto bíblico no Brain e integra, ou cria novo.
 */
async function vincularAoBrainDoDestinatario(nomeTexto, notaId, caixaId, db, auth) {
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nomeTexto));
    const snap = await getDocs(q);

    const agora = new Date().toISOString();
    const itemCaixa = { id: caixaId, timestamp: agora };

    if (!snap.empty) {
        // JÁ TEM: Adiciona aos arrays Dossie.Apto e caixas
        const refDoc = snap.docs[0].ref;
        await updateDoc(refDoc, {
            "Dossie.Apto": arrayUnion(caixaId),
            "caixas": arrayUnion(itemCaixa)
        });
    } else {
        // NÃO TEM: Criar registo novo para o utilizador
        // Extraímos livro/cap/ver do nome (ex: "Jó 1:1")
        const [livro, coords] = nomeTexto.split(' ');
        const [cap, ver] = coords.split(':');

        await addDoc(collection(db, "TextosBiblia"), {
            id: crypto.randomUUID(),
            nome: nomeTexto,
            livro, capitulo: cap, versiculo: ver,
            userId: uid,
            estado: "ativo",
            tipo: "textobiblico",
            timestamp: serverTimestamp(),
            caixas: [itemCaixa],
            Dossie: { Apto: [caixaId], mica: {} },
            Puzzle: { quadros: [] }
        });
    }
}