// components/lists/marcadores-list.js
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirVersiculoNoBrain } from '../direita/biblia-brain.js';

/**
 * INICIALIZA A LISTAGEM DE MARCADORES (LISTS)
 */
export async function iniciarNavegacaoMarcadores(db, auth) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    if (!window.htmlListaAntiga) window.htmlListaAntiga = container.innerHTML;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    try {
        const q = query(
            collection(db, "Marcador"),
            where("userId", "==", auth.currentUser.uid),
            where("estado", "==", "on")
        );

        const snap = await getDocs(q);
        const listaMarcadores = [];
        snap.forEach(d => listaMarcadores.push({ docId: d.id, ...d.data() }));

        if (listaMarcadores.length === 0) {
            renderizarAvisoVazio(container);
            return;
        }

        renderizarListaCategorias(container, listaMarcadores, db, auth);

    } catch (e) {
        console.error("Erro ao carregar marcadores:", e);
        container.innerHTML = `<p style="color:red; padding:20px; font-size:11px;">Erro de permissão ou rede.</p>`;
    }
}

/**
 * NÍVEL 1: LISTA DE CATEGORIAS (Ex: Promessas, Profecias...)
 */
function renderizarListaCategorias(container, marcadores, db, auth) {
    container.innerHTML = `
        <div id="btn-marc-voltar-raiz" style="padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
            <i class="fa-solid fa-arrow-left"></i> Marcadores
        </div>
        <div id="marcadores-scroll" style="flex: 1; overflow-y: auto; padding: 10px 0;">
            ${marcadores.map(m => `
                <div class="menu-item-list item-categoria-marcada" data-id="${m.docId}">
                    <i class="fa-solid fa-bookmark" style="color: #ef4444; font-size:12px; opacity:0.8;"></i> 
                    <span style="flex:1;">${m.nome}</span>
                    <small style="opacity:0.4; font-size:9px;">${m.textosbiblia?.length || 0}</small>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btn-marc-voltar-raiz').onclick = () => {
        container.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };

    container.querySelectorAll('.item-categoria-marcada').forEach(el => {
        el.onclick = () => {
            const marcador = marcadores.find(m => m.docId === el.dataset.id);
            renderizarVersiculosDoMarcador(container, marcador, marcadores, db, auth);
        };
    });
}

/**
 * NÍVEL 2: LISTA DE VERSÍCULOS DENTRO DO MARCADOR
 */
async function renderizarVersiculosDoMarcador(container, marcador, listaCompleta, db, auth) {
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    const idsVersiculos = marcador.textosbiblia || [];

    if (idsVersiculos.length === 0) {
        container.innerHTML = `
            <div id="btn-marc-voltar-cat" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
                <i class="fa-solid fa-chevron-left"></i> ${marcador.nome}
            </div>
            <p style="color:gray; text-align:center; padding:40px; font-size:11px;">Nenhum versículo nesta categoria.</p>
        `;
    } else {
        // Buscar os nomes dos versículos na coleção TextosBiblia
        const promessas = idsVersiculos.map(async (id) => {
            const q = query(collection(db, "TextosBiblia"), where("id", "==", id), where("userId", "==", auth.currentUser.uid));
            const s = await getDocs(q);
            return s.empty ? null : s.docs[0].data();
        });

        const resultados = (await Promise.all(promessas)).filter(r => r !== null);

        container.innerHTML = `
            <div id="btn-marc-voltar-cat" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
                <i class="fa-solid fa-chevron-left"></i> ${marcador.nome}
            </div>
            <div id="marcadores-scroll" style="flex: 1; overflow-y: auto; padding: 10px 0;">
                ${resultados.map(v => `
                    <div class="menu-item-list item-v-clique" data-livro="${v.livro}" data-cap="${v.capitulo}" data-ver="${v.versiculo}">
                        <i class="fa-solid fa-quote-left" style="opacity:0.3; font-size:10px;"></i> ${v.nome}
                    </div>
                `).join('')}
            </div>
        `;
    }

    document.getElementById('btn-marc-voltar-cat').onclick = () => {
        renderizarListaCategorias(container, listaCompleta, db, auth);
    };

    container.querySelectorAll('.item-v-clique').forEach(el => {
        el.onclick = async () => {
            const { livro, cap, ver } = el.dataset;
            const textoOriginal = await buscarTextoNoJson(livro, cap, ver);
            if (typeof window.ensureOfficeRightPanel === 'function') await window.ensureOfficeRightPanel();
            abrirVersiculoNoBrain(livro, cap, ver, textoOriginal, db, auth);
        };
    });
}

/**
 * AUXILIAR: BUSCAR TEXTO NO JSON
 */
async function buscarTextoNoJson(livro, cap, ver) {
    try {
        const slug = livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
        const response = await fetch(`data/biblia/${slug}.json`);
        const data = await response.json();
        const chaveReal = Object.keys(data).find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === slug);
        return data[chaveReal][cap][ver];
    } catch (e) { return "Texto não disponível."; }
}

function renderizarAvisoVazio(container) {
    container.innerHTML = `
        <div id="btn-marc-voltar-v" style="padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
            <i class="fa-solid fa-arrow-left"></i> Voltar
        </div>
        <p style="color:gray; text-align:center; padding:40px; font-size:12px; opacity:0.5;">Ainda não criaste categorias de marcadores.</p>
    `;
    document.getElementById('btn-marc-voltar-v').onclick = () => {
        container.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };
}

/**
 * DELEGAÇÃO DE EVENTOS PARA MARCADORES
 * Garante que a navegação funciona após restauração via Memory Bridge
 */
document.addEventListener('click', (e) => {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    if (e.target.closest('#btn-marc-voltar-raiz') || e.target.closest('#btn-marc-voltar-v')) {
        if (window.htmlListaAntiga) {
            container.innerHTML = window.htmlListaAntiga;
            window.htmlListaAntiga = null;
        } else if (typeof window.renderizarMenuPrincipalLists === 'function') {
            window.renderizarMenuPrincipalLists();
        }
    }

    if (e.target.closest('#btn-marc-voltar-cat')) {
        import('./marcadores-list.js').then(m => {
            // CORREÇÃO: Usar window.db e window.auth
            m.iniciarNavegacaoMarcadores(window.db, window.auth);
        });
    }
});
