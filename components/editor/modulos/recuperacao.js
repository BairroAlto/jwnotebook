// components/editor/modulos/recuperacao.js
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { IDENTIDADE_FERRAMENTAS } from '../../constants/ferramentas.js';
import { perguntarRestauroBackup } from './tags/tags-utils.js';
import { SyncLogic } from './sync-logic.js';

let arrayCaixas = [];
let notaOrigemDados = null;
let notaOrigemId = null;
let dbRef = null;
let authRef = null;
let callbackAtualizarEditor = null;

// Função auxiliar para formatar a data de criação
function formatarDataCompleta(dataFirebase) {
    if (!dataFirebase) return "Data desconhecida";
    let data = dataFirebase.toDate ? dataFirebase.toDate() : new Date(dataFirebase);
    return data.toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function iniciarSistemaRecuperacao(db, auth) {
    dbRef = db; authRef = auth;
    document.getElementById('btn-fechar-restaurar').onclick = () => document.getElementById('popup-restaurar-overlay').classList.remove('active');
    document.querySelectorAll('.tab-restaurar').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.tab-restaurar').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.restaurar-tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(tab.getAttribute('data-target')).style.display = 'block';
        };
    });
}

export async function abrirCentroRecuperacao(caixas, dadosNota, idNota, callbackUpdate, db, auth) {
    // Se por acaso o dbRef for null, tentamos recuperar dos argumentos passados
    if (!dbRef && db) dbRef = db;
    if (!authRef && auth) authRef = auth;

    if (!dbRef) {
        console.error("❌ Erro: Firestore não inicializado no módulo de recuperação.");
        return;
    }

    arrayCaixas = caixas;
    notaOrigemDados = dadosNota;
    notaOrigemId = idNota;
    callbackAtualizarEditor = callbackUpdate;

    document.querySelector('[data-target="tab-backup"]').click();
    renderizarReciclagem(); 
    renderizarHistorico();
    
    // Agora o carregarListaBackups terá o dbRef preenchido
    await carregarListaBackups(); 

    document.getElementById('popup-restaurar-overlay').classList.add('active');
    document.getElementById('btn-criar-backup').onclick = criarNovoBackup;
}

// --- BACKUPS ---
async function criarNovoBackup() {
    const btn = document.getElementById('btn-criar-backup');
    if (!authRef.currentUser) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;

    try {
        // Detetar a pasta pai atual (se falhar, vai para o root)
        const pastaDestino = notaOrigemDados.pastapai || "root";

        const backupData = {
            nomeOriginal: document.getElementById('editor-titulo').innerText,
            caixas: JSON.parse(JSON.stringify(arrayCaixas)), 
            timestamp: serverTimestamp(),
            pastapai: pastaDestino, // <--- Crucial
            userId: authRef.currentUser.uid
        };

        console.log("A criar backup na pasta:", pastaDestino);
        await addDoc(collection(dbRef, "Local", notaOrigemId, "Backups"), backupData);
        await carregarListaBackups();
        
    } catch (e) { 
        console.error("Erro ao criar backup:", e);
        alert("Erro de permissão ou rede.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-plus"></i> CRIAR CÓPIA DE SEGURANÇA`;
    }
}

async function carregarListaBackups() {
    const container = document.getElementById('lista-backups-firestore');
    if(!container || !notaOrigemId) return;
    
    container.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; margin-top:20px;">A procurar...</p>`;
    
    try {
        // DETETAR SE A NOTA É LOCAL OU SHARE
     const colecaoAlvo = (notaOrigemDados.onde === "share") ? "Share" : "Local";
const q = query(
    collection(dbRef, colecaoAlvo, notaOrigemId, "Backups"), 
    where("userId", "==", authRef.currentUser.uid), 
    orderBy("timestamp", "desc")
);
        
        const snap = await getDocs(q);
        
        if(snap.empty) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:11px; margin-top:20px;">Nenhum backup encontrado.</p>`;
            return;
        }
        
        container.innerHTML = "";
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const dataF = d.timestamp ? d.timestamp.toDate().toLocaleString('pt-PT') : '...';
            const div = document.createElement('div');
            div.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom:6px;";
            div.innerHTML = `
                <div style="overflow:hidden; flex:1;">
                    <p style="font-size:11px; color:white; font-weight:600; margin:0;">${d.nomeOriginal}</p>
                    <p style="font-size:9px; color:var(--text-muted); margin:0;">${dataF}</p>
                </div>
                <button class="btn-rest-bk" style="background:#22c55e; color:black; border:none; padding:5px 10px; border-radius:4px; font-size:10px; font-weight:800; cursor:pointer;">RESTAURAR</button>`;
            
            div.querySelector('.btn-rest-bk').onclick = () => restaurarCopiaComoNovaNota(d);
            container.appendChild(div);
        });
    } catch (err) { 
        console.error("Erro no Firestore:", err);
        container.innerHTML = `<p style="color:red; font-size:10px;">Erro de permissão ou rede.</p>`; 
    }
}

