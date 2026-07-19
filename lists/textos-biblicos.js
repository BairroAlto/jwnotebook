// components/lists/textos-biblicos.js
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { abrirVersiculoNoBrain } from '../direita/biblia-brain.js';

/**
 * INICIALIZA A NAVEGAÇÃO DE TEXTOS ANOTADOS
 */
export async function iniciarNavegacaoTextosBiblicos(db, auth) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // Salvar o estado anterior para poder voltar
    if (!window.htmlListaAntiga) window.htmlListaAntiga = container.innerHTML;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    try {
        const q = query(
            collection(db, "TextosBiblia"),
            where("userId", "==", auth.currentUser.uid),
            where("estado", "==", "on"),
            orderBy("nome", "asc")
        );

        const snap = await getDocs(q);
        const todosTextos = [];
        snap.forEach(d => todosTextos.push(d.data()));

        if (todosTextos.length === 0) {
            renderizarAvisoVazio(container);
            return;
        }

        // 1. Extrair Livros Únicos
        const livrosUnicos = [...new Set(todosTextos.map(t => t.livro))].sort();

        renderizarListaLivros(container, livrosUnicos, todosTextos, db, auth);

    } catch (e) {
        console.error("Erro ao carregar textos bíblicos:", e);
        container.innerHTML = `<p style="color:red; padding:20px; font-size:11px;">Erro ao carregar dados.</p>`;
    }
}

/**
 * NÍVEL 1: LISTA DE LIVROS QUE TÊM ANOTAÇÕES
 */
function renderizarListaLivros(container, livros, todosTextos, db, auth) {
    container.innerHTML = `
        <div id="btn-textos-voltar-raiz" style="padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
            <i class="fa-solid fa-arrow-left"></i> Textos Bíblicos
        </div>
        <div id="textos-scroll" style="flex: 1; overflow-y: auto; padding: 10px 0;">
            ${livros.map(livro => `
                <div class="menu-item-list item-livro-anotado" data-livro="${livro}">
                    <i class="fa-solid fa-book" style="opacity:0.5; font-size:12px;"></i> ${livro}
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btn-textos-voltar-raiz').onclick = () => {
        container.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };

    container.querySelectorAll('.item-livro-anotado').forEach(el => {
        el.onclick = () => {
            const livroSel = el.dataset.livro;
            const textosDoLivro = todosTextos.filter(t => t.livro === livroSel);
            renderizarListaVersiculos(container, livroSel, textosDoLivro, livros, todosTextos, db, auth);
        };
    });
}

/**
 * NÍVEL 2: LISTA DE VERSÍCULOS DENTRO DO LIVRO
 */
function renderizarListaVersiculos(container, livroNome, textos, listaLivros, todos, db, auth) {
    container.innerHTML = `
        <div id="btn-textos-voltar-livros" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
            <i class="fa-solid fa-chevron-left"></i> ${livroNome}
        </div>
        <div id="textos-scroll" style="flex: 1; overflow-y: auto; padding: 10px 0;">
            ${textos.map(t => `
                <div class="menu-item-list item-versiculo-anotado" data-nome="${t.nome}" data-livro="${t.livro}" data-cap="${t.capitulo}" data-ver="${t.versiculo}">
                    <i class="fa-solid fa-quote-left" style="opacity:0.3; font-size:10px;"></i> ${t.nome}
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btn-textos-voltar-livros').onclick = () => {
        renderizarListaLivros(container, listaLivros, todos, db, auth);
    };

    container.querySelectorAll('.item-versiculo-anotado').forEach(el => {
        el.onclick = async () => {
            const { nome, livro, cap, ver } = el.dataset;
            container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
            
            // Buscar o texto original no JSON para abrir no Brain
            const textoOriginal = await buscarTextoNoJson(livro, cap, ver);
            if (typeof window.ensureOfficeRightPanel === 'function') await window.ensureOfficeRightPanel();
            
            // Abrir no Brain (Exatamente como no módulo Bíblia)
            abrirVersiculoNoBrain(livro, cap, ver, textoOriginal, db, auth);
            
            // Voltar a exibir a lista (para não ficar o spinner)
            renderizarListaVersiculos(container, livroNome, textos, listaLivros, todos, db, auth);
        };
    });
}

/**
 * AUXILIAR: BUSCAR TEXTO NO JSON LOCAL
 */
async function buscarTextoNoJson(livro, cap, ver) {
    try {
        const slug = livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
        const response = await fetch(`data/biblia/${slug}.json`);
        const data = await response.json();
        // O JSON pode usar acentos na chave principal, tentamos encontrar a correspondência
        const chaveReal = Object.keys(data).find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === slug);
        return data[chaveReal][cap][ver] || "Texto não encontrado no repositório.";
    } catch (e) {
        return "Erro ao carregar texto do repositório.";
    }
}

function renderizarAvisoVazio(container) {
    container.innerHTML = `
        <div id="btn-textos-voltar-vazio" style="padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); text-transform: uppercase;">
            <i class="fa-solid fa-arrow-left"></i> Voltar
        </div>
        <p style="color:gray; text-align:center; padding:40px; font-size:12px; opacity:0.5;">Ainda não tens textos bíblicos anotados ou vinculados.</p>
    `;
    document.getElementById('btn-textos-voltar-vazio').onclick = () => {
        container.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };
}

/**
 * DELEGAÇÃO DE EVENTOS PARA TEXTOS BÍBLICOS
 * Resolve o problema dos botões mortos após restauração via Memory Bridge
 */
document.addEventListener('click', (e) => {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    if (e.target.closest('#btn-textos-voltar-raiz') || e.target.closest('#btn-textos-voltar-vazio')) {
        if (window.htmlListaAntiga) {
            container.innerHTML = window.htmlListaAntiga;
            window.htmlListaAntiga = null;
        } else if (typeof window.renderizarMenuPrincipalLists === 'function') {
            window.renderizarMenuPrincipalLists();
        }
    }

    if (e.target.closest('#btn-textos-voltar-livros')) {
        import('./textos-biblicos.js').then(m => {
            // Agora usamos as variáveis globais que expusemos no index.html
            m.iniciarNavegacaoTextosBiblicos(window.db, window.auth);
        });
    }
});
