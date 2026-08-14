// components/lists/topicos.js
import { 
    collection, addDoc, doc, getDoc, updateDoc, query, where, 
    onSnapshot, serverTimestamp, getDocs, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { prepararSubtopicoNoBrain } from '../topico-brain/topico-manager.js';
import { abrirSubtopicoNasFontes } from '../topico-brain/topico-fontes.js';


let dbRef, authRef;
let modoEdicao = false;
let modoPesquisa = false;
let filtroBusca = "";
let corSelecionada = "";
let topicoAtivoId = null; 
let itemSendoEditadoDocId = null; 
let subtopicoSelecionadoId = null;

const CORES_TOPICO = [
    { nome: "Vermelho", hex: "#ef4444" },
    { nome: "Castanho", hex: "#78350f" },
    { nome: "Laranja", hex: "#ea580c" },
    { nome: "Amarelo", hex: "#f59e0b" },
    { nome: "Verde Claro", hex: "#4ade80" },
    { nome: "Verde Escuro", hex: "#166534" },
    { nome: "Azul", hex: "#3b82f6" },
    { nome: "Azul Escuro", hex: "#1e40af" },
    { nome: "Roxo", hex: "#6b21a8" },
    { nome: "LilÃ¡s", hex: "#a855f7" },
    { nome: "Rosa Choque", hex: "#db2777" },
    { nome: "Cinzento", hex: "#6b7280" },
    { nome: "Preto", hex: "#000000" },
    { nome: "Branco", hex: "#ffffff" }
];

export function iniciarTopicos(db, auth) {
    dbRef = db; authRef = auth;
    exporFuncoesGlobais();
}

/**
 * NAVEGAÃ‡ÃƒO LATERAL (LISTS)
 */
export function renderizarNavegacaoTopicos() {
    const container = document.getElementById('lista-lists');
    if (!container) return;
    if (!window.htmlListaAntiga) window.htmlListaAntiga = container.innerHTML;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); position: sticky; top: 0; z-index: 5;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px;">
                <div id="btn-topicos-voltar" style="cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i> ${topicoAtivoId ? 'SubtÃ³picos' : 'TÃ³picos'}
                </div>
                <div style="display: flex; gap: 6px;">
                    <button id="btn-search-topicos" title="Pesquisar" style="background:${modoPesquisa ? 'var(--primary)' : 'transparent'}; border:1px solid var(--border-color); color:white; width:28px; height:28px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-magnifying-glass" style="font-size:11px"></i></button>
                    <button id="btn-edit-topicos" title="Modo EdiÃ§Ã£o" style="background:${modoEdicao ? 'var(--primary)' : 'transparent'}; border:1px solid var(--border-color); color:white; width:28px; height:28px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-pen" style="font-size:11px"></i></button>
                    <button id="btn-add-topico" title="Novo" style="background:var(--primary); border:none; color:white; width:28px; height:28px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
            <div id="search-bar-topicos" style="display: ${modoPesquisa ? 'block' : 'none'}; padding: 0 12px 12px 12px;">
                <input type="text" id="input-search-topicos" placeholder="Procurar em tudo..." value="${filtroBusca}" style="width: 100%; padding: 8px; font-size: 12px; background: var(--bg-body); border: 1px solid var(--primary); border-radius:4px; color: white; outline: none;">
            </div>
        </div>
        <div id="topicos-items-list" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 4px;"></div>
    `;

    document.getElementById('btn-topicos-voltar').onclick = () => {
        if (topicoAtivoId) { topicoAtivoId = null; renderizarNavegacaoTopicos(); }
        else { container.innerHTML = window.htmlListaAntiga; window.htmlListaAntiga = null; }
    };
    document.getElementById('btn-add-topico').onclick = () => abrirPopupCriar();
    document.getElementById('btn-edit-topicos').onclick = () => { modoEdicao = !modoEdicao; renderizarNavegacaoTopicos(); };
    document.getElementById('btn-search-topicos').onclick = () => { 
        modoPesquisa = !modoPesquisa; 
        if(!modoPesquisa) filtroBusca = ""; 
        renderizarNavegacaoTopicos(); 
    };
    
    if(modoPesquisa) {
        const input = document.getElementById('input-search-topicos');
        input.focus();
        input.oninput = (e) => { filtroBusca = e.target.value.toLowerCase(); escutarDados(); };
    }

    escutarDados();
}

function activarAbaTopico(target) {
    document.querySelectorAll('.tab-topico').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.target === target);
    });
    document.querySelectorAll('.topico-tab-content').forEach(content => {
        content.style.display = content.id === target ? 'block' : 'none';
    });
}

function renderizarCoresTopico(corAtual = '') {
    const container = document.getElementById('topico-cor-selector');
    if (!container) return;
    container.innerHTML = CORES_TOPICO.map(cor => `
        <button type="button" class="topico-cor-option" data-cor="${cor.hex}" title="${cor.nome}"
                style="width:28px; height:28px; border-radius:50%; border:2px solid ${cor.hex === corAtual ? 'white' : 'transparent'}; background:${cor.hex}; cursor:pointer; box-shadow:0 0 0 1px rgba(255,255,255,.18);"></button>
    `).join('');
    container.querySelectorAll('.topico-cor-option').forEach(botao => {
        botao.onclick = () => {
            corSelecionada = botao.dataset.cor;
            renderizarCoresTopico(corSelecionada);
        };
    });
}

async function carregarTopicosPai(seleccionados = []) {
    const container = document.getElementById('container-dropdown-pais');
    if (!container || !authRef?.currentUser) return;
    const q = query(collection(dbRef, 'Topico'), where('userId', '==', authRef.currentUser.uid), where('tipo', '==', 'topico'), where('estado', '==', 'on'));
    const snapshot = await getDocs(q);
    container.innerHTML = snapshot.docs.map(itemDoc => {
        const dados = itemDoc.data();
        const marcado = seleccionados.includes(dados.id) || seleccionados.includes(itemDoc.id);
        return `<label style="display:flex; align-items:center; gap:8px; padding:7px 4px; cursor:pointer; font-size:12px;"><input type="checkbox" class="topico-pai-check" value="${dados.id || itemDoc.id}" ${marcado ? 'checked' : ''}><span>${dados.nome || 'Sem nome'}</span></label>`;
    }).join('') || '<span style="font-size:11px; color:var(--text-muted);">Ainda não existem tópicos.</span>';
    container.querySelectorAll('.topico-pai-check').forEach(input => input.onchange = actualizarResumoPais);
    actualizarResumoPais();
}

function actualizarResumoPais() {
    const checks = [...document.querySelectorAll('.topico-pai-check:checked')];
    const texto = document.getElementById('texto-selecionados');
    const aviso = document.getElementById('aviso-espelho');
    if (texto) texto.textContent = checks.length ? `${checks.length} tópico(s) seleccionado(s)` : 'Selecionar Tópicos...';
    if (aviso) aviso.style.display = checks.length > 1 ? 'block' : 'none';
}

function configurarPopupTopicos() {
    const overlay = document.getElementById('popup-topicos-overlay');
    if (!overlay || overlay.dataset.configurado === 'true') return;
    overlay.dataset.configurado = 'true';
    document.querySelectorAll('.tab-topico').forEach(tab => tab.onclick = () => activarAbaTopico(tab.dataset.target));
    document.getElementById('btn-fechar-topico')?.addEventListener('click', () => overlay.classList.remove('active'));
    document.getElementById('topicos-pai-select-head')?.addEventListener('click', () => {
        const lista = document.getElementById('container-dropdown-pais');
        if (lista) lista.style.display = lista.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('btn-gravar-topico')?.addEventListener('click', guardarTopico);
    document.getElementById('btn-ocultar-topico')?.addEventListener('click', ocultarTopico);
}

function limparPopupTopico() {
    document.getElementById('topico-nome').value = '';
    document.getElementById('subtopico-nome').value = '';
    document.getElementById('titulo-popup-topico').textContent = 'Novo Tópico / Subtópico';
    document.getElementById('btn-gravar-topico').textContent = 'Gravar';
    document.getElementById('btn-ocultar-topico').style.display = 'none';
    itemSendoEditadoDocId = null;
    corSelecionada = '';
    activarAbaTopico('form-topico');
    renderizarCoresTopico();
    carregarTopicosPai();
}

function abrirPopupCriar() {
    configurarPopupTopicos();
    limparPopupTopico();
    document.getElementById('popup-topicos-overlay')?.classList.add('active');
}

async function editarTopico(docId) {
    try {
        const snap = await getDoc(doc(dbRef, 'Topico', docId));
        if (!snap.exists()) return;
        const dados = snap.data();
        configurarPopupTopicos();
        itemSendoEditadoDocId = docId;
        corSelecionada = dados.cor || '';
        document.getElementById('titulo-popup-topico').textContent = 'Editar Tópico / Subtópico';
        document.getElementById('btn-gravar-topico').textContent = 'Actualizar';
        document.getElementById('btn-ocultar-topico').style.display = 'block';
        if (dados.tipo === 'subtopico') {
            activarAbaTopico('form-subtopico');
            document.getElementById('subtopico-nome').value = dados.nome || '';
            await carregarTopicosPai(dados.topicospai || []);
        } else {
            activarAbaTopico('form-topico');
            document.getElementById('topico-nome').value = dados.nome || '';
            renderizarCoresTopico(corSelecionada);
        }
        document.getElementById('popup-topicos-overlay')?.classList.add('active');
    } catch (erro) {
        console.error('[TOPICOS] Erro ao abrir edição:', erro);
    }
}

async function guardarTopico() {
    const botao = document.getElementById('btn-gravar-topico');
    const aba = document.querySelector('.tab-topico.active')?.dataset.target || 'form-topico';
    const isSubtopico = aba === 'form-subtopico';
    const nome = document.getElementById(isSubtopico ? 'subtopico-nome' : 'topico-nome')?.value.trim();
    if (!nome || !authRef?.currentUser) return;
    const dados = isSubtopico
        ? { nome, tipo: 'subtopico', topicospai: [...document.querySelectorAll('.topico-pai-check:checked')].map(input => input.value) }
        : { nome, tipo: 'topico', cor: corSelecionada || null };
    botao.disabled = true;
    try {
        if (itemSendoEditadoDocId) {
            await updateDoc(doc(dbRef, 'Topico', itemSendoEditadoDocId), dados);
        } else {
            await addDoc(collection(dbRef, 'Topico'), { ...dados, id: crypto.randomUUID(), userId: authRef.currentUser.uid, estado: 'on', caixas: [], notas: [], timestamp: serverTimestamp() });
        }
        document.getElementById('popup-topicos-overlay')?.classList.remove('active');
    } catch (erro) {
        console.error('[TOPICOS] Erro ao guardar:', erro);
    } finally {
        botao.disabled = false;
    }
}

async function ocultarTopico() {
    if (!itemSendoEditadoDocId) return;
    const overlay = document.getElementById('popup-confirmar-topico-overlay');
    overlay?.classList.add('active');
    const fechar = () => overlay?.classList.remove('active');
    const cancelar = document.getElementById('btn-cancelar-ocultar-topico');
    const confirmar = document.getElementById('btn-confirmar-ocultar-topico');
    cancelar.onclick = fechar;
    confirmar.onclick = async () => {
        await updateDoc(doc(dbRef, 'Topico', itemSendoEditadoDocId), { estado: 'off', timedelete: new Date().toISOString() });
        fechar();
        document.getElementById('popup-topicos-overlay')?.classList.remove('active');
    };
}

function exporFuncoesGlobais() {
    configurarPopupTopicos();
    window.editarTopicoGlobal = editarTopico;
    window.abrirPopupCriarTopico = abrirPopupCriar;
}
function escutarDados() {
    if (!authRef.currentUser) return;
    const userId = authRef.currentUser.uid;
    const q = query(collection(dbRef, "Topico"), where("userId", "==", userId), where("estado", "==", "on"));

    onSnapshot(q, (snapshot) => {
        const listDiv = document.getElementById('topicos-items-list');
        if (!listDiv) return;
        listDiv.innerHTML = "";

        let itens = [];
        snapshot.forEach(d => itens.push({ docId: d.id, ...d.data() }));

        if (modoPesquisa && filtroBusca.length > 0) {
            itens.filter(i => i.nome.toLowerCase().includes(filtroBusca)).forEach(item => {
                listDiv.appendChild(criarElementoLista(item, item.tipo === 'subtopico' ? 'SUB' : 'TOP'));
            });
        } else if (topicoAtivoId) {
            itens.filter(i => i.tipo === 'subtopico' && i.topicospai && i.topicospai.includes(topicoAtivoId)).forEach(sub => {
                listDiv.appendChild(criarElementoLista(sub));
            });
        } else {
            itens.filter(i => i.tipo === 'topico').forEach(top => {
                listDiv.appendChild(criarElementoLista(top));
            });
        }
        
        if (snapshot.empty) listDiv.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; margin-top:20px;">Vazio.</p>`;
    });
}