async function restaurarCopiaComoNovaNota(dadosBackup) {
    const dataF = dadosBackup.timestamp ? dadosBackup.timestamp.toDate().toLocaleString('pt-PT') : '...';
    
    const confirmou = await perguntarRestauroBackup(dataF);
    
    if (confirmou) {
        try {
            const dataSufixo = new Date().toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            
            // Garantir que temos um pastapai válido
            const pastaPai = dadosBackup.pastapai || "root";

            const novaNota = {
                userId: authRef.currentUser.uid,
                tipo: "nota",
                estado: "ativa",
                nome: `${dadosBackup.nomeOriginal} (Restaurada ${dataSufixo})`,
                pastapai: pastaPai,
                caixas: dadosBackup.caixas,
                timestamp: serverTimestamp(),
                browser: [],
                ordem: 99 // Coloca no fim da lista
            };

            console.log("A restaurar nota para a pasta:", pastaPai);

            // Gravar na coleção principal "Local" para que apareça na barra lateral
            const docRef = await addDoc(collection(dbRef, "Local"), novaNota);
            
            console.log("Nota restaurada com ID:", docRef.id);
            
            document.getElementById('popup-restaurar-overlay').classList.remove('active');

        } catch (e) {
            console.error("Erro crítico no restauro:", e);
        }
    }
}

// --- RECICLAGEM ---
function renderizarReciclagem() {
    const lista = document.getElementById('lista-reciclagem-caixas');
    if (!lista) return;

    lista.innerHTML = "";

    // Filtrar caixas que foram marcadas como ocultas/apagadas
    const apagadas = arrayCaixas.filter(c => c.estado === 'desativa');

    if (apagadas.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 40px;">Reciclagem vazia.</p>';
        return;
    }

    apagadas.forEach(caixa => {
        // Obter configuração visual da ferramenta (ícone e cor)
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        let resumo = (caixa.titulo || caixa.conteudo || "Bloco sem título").substring(0, 30);

        const div = document.createElement('div');
        div.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-panel); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 6px;";
        
        div.innerHTML = `
            <div style="font-size:11px; color:white; display:flex; align-items:center; gap:8px;">
                <i class="${config.icon}" style="color:${config.cor};"></i>
                <span>${resumo}...</span>
            </div>
            <button class="btn-r" style="background:var(--primary); color:white; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Restaurar</button>
        `;

        // LÓGICA DE CLIQUE NO BOTÃO RESTAURAR
        div.querySelector('.btn-r').onclick = async () => { 
    caixa.estado = "ativa"; 
    
    // LIMPAR o campo de deleção ao restaurar
    if (caixa.timedelete) delete caixa.timedelete; 

    if (typeof callbackAtualizarEditor === 'function') callbackAtualizarEditor(); 
    renderizarReciclagem(); 
};

        lista.appendChild(div);
    });
}

// --- HISTÓRICO (AGORA COM CABEÇALHO DE CRIAÇÃO) ---
function renderizarHistorico() {
    const lista = document.getElementById('tab-historico');
    if (!lista) return;
    lista.innerHTML = "";

    // 1. ADICIONAR O REGISTO DE CRIAÇÃO DA NOTA (O que faltava)
    const dataCriacao = formatarDataCompleta(notaOrigemDados.timestamp);
    const divCriacao = document.createElement('div');
    divCriacao.style.cssText = "padding: 15px; border-bottom: 1px solid var(--border-color); margin-bottom: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px;";
    divCriacao.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: var(--primary); color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                <i class="fa-solid fa-star"></i>
            </div>
            <div>
                <p style="font-size: 12px; font-weight: 700; color: white; margin: 0;">Nota Criada Oficialmente</p>
                <p style="font-size: 10px; color: var(--text-muted); margin: 0; text-transform: capitalize;">${dataCriacao}</p>
            </div>
        </div>
    `;
    lista.appendChild(divCriacao);

    // 2. LISTA DE FERRAMENTAS ATUAIS
    const caixasAtivas = arrayCaixas.filter(c => c.estado === 'ativa');
    caixasAtivas.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    caixasAtivas.forEach(caixa => {
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        const dataF = new Date(caixa.timestamp).toLocaleTimeString('pt-PT', {hour:'2-digit', minute:'2-digit'});
        const div = document.createElement('div');
        div.style.cssText = "display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03);";
        div.innerHTML = `
            <i class="${config.icon}" style="color: ${config.cor}; opacity:0.6; font-size:12px; width:20px; text-align:center;"></i>
            <div style="flex:1;">
                <p style="font-size:11px; color:#e2e8f0; margin:0;">Adicionada ferramenta <b>${config.nome}</b></p>
                <p style="font-size:9px; color:var(--text-muted); margin:0;">Hoje às ${dataF}</p>
            </div>
        `;
        lista.appendChild(div);
    });
}