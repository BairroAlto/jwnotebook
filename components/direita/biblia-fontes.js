// components/direita/biblia-fontes.js
import { 
    doc, 
    updateDoc, 
    getDoc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    getDocs,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { abrirPesquisaCodex } from '../editor/modulos/codex-browser.js';
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';

let currentRef = null;
let unsubFontes = null;
let urlsTemp = [""]; 
let linkSendoEditado = null;
let currentUid = null;

/**
 * LIMPEZA
 */
export function limparFontesBiblia() {
    if (unsubFontes) { unsubFontes(); unsubFontes = null; }
}

/**
 * RENDERIZAÇÃO DA ABA LINKS/CODEX
 */
export async function renderizarFontesBiblia(info, container, db, auth) {
    const nomeCompleto = `${info.livro} ${info.cap}:${info.ver}`;
    currentUid = auth.currentUser.uid;
    limparFontesBiblia();

    // 1. CONFIGURAR ALVOS PARA O POPUP GLOBAL
    // Guardamos o ID do versículo para que, quando o popup de links abrir, ele saiba onde gravar
    const docId = await obterDocIdBiblia(nomeCompleto, currentUid, db);
    
    if (docId) {
        currentRef = doc(db, "TextosBiblia", docId);
    }

    // 2. REGISTAR O OUVINTE DO BOTÃO VERDE (HEADER)
    // O index.html dispara 'brain:abrirPopupFontes'
    window.removeEventListener('brain:abrirPopupFontes', window._handlerBibliaFontes);
    
    window._handlerBibliaFontes = () => {
        console.log("📥 [FONTES-BIBLIA] Abrindo configurador de fontes...");
        
        // Antes de abrir, dizemos ao sistema que o alvo é o Versículo
        window.colecaoAlvoFontes = "TextosBiblia";
        window.idAlvoFontes = docId; 
        
        // Chamamos a função de abertura que já tens no ficheiro
        abrirPopupFontesBiblia();
    };
    
    window.addEventListener('brain:abrirPopupFontes', window._handlerBibliaFontes);

    // 3. SE O DOC NÃO EXISTE, AVISAR
    if (!docId) {
        container.innerHTML = `<p style="color:gray; text-align:center; margin-top:30px; font-size:11px; opacity:0.5;">Cria primeiro uma anotação (aba +) para poderes adicionar fontes.</p>`;
        return;
    }

    currentRef = doc(db, "TextosBiblia", docId);

unsubFontes = onSnapshot(currentRef, (docSnap) => {
    if (!docSnap.exists()) return;

    // 1. INICIALIZAR REGISTO GLOBAL (Crucial para o Scroll na esquerda)
    if (!window.__codexGlobalRegistry) window.__codexGlobalRegistry = {};

    const dados = docSnap.data();
    const fontes = dados.Fontes || { Links: [], codex: [] };

    // Limpar o container antes de renderizar
    container.innerHTML = "";

    // 2. RENDERIZAR LINKS (Hiperligações externas)
    const linksAtivos = (fontes.Links || []).filter(l => l.estado === "ativo")
        .sort((a,b) => (b.favorito === 'sim' ? 1 : 0) - (a.favorito === 'sim' ? 1 : 0));
    
    linksAtivos.forEach(link => {
        container.appendChild(criarCardLinkUI(link, fontes.Links));
    });

    // 3. RENDERIZAR CODEX (Mapeamentos de Livros/Publicações)
    const codexAtivos = (fontes.codex || []).filter(c => c.estado === "ativo")
        .sort((a,b) => (b.favorito === 'sim' ? 1 : 0) - (a.favorito === 'sim' ? 1 : 0));
        
    codexAtivos.forEach((item, index) => {
        // REGISTO NA RAM PARA O "SALTO" ENCONTRAR OS METADADOS
        window.__codexGlobalRegistry[item.id] = item;

        // CRIAR O CARD VISUAL
        container.appendChild(criarCardCodexUI(item, fontes.codex, index));
    });
});

/**
 * UI: CARD CODEX (Customizado para Bíblia: Sem Lápis + Com Lixeira)
 */
function criarCardCodexUI(item, listaOriginal, index) {
    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.marginBottom = "10px";

    // 1. Gerar HTML base (passamos "" para esconder o lápis de edição)
    div.innerHTML = SharedUI.renderCodexCard(item, "");

    // 2. Localizar o grupo de botões no topo direito do card
    const btnGroup = div.querySelector('div[style*="position: absolute"]');

    if (btnGroup) {
        // 3. Injetar Ícone de Lixeira
        const btnDel = document.createElement('i');
        btnDel.className = "fa-solid fa-trash-can";
        btnDel.style.cssText = "color:#f87171; cursor:pointer; font-size:13px; margin-left: 10px; transition: 0.2s; opacity: 0.7;";
        btnDel.title = "Remover Mapeamento";

        btnDel.onmouseenter = () => btnDel.style.opacity = "1";
        btnDel.onmouseleave = () => btnDel.style.opacity = "0.7";

        // 4. Lógica de Remoção no Firebase
        btnDel.onclick = async (e) => {
            e.stopPropagation();
            
            const confirmou = await confirmarAcaoBiblia(
                "Remover Mapeamento?", 
                "Desejas remover este vínculo bibliográfico deste versículo?"
            );

            if (confirmou) {
                try {
                    // Filtra a lista para remover o item pelo ID
                    const novaLista = listaOriginal.filter(c => c.id !== item.id);
                    
                    // Grava a nova lista no Firestore (currentRef definido no init do ficheiro)
                    await updateDoc(currentRef, { 
                        "Fontes.codex": novaLista 
                    });
                    
                    console.log("✅ [SISTEMA] Vínculo removido do Firebase.");
                } catch (err) {
                    console.error("Erro ao remover:", err);
                }
            }
        };

        btnGroup.appendChild(btnDel);
    }

    return div;
}

    // Lógica de Favoritos
    window.toggleFavoritoFonte = async (tipo, idItem) => {
        const snap = await getDoc(currentRef);
        const dados = snap.data();
        const campo = (tipo === 'links') ? "Fontes.Links" : "Fontes.codex";
        const lista = (tipo === 'links') ? [...dados.Fontes.Links] : [...dados.Fontes.codex];

        const item = lista.find(i => (tipo === 'links' ? i.timestamp === idItem : i.id === idItem));
        if (item) {
            item.favorito = (item.favorito === "sim") ? "nao" : "sim";
            await updateDoc(currentRef, { [campo]: lista });
        }
    };
}

/**
 * UI: CARD LINK (Integrado com SharedUI)
 */
function criarCardLinkUI(link, listaOriginal) {
    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.marginBottom = "10px";

    const refCompativel = {
        id: link.timestamp,
        titulo: link.titulo,
        link: link.hiperlinks[0],
        favorito: link.favorito || "nao"
    };

    // Usamos a referência window para o onclick
    div.innerHTML = SharedUI.renderLinkCard(refCompativel, `window.abrirPopupFontesBiblia(${JSON.stringify(link).replace(/"/g, '&quot;')})`);

    const btnGroup = div.querySelector('div[style*="right: 8px"]');
    if (btnGroup) {
        const btnDel = document.createElement('i');
        btnDel.className = "fa-solid fa-trash-can";
        btnDel.style.cssText = "color:#f87171; cursor:pointer; font-size:12px; margin-left: 2px;";
        btnDel.onclick = async (e) => {
            e.stopPropagation();
            if (await confirmarAcaoBiblia("Remover Fonte?", "Desejas ocultar este link?")) {
                const novaLista = listaOriginal.map(l => l.timestamp === link.timestamp ? {...l, estado: "desativo"} : l);
                await updateDoc(currentRef, { "Fontes.Links": novaLista });
            }
        };
        btnGroup.appendChild(btnDel);
    }
    return div;
}

/**
 * UI: CARD CODEX
 */
function criarCardCodexUI(item, listaOriginal, index) {
    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.marginBottom = "10px";

    // 1. Geramos o HTML base SEM o botão de editar (passando "")
    div.innerHTML = SharedUI.renderCodexCard(item, "");

    // 2. Localizamos o grupo de botões no topo direito do card gerado
    const btnGroup = div.querySelector('div[style*="position: absolute"]');

    if (btnGroup) {
        // 3. Criamos o ícone da lixeira
        const btnDel = document.createElement('i');
        btnDel.className = "fa-solid fa-trash-can";
        btnDel.style.cssText = "color:#f87171; cursor:pointer; font-size:13px; margin-left: 8px; transition: 0.2s; opacity: 0.7;";
        btnDel.title = "Remover Vínculo";

        // Efeito hover manual
        btnDel.onmouseenter = () => btnDel.style.opacity = "1";
        btnDel.onmouseleave = () => btnDel.style.opacity = "0.7";

        // 4. Lógica de clique para remover do Firebase
        btnDel.onclick = async (e) => {
            e.stopPropagation();
            
            // Usamos a função de confirmação que já tens no ficheiro
            const confirmou = await confirmarAcaoBiblia(
                "Remover Mapeamento?", 
                "Tens a certeza que desejas remover este vínculo de codex deste versículo?"
            );

            if (confirmou) {
                console.log("🗑️ [SISTEMA] Removendo mapeamento:", item.id);
                
                try {
                    // Remove o item da lista (filtrando pelo ID único do codex)
                    const novaLista = listaOriginal.filter(c => c.id !== item.id);
                    
                    // Atualiza o documento "TextosBiblia" no Firebase
                    // currentRef é a variável global que já tens definida no topo do ficheiro
                    await updateDoc(currentRef, { 
                        "Fontes.codex": novaLista 
                    });
                    
                    console.log("✅ Vínculo removido com sucesso.");
                } catch (err) {
                    console.error("Erro ao remover vínculo:", err);
                    alert("Erro ao remover. Verifica a tua ligação.");
                }
            }
        };

        // Adicionamos a lixeira ao grupo de botões (onde estava o lápis)
        btnGroup.appendChild(btnDel);
    }

    return div;
}

/**
 * POPUP DE CONFIGURAÇÃO DE LINKS
 */
export function abrirPopupFontesBiblia(dadosEdicao = null) {
    const overlay = document.getElementById('popup-cosmos-fontes-overlay');
    if (!overlay) return;
    linkSendoEditado = dadosEdicao;
    overlay.classList.add('active');

    const tabLinks = overlay.querySelector('[data-target="tab-f-links"]');
    const tabCodex = overlay.querySelector('[data-target="tab-f-codex"]');

    tabLinks.onclick = () => {
        tabLinks.classList.add('active'); tabCodex.classList.remove('active');
        document.getElementById('tab-f-links').style.display = 'block';
        document.getElementById('tab-f-codex').style.display = 'none';
    };
    
    tabCodex.onclick = () => {
        overlay.classList.remove('active');
        abrirPesquisaCodex(async (dadosCodex) => {
            if (!dadosCodex) return;
            const novoItem = { ...dadosCodex, id: crypto.randomUUID(), userId: currentUid, timestamp: new Date().toISOString(), estado: "ativo", favorito: "nao", partilha: "desativado" };
            await updateDoc(currentRef, { "Fontes.codex": arrayUnion(novoItem) });
        });
    };

    const inputTitulo = document.getElementById('f-link-titulo');
    const btnGravar = document.getElementById('btn-gravar-f-cosmos');
    
    if (dadosEdicao) {
        inputTitulo.value = dadosEdicao.titulo;
        urlsTemp = [...dadosEdicao.hiperlinks];
        tabCodex.style.display = 'none';
    } else {
        inputTitulo.value = "";
        urlsTemp = [""];
        tabCodex.style.display = 'inline-flex';
    }

    renderizarInputsUrls();
    tabLinks.click();

    document.getElementById('btn-mais-url').onclick = () => { urlsTemp.push(""); renderizarInputsUrls(); };
    document.getElementById('btn-fechar-fontes-cosmos').onclick = () => overlay.classList.remove('active');
    document.getElementById('btn-cancelar-f-cosmos').onclick = () => overlay.classList.remove('active');
    btnGravar.onclick = gravarLinksNoFirebase;
}

/**
 * EDIÇÃO DE CODEX
 */
export async function editarCodexBiblia(index) {
    const snap = await getDoc(currentRef);
    const item = snap.data().Fontes.codex[index];
    abrirPesquisaCodex(async (novosDados) => {
        if (!novosDados) return;
        const lista = snap.data().Fontes.codex;
        lista[index] = { ...item, ...novosDados };
        await updateDoc(currentRef, { "Fontes.codex": lista });
    }, item);
}

// --- AUXILIARES ---

function renderizarInputsUrls() {
    const cont = document.getElementById('container-inputs-urls');
    cont.innerHTML = urlsTemp.map((val, i) => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <input type="text" class="input-url-f" data-idx="${i}" value="${val}" placeholder="https://..." style="flex:1; padding:10px; background:var(--bg-panel); border:1px solid var(--border-color); color:white; border-radius:6px;">
            ${urlsTemp.length > 1 ? `<i class="fa-solid fa-xmark btn-remove-url" data-idx="${i}" style="color:#f87171; cursor:pointer;"></i>` : ''}
        </div>`).join('');
    cont.querySelectorAll('.input-url-f').forEach(input => {
        input.oninput = (e) => { urlsTemp[e.target.dataset.idx] = e.target.value; };
    });
    cont.querySelectorAll('.btn-remove-url').forEach(btn => {
        btn.onclick = () => { urlsTemp.splice(btn.dataset.idx, 1); renderizarInputsUrls(); };
    });
}

async function gravarLinksNoFirebase() {
    const titulo = document.getElementById('f-link-titulo').value.trim();
    const urlsValidas = urlsTemp.filter(u => u.trim() !== "");
    if (!titulo || urlsValidas.length === 0) return alert("Preenche os campos.");
    const snap = await getDoc(currentRef);
    let listaLinks = snap.data().Fontes?.Links || [];
    if (linkSendoEditado) {
        listaLinks = listaLinks.map(l => l.timestamp === linkSendoEditado.timestamp ? { ...l, titulo, hiperlinks: urlsValidas } : l);
    } else {
        listaLinks.push({ timestamp: new Date().toISOString(), titulo, hiperlinks: urlsValidas, estado: "ativo", favorito: "nao" });
    }
    await updateDoc(currentRef, { "Fontes.Links": listaLinks });
    document.getElementById('popup-cosmos-fontes-overlay').classList.remove('active');
}

async function obterDocIdBiblia(nome, uid, db) {
    const q = query(collection(db, "TextosBiblia"), where("userId", "==", uid), where("nome", "==", nome));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].id;
}

function confirmarAcaoBiblia(titulo, mensagem) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-rem-fonte-overlay');
        const btnSim = document.getElementById('btn-confirmar-rem-fonte');
        const btnNao = document.getElementById('btn-cancelar-rem-fonte');
        if (!overlay) return resolve(confirm(mensagem));
        document.getElementById('rem-fonte-titulo').innerText = titulo;
        document.getElementById('rem-fonte-msg').innerText = mensagem;
        overlay.classList.add('active');
        const fechar = (r) => { overlay.classList.remove('active'); btnSim.onclick = null; resolve(r); };
        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

/**
 * LÓGICA PARA ADICIONAR MAPEAMENTO CODEX NO BRAIN DA BÍBLIA
 * Substitui o código antigo dentro do evento de clique da aba Codex.
 */
async function adicionarCodexBiblia() {
    // 1. Fechar o popup de fontes (se estiver aberto) para dar lugar ao browser
    const overlayFontes = document.getElementById('popup-cosmos-fontes-overlay');
    if (overlayFontes) overlayFontes.classList.remove('active');

    // 2. Abrir o Explorador Automático
    abrirPesquisaCodex(async (dadosReferencia) => {
        if (!dadosReferencia) return;

        console.log("📖 [BIBLIA-CODEX] Processando seleção do explorador...");

        // 3. Importar o Handler Central para garantir consistência de dados
        import('../editor/modulos/tags/tags-handlers-codex.js').then(async (mHandler) => {
            
            // Criar o contexto para o processador (passando as instâncias globais)
            const ctx = {
                dbRef: db, // Instância do Firestore passada na inicialização
                authRef: auth, 
                notaMaeId: "BIBLIA_BRAIN" // Identificador para a Biblioteca Global
            };

            // 4. Gerar os sub-documentos limpos (oque/sequencia/mês numérico)
            const novosItens = mHandler.prepararGrupoSemantico(dadosReferencia, ctx);

            try {
                // 5. Gravar no array Fontes.codex do documento TextosBiblia atual
                // currentRef é a referência ao doc do versículo (ex: Jó 1:1)
                await updateDoc(currentRef, { 
                    "Fontes.codex": arrayUnion(...novosItens) 
                });

                // 6. Sincronizar cada sub-item individualmente com a Biblioteca Global
                for (const item of novosItens) {
                    await mHandler.executarSincronizacaoForcada(item, ctx);
                }

                console.log("✅ [BIBLIA-CODEX] Mapeamento concluído e indexado.");
                
            } catch (error) {
                console.error("❌ [BIBLIA-CODEX] Erro ao gravar mapeamento:", error);
                alert("Erro ao salvar o mapeamento na base de dados.");
            }
        });
    });
}

/**
 * FABRICA DE CARDS CODEX PARA BÍBLIA
 * Força a substituição do lápis pela lixeira.
 */
function criarCardCodexBiblia(item, deOnde, db) {
    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.marginBottom = "10px";

    // 1. Gerar o HTML base (Passamos null para o edit)
    div.innerHTML = SharedUI.renderCodexCard(item, null);

    // 2. LOCALIZAÇÃO E LIMPEZA AGRESSIVA
    // Procuramos o grupo de botões no topo direito
    const btnGroup = div.querySelector('div[style*="position: absolute"]');
    
    if (btnGroup) {
        // Removemos qualquer lápis que tenha sobrado por erro de renderização do componente
        const pencil = btnGroup.querySelector('.fa-pen-to-square, .fa-pen');
        if (pencil) pencil.remove();

        // 3. ADICIONAR A LIXEIRA (Se ainda não existir no grupo)
        if (!btnGroup.querySelector('.fa-trash-can')) {
            const btnDel = document.createElement('i');
            btnDel.className = "fa-solid fa-trash-can";
            btnDel.style.cssText = "color:#f87171; cursor:pointer; font-size:13px; opacity:0.7; transition: 0.2s; margin-left: 5px;";
            
            btnDel.onmouseenter = () => btnDel.style.opacity = "1";
            btnDel.onmouseleave = () => btnDel.style.opacity = "0.7";

            btnDel.onclick = async (e) => {
                e.stopPropagation();
                const confirmou = await SharedPuzzleUI.confirmarAcao(
                    "Remover Vínculo?", 
                    "Desejas retirar este mapeamento do versículo? (O estudo original será preservado)"
                );

                if (confirmou) {
                    try {
                        if (deOnde === "Biblioteca") {
                            await updateDoc(currentRef, { Biblioteca: arrayRemove(item.id) });
                        } else {
                            const snap = await getDoc(currentRef);
                            const novaLista = snap.data().Fontes.codex.map(c => 
                                c.id === item.id ? { ...c, estado: "desativo" } : c
                            );
                            await updateDoc(currentRef, { "Fontes.codex": novaLista });
                        }
                    } catch (err) { console.error(err); }
                }
            };
            btnGroup.appendChild(btnDel);
        }
    }

    return div;
}