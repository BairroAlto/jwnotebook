import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../../firebase-config.js";
import { iniciarAutenticacao } from "../biblioteca-brain/auth/auth.js";
import { criarGuardaDeAutenticacao } from "../biblioteca-brain/auth/auth-guard.js";
import { migrarNotaParaLocalCaixas } from "../local/caixas-repository.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = (await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js")).getFirestore(app);
const authStatus = document.getElementById("auth-status");
const status = document.getElementById("status");
const log = document.getElementById("log");
const progressBar = document.getElementById("progress-bar");
const btnAnalisar = document.getElementById("btn-analisar");
const btnMigrar = document.getElementById("btn-migrar");
let utilizador = null;
let snapshotLocal = null;

function escrever(mensagem, classe = "") {
    log.className = classe;
    log.textContent += `\n${mensagem}`;
    log.scrollTop = log.scrollHeight;
}

async function carregarLocal() {
    const q = query(collection(db, "Local"), where("userId", "==", utilizador.uid));
    snapshotLocal = await getDocs(q);
    return snapshotLocal;
}

async function analisar() {
    try {
        status.textContent = "A analisar a coleção Local...";
        log.textContent = "";
        const snap = await carregarLocal();
        let notas = 0;
        let caixas = 0;
        snap.forEach(docSnap => {
            const dados = docSnap.data() || {};
            if (dados.tipo === "pasta") return;
            const total = Array.isArray(dados.caixas) ? dados.caixas.filter(c => c?.id).length : 0;
            if (total) notas++;
            caixas += total;
        });
        status.textContent = `${notas} notas com caixas; ${caixas} caixas prontas para migrar.`;
        escrever(`Local lido: ${snap.size} documentos.`);
        escrever(`Notas com caixas: ${notas}. Caixas: ${caixas}.`, "ok");
    } catch (erro) {
        status.textContent = "Não foi possível analisar os dados.";
        escrever(erro.message || String(erro), "error");
    }
}

async function migrar() {
    btnAnalisar.disabled = true;
    btnMigrar.disabled = true;
    progressBar.style.width = "0%";
    log.textContent = "";
    try {
        const snap = snapshotLocal || await carregarLocal();
        const candidatos = snap.docs.filter(docSnap => {
            const dados = docSnap.data() || {};
            return dados.tipo !== "pasta" && Array.isArray(dados.caixas) && dados.caixas.some(c => c?.id);
        });
        let totalCaixas = 0;
        for (const docSnap of candidatos) totalCaixas += (docSnap.data().caixas || []).filter(c => c?.id).length;

        let migradas = 0;
        for (let i = 0; i < candidatos.length; i++) {
            const resultado = await migrarNotaParaLocalCaixas(db, utilizador.uid, candidatos[i]);
            migradas += resultado.caixas;
            progressBar.style.width = `${Math.round(((i + 1) / candidatos.length) * 100)}%`;
            status.textContent = `A migrar nota ${i + 1} de ${candidatos.length}... (${migradas}/${totalCaixas} caixas)`;
            escrever(`Nota ${resultado.notaId}: ${resultado.caixas} caixas migradas.`);
        }
        progressBar.style.width = "100%";
        status.textContent = `Migração concluída: ${migradas} caixas em ${candidatos.length} notas.`;
        escrever("As caixas antigas foram mantidas em Local como cópia de segurança.", "ok");
    } catch (erro) {
        status.textContent = "A migração foi interrompida.";
        escrever(erro.message || String(erro), "error");
    } finally {
        btnAnalisar.disabled = false;
        btnMigrar.disabled = false;
    }
}

btnAnalisar.onclick = analisar;
btnMigrar.onclick = migrar;
iniciarAutenticacao(app, db);
criarGuardaDeAutenticacao({ auth, protectedSelector: 'main', hideProtected: false });
onAuthStateChanged(auth, user => {
    utilizador = user;
    if (!user) {
        authStatus.textContent = "Inicia sessão no NotaBook para continuar.";
        btnAnalisar.disabled = true;
        btnMigrar.disabled = true;
        return;
    }
    authStatus.textContent = `Sessão activa: ${user.email || user.uid}`;
    btnAnalisar.disabled = false;
    btnMigrar.disabled = false;
    log.textContent = "Sessão validada. Analisa os dados antes de migrar.";
});
