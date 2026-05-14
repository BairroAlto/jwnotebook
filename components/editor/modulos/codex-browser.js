// components/editor/modulos/codex-browser.js
import { SIGLAS_PUBLICACOES } from '../../lists/siglas-data.js';
import { mostrarAviso } from './tags/tags-utils.js';
import { DISPONIVEL_LIVROS, DISPONIVEL_PUBLICACOES, DISPONIVEL_VIDEOS, ANOS_DISPONIVEIS } from '../../lists/repositorio-data.js';

let callbackConfirmacao = null;
let caminhoAtual = ['data']; 
let ficheiroAberto = null;
let itensSelecionados = []; 
let capituloAbertoNum = null; 
let artigoAbertoIdx = null; 

function formatarNomeMes(nomeFicheiro) {
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const id = nomeFicheiro.replace('.json', '');
    if (id.includes('_')) {
        const [m, d] = id.split('_');
        return `${parseInt(d)} de ${meses[parseInt(m) - 1]}`;
    }
    const idx = parseInt(id) - 1;
    return meses[idx] || id;
}

window.toggleSelecaoCodex = (ref, oque, el) => {
    const index = itensSelecionados.findIndex(p => p.ref == ref && p.oque == oque);
    if (index > -1) {
        itensSelecionados.splice(index, 1);
        el.style.background = "transparent";
        el.style.borderLeftColor = "transparent";
    } else {
        itensSelecionados.push({ ref, oque });
        el.style.background = "rgba(99, 102, 241, 0.2)";
        el.style.borderLeftColor = "var(--primary)";
    }
    atualizarUIBloqueio();
};

export function iniciarCodexBrowser() {
    const overlay = document.getElementById('popup-codex-browser-overlay');
    const btnFechar = document.getElementById('btn-fechar-codex-browser');
    const btnConfirmar = document.getElementById('btn-confirmar-codex');

    if (btnFechar) btnFechar.onclick = () => overlay.classList.remove('active');
    
    if (btnConfirmar) {
        btnConfirmar.onclick = () => {
            if (itensSelecionados.length === 0) {
    // Substitui o alert por este:
    return mostrarAviso("Seleciona pelo menos um item para mapear.");
}
            
            const json = ficheiroAberto;
            const ficheiroSegmento = caminhoAtual[caminhoAtual.length - 1];
            const idFicheiroReal = ficheiroSegmento.replace('.json', '');
            const anoDetectado = caminhoAtual.find(p => p.match(/^\d{4}$/)) || "";

            const agrupado = itensSelecionados.reduce((acc, item) => {
                if (!acc[item.oque]) acc[item.oque] = [];
                acc[item.oque].push(item.ref);
                return acc;
            }, {});

            const mapeamentoFinal = Object.keys(agrupado).map(tipo => ({
                oque: tipo,
                sequencia: [...new Set(agrupado[tipo])].sort((a, b) => a - b)
            }));

            // --- INICIALIZAÇÃO CORRETA DOS DADOS ---
            let dadosParaEnviar = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                estado: "ativo",
                favorito: "nao",
                mapeamento: mapeamentoFinal,
                ano: anoDetectado,
                contexto: "", sigla: "", referencia: "", mes: "", multimediapath: "", capitulo: "", artigo: "", titulo: ""
            };

            if (json.video) {
                dadosParaEnviar.contexto = "multimedia";
                dadosParaEnviar.sigla = "jwbvod";
                dadosParaEnviar.multimediapath = String(json.video.id);
                dadosParaEnviar.referencia = json.video.referencia;
                dadosParaEnviar.titulo = json.video.titulo;
            } 
            else if (json.capitulos) {
                const capObj = json.capitulos.flat().find(c => c.capitulo == capituloAbertoNum);
                dadosParaEnviar.contexto = "livro";
                dadosParaEnviar.sigla = json.id || idFicheiroReal;
                dadosParaEnviar.capitulo = String(capituloAbertoNum);
                dadosParaEnviar.titulo = capObj ? capObj.titulo : "";
            } 
            else if (json.artigos) {
                const art = json.artigos[artigoAbertoIdx];
                const idxPub = caminhoAtual.indexOf('publicacoes');
                dadosParaEnviar.contexto = "publicacao";
                // A sigla real é a pasta a seguir a "publicacoes" (ex: w ou mwb)
                dadosParaEnviar.sigla = (idxPub !== -1) ? caminhoAtual[idxPub + 1] : idFicheiroReal;
                dadosParaEnviar.mes = idFicheiroReal;
                dadosParaEnviar.referencia = art ? art.referencia : "";
                dadosParaEnviar.artigo = art ? art.titulo : "";
            }

            if (callbackConfirmacao) callbackConfirmacao(dadosParaEnviar);
            overlay.classList.remove('active');
        };
    }
}

