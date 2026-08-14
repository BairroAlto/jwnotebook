import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../../firebase-config.js";
import { iniciarAutenticacao } from "../auth/auth.js";
import { criarGuardaDeAutenticacao } from "../auth/auth-guard.js";
import { migrarNotaParaLocalCaixas } from "../local/caixas-repository.js";
import { migrarNotaParaShareCaixas } from "../share/share-caixas-repository.js";
import { migrarPalcoParaPalcoCaixas } from "../palco/palco-caixas-repository.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = (await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js")).getFirestore(app);
const authStatus = document.getElementById("auth-status");
const status = document.getElementById("status");
const log = document.getElementById("log");
const progressBar = document.getElementById("progress-bar");
const btnMigrar = document.getElementById("btn-migrar");
let utilizador = null;

function escrever(mensagem, classe = "") {
    log.className = classe;
    log.textContent += `\n${mensagem}`;
    log.scrollTop = log.scrollHeight;
}

function obterCaixas(dados = {}) {
    return Array.isArray(dados.caixas) ? dados.caixas.filter(caixa => caixa?.id) : [];
}

async function verificarExterna(colecao, campoPai, notaId, ids) {
    const falhas = [];
    for (const id of ids) {
        const snap = await getDoc(doc(db, colecao, String(id)));
        const dados = snap.exists() ? snap.data() : null;
        if (!dados || String(dados[campoPai]) !== String(notaId)) falhas.push(String(id));
    }
    return falhas;
}

async function carregarNotas(colecao) {
    return getDocs(query(collection(db, colecao), where("userId", "==", utilizador.uid)));
}

async function migrarColecao({ nome, snapshot, migrar, caixasColecao, campoPai, inicio, total }) {
    let notas = 0;
    let caixas = 0;
    let falhas = 0;

    for (const [indice, docSnap] of snapshot.docs.entries()) {
        const dados = docSnap.data() || {};
        const caixasDaNota = obterCaixas(dados);
        if (dados.tipo === "pasta" || !caixasDaNota.length) continue;

        const resultado = await migrar(db, utilizador.uid, docSnap);
        const ids = resultado.ids || caixasDaNota.map(caixa => String(caixa.id));
        const problemas = await verificarExterna(caixasColecao, campoPai, docSnap.id, ids);
        notas += 1;
        caixas += resultado.caixas || 0;
        falhas += problemas.length;

        const percentagem = Math.round(((inicio + indice + 1) / total) * 100);
        progressBar.style.width = `${percentagem}%`;
        status.textContent = `${nome}: nota ${indice + 1} de ${snapshot.size}...`;
        escrever(`${nome} ${docSnap.id}: ${resultado.caixas || 0} caixas; verificação ${problemas.length ? `FALHOU (${problemas.join(", ")})` : "OK"}.`, problemas.length ? "error" : "");
    }

    return { notas, caixas, falhas };
}

async function migrarTudo() {
    btnMigrar.disabled = true;
    progressBar.style.width = "0%";
    log.textContent = "";

    try {
        const [local, share, palco] = await Promise.all([carregarNotas("Local"), carregarNotas("Share"), carregarNotas("Palco")]);
        const total = Math.max(1, local.size + share.size + palco.size);
        escrever(`Local: ${local.size} documentos encontrados.`);
        escrever(`Share: ${share.size} documentos encontrados.`);
        escrever(`Palco: ${palco.size} documentos encontrados.`);

        const resultadoLocal = await migrarColecao({
            nome: "Local",
            snapshot: local,
            migrar: (firestore, uid, docSnap) => migrarNotaParaLocalCaixas(firestore, uid, docSnap),
            caixasColecao: "LocalCaixas",
            campoPai: "localDocId",
            inicio: 0,
            total
        });
        const resultadoShare = await migrarColecao({
            nome: "Share",
            snapshot: share,
            migrar: (firestore, uid, docSnap) => migrarNotaParaShareCaixas(firestore, docSnap),
            caixasColecao: "ShareCaixas",
            campoPai: "shareId",
            inicio: local.size,
            total
        });

        const resultadoPalco = await migrarColecao({
            nome: "Palco",
            snapshot: palco,
            migrar: (firestore, uid, docSnap) => migrarPalcoParaPalcoCaixas(firestore, uid, docSnap),
            caixasColecao: "PalcoCaixas",
            campoPai: "palcoId",
            inicio: local.size + share.size,
            total
        });
        const falhas = resultadoLocal.falhas + resultadoShare.falhas + resultadoPalco.falhas;
        progressBar.style.width = "100%";
        status.textContent = falhas ? `Concluído com ${falhas} falhas de verificação.` : "Migração e verificação concluídas.";
        escrever(`Total Local: ${resultadoLocal.notas} notas e ${resultadoLocal.caixas} caixas.`, "ok");
        escrever(`Total Share: ${resultadoShare.notas} notas e ${resultadoShare.caixas} caixas.`, "ok");
        escrever(`Total Palco: ${resultadoPalco.notas} registos e ${resultadoPalco.caixas} caixas.`, "ok");
        escrever(falhas ? "Corrige as falhas indicadas e executa novamente." : "Tudo pronto. A abertura normal das notas não precisa de consultar cada caixa.", falhas ? "error" : "ok");
    } catch (erro) {
        status.textContent = "A migração foi interrompida.";
        escrever(erro.message || String(erro), "error");
    } finally {
        btnMigrar.disabled = false;
    }
}

btnMigrar.onclick = migrarTudo;
iniciarAutenticacao(app, db);
criarGuardaDeAutenticacao({ auth, protectedSelector: 'main', hideProtected: false });
onAuthStateChanged(auth, user => {
    utilizador = user;
    if (!user) {
        authStatus.textContent = "Inicia sessão no NotaBook para continuar.";
        btnMigrar.disabled = true;
        return;
    }
    authStatus.textContent = `Sessão activa: ${user.email || user.uid}`;
    btnMigrar.disabled = false;
    log.textContent = "Sessão validada. Clica para migrar e verificar tudo.";
});
