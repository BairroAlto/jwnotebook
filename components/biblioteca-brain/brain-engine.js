// components/brain-core/brain-engine.js
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { abrirEstudoNoBrain } from './biblio-brain-ui.js';

// Importadores de Regras
import { PublicacoesProcessor } from '../editor/modulos/tags/codex-processor-publicacoes.js';
import { LivrosProcessor } from '../editor/modulos/tags/codex-processor-livros.js';
import { MultimediaProcessor } from '../editor/modulos/tags/codex-processor-multimedia.js';



// --- ESTADO PRIVADO DO MÓDULO ---
let unsubDoc = null;
let unsubLocal = null;
let estaAEscrever = false;
let ultimoJsonRenderizado = "";
let mapaFerramentasVivas = {};
let dadosAtuais = null;

let currentDocRef = null;
let currentContainer = null;
let currentUid = null;
let globalHandlerAddRef = null;

/**
 * LIMPEZA DE MEMÓRIA (Evita duplicação de caixas e processos fantasma)
 */
export function limparEngine() {
    console.log("%c🧹 [ENGINE] Limpeza total de listeners.", "color: #f87171; font-weight: bold;");
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
    if (unsubLocal) { unsubLocal(); unsubLocal = null; }
    
    if (globalHandlerAddRef) {
        window.removeEventListener('brain:adicionarTexto', globalHandlerAddRef);
        globalHandlerAddRef = null;
    }

    estaAEscrever = false;
    ultimoJsonRenderizado = "";
    mapaFerramentasVivas = {};
    dadosAtuais = null;
}

/**
 * LÓGICA DO BOTÃO + (MAIS RECENTE NO TOPO)
 */
async function handlePlusClick() {
    if (!dadosAtuais || estaAEscrever) return;
    
    const novoId = crypto.randomUUID();
    console.group(`%c🚀 [RADAR] CRIANDO QUADRO NO TOPO: ${novoId.substring(0,5)}`, "color: #22c55e; font-weight: bold;");
    
    estaAEscrever = true;

    // 1. Sincronizar DOM -> RAM (Evita perda de texto nas outras caixas)
    const textareas = currentContainer.querySelectorAll('textarea[data-id]');
    const quadrosNaRam = [...(dadosAtuais.Puzzle?.quadros || [])];

    textareas.forEach(ta => {
        const q = quadrosNaRam.find(itemQ => itemQ.id === ta.dataset.id);
        if (q) q.conteudo = ta.value;
    });

    const novo = { 
        id: novoId, 
        userId: currentUid, 
        timestamp: new Date().toISOString(), // Timestamp atual garante o topo no sort
        estado: "on", 
        tipo: "caixatexto", 
        conteudo: "" 
    };

    const listaFinal = [...quadrosNaRam, novo];
    dadosAtuais.Puzzle.quadros = listaFinal;
    ultimoJsonRenderizado = ""; // Força o motor a redesenhar o DOM

    try {
        // --- TÉCNICA DE TRAVAGEM DE SCROLL ---
        console.log("🔒 Bloqueando Scroll do container...");
        currentContainer.style.overflow = "hidden"; // Impede saltos do browser
        currentContainer.scrollTop = 0; // Força o ecrã no topo

        await updateDoc(currentDocRef, { "Puzzle.quadros": listaFinal });

        // 2. Aguardar a pintura do DOM (Snapshot do Firebase)
        setTimeout(() => {
            const targetTa = currentContainer.querySelector(`textarea[data-id="${novoId}"]`);
            
            if(targetTa) {
                console.log("🎯 [FOCUS] Aplicando foco na nova caixa.");
                
                // Ativar scroll novamente
                currentContainer.style.overflow = "auto";
                
                // Focar impedindo que o navegador role a página sozinho
                targetTa.focus({ preventScroll: true }); 
                
                // Garantir o topo absoluto
                currentContainer.scrollTo({ top: 0, behavior: 'instant' });
                console.log("✅ [SUCCESS] Cursor no topo, scroll em 0px.");
            } else {
                console.error("❌ [ERROR] Caixa nova não encontrada no DOM.");
                currentContainer.style.overflow = "auto";
            }
            
            estaAEscrever = false;
            console.groupEnd();
        }, 350); 

    } catch (e) { 
        console.error("❌ [FIREBASE-FAIL]", e);
        currentContainer.style.overflow = "auto";
        estaAEscrever = false;
        console.groupEnd();
    }
}

