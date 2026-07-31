// components/direita/eye-textos-biblia.js
import { BIBLE_ABBREVIATIONS } from '../lists/bilbe-abreviatura.js';

let listaIdsAnteriores = [];

/**
 * MOTOR DE DETECÇÃO BÍBLICA "EYE"
 * @param {Array} caixasParaVarrer - Lista de caixas filtrada pelo Dispatcher
 */
export async function detectarEExibirTextosBiblicos(caixasParaVarrer) {
    const db = window.notaAtualContext?.db;
    const auth = window.notaAtualContext?.auth;
    if (db && auth) {
        iniciarPrecarregamentoSegundoPlano(db, auth);
    }
    const container = document.getElementById('textos-container');
    if (!container) return;

    // Se o Dispatcher ou o SwitchTab enviarem uma lista vazia, limpamos a aba
    if (!caixasParaVarrer || caixasParaVarrer.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Nenhuma referência bíblica detetada neste modo.</div>`;
        listaIdsAnteriores = [];
        return;
    }

    // 2. EXTRAIR TEXTO BRUTO (Apenas das caixas permitidas)
   let textoGlobal = caixasParaVarrer
        .map(c => `${c.titulo || ""} ${c.conteudo || ""}`)
        .join(" [SEP] ");

    // 3. EXTRAIR REFERÊNCIAS REAIS (Lógica de Livros e Capítulos)
    const citacoesEncontradas = localizarLivrosESlices(textoGlobal);

    // 4. COMPARADOR DE ASSINATURA (Evita resetar a aba enquanto o utilizador escreve)
    const idsAtuais = citacoesEncontradas.map(r => r.idUnico);
    if (JSON.stringify(idsAtuais) === JSON.stringify(listaIdsAnteriores)) return;

    // Identificar se há algo novo para fazer scroll automático
    let idParaScroll = idsAtuais.find(id => !listaIdsAnteriores.includes(id)) || "";
    listaIdsAnteriores = idsAtuais;

    // 5. RENDERIZAR ESTRUTURA BASE (INCREMENTAL E SEM RECARREGAR CARDS EXISTENTES)
    if (citacoesEncontradas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Escreve uma referência (ex: João 3:16) para ler aqui.</div>`;
        return;
    }

    let listaArea = document.getElementById('lista-escrituras-nota');
    let headerCont = container.querySelector('.escrituras-header-count');

    if (!listaArea) {
        container.innerHTML = `
            <div style="padding: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <p style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                    <i class="fa-solid fa-book-bible"></i> Escrituras Detetadas (<span class="escrituras-header-count">${citacoesEncontradas.length}</span>)
                </p>
            </div>
            <div id="lista-escrituras-nota" style="padding: 0 10px 20px 10px; display: flex; flex-direction: column; gap:12px;"></div>
        `;
        listaArea = document.getElementById('lista-escrituras-nota');
    } else if (headerCont) {
        headerCont.textContent = citacoesEncontradas.length;
    }

    // 6. REMOVER CARDS QUE DEIXARAM DE EXISTIR
    const cardsExistentes = listaArea.querySelectorAll('[id^="bib-card-"]');
    cardsExistentes.forEach(cardEl => {
        const idCard = cardEl.id.replace('bib-card-', '');
        if (!idsAtuais.includes(idCard)) {
            cardEl.remove();
        }
    });

    // 7. INJETAR E REORDENAR NA POSIÇÃO EXATA DA NOTA
    const novasRefsParaCarregar = [];
    citacoesEncontradas.forEach((ref, index) => {
        const idCard = `bib-card-${ref.idUnico}`;
        let div = document.getElementById(idCard);
        const ehNovo = !div;

        if (ehNovo) {
            div = document.createElement('div');
            div.id = idCard;
            div.style.cssText = "background: rgba(255,255,255,0.02); border-radius: 8px; padding: 12px; border: 1px solid transparent; transition: border 0.5s;";
            div.innerHTML = `<p style="font-size:9px; color:var(--text-muted); opacity:0.5;">Sincronizando ${ref.livro}...</p>`;
            novasRefsParaCarregar.push(ref);
        }

        const filhoNaPosicao = listaArea.children[index];
        if (filhoNaPosicao !== div) {
            listaArea.insertBefore(div, filhoNaPosicao || null);
        }
    });

    // Carrega apenas os novos cartões
    if (novasRefsParaCarregar.length > 0) {
        await Promise.all(novasRefsParaCarregar.map(ref => preencherTextoNoCard(ref)));
    }

    // 8. UX: SCROLL PARA O NOVO TEXTO DETETADO
    if (idParaScroll) {
        setTimeout(() => {
            const elAlvo = document.getElementById(`bib-card-${idParaScroll}`);
            if (elAlvo) {
                elAlvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
                elAlvo.style.borderColor = 'var(--primary)';
                setTimeout(() => elAlvo.style.borderColor = 'transparent', 1500);
            }
        }, 300);
    }
}

