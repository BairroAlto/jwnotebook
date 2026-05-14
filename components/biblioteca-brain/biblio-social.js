import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function buscarRespostasDaRede(estudoAtivo, container) {
    const db = getFirestore();
    const meuUid = window.auth.currentUser.uid;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i><p style="font-size:10px; margin-top:10px;">A PROCURAR RESPOSTAS DE AMIGOS...</p></div>`;

    try {
        // 1. BUSCAR AMIGOS ACEITES
        const qAmigos = query(collection(db, "Amigos"), where("usuarios", "array-contains", meuUid), where("status", "==", "aceite"));
        const snapAmigos = await getDocs(qAmigos);
        
        if (snapAmigos.empty) {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; font-size:11px;">Ainda não tens amigos na rede para ver comentários.</p>`;
            return;
        }

        const idsAmigos = [];
        snapAmigos.forEach(d => {
            const ids = d.data().usuarios;
            idsAmigos.push(ids.find(id => id !== meuUid));
        });

        // 2. FILTRAR AMIGOS COM "PARTILHA ATIVA"
        const amigosAutorizados = [];
        for (const idAmigo of idsAmigos) {
            const pSnap = await getDoc(doc(db, "Partilharcom", idAmigo));
            if (pSnap.exists() && pSnap.data().shareAnswers === true) {
                amigosAutorizados.push(idAmigo);
            }
        }

        if (amigosAutorizados.length === 0) {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; font-size:11px;">Nenhum dos teus amigos ativou a Rede de Respostas.</p>`;
            return;
        }

        // 3. BUSCAR ANOTAÇÕES DESSES AMIGOS NESTE ESTADO
        // Filtramos por referência e os UIDs autorizados
        const qEstudos = query(
            collection(db, "Biblioteca"), 
            where("userId", "in", amigosAutorizados),
            where("referencia", "==", estudoAtivo.referencia),
            where("sequencia", "==", estudoAtivo.sequencia)
        );

        const snapEstudos = await getDocs(qEstudos);
        container.innerHTML = "";

        if (snapEstudos.empty) {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; font-size:11px;">Nenhum amigo comentou este parágrafo ainda.</p>`;
            return;
        }

        for (const docEstudo of snapEstudos.docs) {
            const data = docEstudo.data();
            const caixa = data.anotacaoEspecial;
            if (!caixa || !caixa.conteudo || caixa.estado === "desativo") continue;

            // Buscar nome do autor
            const userSnap = await getDoc(doc(db, "users", data.userId));
            const nomeAutor = userSnap.exists() ? (userSnap.data().email.split('@')[0]) : "Amigo";

            const card = document.createElement('div');
            card.style.cssText = `background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 10px; padding: 15px; margin-bottom: 12px; border-left: 4px solid var(--primary);`;
            
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:10px; font-weight:800; color:var(--primary); text-transform:uppercase;">
                        <i class="fa-solid fa-user"></i> ${nomeAutor}
                    </span>
                    <span style="font-size:9px; color:gray;">${data.referencia} §${data.sequencia}</span>
                </div>
                <div style="color:white; font-size:13px; line-height:1.5;">
                    ${caixa.titulo ? `<b style="display:block; margin-bottom:5px;">${caixa.titulo}</b>` : ''}
                    <p style="opacity:0.8; white-space:pre-wrap; margin:0;">${caixa.conteudo}</p>
                </div>
            `;
            container.appendChild(card);
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = "Erro ao carrerar rede social.";
    }
}

export async function verificarNovidadesSociais(estudoAtivo) {
    const db = getFirestore();
    const meuUid = window.auth.currentUser.uid;

    try {
        // 1. BUSCAR AMIGOS ACEITES
        const qAmigos = query(collection(db, "Amigos"), where("usuarios", "array-contains", meuUid), where("status", "==", "aceite"));
        const snapAmigos = await getDocs(qAmigos);
        if (snapAmigos.empty) return false;

        const idsAmigos = [];
        snapAmigos.forEach(d => {
            const ids = d.data().usuarios;
            idsAmigos.push(ids.find(id => id !== meuUid));
        });

        // 2. FILTRAR AMIGOS COM PARTILHA ATIVA
        const amigosAutorizados = [];
        for (const idAmigo of idsAmigos) {
            const pSnap = await getDoc(doc(db, "Partilharcom", idAmigo));
            if (pSnap.exists() && pSnap.data().shareAnswers === true) {
                amigosAutorizados.push(idAmigo);
            }
        }
        if (amigosAutorizados.length === 0) return false;

        // 3. CONSULTA RÁPIDA NA BIBLIOTECA
        const qCheck = query(
            collection(db, "Biblioteca"), 
            where("userId", "in", amigosAutorizados),
            where("referencia", "==", estudoAtivo.referencia),
            where("sequencia", "==", estudoAtivo.sequencia)
        );

        const snapCheck = await getDocs(qCheck);
        
        // Verifica se pelo menos um tem conteúdo real
        let existeAlgum = false;
        snapCheck.forEach(docEstudo => {
            const caixa = docEstudo.data().anotacaoEspecial;
            if (caixa && caixa.conteudo && caixa.estado !== "desativo") {
                existeAlgum = true;
            }
        });

        return existeAlgum;

    } catch (e) {
        console.error("Erro na verificação de radar social:", e);
        return false;
    }
}