function criarElementoLista(item, tag = null) {
    const div = document.createElement('div');
    
    // 1. Verificamos se este Ã© o item selecionado
    const isAtivo = item.id === subtopicoSelecionadoId;
    
    div.className = `menu-item-list ${isAtivo ? 'active' : ''}`;
    div.style.justifyContent = "space-between";
    
    // Estilo visual de item ativo (ex: borda esquerda ou fundo mais claro)
    if (isAtivo) {
        div.style.background = "rgba(99, 102, 241, 0.1)";
        div.style.borderLeft = "3px solid var(--primary)";
    }

    let htmlTag = tag ? `<small style="background:rgba(255,255,255,0.1); padding:20px 5px; border-radius:3px; font-size:8px; margin-right:8px; color:var(--text-muted);">${tag}</small>` : '';
    let htmlCor = item.cor ? `<div style="width:10px; height:10px; border-radius:50%; background:${item.cor}; margin-right:10px; flex-shrink:0;"></div>` : '<i class="fa-solid fa-hashtag" style="margin-right:10px; opacity:0.3; font-size:12px;"></i>';

    div.innerHTML = `
        <div style="display:flex; align-items:center; overflow:hidden; pointer-events:none;">
            ${htmlTag} ${htmlCor}
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px; color:${isAtivo ? 'white' : 'inherit'}; font-weight:${isAtivo ? '700' : '500'};">${item.nome}</span>
        </div>
        ${modoEdicao ? `<i class="fa-solid fa-pen-to-square" onclick="event.stopPropagation(); window.editarTopicoGlobal('${item.docId}')" style="color:var(--primary); padding:5px; cursor:pointer;"></i>` : ''}
    `;

    if (!modoEdicao) {
        div.onclick = async () => {
            if (item.tipo === 'topico') {
                topicoAtivoId = item.id;
                renderizarNavegacaoTopicos();
                return;
            }

            subtopicoSelecionadoId = item.id;
            await prepararSubtopicoNoBrain(item);
            await abrirSubtopicoNasFontes(item);
        };
    }

    return div;
}