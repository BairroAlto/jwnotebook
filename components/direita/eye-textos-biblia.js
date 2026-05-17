// components/direita/eye-textos-biblia.js
import { BIBLE_ABBREVIATIONS } from '../lists/bilbe-abreviatura.js';

let listaIdsAnteriores = [];

const NUMEROS_TEXTUAIS = {
    "um": 1, "dois": 2, "três": 3, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9, "dez": 10
};

export async function detectarEExibirTextosBiblicos(caixasAtuais) {
    const container = document.getElementById('textos-container');
    if (!container) return;

    // 1. Extrair Texto Bruto
    let textoGlobal = caixasAtuais.filter(c => c.estado === 'ativa')
        .map(c => `${c.titulo || ""} ${c.conteudo || ""}`).join(" [SEP] ");

    // 2. Extrair referências com a lógica completa de intervalos e slices
    const citacoesEncontradas = localizarLivrosESlices(textoGlobal);

    // 3. Comparador de Assinatura (Para não resetar a aba à toa)
    const idsAtuais = citacoesEncontradas.map(r => r.idUnico);
    if (JSON.stringify(idsAtuais) === JSON.stringify(listaIdsAnteriores)) return;

    // 4. Identificar novo para scroll
    let idParaScroll = idsAtuais.find(id => !listaIdsAnteriores.includes(id)) || "";
    listaIdsAnteriores = idsAtuais;

    if (citacoesEncontradas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:11px; opacity:0.5;">Escreve uma referência para ler aqui.</div>`;
        return;
    }

    // 5. Renderizar estrutura
    container.innerHTML = `
        <div style="padding: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <p style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                <i class="fa-solid fa-book-bible"></i> Escrituras Detetadas
            </p>
        </div>
        <div id="lista-escrituras-nota" style="padding: 0 10px 20px 10px; display: flex; flex-direction: column; gap:12px;"></div>
    `;
    const listaArea = document.getElementById('lista-escrituras-nota');

    // 6. Injetar Placeholders Ordenados
    citacoesEncontradas.forEach(ref => {
        const div = document.createElement('div');
        div.id = `bib-card-${ref.idUnico}`;
        div.style.cssText = "background: rgba(255,255,255,0.02); border-radius: 8px; padding: 12px; border: 1px solid transparent; scroll-margin-top: 50px; transition: border 0.5s;";
        div.innerHTML = `<p style="font-size:9px; color:var(--text-muted);">A carregar ${ref.livro}...</p>`;
        listaArea.appendChild(div);
    });

    // 7. Preencher dados (Busca em paralelo)
    await Promise.all(citacoesEncontradas.map(ref => preencherTexto(ref)));

    // 8. Scroll para o novo card
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

function localizarLivrosESlices(texto) {
    const achados = [];
    
    // 1. Organizar chaves por tamanho descendente (essencial!)
    const nomesOrdenados = Object.keys(BIBLE_ABBREVIATIONS).sort((a, b) => b.length - a.length);
    
    // 2. Criar a expressão de busca
    const regexLivros = nomesOrdenados.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // 3. REGEX APERFEIÇOADA:
    // Captura o livro apenas se não estiver "dentro" de outra palavra
    const regexMatchLivro = new RegExp(`(?:^|[^a-zA-Zá-üÀ-ú])(${regexLivros})(?![a-zA-Zá-üÀ-ú])`, 'gi');
    
    let match;
    const posicoesLivros = [];
    const contagemOcorrencias = {};

    // 4. Mapear todas as posições onde aparecem livros
    while ((match = regexMatchLivro.exec(texto)) !== null) {
        const siglaEncontrada = match[1];
        const indiceReal = match.index + match[0].indexOf(siglaEncontrada);
        posicoesLivros.push({ sigla: siglaEncontrada, index: indiceReal });
    }

    // 5. Extrair as coordenadas para cada posição encontrada
    for (let i = 0; i < posicoesLivros.length; i++) {
        const atual = posicoesLivros[i];
        const proximo = posicoesLivros[i + 1];
        
        // Corta o texto do livro atual até ao início do próximo livro
        const sliceTexto = texto.substring(atual.index, proximo ? proximo.index : texto.length);
        
        // Procura os números (Capítulo:Versículo) logo após o nome do livro
        const regexCoordenadas = /(\d+[:\s]\d+(?:[\s,;:-]*\d+)*)/g;
        const matchCoord = sliceTexto.match(regexCoordenadas);

        if (matchCoord) {
            // Identificar qual o livro oficial no dicionário
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
    const partes = str.split(';'); // Separa capítulos (ex: 3:2 ; 4:1)
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
        const grupos = versStr.split(','); // Separa listas (ex: 1, 5)
        
        grupos.forEach(g => {
            const item = g.trim();
            if (item.includes('-')) { // Trata intervalos (ex: 2-5)
                const range = item.split('-');
                const ini = parseInt(range[0]);
                const fim = parseInt(range[1]);
                if (!isNaN(ini) && !isNaN(fim)) {
                    for (let i = Math.min(ini, fim); i <= Math.max(ini, fim); i++) {
                        versiculos.push(i);
                    }
                }
            } else {
                const v = parseInt(item);
                if (!isNaN(v)) versiculos.push(v);
            }
        });

        if (versiculos.length > 0) {
            resultado.citacoes.push({ cap, versiculos: [...new Set(versiculos)] });
        }
    });

    return resultado.citacoes.length > 0 ? resultado : null;
}

async function preencherTexto(ref) {
    const slug = ref.livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    const container = document.getElementById(`bib-card-${ref.idUnico}`);
    if (!container) return;
    
    try {
        const response = await fetch(`data/biblia/${slug}.json`);
        const data = await response.json();
        const livroData = data[ref.livro];

        let html = `<p style="color:var(--primary); font-size:10px; font-weight:800; margin-bottom:8px; text-transform:uppercase;">${ref.livro}</p>`;
        
        ref.citacoes.forEach(cite => {
            const capData = livroData[cite.cap];
            if (capData) {
                cite.versiculos.forEach(vNum => {
                    if (capData[vNum]) {
                        html += `<div style="margin-bottom:6px; line-height:1.4;">
    <b style="color:var(--primary); font-size:9px; margin-right:5px;">${cite.cap}:${vNum}</b>
    <!-- ALTERADO: font-size agora usa a variável CSS -->
    <span style="font-size: var(--fs-biblia-coluna-inteligente); color:#f1f5f9;">${capData[vNum]}</span>
</div>`;
                    }
                });
            }
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p style="color:red; font-size:9px;">Erro ao carregar texto.</p>`;
    }
}

function normalizarLinguagemBiblica(t) {
    let res = t.toLowerCase();
    for (const [word, num] of Object.entries(NUMEROS_TEXTUAIS)) {
        res = res.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
    }
    res = res.replace(/capitulo|capítulo/g, " ").replace(/versiculo|versículo/g, ":");
    return res;
}