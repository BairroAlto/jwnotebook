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
    { nome: "Vermelho", hex: "#ef4444" }, { nome: "Amarelo", hex: "#f59e0b" },
    { nome: "Laranja", hex: "#ea580c" }, { nome: "Castanho", hex: "#78350f" },
    { nome: "Azul", hex: "#3b82f6" }, { nome: "Lilás", hex: "#a855f7" },
    { nome: "Cinzento", hex: "#6b7280" }
];

export function iniciarTopicos(db, auth) {
    dbRef = db; authRef = auth;
    exporFuncoesGlobais();
}

/**
 * NAVEGAÇÃO LATERAL (LISTS)
 */
export function renderizarNavegacaoTopicos() {
    const container = document.getElementById('lista-lists');
    if (!container) return;
    if (!window.htmlListaAntiga) window.htmlListaAntiga = container.innerHTML;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); position: sticky; top: 0; z-index: 5;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px;">
                <div id="btn-topicos-voltar" style="cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                    <i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i> ${topicoAtivoId ? 'Subtópicos' : 'Tópicos'}
                </div>
                <div style="display: flex; gap: 6px;">
                    <button id="btn-search-topicos" title="Pesquisar" style="background:${modoPesquisa ? 'var(--primary)' : 'transparent'}; border:1px solid var(--border-color); color:white; width:28px; height:28px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-magnifying-glass" style="font-size:11px"></i></button>
                    <button id="btn-edit-topicos" title="Modo Edição" style="background:${modoEdicao ? 'var(--primary)' : 'transparent'}; border:1px solid var(--border-color); color:white; width:28px; height:28px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-pen" style="font-size:11px"></i></button>
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

function escutarDados() {
    if (!authRef.currentUser) return;
    const userId = authRef.currentUser.uid;
    const q = query(collection(dbRef, "Topico"), where("userId", "==", userId), where("estado", "==", "ativo"));

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
    
    // 1. Verificamos se este é o item selecionado
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
        div.onclick = () => {
            if (item.tipo === 'topico') {
                topicoAtivoId = item.id;
                renderizarNavegacaoTopicos();
            } else {
                // 2. Guardamos o ID e re-renderizamos a lista lateral para mostrar o estado ativo
                subtopicoSelecionadoId = item.id;
                renderizarNavegacaoTopicos(); 
                prepararSubtopicoNoBrain(item);
            }
        };
    }
    return div;
}

/**
 * LÓGICA DO POPUP (CRIAÇÃO / EDIÇÃO)
 */

async function abrirPopupCriar(dadosEdicao = null) {
    itemSendoEditadoDocId = dadosEdicao ? dadosEdicao.docId : null;
    document.getElementById('topico-nome').value = dadosEdicao ? dadosEdicao.nome : "";
    document.getElementById('subtopico-nome').value = dadosEdicao ? dadosEdicao.nome : "";
    corSelecionada = dadosEdicao ? (dadosEdicao.cor || "") : "";
    
    document.getElementById('titulo-popup-topico').innerText = dadosEdicao ? "Editar Item" : "Novo Tópico / Subtópico";
    document.getElementById('btn-gravar-topico').innerText = dadosEdicao ? "Atualizar" : "Gravar";
    document.getElementById('btn-ocultar-topico').style.display = dadosEdicao ? "block" : "none";
    
    const overlay = document.getElementById('popup-topicos-overlay');
    overlay.classList.add('active');
    
    configurarEventosPopup();
    renderizarCores();
    await carregarDropdownPais(dadosEdicao ? dadosEdicao.topicospai : null);

    const btnTabSub = document.querySelector('[data-target="form-subtopico"]');
    const btnTabTop = document.querySelector('[data-target="form-topico"]');
    const abasNavegacao = document.querySelector('#popup-topicos-overlay .sub-tabs');

    if (dadosEdicao) {
        abasNavegacao.style.display = "none";
        if (dadosEdicao.tipo === 'subtopico') btnTabSub.click();
        else btnTabTop.click();
    } else {
        abasNavegacao.style.display = "flex";
        if (topicoAtivoId) {
            btnTabSub.click();
            const checks = document.querySelectorAll('.check-pai');
            checks.forEach(c => { if(c.value === topicoAtivoId) c.checked = true; });
            atualizarTextoDropdown();
        } else {
            btnTabTop.click();
        }
    }
}

