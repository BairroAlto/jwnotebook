import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from "../../firebase-config.js";
import { iniciarAutenticacao } from "../auth/auth.js";
import { criarGuardaDeAutenticacao } from "../auth/auth-guard.js";
import { migrarNotaParaShareCaixas } from "../share/share-caixas-repository.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const authStatus = document.getElementById("auth-status");
const status = document.getElementById("status");
const log = document.getElementById("log");
const progressBar = document.getElementById("progress-bar");
const btnAnalisar = document.getElementById("btn-analisar");
const btnMigrar = document.getElementById("btn-migrar");
let utilizador = null;
let snapshotShare = null;

function escrever(mensagem, classe = "") {
    log.className = classe;
    log.textContent += `\n${mensagem}`;
    log.scrollTop = log.scrollHeight;
}

async function carregarShare() {
    const q = query(collection(db, "Share"), where("userId", "==", utilizador.uid));
    snapshotShare = await getDocs(q);
    return snapshotShare;
}

async function analisar() {
    try {
        status.textContent = "A analisar a colecção Share...";
        log.textContent = "";
        const snap = await carregarShare();
        let notas = 0;
        let caixas = 0;
        snap.forEach(docSnap => {
            const dados = docSnap.data() || {};
            if (dados.tipo === "pasta") return;
            const total = Array.isArray(dados.caixas) ? dados.caixas.filter(c => c?.id).length : 0;
            if (total) notas++;
            caixas += total;
        });
        status.textContent = `${notas} notas com caixas antigas; ${caixas} caixas prontas para migrar.`;
        escrever(`Share lido: ${snap.size} documentos.`);
        escrever(`Notas com caixas antigas: ${notas}. Caixas: ${caixas}.`, "ok");
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
        const snap = snapshotShare || await carregarShare();
        const candidatos = snap.docs.filter(docSnap => {
            const dados = docSnap.data() || {};
            return dados.tipo !== "pasta" && Array.isArray(dados.caixas) && dados.caixas.some(c => c?.id);
        });
        let migradas = 0;
        for (let i = 0; i < candidatos.length; i++) {
            const resultado = await migrarNotaParaShareCaixas(db, candidatos[i]);
            migradas += resultado.caixas;
            progressBar.style.width = `${Math.round(((i + 1) / candidatos.length) * 100)}%`;
            status.textContent = `A migrar nota ${i + 1} de ${candidatos.length}... (${migradas} caixas)`;
            escrever(`Nota ${resultado.notaId}: ${resultado.caixas} caixas migradas.`);
        }
        progressBar.style.width = "100%";
        status.textContent = `Migração concluída: ${migradas} caixas em ${candidatos.length} notas.`;
        escrever("As caixas antigas foram mantidas em Share como cópia de segurança.", "ok");
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