export async function abrirPesquisaCodex(callback) {
    callbackConfirmacao = callback;
    itensSelecionados = [];
    capituloAbertoNum = null;
    artigoAbertoIdx = null;
    caminhoAtual = ['data']; 
    document.getElementById('popup-codex-browser-overlay').classList.add('active');
    renderizarNivelRaiz();
    atualizarUIBloqueio();
}

window.codexNavegar = async (segmento) => {
    if (segmento === '..') {
        if (itensSelecionados.length > 0) return mostrarAviso("Remove a seleção para voltar.");
        if (artigoAbertoIdx !== null) { artigoAbertoIdx = null; renderizarListaArtigos(); return; }
        if (capituloAbertoNum !== null) { capituloAbertoNum = null; renderizarListaCapitulos(); return; }
        caminhoAtual.pop();
    } else {
        caminhoAtual.push(segmento);
    }
    const path = caminhoAtual.join('/');
    document.getElementById('codex-navegacao-caminho').innerText = path.replace('data/', '');
    if (caminhoAtual.length === 1) return renderizarNivelRaiz();
    const nivel = caminhoAtual[caminhoAtual.length - 1];
    let htmlVoltar = `<div class="menu-item-list" onclick="window.codexNavegar('..')" style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-arrow-left"></i> Voltar</div>`;
    if (nivel.endsWith('.json')) carregarFicheiroEProcessar(path);
    else if (nivel === 'livros') listarLivrosDiretos(path, htmlVoltar);
    else if (nivel.match(/^\d{4}$/)) listarFicheirosDoAno(path, htmlVoltar);
    else renderizarAnos(htmlVoltar);
};

async function carregarFicheiroEProcessar(url) {
    try {
        const response = await fetch(url);
        ficheiroAberto = await response.json();
        if (ficheiroAberto.capitulos) renderizarListaCapitulos();
        else if (ficheiroAberto.artigos) renderizarListaArtigos();
        else if (ficheiroAberto.video) renderizarParagrafos(ficheiroAberto.video.conteudo, ficheiroAberto.video.titulo);
    } catch (e) { console.error(e); }
}

function renderizarNivelRaiz() {
    const lista = document.getElementById('codex-browser-lista');
    lista.innerHTML = `
        <div class="menu-item-list" onclick="window.codexNavegar('livros')"><i class="fa-solid fa-book"></i> Livros</div>
        <div class="menu-item-list" onclick="window.codexNavegar('publicacoes/w')"><i class="fa-solid fa-copy"></i> A Sentinela</div>
        <div class="menu-item-list" onclick="window.codexNavegar('publicacoes/mwb')"><i class="fa-solid fa-calendar-check"></i> Manual de Atividades</div>
        <div class="menu-item-list" onclick="window.codexNavegar('multimedia')"><i class="fa-solid fa-clapperboard"></i> Multimédia</div>`;
}

function renderizarAnos(btnVoltar) {
    const lista = document.getElementById('codex-browser-lista');
    const htmlAnos = ANOS_DISPONIVEIS.map(ano => `<div class="cap-btn" style="text-align:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:4px; cursor:pointer;" onclick="window.codexNavegar('${ano}')">${ano}</div>`).join('');
    lista.innerHTML = btnVoltar + `<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:10px;">${htmlAnos}</div>`;
}

async function listarFicheirosDoAno(path, btnVoltar) {
    const lista = document.getElementById('codex-browser-lista');
    const isMult = path.includes('multimedia');
    const listaUsar = isMult ? DISPONIVEL_VIDEOS : DISPONIVEL_PUBLICACOES;
    const fragmento = document.createDocumentFragment();
    let encontrou = false;
    const checks = listaUsar.map(async (f) => {
        const url = `${path}/${f}.json`;
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json(); encontrou = true;
                const div = document.createElement('div'); div.className = "menu-item-list";
                if (isMult && data.video) div.innerHTML = `<i class="fa-solid fa-play" style="color:var(--primary); font-size:10px; margin-right:12px;"></i><div style="display:flex; flex-direction:column;"><span style="font-size:13px; color:white; font-weight:600;">${data.video.titulo}</span><small style="font-size:9px; color:var(--text-muted);">Ficheiro ${f}</small></div>`;
                else div.innerHTML = `<i class="fa-solid fa-calendar-day" style="opacity:0.5; margin-right:12px;"></i><span>Ficheiro ${f}</span>`;
                div.onclick = () => carregarFicheiroEProcessar(url); return div;
            }
        } catch(e) {} return null;
    });
    const res = await Promise.all(checks);
    lista.innerHTML = btnVoltar;
    res.forEach(el => { if(el) fragmento.appendChild(el); });
    if (!encontrou) lista.innerHTML += `<p style="text-align:center; color:gray; padding:30px;">Vazio.</p>`;
    else lista.appendChild(fragmento);
}