async function carregarDropdownPais(paisSelecionados = null) {
    const cont = document.getElementById('container-dropdown-pais');
    const head = document.getElementById('topicos-pai-select-head');
    
    head.onclick = (e) => {
        e.stopPropagation();
        cont.style.display = cont.style.display === 'block' ? 'none' : 'block';
    };

    const clickFora = () => { cont.style.display = 'none'; document.removeEventListener('click', clickFora); };
    document.addEventListener('click', clickFora);

    const q = query(collection(dbRef, "Topico"), where("userId", "==", authRef.currentUser.uid), where("tipo", "==", "topico"), where("estado", "==", "ativo"));
    const snap = await getDocs(q);
    
    let html = "";
    snap.forEach(d => {
        const data = d.data();
        const isChecked = paisSelecionados && paisSelecionados.includes(data.id) ? "checked" : "";
        html += `
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:12px; cursor:pointer; color:white; padding:5px; border-radius:4px;" class="item-select-pai">
            <input type="checkbox" class="check-pai" ${isChecked} value="${data.id}" data-docid="${d.id}" data-nome="${data.nome}"> ${data.nome}
        </label>`;
    });
    cont.innerHTML = html || '<span style="font-size:11px; color:gray; padding:10px; display:block;">Crie primeiro um tópico.</span>';

    cont.querySelectorAll('.check-pai').forEach(check => {
        check.onchange = () => atualizarTextoDropdown();
    });
    atualizarTextoDropdown(); 
}

function atualizarTextoDropdown() {
    const cont = document.getElementById('container-dropdown-pais');
    if(!cont) return;
    const checks = Array.from(cont.querySelectorAll('.check-pai:checked'));
    const txt = document.getElementById('texto-selecionados');
    const aviso = document.getElementById('aviso-espelho');

    if (checks.length === 0) {
        txt.innerText = "Selecionar Tópicos...";
        txt.style.color = "var(--text-muted)";
        aviso.style.display = 'none';
    } else {
        txt.innerText = checks.map(c => c.dataset.nome).join(', ');
        txt.style.color = "white";
        aviso.style.display = checks.length > 1 ? 'block' : 'none';
    }
}

function configurarEventosPopup() {
    document.getElementById('btn-fechar-topico').onclick = () => document.getElementById('popup-topicos-overlay').classList.remove('active');
    
    const tabs = document.querySelectorAll('.tab-topico');
    tabs.forEach(t => {
        t.onclick = () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.topico-tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(t.dataset.target).style.display = 'block';
        };
    });

  document.getElementById('btn-ocultar-topico').onclick = async () => {
        const confirmou = await confirmarOcultarPopup();
        if (confirmou) {
            await updateDoc(doc(dbRef, "Topico", itemSendoEditadoDocId), { estado: 'desativo' });
            document.getElementById('popup-topicos-overlay').classList.remove('active');
        }
    };

  document.getElementById('btn-gravar-topico').onclick = async () => {
    const btn = document.getElementById('btn-gravar-topico');
    const abaAtiva = document.querySelector('.tab-topico.active').dataset.target;
    const userId = authRef.currentUser.uid;
    
    btn.innerText = "A processar...";
    btn.disabled = true;

    try {
        if (abaAtiva === 'form-topico') {
            const nome = document.getElementById('topico-nome').value.trim();
            if(!nome) throw new Error("Nome obrigatório");
            
            if (itemSendoEditadoDocId) {
                // --- CASCATA PARA TÓPICO PAI ---
                const snap = await getDoc(doc(dbRef, "Topico", itemSendoEditadoDocId));
                const uuid = snap.data().id;
                
                await updateDoc(doc(dbRef, "Topico", itemSendoEditadoDocId), { nome, cor: corSelecionada });
                sincronizarNomeTopicoEmCascata(uuid, nome); // Disparar cascata
            } else {
                // Criação (mantém igual)
                await addDoc(collection(dbRef, "Topico"), {
                    id: crypto.randomUUID(), nome, cor: corSelecionada, estado: 'ativo', tipo: 'topico', userId, timestamp: serverTimestamp(), subtopicos: []
                });
            }
        } else {
            // LÓGICA PARA SUBTÓPICO
            const nome = document.getElementById('subtopico-nome').value.trim();
            const checks = Array.from(document.querySelectorAll('.check-pai:checked'));
            if(!nome || (itemSendoEditadoDocId === null && checks.length === 0)) throw new Error("Nome e pelo menos um Pai obrigatórios");
            
            if (itemSendoEditadoDocId) {
                // --- CASCATA PARA SUBTÓPICO ---
                const snap = await getDoc(doc(dbRef, "Topico", itemSendoEditadoDocId));
                const uuid = snap.data().id;

                const idsPaisInternos = checks.map(c => c.value);
                await updateDoc(doc(dbRef, "Topico", itemSendoEditadoDocId), { nome, topicospai: idsPaisInternos });
                
                sincronizarNomeTopicoEmCascata(uuid, nome); // Disparar cascata
            } else {
                // Criação (mantém igual)
                const idSub = crypto.randomUUID();
                const docIdsFirebase = checks.map(c => c.dataset.docid);
                const idsPaisInternos = checks.map(c => c.value);

                await addDoc(collection(dbRef, "Topico"), {
                    id: idSub, nome, topicospai: idsPaisInternos, estado: 'ativo', tipo: 'subtopico', userId, timestamp: serverTimestamp()
                });
                const updates = docIdsFirebase.map(docId => updateDoc(doc(dbRef, "Topico", docId), { subtopicos: arrayUnion(idSub) }));
                await Promise.all(updates);
            }
        }
        document.getElementById('popup-topicos-overlay').classList.remove('active');
    } catch (err) {
        alert(err.message);
    } finally {
        btn.innerText = "Gravar";
        btn.disabled = false;
    }
};
}

