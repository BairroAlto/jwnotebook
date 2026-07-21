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
                estado: "on",
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

    // 1. DETETAR O MODO ATUAL DA NOTA
    // notaOrigemDados é a variável definida no abrirCentroRecuperacao
    const modos = Array.isArray(notaOrigemDados.modo) ? notaOrigemDados.modo : [notaOrigemDados.modo || 'normal'];
    const isModoSentinela = modos.includes('sentinela');

    // 2. FILTRAGEM INTELIGENTE
    const apagadas = arrayCaixas.filter(caixa => {
        // Regra base: a caixa tem de estar em estado "off"
        if (caixa.estado !== 'off') return false;

        // REGRA DE SEGREGAÇÃO:
        if (isModoSentinela) {
            // No Modo Sentinela, apenas mostramos caixas que pertencem ao estudo (têm referenciacodex)
            return !!caixa.referenciacodex;
        } else {
            // Nos outros modos (Normal, Post, Arquivo), escondemos as caixas do estudo Sentinela
            return !caixa.referenciacodex;
        }
    });

    // 3. SE NÃO HOUVER NADA QUE CORRESPONDA AO MODO ATUAL
    if (apagadas.length === 0) {
        lista.innerHTML = `
            <div style="text-align:center; padding:40px; opacity:0.5;">
                <i class="fa-solid fa-trash-can-arrow-up" style="font-size:30px; margin-bottom:10px; color:gray;"></i>
                <p style="color:var(--text-muted); font-size:12px;">
                    ${isModoSentinela ? 'Nenhuma pergunta removida neste estudo.' : 'Reciclagem vazia para este modo.'}
                </p>
            </div>`;
        return;
    }

    // 4. RENDERIZAR OS CARDS DE RESTAURO
    apagadas.forEach(caixa => {
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
        
        // Formatar o resumo do texto
        let resumo = (caixa.titulo || caixa.conteudo || "Bloco sem conteúdo").substring(0, 45);
        if (resumo.length >= 45) resumo += "...";

        const div = document.createElement('div');
        div.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            background: rgba(255,255,255,0.02); 
            padding: 12px 15px; 
            border-radius: 8px; 
            border: 1px solid var(--border-color); 
            margin-bottom: 8px;
            border-left: 4px solid ${caixa.referenciacodex ? '#818cf8' : config.cor};
        `;
        
        div.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="${config.icon}" style="color:${config.cor}; font-size:10px;"></i>
                    <span style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">
                        ${caixa.referenciacodex ? 'Pergunta do Estudo' : config.nome}
                    </span>
                </div>
                <div style="font-size:13px; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${resumo}
                </div>
            </div>
            <button class="btn-restaurar-caixa" style="
                background: var(--primary); 
                color: white; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 4px; 
                font-size: 10px; 
                font-weight: 800; 
                cursor: pointer;
                margin-left: 15px;
            ">RESTAURAR</button>
        `;

        // 5. EVENTO DE CLIQUE PARA RESTAURAR
        div.querySelector('.btn-restaurar-caixa').onclick = async () => {
            console.log(`♻️ Restaurando bloco: ${caixa.id}`);
            
            // Reativa a caixa localmente
            caixa.estado = "on";
            if (caixa.timedelete) delete caixa.timedelete;

            // Se for Modo Sentinela, avisa o Firebase->Biblioteca para reativar lá também
            if (caixa.referenciacodex) {
                import('./sentinela-manager.js').then(m => {
                    m.SentinelaManager.sincronizarParaBiblioteca(caixa, dbRef, authRef.currentUser.uid);
                });
            }

            // Atualiza o editor central
            if (typeof callbackAtualizarEditor === 'function') {
                await callbackAtualizarEditor();
            }

            // Atualiza a própria lista de reciclagem (o item desaparece daqui)
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

    const caixasAtivas = arrayCaixas.filter(caixa => caixa.estado === 'on');
    const totalFerramentas = caixasAtivas.length;
    const contagemPorTipo = caixasAtivas.reduce((contagem, caixa) => {
        contagem.set(caixa.tipo, (contagem.get(caixa.tipo) || 0) + 1);
        return contagem;
    }, new Map());

    const resumoFerramentas = document.createElement('div');
    resumoFerramentas.setAttribute('role', 'button');
    resumoFerramentas.setAttribute('tabindex', '0');
    resumoFerramentas.setAttribute('aria-expanded', 'false');
    resumoFerramentas.style.cssText = "display:flex; align-items:center; gap:10px; margin:-8px 4px 0; padding:9px 12px; border:1px solid rgba(99,102,241,.16); border-radius:7px; background:rgba(99,102,241,.035); cursor:pointer;";
    resumoFerramentas.innerHTML = `
        <i class="fa-solid fa-layer-group" style="color:var(--primary); font-size:11px;"></i>
        <span style="font-size:10px; color:var(--text-muted); flex:1;">
            <strong style="color:var(--text-main);">${totalFerramentas}</strong>
            ${totalFerramentas === 1 ? 'ferramenta ativa' : 'ferramentas ativas'} atualmente nesta nota
        </span>
        <i class="fa-solid fa-chevron-down" data-contador-seta style="color:var(--text-muted); font-size:9px; transition:transform .18s ease;"></i>
    `;

    const detalhesFerramentas = document.createElement('div');
    detalhesFerramentas.hidden = true;
    detalhesFerramentas.style.cssText = "margin:5px 4px 14px; padding:6px 10px; border:1px solid rgba(255,255,255,.06); border-radius:7px; background:rgba(2,6,23,.2);";

    if (contagemPorTipo.size === 0) {
        detalhesFerramentas.innerHTML = '<p style="margin:5px 0; color:var(--text-muted); font-size:10px;">Nenhuma ferramenta ativa.</p>';
    } else {
        [...contagemPorTipo.entries()]
            .map(([tipo, quantidade]) => ({
                quantidade,
                config: IDENTIDADE_FERRAMENTAS[tipo] || IDENTIDADE_FERRAMENTAS.contentor
            }))
            .sort((a, b) => a.config.nome.localeCompare(b.config.nome, 'pt-PT'))
            .forEach(({ quantidade, config }) => {
                const linha = document.createElement('div');
                linha.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 2px; border-bottom:1px solid rgba(255,255,255,.035);";
                linha.innerHTML = `
                    <i class="${config.icon}" style="width:16px; color:${config.cor}; font-size:10px; text-align:center;"></i>
                    <span style="flex:1; color:var(--text-main); font-size:10px;">${config.nome}</span>
                    <strong style="min-width:22px; padding:2px 6px; border-radius:10px; background:${config.cor}22; color:${config.cor}; font-size:10px; text-align:center;">${quantidade}</strong>
                `;
                detalhesFerramentas.appendChild(linha);
            });
    }

    const alternarDetalhes = () => {
        const expandido = resumoFerramentas.getAttribute('aria-expanded') === 'true';
        resumoFerramentas.setAttribute('aria-expanded', String(!expandido));
        detalhesFerramentas.hidden = !expandido;
        const seta = resumoFerramentas.querySelector('[data-contador-seta]');
        if (seta) seta.style.transform = expandido ? 'rotate(0deg)' : 'rotate(180deg)';
    };

    resumoFerramentas.addEventListener('click', alternarDetalhes);
    resumoFerramentas.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter' && evento.key !== ' ') return;
        evento.preventDefault();
        alternarDetalhes();
    });

    lista.appendChild(resumoFerramentas);
    lista.appendChild(detalhesFerramentas);

    // 2. LISTA DE FERRAMENTAS ATUAIS    caixasAtivas.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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