function renderizarListaArtigos() {
    const lista = document.getElementById('codex-browser-lista');
    let html = `<div class="menu-item-list" onclick="window.codexNavegar('..')" style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-arrow-left"></i> Voltar</div>`;
    ficheiroAberto.artigos.forEach((art, index) => {
        html += `<div class="menu-item-list" onclick="window.abrirArtigoNoBrowser(${index})"><div style="display:flex; flex-direction:column;"><small style="color:var(--text-muted); font-size:9px;">ARTIGO ${index + 1}</small><span style="font-size:13px; color:white;">${art.titulo}</span></div></div>`;
    });
    lista.innerHTML = html;
}

window.abrirArtigoNoBrowser = (index) => { artigoAbertoIdx = index; renderizarParagrafos(ficheiroAberto.artigos[index].conteudo, ficheiroAberto.artigos[index].titulo); };

function renderizarListaCapitulos() {
    const lista = document.getElementById('codex-browser-lista');
    let html = `<div class="menu-item-list btn-voltar-navegacao" onclick="window.codexNavegar('..')" style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-arrow-left"></i> Voltar</div>`;
    ficheiroAberto.capitulos.forEach((item, index) => { const cap = Array.isArray(item) ? item[0] : item; html += `<div class="menu-item-list" onclick="window.abrirCapituloNoBrowser(${index})"><span>Capítulo ${cap.capitulo} - ${cap.titulo}</span></div>`; });
    lista.innerHTML = html;
}

window.abrirCapituloNoBrowser = (index) => { const item = ficheiroAberto.capitulos[index]; const cap = Array.isArray(item) ? item[0] : item; capituloAbertoNum = cap.capitulo; renderizarParagrafos(cap.conteudo, `Capítulo ${cap.capitulo}`); };

function renderizarParagrafos(conteudo, subtitulo = "") {
    const lista = document.getElementById('codex-browser-lista');
    let html = `<div class="menu-item-list btn-voltar-navegacao" onclick="window.codexNavegar('..')" style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-arrow-left"></i> Voltar</div>`;
    if (subtitulo) html += `<div style="padding:10px 15px; font-size:10px; color:var(--text-muted); background:rgba(0,0,0,0.2); text-transform:uppercase; font-weight:700;">${subtitulo}</div>`;
    conteudo.forEach(b => {
        const tiposValidos = ["paragrafo", "discurso", "pergunta", "subtema", "video", "musical", "rodape", "resumo"];
        if (tiposValidos.includes(b.tipo)) {
            const isSelected = itensSelecionados.some(p => p.ref == b.numero_ref && p.oque == b.tipo);
            html += `<div class="codex-item-select" onclick="window.toggleSelecaoCodex('${b.numero_ref}', '${b.tipo}', this)" style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.05); border-left: 3px solid ${isSelected ? 'var(--primary)' : 'transparent'}; cursor:pointer; font-size:12px; transition: 0.2s; background:${isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><b style="color:var(--primary); text-transform:uppercase; font-size:9px; letter-spacing:0.5px;">${b.tipo} ${b.numero_ref || ''}</b>${b.pagina ? `<small style="opacity:0.5;">pág. ${b.pagina}</small>` : ''}</div>
                    <div style="line-height:1.5; color:#cbd5e1;">${b.texto.substring(0, 160)}...</div>
                </div>`;
        }
    });
    lista.innerHTML = html; atualizarUIBloqueio();
}

async function listarLivrosDiretos(path, btnVoltar) {
    const lista = document.getElementById('codex-browser-lista');
    const res = await Promise.all(DISPONIVEL_LIVROS.map(async (s) => {
        try { const r = await fetch(`${path}/${s}.json`, { method: 'HEAD' }); if (r.ok) return `<div class="menu-item-list" onclick="window.codexNavegar('${s}.json')"><i class="fa-solid fa-book-open" style="color:var(--primary);"></i><span style="margin-left:12px; font-size:13px; color:white;">${SIGLAS_PUBLICACOES[s] || s.toUpperCase()}</span></div>`; } catch(e) {} return null;
    }));
    lista.innerHTML = btnVoltar + res.filter(r => r !== null).join('');
}

function atualizarUIBloqueio() {
    const info = document.getElementById('codex-selecionados-info');
    if (info) info.innerText = `${itensSelecionados.length} selecionado(s)`;
}