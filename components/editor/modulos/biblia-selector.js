// components/editor/modulos/biblia-selector.js
import { BIBLE_DATA } from '../../lists/bible-data.js';
import { 
    getFirestore, doc, updateDoc, arrayUnion, getDoc, 
    collection, query, where, getDocs, serverTimestamp, addDoc, 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let currentTarget = null; 
let tempSelecao = [];
let callbackFinal = null;

/**
 * INICIALIZAÇÃO
 */
export function iniciarSelectorBiblia(onSave) {
    callbackFinal = onSave;
    const btnConfirmar = document.getElementById('btn-confirmar-selecao-biblia');
    if (btnConfirmar) btnConfirmar.onclick = confirmarSelecao;

    const btnFechar = document.getElementById('btn-fechar-biblia-citacao');
    if (btnFechar) btnFechar.onclick = () => document.getElementById('popup-biblia-citacao-overlay').classList.remove('active');
}


/**
 * ABRIR EXPLORADOR
 * @param {Object} target - Pode ser a caixa da nota ou o tema do Cosmos
 */
export function abrirSelector(target) {
    currentTarget = target;
    tempSelecao = []; 
    
    const overlay = document.getElementById('popup-biblia-citacao-overlay');
    if (overlay) {
        overlay.classList.add('active');
        renderizarLivros();
        atualizarContadorUI();
    }
}

/**
 * VISTA 1: MOSAICO DE LIVROS
 */
function renderizarLivros() {
    const corpo = document.getElementById('biblia-citacao-corpo');
    document.getElementById('biblia-citacao-navegacao').innerText = "Bíblia > Selecionar Livro";
    corpo.innerHTML = `<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        ${BIBLE_DATA.map(l => `<button class="btn-amt" style="width:auto; height:40px;" onclick="window.selBibliaLivro('${l.nome}')">${l.abrev}</button>`).join('')}
    </div>`;
}

window.selBibliaLivro = (nomeLivro) => {
    const livro = BIBLE_DATA.find(l => l.nome === nomeLivro);
    const corpo = document.getElementById('biblia-citacao-corpo');
    document.getElementById('biblia-citacao-navegacao').innerText = `Bíblia > ${nomeLivro}`;
    corpo.innerHTML = `<div style="display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
        <button class="btn-amt" style="grid-column: span 5; color:var(--primary); margin-bottom:10px;" onclick="window.voltarLivros()">VOLTAR AOS LIVROS</button>
        ${Array.from({length: livro.caps}, (_, i) => i + 1).map(n => 
            `<button class="btn-amt" style="width:auto; height:40px;" onclick="window.selBibliaCap('${nomeLivro}', ${n})">${n}</button>`
        ).join('')}
    </div>`;
};

/**
 * VISTA 2: LISTA DE VERSÍCULOS (CORRIGIDO SCROLL)
 */
window.selBibliaCap = async (livro, cap) => {
    const corpo = document.getElementById('biblia-citacao-corpo');
    corpo.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
    try {
        const slug = livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
        const res = await fetch(`data/biblia/${slug}.json`);
        const data = await res.json();
        const versiculos = data[livro][cap];
        corpo.innerHTML = `<button class="btn-amt" style="width:100%; margin-bottom:15px; color:var(--primary);" onclick="window.selBibliaLivro('${livro}')">VOLTAR AOS CAPÍTULOS</button>`;
        Object.entries(versiculos).forEach(([num, texto]) => {
            const isSelected = tempSelecao.some(s => s.livro === livro && s.cap === cap && s.ver == num);
            const item = document.createElement('div');
            item.style.cssText = `padding:12px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; font-size:13px; transition: 0.2s; border-left: 3px solid ${isSelected ? 'var(--primary)' : 'transparent'}; background:${isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}`;
            item.innerHTML = `<b>${num}</b> ${texto}`;
            item.onclick = () => {
                const index = tempSelecao.findIndex(s => s.livro === livro && s.cap === cap && s.ver == num);
                if (index > -1) {
                    tempSelecao.splice(index, 1);
                    item.style.background = "transparent";
                    item.style.borderLeftColor = "transparent";
                } else {
                    tempSelecao.push({ livro, cap, ver: num, texto });
                    item.style.background = "rgba(99, 102, 241, 0.15)";
                    item.style.borderLeftColor = "var(--primary)";
                }
                atualizarContadorUI();
            };
            corpo.appendChild(item);
        });
    } catch (e) { corpo.innerHTML = "Erro ao carregar versículos."; }
};

window.voltarLivros = () => renderizarLivros();
function atualizarContadorUI() {
    const info = document.getElementById('info-selecao-biblia');
    if (info) info.innerText = `${tempSelecao.length} versículos selecionados`;
}


/**
 * FUNÇÃO CONFIRMAR: Grava no destino (Nota ou Cosmos)
 */
async function confirmarSelecao() {
    console.log("🚀 [BIBLIA-SELECTOR] Iniciando gravação bidirecional...");

    if (tempSelecao.length === 0) return alert("Seleciona pelo menos um versículo.");

    const btn = document.getElementById('btn-confirmar-selecao-biblia');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A gravar...';

    const db = getFirestore();
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) return;

    try {
        const micaIdAlvo = window.micaAbertaIdParaSelector;
        const uid = user.uid;

        // --- RESOLUÇÃO DO ERRO: CAPTURA ROBUSTA DO ID ---
        // Tentamos obter o ID de todas as formas que ele costuma viajar no sistema
        const fichaEstudoId = currentTarget.docIdFirebase || currentTarget.id || currentTarget.idcosmo;

        if (!fichaEstudoId) {
            console.error("❌ [SELECTOR ERROR] O ID do documento alvo é UNDEFINED.", currentTarget);
            throw new Error("Não foi possível identificar o documento de destino.");
        }

        // ========================================================
        // CENÁRIO A: ESTUDO DE LIVRO/REVISTA (Coleção Biblioteca)
        // ========================================================
        // Verificamos se é Biblioteca pelo contexto ou se o alvo veio de lá
        if (currentTarget.contexto === "publicacao" || currentTarget.contexto === "livro" || currentTarget.contexto === "multimedia") {
            
            const studyRef = doc(db, "Biblioteca", fichaEstudoId);
            const nomesDosVersiculos = tempSelecao.map(v => `${v.livro} ${v.cap}:${v.ver}`);

            // 1. Gravar na MICA da Ficha de Estudo (Biblioteca)
            await updateDoc(studyRef, {
                [`Dossie.mica.${micaIdAlvo}.caixas`]: arrayUnion(...nomesDosVersiculos)
            });
            console.log("✅ [BIBLIOTECA] Versículos injetados na Mica.");

            // 2. Gravar no documento do VERSÍCULO (TextosBiblia)
            for (const v of tempSelecao) {
                const nomeRef = `${v.livro} ${v.cap}:${v.ver}`;
                const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nomeRef));
                const snapV = await getDocs(q);

                if (!snapV.empty) {
                    await updateDoc(snapV.docs[0].ref, {
                        "Biblioteca": arrayUnion(fichaEstudoId)
                    });
                } else {
                    await addDoc(collection(db, "TextosBiblia"), {
                        id: crypto.randomUUID(),
                        userId: uid,
                        nome: nomeRef,
                        livro: v.livro,
                        capitulo: v.cap,
                        versiculo: v.ver,
                        tipo: "textobiblico",
                        estado: "ativo",
                        timestamp: serverTimestamp(),
                        Biblioteca: [fichaEstudoId], 
                        Dossie: { mica: {}, Apto: [] },
                        Puzzle: { quadros: [] }
                    });
                }
            }
        }

        // ========================================================
        // CENÁRIO B: TEMA DO COSMOS (Suporte para IDs variados)
        // ========================================================
        else if (currentTarget.docIdFirebase || currentTarget.idcosmo || currentTarget.tipo === "cosmos") {
            const temaRef = doc(db, "Cosmo", fichaEstudoId);
            const nomesV = tempSelecao.map(v => `${v.livro} ${v.cap}:${v.ver}`);

            await updateDoc(temaRef, {
                [`Dossie.mica.${micaIdAlvo}.caixas`]: arrayUnion(...nomesV)
            });
            console.log("✅ [COSMOS] Versículos injetados na Mica.");
        } 

        // ========================================================
        // CENÁRIO C: FERRAMENTA DE NOTA
        // ========================================================
        else if (currentTarget.tipo === "citacaobiblica") {
            currentTarget.textosanexados = tempSelecao;
            if (callbackFinal) callbackFinal();
        }

        document.getElementById('popup-biblia-citacao-overlay').classList.remove('active');
        console.log("🏁 [SELECTOR] Gravação terminada com sucesso.");

    } catch (e) {
        console.error("❌ [SELECTOR ERROR]", e);
        alert("Erro no Seletor: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Confirmar";
    }
}