function renderizarCores() {
    const cont = document.getElementById('topico-cor-selector');
    if(!cont) return;
    cont.innerHTML = CORES_TOPICO.map(c => `
        <div onclick="window.setCorTopico('${c.hex}')" style="width:25px; height:25px; border-radius:50%; background:${c.hex}; cursor:pointer; border: ${corSelecionada === c.hex ? '3px solid white' : '1px solid rgba(0,0,0,0.2)'}"></div>
    `).join('');
}

function exporFuncoesGlobais() {
    window.setCorTopico = (hex) => { corSelecionada = hex; renderizarCores(); };
    window.editarTopicoGlobal = async (docId) => {
        const snap = await getDoc(doc(dbRef, "Topico", docId));
        if (snap.exists()) {
            const dados = snap.data();
            abrirPopupCriar({ docId: snap.id, ...dados });
        }
    };
}

function confirmarOcultarPopup() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-topico-overlay');
        const btnSim = document.getElementById('btn-confirmar-ocultar-topico');
        const btnNao = document.getElementById('btn-cancelar-ocultar-topico');

        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

/**
 * Procura em todas as notas do utilizador por vínculos a este Tópico/Subtópico
 * e atualiza o nome exibido nas pills (tanto em caixas como na própria nota).
 */
async function sincronizarNomeTopicoEmCascata(uuidInterno, novoNome) {
    console.log(`🔄 [TÓPICO-CASCATA] Iniciando atualização global para: ${novoNome}`);
    const uid = authRef.currentUser.uid;
    const colecoes = ["Local", "Share"];

    for (const col of colecoes) {
        try {
            const q = query(collection(dbRef, col), where("userId", "==", uid));
            const snap = await getDocs(q);

            for (const docNota of snap.docs) {
                const dadosNota = docNota.data();
                let houveAlteracao = false;
                let updatePayload = {};

                // 1. Verificar vínculos na RAIZ DA NOTA (Tags da nota)
                if (dadosNota.vincTopicos) {
                    const novosVincNota = dadosNota.vincTopicos.map(v => {
                        if (v.id === uuidInterno && v.nome !== novoNome) {
                            houveAlteracao = true;
                            return { ...v, nome: novoNome };
                        }
                        return v;
                    });
                    if (houveAlteracao) updatePayload.vincTopicos = novosVincNota;
                }

                // 2. Verificar vínculos dentro das CAIXAS (Blocos)
                if (dadosNota.caixas) {
                    let caixasMudaram = false;
                    const novasCaixas = dadosNota.caixas.map(caixa => {
                        if (caixa.vincTopicos) {
                            caixa.vincTopicos = caixa.vincTopicos.map(v => {
                                if (v.id === uuidInterno && v.nome !== novoNome) {
                                    houveAlteracao = true;
                                    caixasMudaram = true;
                                    return { ...v, nome: novoNome };
                                }
                                return v;
                            });
                        }
                        return caixa;
                    });
                    if (caixasMudaram) updatePayload.caixas = novasCaixas;
                }

                // Gravar se houver mudanças
                if (houveAlteracao) {
                    console.log(`✅ [TÓPICO-CASCATA] Nome atualizado na nota: ${dadosNota.nome}`);
                    await updateDoc(doc(dbRef, col, docNota.id), updatePayload);
                }
            }
        } catch (e) {
            console.error(`❌ [TÓPICO-CASCATA] Erro na coleção ${col}:`, e);
        }
    }
    console.log("🏁 [TÓPICO-CASCATA] Sincronização concluída.");
}