import { abrirVersiculoNoBrain } from './biblia-brain.js';
import { collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let cacheVersiculosComConteudo = new Set();
let unsubPreloadTB = null;
let unsubPreloadLocal = null;
let precarregadoUid = null;

export function iniciarPrecarregamentoSegundoPlano(db, auth) {
    const uid = auth?.currentUser?.uid;
    if (!db || !uid || precarregadoUid === uid) return;

    if (unsubPreloadTB) unsubPreloadTB();
    if (unsubPreloadLocal) unsubPreloadLocal();

    precarregadoUid = uid;
    console.log("⚡ [EYE-BIBLE] Inicializando pré-carregamento em segundo plano...");

    const qTB = query(collection(db, "TextosBiblia"), where("userId", "==", uid));
    unsubPreloadTB = onSnapshot(qTB, (snapTB) => {
        snapTB.forEach(docSnap => {
            const data = docSnap.data();
            const nome = data.nome;
            if (!nome) return;

            const temPuzzle = Boolean(
                (data.Puzzle && (
                    (Array.isArray(data.Puzzle.quadros) && data.Puzzle.quadros.length > 0) ||
                    (Array.isArray(data.Puzzle.blocos) && data.Puzzle.blocos.length > 0)
                )) ||
                (Array.isArray(data.Blocos) && data.Blocos.length > 0) ||
                (Array.isArray(data.textos) && data.textos.length > 0)
            );

            const temFontes = Boolean(
                data.Fontes && (
                    (Array.isArray(data.Fontes.Links) && data.Fontes.Links.length > 0) ||
                    (Array.isArray(data.Fontes.codex) && data.Fontes.codex.length > 0) ||
                    (Array.isArray(data.Fontes) && data.Fontes.length > 0)
                )
            );

            const temDossie = Boolean(
                (Array.isArray(data.Micas) && data.Micas.length > 0) ||
                (Array.isArray(data.Dossies) && data.Dossies.length > 0)
            );

            const eMarcador = data.marcador === 'sim';

            if (temPuzzle || temFontes || temDossie || eMarcador) {
                cacheVersiculosComConteudo.add(nome);
            } else {
                cacheVersiculosComConteudo.delete(nome);
            }
        });
    });

    const qLocal = query(collection(db, "Local"), where("userId", "==", uid));
    unsubPreloadLocal = onSnapshot(qLocal, (snapLocal) => {
        snapLocal.forEach(docN => {
            const nData = docN.data();
            if (nData.estado === "on" && Array.isArray(nData.caixas)) {
                nData.caixas.forEach(c => {
                    if (c.estado === "on" && Array.isArray(c.neuroniosBiba)) {
                        c.neuroniosBiba.forEach(ref => cacheVersiculosComConteudo.add(ref));
                    }
                });
            }
        });
    });
}

function verificarTemConteudoVersiculo(nomeVersiculo, db, auth) {
    if (db && auth) {
        iniciarPrecarregamentoSegundoPlano(db, auth);
    }
    return cacheVersiculosComConteudo.has(nomeVersiculo);
}

/**
 * FUNÇÕES AUXILIARES DE PROCESSAMENTO (MANTIDAS DO MOTOR ORIGINAL)
 */

async function preencherTextoNoCard(ref) {
    const slug = ref.livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const card = document.getElementById(`bib-card-${ref.idUnico}`);
    if (!card) return;

    const caminhoFicheiro = `./data/biblia/${slug}.json`;
    console.log(`🔍 [EYE-BIBLE] Carregando: ${caminhoFicheiro} (${ref.livro})`);
    
    try {
        const response = await fetch(caminhoFicheiro);
        if (!response.ok) {
            console.error(`❌ [EYE-BIBLE 404] Ficheiro não encontrado no servidor: ${caminhoFicheiro} (Status: ${response.status})`);
            console.warn(`💡 [DICA DEPLOY] Certifica-te de que o ficheiro '${slug}.json' foi adicionado ao Git e publicado no servidor.`);
            card.innerHTML = `
                <p style="color:#ef4444; font-size:10px; font-weight:700; margin-bottom:4px;">⚠️ ${ref.livro} (404 Not Found)</p>
                <p style="color:var(--text-muted); font-size:9px;">Ficheiro <code>data/biblia/${slug}.json</code> em falta no servidor online.</p>
            `;
            return;
        }

        const data = await response.json();
        const livroData = data[ref.livro];

        if (!livroData) {
            console.error(`❌ [EYE-BIBLE] Chave '${ref.livro}' não encontrada dentro de ${caminhoFicheiro}`);
            card.innerHTML = `<p style="color:#ef4444; font-size:9px;">Chave do livro '${ref.livro}' inválida no JSON.</p>`;
            return;
        }

        const db = window.notaAtualContext?.db;
        const auth = window.notaAtualContext?.auth;

        let html = `<p style="color:var(--primary); font-size:10px; font-weight:800; margin-bottom:8px; text-transform:uppercase;">${ref.livro}</p>`;
        
        for (const cite of ref.citacoes) {
            const capData = livroData[cite.cap];
            if (!capData) continue;

            for (const vNum of cite.versiculos) {
                if (!capData[vNum]) continue;

                const nomeVersiculo = `${ref.livro} ${cite.cap}:${vNum}`;
                const temConteudo = await verificarTemConteudoVersiculo(nomeVersiculo, db, auth);

                const corB = temConteudo ? '#ec4899' : 'var(--primary)';
                const estiloB = `color:${corB}; font-size:9px; margin-right:5px; cursor:pointer;${temConteudo ? ' font-weight:800;' : ''}`;
                const textoLimpo = String(capData[vNum]).replace(/"/g, '&quot;');

                html += `
                <div style="margin-bottom:6px; line-height:1.4;">
                    <b class="biblia-ver-ref${temConteudo ? ' is-pink' : ''}" 
                       data-livro="${ref.livro}" 
                       data-cap="${cite.cap}" 
                       data-ver="${vNum}" 
                       data-texto="${textoLimpo}"
                       style="${estiloB}">${cite.cap}:${vNum}</b>
                    <span style="font-size: var(--fs-biblia-coluna-inteligente); color:#f1f5f9;">${capData[vNum]}</span>
                </div>`;
            }
        }
        card.innerHTML = html;

        card.querySelectorAll('.biblia-ver-ref').forEach(b => {
            b.addEventListener('click', () => {
                const db = window.notaAtualContext?.db;
                const auth = window.notaAtualContext?.auth;
                if (db && auth) {
                    abrirVersiculoNoBrain(b.dataset.livro, b.dataset.cap, b.dataset.ver, b.dataset.texto, db, auth);
                }
            });
        });

        console.log(`✅ [EYE-BIBLE] Sucesso ao carregar ${ref.livro}`);
    } catch (e) {
        console.error(`❌ [EYE-BIBLE ERRO] Falha ao ler ${caminhoFicheiro}:`, e);
        card.innerHTML = `<p style="color:#ef4444; font-size:9px;">Erro ao ler o texto bíblico no repositório.</p>`;
    }
}

function localizarLivrosESlices(texto) {
    const achados = [];
    const nomesOrdenados = Object.keys(BIBLE_ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const regexLivros = nomesOrdenados.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regexMatchLivro = new RegExp(`(?:^|[^a-zA-Zá-üÀ-ú])(${regexLivros})(?![a-zA-Zá-üÀ-ú])`, 'gi');
    
    let match;
    const posicoesLivros = [];
    const contagemOcorrencias = {};

    while ((match = regexMatchLivro.exec(texto)) !== null) {
        const siglaEncontrada = match[1];
        const indiceReal = match.index + match[0].indexOf(siglaEncontrada);
        posicoesLivros.push({ sigla: siglaEncontrada, index: indiceReal });
    }

    for (let i = 0; i < posicoesLivros.length; i++) {
        const atual = posicoesLivros[i];
        const proximo = posicoesLivros[i + 1];
        const sliceTexto = texto.substring(atual.index, proximo ? proximo.index : texto.length);
        const regexCoordenadas = /(\d+[:\s]\d+(?:[\s,;:-]*\d+)*)/g;
        const matchCoord = sliceTexto.match(regexCoordenadas);

        if (matchCoord) {
            const chaveOriginal = Object.keys(BIBLE_ABBREVIATIONS).find(k => k.toLowerCase() === atual.sigla.toLowerCase());
            const livroOficial = BIBLE_ABBREVIATIONS[chaveOriginal];
            const coordenadasBrutas = matchCoord[0];
            const estruturado = processarCoordenadas(livroOficial, coordenadasBrutas);
            
            if (estruturado) {
                const baseKey = `${livroOficial}-${coordenadasBrutas}`.replace(/[:\s,;]/g, '-');
                contagemOcorrencias[baseKey] = (contagemOcorrencias[baseKey] || 0) + 1;
                achados.push({
                    ...estruturado,
                    idUnico: `${baseKey}-${contagemOcorrencias[baseKey]}`
                });
            }
        }
    }
    return achados;
}

function processarCoordenadas(livro, str) {
    const partes = str.split(';');
    let resultado = { livro, citacoes: [] };
    let ultimoCap = null;

    partes.forEach(p => {
        let bloco = p.trim();
        if (!bloco) return;
        let cap, versStr;
        if (bloco.includes(':')) {
            const split = bloco.split(':');
            cap = parseInt(split[0]);
            versStr = split[1];
            ultimoCap = cap;
        } else if (ultimoCap !== null) {
            cap = ultimoCap;
            versStr = bloco;
        } else return;

        const versiculos = [];
        const grupos = versStr.split(',');
        grupos.forEach(g => {
            const item = g.trim();
            if (item.includes('-')) {
                const range = item.split('-');
                const ini = parseInt(range[0]);
                const fim = parseInt(range[1]);
                if (!isNaN(ini) && !isNaN(fim)) {
                    for (let i = Math.min(ini, fim); i <= Math.max(ini, fim); i++) versiculos.push(i);
                }
            } else {
                const v = parseInt(item);
                if (!isNaN(v)) versiculos.push(v);
            }
        });
        if (versiculos.length > 0) resultado.citacoes.push({ cap, versiculos: [...new Set(versiculos)] });
    });
    return resultado.citacoes.length > 0 ? resultado : null;
}

/**
 * FERRAMENTA DE DIAGNÓSTICO BÍBLICO ONLINE
 * Executa uma verificação rápida aos 66 ficheiros da Bíblia no servidor online.
 * Para usar no browser: escreve `diagnosticarTextosBiblicos()` na consola.
 */
window.diagnosticarTextosBiblicos = async function() {
    console.log("%c🔍 [DIAGNÓSTICO BÍBLICO] Testando a presença dos 66 ficheiros JSON no servidor...", "color: #3b82f6; font-weight: bold;");
    
    const ficheiros = [
        "1_corintios", "1_cronicas", "1_joao", "1_pedro", "1_reis", "1_samuel", "1_tessalonicenses", "1_timoteo",
        "2_corintios", "2_cronicas", "2_joao", "2_pedro", "2_reis", "2_samuel", "2_tessalonicenses", "2_timoteo",
        "3_joao", "ageu", "amos", "apocalipse", "atos", "cantico_de_salomao", "colossenses", "daniel", "deuteronomio",
        "eclesiastes", "efesios", "esdras", "ester", "exodo", "ezequiel", "filemon", "filipenses", "galatas", "genesis",
        "habacuque", "hebreus", "isaias", "jeremias", "jo", "joao", "joel", "jonas", "josue", "judas", "juizes",
        "lamentacoes", "levitico", "lucas", "malaquias", "marcos", "mateus", "miqueias", "naum", "neemias", "numeros",
        "obadias", "oseias", "proverbios", "romanos", "rute", "salmos", "sofonias", "tiago", "tito", "zacarias"
    ];

    let okCount = 0;
    let emFalta = [];

    await Promise.all(ficheiros.map(async (slug) => {
        try {
            const res = await fetch(`./data/biblia/${slug}.json`, { method: 'HEAD' });
            if (res.ok) {
                okCount++;
            } else {
                emFalta.push(`${slug}.json (HTTP ${res.status})`);
            }
        } catch (e) {
            emFalta.push(`${slug}.json (Erro de ligação)`);
        }
    }));

    console.log(`%c📊 [RESULTADO DIAGNÓSTICO]: ${okCount}/66 Ficheiros disponíveis no servidor.`, okCount === 66 ? "color: #22c55e; font-weight: bold;" : "color: #ef4444; font-weight: bold;");
    
    if (emFalta.length > 0) {
        console.warn("⚠️ FICHEIROS EM FALTA NO SERVIDOR ONLINE:", emFalta);
        console.warn("👉 Dica: Certifica-te de que a pasta 'data/biblia/' foi publicada no teu servidor de alojamento.");
    } else {
        console.log("🎉 Excelente! Todos os 66 ficheiros da Bíblia estão presentes e funcionais no servidor.");
    }

    return { disponiveis: okCount, total: 66, emFalta };
};