/**
 * ============================================================
 * 🧩 MOTOR PUZZLE (GENÉRICO)
 * ============================================================
 */
export async function iniciarPuzzle(colecao, item, container, db, auth) {
    limparEngine();
    
    currentDocRef = doc(db, colecao, item.id);
    currentContainer = container;
    currentUid = auth.currentUser.uid;

    console.log(`%c📡 [ENGINE] Iniciando sessão para: ${colecao}`, "color: #8b5cf6; font-weight: bold;");

    // 1. ESCUTA: NOTAS LOCAIS (Espelhamento de Ferramentas)
    unsubLocal = onSnapshot(query(collection(db, "Local"), where("userId", "==", currentUid)), (snapshot) => {
        mapaFerramentasVivas = {};
        snapshot.forEach(docNota => {
            const d = docNota.data();
            if (d.estado !== "on") return;
            (d.caixas || []).forEach(c => {
                // Vínculos Possíveis: Cosmos ou Biblioteca (Ficha)
                const isCosmos = c.neuroniosCosmos?.some(n => n.id === item.id);
                const isBiblioteca = (c.idBiblioteca === item.id);

                if (c.estado === "on" && (isCosmos || isBiblioteca)) {
                    mapaFerramentasVivas[c.id] = { ...c, notaDocId: docNota.id, notaDados: d };
                }
            });
        });
        reconstruirPuzzleUI(currentContainer, currentDocRef, db, auth);
    });

    // 2. ESCUTA: DOCUMENTO PAI (Snapshot com Blindagem)
    unsubDoc = onSnapshot(currentDocRef, (snap) => {
        if (!snap.exists()) return;
        const dadosServidor = snap.data();
        
        if (!dadosServidor.Puzzle) dadosServidor.Puzzle = { quadros: [] };

        if (estaAEscrever && dadosAtuais) {
            dadosServidor.Puzzle.quadros = dadosServidor.Puzzle.quadros.map(sq => {
                const itemNaRam = dadosAtuais.Puzzle.quadros?.find(l => l.id === sq.id);
                return itemNaRam ? { ...sq, conteudo: itemNaRam.conteudo } : sq;
            });
        }
        
        dadosAtuais = dadosServidor;
        reconstruirPuzzleUI(currentContainer, currentDocRef, db, auth);
    });

    // 3. LIGAR OUVINTE ÚNICO
    globalHandlerAddRef = handlePlusClick;
    window.addEventListener('brain:adicionarTexto', globalHandlerAddRef);
}

