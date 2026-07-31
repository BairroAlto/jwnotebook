// components/direita/eye-textos-biblia.js
import { BIBLE_ABBREVIATIONS } from '../lists/bilbe-abreviatura.js';

let listaIdsAnteriores = [];

/**
 * MOTOR DE DETECÇÃO BÍBLICA "EYE"
 * @param {Array} caixasParaVarrer - Lista de caixas filtrada pelo Dispatcher
 */
export async function detectarEExibirTextosBiblicos(caixasParaVarrer) {
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

    // 5. RENDERIZAR ESTRUTURA BASE
    if (citacoesEncontradas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Escreve uma referência (ex: João 3:16) para ler aqui.</div>`;
        return;
    }

    container.innerHTML = `
        <div style="padding: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <p style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                <i class="fa-solid fa-book-bible"></i> Escrituras Detetadas (${citacoesEncontradas.length})
            </p>
        </div>
        <div id="lista-escrituras-nota" style="padding: 0 10px 20px 10px; display: flex; flex-direction: column; gap:12px;"></div>
    `;
    
    const listaArea = document.getElementById('lista-escrituras-nota');

    // 6. INJETAR PLACEHOLDERS E CARREGAR TEXTOS EM PARALELO
    citacoesEncontradas.forEach(ref => {
        const div = document.createElement('div');
        div.id = `bib-card-${ref.idUnico}`;
        div.style.cssText = "background: rgba(255,255,255,0.02); border-radius: 8px; padding: 12px; border: 1px solid transparent; transition: border 0.5s;";
        div.innerHTML = `<p style="font-size:9px; color:var(--text-muted); opacity:0.5;">Sincronizando ${ref.livro}...</p>`;
        listaArea.appendChild(div);
    });

    // Dispara a busca nos ficheiros JSON locais
    await Promise.all(citacoesEncontradas.map(ref => preencherTextoNoCard(ref)));

    // 7. UX: SCROLL PARA O NOVO TEXTO DETETADO
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

        let html = `<p style="color:var(--primary); font-size:10px; font-weight:800; margin-bottom:8px; text-transform:uppercase;">${ref.livro}</p>`;
        
        ref.citacoes.forEach(cite => {
            const capData = livroData[cite.cap];
            if (capData) {
                cite.versiculos.forEach(vNum => {
                    if (capData[vNum]) {
                        html += `
                        <div style="margin-bottom:6px; line-height:1.4;">
                            <b style="color:var(--primary); font-size:9px; margin-right:5px;">${cite.cap}:${vNum}</b>
                            <span style="font-size: var(--fs-biblia-coluna-inteligente); color:#f1f5f9;">${capData[vNum]}</span>
                        </div>`;
                    }
                });
            }
        });
        card.innerHTML = html;
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