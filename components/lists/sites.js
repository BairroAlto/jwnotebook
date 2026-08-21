import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let sitesPublicados = [];
let carregamentoConcluido = false;
let unsubscribeSites = null;
let utilizadorEmEscuta = '';

function compararSites(a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-PT', { sensitivity: 'base' });
}

function estaNaVistaSites() {
    return document.getElementById('lista-lists')?.dataset.listView === 'sites';
}

export function iniciarSites(db, auth) {
    const uid = auth?.currentUser?.uid || '';
    if (!db || !uid || uid === utilizadorEmEscuta) return;

    unsubscribeSites?.();
    utilizadorEmEscuta = uid;
    carregamentoConcluido = false;
    sitesPublicados = [];

    const consulta = query(collection(db, 'Local'), where('userId', '==', uid));
    unsubscribeSites = onSnapshot(consulta, snapshot => {
        sitesPublicados = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .filter(nota => nota?.sites?.estado === 'on')
            .sort(compararSites);
        carregamentoConcluido = true;
        if (estaNaVistaSites()) renderizarNavegacaoSites();
    }, erro => {
        console.error('[SITES][LISTS] Não foi possível carregar os Sites publicados:', erro);
        sitesPublicados = [];
        carregamentoConcluido = true;
        if (estaNaVistaSites()) renderizarNavegacaoSites({ erro: true });
    });
}

export function pararSites() {
    unsubscribeSites?.();
    unsubscribeSites = null;
    utilizadorEmEscuta = '';
    sitesPublicados = [];
    carregamentoConcluido = false;
}

function criarCabecalho(container) {
    const voltar = document.createElement('button');
    voltar.type = 'button';
    voltar.className = 'menu-item-list';
    voltar.style.cssText = 'width:100%; background:transparent; font:inherit; text-align:left;';
    voltar.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Voltar a Lists';
    voltar.addEventListener('click', () => window.renderizarMenuPrincipalLists?.());
    container.appendChild(voltar);

    const titulo = document.createElement('div');
    titulo.style.cssText = 'padding:12px 10px 6px; color:var(--text-muted); font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase;';
    titulo.textContent = 'Sites publicados';
    container.appendChild(titulo);
}

function criarSiteItem(site) {
    const link = document.createElement('a');
    link.className = 'menu-item-list';
    link.href = `sites.html?id=${encodeURIComponent(site.id)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Abrir Site noutra página';
    link.style.textDecoration = 'none';

    const icone = document.createElement('i');
    icone.className = 'fa-solid fa-globe';
    icone.style.color = '#22c55e';

    const nome = document.createElement('span');
    nome.textContent = site.nome || 'Nota sem título';

    const externo = document.createElement('i');
    externo.className = 'fa-solid fa-arrow-up-right-from-square';
    externo.style.cssText = 'margin-left:auto; font-size:9px; opacity:.55;';

    link.append(icone, nome, externo);
    return link;
}

export function renderizarNavegacaoSites({ erro = false } = {}) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    container.replaceChildren();
    container.dataset.listView = 'sites';
    window.htmlListaAntiga = null;
    criarCabecalho(container);

    if (erro) {
        const mensagem = document.createElement('p');
        mensagem.style.cssText = 'padding:20px 10px; color:var(--text-muted); font-size:12px; text-align:center;';
        mensagem.textContent = 'Não foi possível carregar os Sites.';
        container.appendChild(mensagem);
        return;
    }

    if (!carregamentoConcluido) {
        const estado = document.createElement('p');
        estado.style.cssText = 'padding:20px 10px; color:var(--text-muted); font-size:12px; text-align:center;';
        estado.textContent = 'A carregar Sites…';
        container.appendChild(estado);
        return;
    }

    if (!sitesPublicados.length) {
        const vazio = document.createElement('p');
        vazio.style.cssText = 'padding:20px 10px; color:var(--text-muted); font-size:12px; text-align:center; line-height:1.5;';
        vazio.textContent = 'Ainda não tens notas publicadas como Site.';
        container.appendChild(vazio);
        return;
    }

    sitesPublicados.forEach(site => container.appendChild(criarSiteItem(site)));
}