function reconstruirPuzzleUI(container, docRef, db, auth) {
    if (!dadosAtuais || !container) return;

    const quadrosManual = dadosAtuais.Puzzle?.quadros || [];
    const caixasVinculo = dadosAtuais.caixas || dadosAtuais.Puzzle?.caixas || [];

    const ferramentas = caixasVinculo.map(conf => {
        const id = typeof conf === 'object' ? conf.id : conf;
        const vivo = mapaFerramentasVivas[id];
        return vivo ? { ...vivo, timestamp: conf.timestamp || vivo.timestamp, _tipo: 'ferramenta' } : null;
    }).filter(f => f !== null);

    // ORDENAÇÃO: MAIS RECENTE NO TOPO (b - a)
    const listaFinal = [
        ...quadrosManual.map(q => ({ ...q, _tipo: 'quadro' })), 
        ...ferramentas
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const assinatura = JSON.stringify(listaFinal.map(i => ({id: i.id, txt: i.conteudo})));
    if (assinatura === ultimoJsonRenderizado) return;
    ultimoJsonRenderizado = assinatura;

    container.innerHTML = "";
    listaFinal.forEach((item, index) => {
        if (item._tipo === 'quadro') {
            container.appendChild(SharedPuzzleUI.renderQuadroManual(item, index, listaFinal, docRef, {
                setEstaAEscrever: (val) => { estaAEscrever = val; },
                moverItem: (idx, dir) => moverItemGenerico(idx, dir, listaFinal, docRef),
                apagarItem: (id) => apagarQuadroGenerico(id, docRef)
            }));
        } else {
            container.appendChild(renderFerramentaEspelho(item, index, listaFinal, docRef, db, auth));
        }
    });
}

/**
 * ============================================================
 * 🔗 MOTOR FONTES (LINKS E CODEX)
 * ============================================================
 */
export async function iniciarFontes(colecao, item, container, db, auth) {
    limparEngine();
    const docRef = doc(db, colecao, item.id);

    unsubDoc = onSnapshot(docRef, (snap) => {
        if (!snap.exists()) return;
        const fontes = snap.data().Fontes || { Links: [], codex: [] };
        container.innerHTML = "";

        const links = (fontes.Links || []).filter(l => l.estado === "on")
            .sort((a,b) => (b.favorito === 'sim' ? 1 : 0) - (a.favorito === 'sim' ? 1 : 0));
        
        links.forEach(l => {
            const card = document.createElement('div');
            card.style.marginBottom = "8px";
            card.innerHTML = SharedUI.renderLinkCard({ ...l, id: l.timestamp, link: l.hiperlinks[0] }, "");
            container.appendChild(card);
        });

        const codices = (fontes.codex || []).filter(c => c.estado === "on")
            .sort((a,b) => (b.favorito === 'sim' ? 1 : 0) - (a.favorito === 'sim' ? 1 : 0));
        
        codices.forEach(c => {
            const card = document.createElement('div');
            card.style.marginBottom = "8px";
            card.innerHTML = SharedUI.renderCodexCard(c, "");
            container.appendChild(card);
        });

        if (container.innerHTML === "") {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; opacity:0.5;">Nenhuma fonte vinculada.</p>`;
        }
    });
}

/**
 * ============================================================
 * 📂 MOTOR DOSSIÊ (MICAS)
 * ============================================================
 */
export async function iniciarDossie(colecao, item, container, db, auth) {
    limparEngine();
    const docRef = doc(db, colecao, item.id);

    unsubDoc = onSnapshot(docRef, (snap) => {
        if (!snap.exists()) return;
        const micas = snap.data().Dossie?.mica || {};
        container.innerHTML = "";
        
        const lista = Object.values(micas)
            .filter(m => m.estado === "on")
            .sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (lista.length === 0) {
            container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; opacity:0.5;">Dossiê vazio.</p>`;
            return;
        }

        lista.forEach(mica => {
            const card = document.createElement('div');
            card.className = "indice-card";
            card.style.borderLeft = `4px solid ${mica.cor || '#fff'}`;
            card.innerHTML = `
                <div style="font-weight:700; color:white; font-size:13px;">${mica.titulo}</div>
                <div style="font-size:10px; opacity:0.5; color:gray; margin-top:4px;">${mica.caixas?.length || 0} itens arquivados</div>
            `;
            container.appendChild(card);
        });
    });
}

/**
 * UTILITÁRIOS INTERNOS
 */

async function moverItemGenerico(index, direcao, todos, docRef) {
    const novoIdx = index + direcao;
    if (novoIdx < 0 || novoIdx >= todos.length) return;
    estaAEscrever = false; ultimoJsonRenderizado = "";
    const tempTime = todos[index].timestamp;
    todos[index].timestamp = todos[novoIdx].timestamp;
    todos[novoIdx].timestamp = tempTime;
    const q = todos.filter(i => i._tipo === 'quadro').map(({_tipo, ...rest}) => rest);
    const c = todos.filter(i => i._tipo === 'ferramenta').map(i => ({ id: i.id, timestamp: i.timestamp }));
    await updateDoc(docRef, { "Puzzle.quadros": q, "caixas": c });
}

async function apagarQuadroGenerico(id, docRef) {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const novos = snap.data().Puzzle.quadros.filter(q => q.id !== id);
    await updateDoc(docRef, { "Puzzle.quadros": novos });
}

function renderFerramentaEspelho(c, index, todos, docRef, db, auth) {
    const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const div = document.createElement('div');
    div.style.cssText = `border-left: 4px solid ${config.cor}; background: rgba(255,255,255,0.02); margin-bottom: 12px; border-radius: 8px; padding:12px; cursor:pointer;`;
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span style="font-size:9px; font-weight:800; color:${config.cor}; text-transform:uppercase;">${c.tipo}</span>
            <i class="fa-solid fa-arrow-up-right-from-square" style="opacity:0.3; font-size:11px;"></i>
        </div>
        <div style="font-size:13px; color:white; line-height:1.5;">
            ${c.titulo ? `<b style="display:block; margin-bottom:4px;">${c.titulo}</b>` : ''}
            <div style="opacity:0.8; white-space: pre-wrap;">${c.conteudo}</div>
        </div>
        <div style="font-size:8px; opacity:0.3; text-align:right; margin-top:8px; font-weight:800; text-transform:uppercase;">
            <i class="fa-solid fa-file-lines"></i> ${c.notaDados.nome}
        </div>`;
    div.onclick = () => abrirNotaNoEditor(c.notaDocId, c.notaDados, db, auth, c.id);
    return div;
}
export async function estudarReferencia(dados) {
    const db = getFirestore();
    const auth = getAuth();
    
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // 1. NORMALIZAÇÃO DE DADOS
    // Limpar espaços e garantir que a sequência é tratada como String para match perfeito
    const refLimpa = String(dados.rawRef || "").trim().replace(/\s+/g, ' ');
    const seqLimpa = String(dados.sequencia || "").trim();
    const tituloLimpo = String(dados.tituloConteudo || "").trim();

    console.log(`%cBridge (Engine): 🌉 Sintonizando: ${refLimpa} | §${seqLimpa}`, "color: #818cf8; font-weight: bold;");

    try {
        // 2. GERAR METADADOS TÉCNICOS VIA PROCESSADORES CODEX
        const mapeamentoFake = { 
            oque: dados.oque || "parágrafo", 
            sequencia: [seqLimpa] 
        };

        const baseParaProcessador = { 
            referencia: refLimpa, 
            titulo: tituloLimpo,
            sigla: dados.sigla || "",
            capitulo: dados.capitulo || "",
            mes: dados.mes || "",
            ano: dados.ano || "",
            multimediapath: dados.multimediapath || ""
        };

        let fichaTecnica = {};
        if (dados.contexto === 'publicacao') {
            fichaTecnica = PublicacoesProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        } else if (dados.contexto === 'livro') {
            fichaTecnica = LivrosProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        } else {
            fichaTecnica = MultimediaProcessor.gerarObjetos(baseParaProcessador, mapeamentoFake, "MANUAL", uid);
        }

        // 3. CONSULTA DE PRECISÃO NO FIRESTORE (Referência + Sequência)
        const q = query(
            collection(db, "Biblioteca"),
            where("userId", "==", uid),
            where("referencia", "==", refLimpa),
            where("sequencia", "==", seqLimpa),
            where("oque", "==", dados.oque),
            where("estado", "==", "on")
        );

        const snap = await getDocs(q);
        let estudoFinal;

        if (snap.empty) {
            // ========================================================
            // ✨ CENÁRIO: CRIANDO FICHA MESTRE NOVA (VAZIA)
            // ========================================================
            console.log("%c✨ Bridge (Engine): Ficha inédita. Definindo Anotação como NULL.", "color: #34d399;");
            
            const { id, groupId, ...dadosPuros } = fichaTecnica;

            const novaFicha = {
                ...dadosPuros,
                referencia: refLimpa,
                sequencia: seqLimpa,
                titulo: tituloLimpo,
                userId: uid,
                textoOriginal: dados.textoOriginal || "",
                estado: "on",
                timestamp: serverTimestamp(),
                // Inicialização das gavetas do Brain
                Puzzle: { quadros: [] },
                Fontes: { Links: [], codex: [] },
                Dossie: { mica: {}, Apto: [] },
                // 🚀 A CORREÇÃO: Definir como null para o Brain mostrar o seletor de 3 opções
                anotacaoEspecial: null 
            };

            const docRef = await addDoc(collection(db, "Biblioteca"), novaFicha);
            estudoFinal = { ...novaFicha, id: docRef.id }; 

        } else {
            // ========================================================
            // 📂 CENÁRIO: CARREGAR FICHA EXISTENTE
            // ========================================================
            const docExistente = snap.docs[0];
            console.log(`%c📂 Bridge (Engine): Ficha localizada (ID: ${docExistente.id})`, "color: #fbbf24;");
            estudoFinal = { ...docExistente.data(), id: docExistente.id };
        }

        // 4. ABRIR INTERFACE NO BRAIN
        // Importação dinâmica para garantir que a UI responde ao estudo carregado
        import('./biblio-brain-ui.js').then(m => m.abrirEstudoNoBrain(estudoFinal));

    } catch (error) {
        console.error("❌ [BRIDGE-ENGINE-ERROR] Falha crítica na transição:", error);
    }
}