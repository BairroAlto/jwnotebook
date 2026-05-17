// components/direita/xsat-controller.js
import { processarPesquisaSat } from './xsat-engine.js';
import { AIController } from './ai-controller.js';


const estadosCanais = {
    1: { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' },
    2: { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' },
    3: { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' },
    4: { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' },
    5: { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' },
    6: { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' } 
};

let canalSelecionadoUI = null;
let jumpInProgress = false;


export function iniciarXSat() {
    const botoesNum = document.querySelectorAll('.xsat-num');
    const subNav = document.getElementById('xsat-sub-nav');

  botoesNum.forEach(btn => {
        btn.onclick = () => {
            const num = btn.dataset.num;
            
            // Se já clicámos neste canal e ele já está ativo, ignoramos (evita loops)
            if (btn.classList.contains('active') && canalSelecionadoUI === num) {
                // Exceção: Se for o 6, deixamos passar para atualizar a lista se houver notas novas
                if (num !== "6") return; 
            }

            botoesNum.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            canalSelecionadoUI = num;

            if (num === "6") {
                if (subNav) subNav.style.display = 'none';
                AIController.renderizarLista();
            } else {
                // MODO SATÉLITE (1-5): Mostra sub-nav e resultados
                if (subNav) subNav.style.display = 'flex';
                
                const canal = estadosCanais[num];
                if (canal && canal.ativa) {
                    // Sincronizar botões da sub-nav com a aba guardada do canal
                    document.querySelectorAll('#xsat-sub-nav button').forEach(b => b.classList.remove('active'));
                    const btnAba = document.getElementById(getAbaId(canal.abaAtiva));
                    if (btnAba) btnAba.classList.add('active');
                    
                    renderizarResultados(canal.dados[canal.abaAtiva]);
                } else {
                    mostrarCanalLivre(num);
                }
            }
        };
    });

    // Delegar cliques da sub-nav (Publicações, Livros, etc.)
    const mapAbas = { 'btn-xsat-pub': 'publicacoes', 'btn-xsat-liv': 'livros', 'btn-xsat-vid': 'multimedia', 'btn-xsat-set': 'definicoes' };
    document.querySelectorAll('#xsat-sub-nav button').forEach(btn => {
        btn.onclick = () => {
            if (!canalSelecionadoUI || canalSelecionadoUI === "6") return;
            
            const canal = estadosCanais[canalSelecionadoUI];
            const abaAlvo = mapAbas[btn.id];
            
            canal.abaAtiva = abaAlvo;
            document.querySelectorAll('#xsat-sub-nav button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (abaAlvo === 'definicoes') renderizarDefinicoesCanal(canalSelecionadoUI);
            else if (canal.dados) renderizarResultados(canal.dados[abaAlvo]);
        };
    });
}


function getAbaId(nome) {
    const ids = { 'publicacoes': 'btn-xsat-pub', 'livros': 'btn-xsat-liv', 'multimedia': 'btn-xsat-vid', 'definicoes': 'btn-xsat-set' };
    return ids[nome];
}

/**
 * DISPARAR PESQUISA PARABÓLICA (COM DELAY ARTÍSTICO MÍNIMO)
 */
/**
 * DISPARAR PESQUISA PARABÓLICA (COM FEEDBACK INSTANTÂNEO E DELAY ARTÍSTICO)
 * Chamado por: Antenas das Caixas, Botão Global do Lab, ou Satélite da Biblioteca.
 */
export async function dispararPesquisaParabolica(textoBruto, isGlobal = false) {
    console.log(`🛰️ [X-SAT] Iniciando varredura ${isGlobal ? 'GLOBAL' : 'INDIVIDUAL'}`);

    // 1. FEEDBACK IMEDIATO: Saltar para o painel X-SAT na hora!
    if (window.switchPanel) {
        window.switchPanel('xsat');
    } else {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('panel-xsat').classList.add('active');
    }

    // 2. GESTÃO DE CANAL
    // Procura o primeiro canal livre ou limpa o Canal 1 se estiverem todos ocupados
    let canalId = Object.keys(estadosCanais).find(id => estadosCanais[id].ativa === false);
    if (!canalId) {
        canalId = "1";
        estadosCanais[1] = { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' };
    }

    canalSelecionadoUI = canalId;

    // Ativar visualmente o número do canal no topo
    document.querySelectorAll('.xsat-num').forEach(b => b.classList.remove('active'));
    const btnNum = document.querySelector(`.xsat-num[data-num="${canalId}"]`);
    if (btnNum) btnNum.classList.add('active');

    // 3. INJETAR ANIMAÇÃO ARTÍSTICA IMEDIATAMENTE (Antes de processar o texto)
    const display = document.getElementById('xsat-display-content');
    if (!display) return;

    const temaCor = isGlobal ? '#34d399' : '#6366f1';
    const iconePrincipal = isGlobal ? 'fa-satellite' : 'fa-satellite';

    display.innerHTML = `
        <div class="xsat-sync-wrapper ${isGlobal ? 'global-mode' : ''}">
            
            <!-- Chuva de Meteoros (10 elementos para o CSS desenhar) -->
            <div class="xsat-meteor-rain">
                ${'<div class="meteor"></div>'.repeat(10)}
            </div>

            <!-- Núcleo do Satélite e Sistema de Órbita -->
            <div class="xsat-visual-core">
                <div class="xsat-radar-wave"></div>
                <div class="xsat-radar-wave"></div>
                
                <div class="xsat-orbital-system">
                    <div class="orbital-particle p1"></div>
                    <div class="orbital-particle p2"></div>
                    <div class="orbital-particle p3"></div>
                </div>

                <i class="fa-solid ${iconePrincipal} xsat-main-icon"></i>
            </div>

            <!-- Interface de Sincronização -->
            <div class="xsat-progress-box">
                <div class="xsat-bar-container">
                    <div class="xsat-bar-fill"></div>
                </div>
                
                <div class="xsat-scan-line"></div>

                <div class="xsat-text" style="color: ${temaCor}">
                    ${isGlobal ? 'GLOBAL NETWORK SYNC' : 'SCANNING SATELLITE...'}
                </div>
                
                <div style="font-size: 8px; color:rgba(255,255,255,0.3); text-align:center; margin-top:8px; font-family:monospace; letter-spacing:1px; font-weight:800;">
                    ESTABLISHING UPLINK • CANAL ${canalId}
                </div>
            </div>
        </div>`;

    // 4. INICIAR PROCESSAMENTO COM SUSPENSÃO ARTÍSTICA (Min. 2.2 segundos)
    estadosCanais[canalId].ativa = true;
    
    try {
        // Corremos a pesquisa e o cronómetro de animação em paralelo
        const [payload] = await Promise.all([
            processarPesquisaSat(textoBruto, canalId),
            new Promise(resolve => setTimeout(resolve, 2200)) 
        ]);

        // 5. VALIDAR RESULTADOS
        if (!payload || !payload.referencias || payload.referencias.length === 0) {
            display.innerHTML = `
                <div style="text-align:center; padding:50px 20px; opacity:0.6;">
                    <i class="fa-solid fa-satellite-dish" style="font-size:40px; margin-bottom:15px; color:var(--primary);"></i>
                    <p style="font-size:12px; font-weight:700;">VARREDURA COMPLETA</p>
                    <p style="font-size:10px; margin-top:5px;">Nenhuma referência bíblica foi detetada para pesquisa.</p>
                    <button onclick="window.limparCanalX(${canalId})" style="margin-top:20px; background:transparent; border:1px solid var(--border-color); color:white; padding:8px 15px; border-radius:4px; font-size:10px; cursor:pointer;">FECHAR CANAL</button>
                </div>`;
            estadosCanais[canalId].ativa = false;
            return;
        }

        // 6. MAPEAR DADOS E ATIVAR PICCARDS
        estadosCanais[canalId].versiculos = payload.referencias.map(ref => ({
            nome: `${ref.livro} ${ref.cap}:${ref.ver}`,
            ativo: true 
        }));

        estadosCanais[canalId].dados = payload.resultados;

        // 7. FINALIZAR: MOSTRAR RESULTADOS (Abre a aba de Publicações por defeito)
        const btnPub = document.getElementById('btn-xsat-pub');
        if (btnPub) btnPub.click(); 

    } catch (e) {
        console.error("❌ [X-SAT] Erro de Sinal:", e);
        display.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px; font-size:11px; font-weight:800;">SATELLITE OFFLINE</p>`;
        estadosCanais[canalId].ativa = false;
    }
}

// REGISTO GLOBAL PARA O EDITOR E FERRAMENTAS
window.dispararPesquisaParabolica = dispararPesquisaParabolica;

function renderizarResultados(lista) {
    const display = document.getElementById('xsat-display-content');
    const subNav = document.getElementById('xsat-sub-nav'); // A barra de ícones (Pubs, Livros...)

    if (!canalSelecionadoUI || !lista) return;

    // FORÇAR A BARRA DE NAVEGAÇÃO A APARECER
    if (subNav) subNav.style.display = 'flex';

    const canal = estadosCanais[canalSelecionadoUI];
    const refsAtivas = canal.versiculos.filter(v => v.ativo).map(v => v.nome);
    const filtrados = lista.filter(item => refsAtivas.includes(item.referencia));

    if (filtrados.length === 0) {
        display.innerHTML = `<p style="text-align:center; color:gray; padding:40px; font-size:12px;">Ativa os Piccards nas definições.</p>`;
        return;
    }

    display.innerHTML = filtrados.map((item, idx) => `
        <div class="indice-card" 
             onclick="window.saltarParaFonteSat(${idx}, '${canalSelecionadoUI}')" 
             style="border-left: 4px solid var(--primary); margin-bottom:12px; background:rgba(255,255,255,0.02); cursor:pointer; padding: 15px; display: block !important;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:9px; color:var(--primary); font-weight:900; text-transform:uppercase; display: flex !important; align-items: center; gap: 5px;">
                    <i class="fa-solid fa-satellite-dish" style="display: inline-block !important;"></i> ${item.contexto}
                </span>
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px; opacity:0.4; display: inline-block !important;"></i>
            </div>

            <div style="font-size:14px; color:white; font-weight:700; line-height:1.3; margin-bottom:8px;">${item.titulo}</div>
            
            <div style="font-size:12px; color:var(--text-muted); line-height:1.6; font-style: italic; opacity:0.8;">
                "${item.resumo}"
            </div>

            <div style="margin-top:10px; font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase; display: flex !important; align-items: center; gap: 5px;">
                <i class="fa-solid fa-quote-left" style="font-size: 8px; display: inline-block !important;"></i> VIA: ${item.referencia}
            </div>
        </div>
    `).join('');
}

function renderizarDefinicoesCanal(num) {
    const display = document.getElementById('xsat-display-content');
    const canal = estadosCanais[num];
    display.innerHTML = `
        <div style="padding:10px;">
            <p style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800; margin-bottom:15px;">Piccards do Canal</p>
            <div style="display:flex; flex-wrap: wrap; gap:8px; margin-bottom:30px;">
                ${canal.versiculos.map(v => `
                    <div class="neuronio-pill" onclick="window.togglePiccard('${num}', '${v.nome}')"
                         style="background:rgba(255,255,255,0.05); border:1px solid ${v.ativo ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; padding:6px 12px; border-radius:20px; display:flex; align-items:center; gap:10px; cursor:pointer; opacity:${v.ativo ? '1' : '0.4'};">
                        <span style="font-size:11px; font-weight:700; color:white;">${v.nome}</span>
                        <i class="fa-solid ${v.ativo ? 'fa-eye' : 'fa-eye-slash'}" style="font-size:10px;"></i>
                    </div>`).join('')}
            </div>
            <button onclick="window.limparCanalX(${num})" style="width:100%; padding:12px; background:rgba(239, 68, 68, 0.1); color:#f87171; border:1px solid #ef4444; border-radius:8px; cursor:pointer; font-weight:700; font-size:11px;">ENCERRAR CANAL ${num}</button>
        </div>`;
}

window.togglePiccard = (canalId, nome) => {
    const canal = estadosCanais[canalId];
    const v = canal.versiculos.find(x => x.nome === nome);
    if (v) { v.ativo = !v.ativo; renderizarDefinicoesCanal(canalId); }
};

window.limparCanalX = (id) => {
    estadosCanais[id] = { ativa: false, dados: null, versiculos: [], abaAtiva: 'publicacoes' };
    const btn = document.querySelector(`.xsat-num[data-num="${id}"]`);
    if (btn) btn.click();
};

window.saltarParaFonteSat = (index, canalId) => {
    if (jumpInProgress) return;
    const canal = estadosCanais[canalId];
    const refsAtivas = canal.versiculos.filter(v => v.ativo).map(v => v.nome);
    const filtrados = canal.dados[canal.abaAtiva].filter(item => refsAtivas.includes(item.referencia));
    const item = filtrados[index];
    if (!item || !item.bridge) return;
    jumpInProgress = true;
    const btnLists = Array.from(document.querySelectorAll('#left-buttons button')).find(b => b.innerText.trim().toUpperCase() === 'LISTS');
    if (btnLists) btnLists.click();
    setTimeout(() => {
        import('../lists/bridge-main.js').then(m => {
            m.abrirReferenciaDireta(item.bridge);
            setTimeout(() => { jumpInProgress = false; }, 2500);
        });
    }, 200);
};

function ativarBotaoSubNav(aba) {
    const ids = { 'publicacoes': 'btn-xsat-pub', 'livros': 'btn-xsat-liv', 'multimedia': 'btn-xsat-vid', 'definicoes': 'btn-xsat-set' };
    const btn = document.getElementById(ids[aba]);
    if (btn) {
        document.querySelectorAll('#xsat-sub-nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function mostrarCanalLivre(num) {
    document.getElementById('xsat-display-content').innerHTML = `
        <div style="text-align:center; margin-top:50px; opacity:0.3;">
            <i class="fa-solid fa-satellite-dish" style="font-size:40px; margin-bottom:10px; display:block;"></i>
            <p style="font-size:12px; font-weight:600; text-transform:uppercase;">CANAL ${num} DISPONÍVEL</p>
        </div>`;
    document.querySelectorAll('#xsat-sub-nav button').forEach(b => b.classList.remove('active'));
}

window.dispararNexoAI = (texto) => {
    if (!texto || texto.trim().length < 5) return;

    // 1. Ir para o Canal 6
    if (window.switchPanel) window.switchPanel('xsat');
    const btn6 = document.querySelector('.xsat-num[data-num="6"]');
    if (btn6) btn6.click();

    const display = document.getElementById('xsat-display-content');

    // 2. DESENHAR O MENU DE PROTOCOLO
    display.innerHTML = `
        <div style="padding: 10px;">
            <p style="font-size:10px; color:#10b981; font-weight:900; text-transform:uppercase; letter-spacing:2px; margin-bottom:20px; text-align:center;">PROTOCOLO NEXO ATIVADO</p>
            
            <div style="display:flex; flex-direction:column; gap:12px;">
                <!-- OPÇÃO 1: MELHORAR -->
                <button onclick="window.executarProtocoloAI(\`${texto.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`, 'melhorar')" 
                        style="background:rgba(16,185,129,0.1); border:1px solid #10b981; color:white; padding:15px; border-radius:10px; cursor:pointer; text-align:left; transition:0.2s;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:#10b981; font-size:18px;"></i>
                        <div>
                            <b style="display:block; font-size:13px;">Melhorar Escrita</b>
                            <span style="font-size:10px; opacity:0.6;">Gramática, fluidez e elegância.</span>
                        </div>
                    </div>
                </button>

                <!-- OPÇÃO 2: INVESTIGAR -->
                <button onclick="window.executarProtocoloAI(\`${texto.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`, 'investigar')" 
                        style="background:rgba(99, 102, 241, 0.1); border:1px solid #6366f1; color:white; padding:15px; border-radius:10px; cursor:pointer; text-align:left; transition:0.2s;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <i class="fa-solid fa-microscope" style="color:#6366f1; font-size:18px;"></i>
                        <div>
                            <b style="display:block; font-size:13px;">Investigar Contexto</b>
                            <span style="font-size:10px; opacity:0.6;">História, Bíblia e conexões profundas.</span>
                        </div>
                    </div>
                </button>
            </div>
            
            <p style="margin-top:20px; font-size:9px; color:gray; text-align:center;">O Nexo está a aguardar as tuas ordens...</p>
        </div>
    `;
};

// 3. FUNÇÃO QUE FAZ O TRABALHO APÓS A ESCOLHA
window.executarProtocoloAI = async (texto, modo) => {
    const display = document.getElementById('xsat-display-content');
    const cor = modo === 'melhorar' ? '#10b981' : '#6366f1';

    display.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:${cor};">
            <i class="fa-solid fa-robot fa-bounce" style="font-size:40px; margin-bottom:20px;"></i>
            <p style="font-family:monospace; font-size:10px; font-weight:800;">EXECUTANDO PROTOCOLO: ${modo.toUpperCase()}...</p>
        </div>`;

    const resposta = await NexoAI.analisarTexto(texto, modo);

    display.innerHTML = `
        <div class="indice-card" style="border-left: 4px solid ${cor}; background: rgba(255,255,255,0.02); padding:20px; display:block !important; cursor:default;">
            <p style="font-size:10px; color:${cor}; font-weight:900; text-transform:uppercase; margin-bottom:10px;">
                <i class="fa-solid fa-robot"></i> Nexo: ${modo === 'melhorar' ? 'Escrita Aperfeiçoada' : 'Relatório de Investigação'}
            </p>
            <div style="font-size:13.5px; color:white; line-height:1.7; white-space:pre-wrap;">${resposta}</div>
        </div>
        <button onclick="window.dispararNexoAI(\`${texto.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`)" 
                style="width:100%; margin-top:10px; background:transparent; border:1px solid rgba(255,255,255,0.1); color:gray; padding:10px; border-radius:8px; cursor:pointer; font-size:10px;">
            <i class="fa-solid fa-arrow-left"></i> VOLTAR AOS PROTOCOLOS
        </button>
    `;
};

function renderizarInterfaceVaziaAI() {
    const display = document.getElementById('xsat-display-content');
    if (display.innerHTML.includes('Inteligência Nexo') || display.innerHTML.includes('fa-bounce')) return;
    display.innerHTML = `
    <div style="padding: 10px;">
        <p style="font-size:10px; color:#10b981; font-weight:900; text-transform:uppercase; letter-spacing:2px; margin-bottom:15px; text-align:center;">MENU DE PROTOCOLOS</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            
            <!-- MELHORAR -->
            <button class="btn-protocolo" onclick="window.executarProtocoloAI(\`${texto}\`, 'melhorar')" style="border-color:#10b981;">
                <i class="fa-solid fa-wand-magic-sparkles" style="color:#10b981;"></i>
                <span>Melhorar</span>
            </button>

            <!-- INVESTIGAR -->
            <button class="btn-protocolo" onclick="window.executarProtocoloAI(\`${texto}\`, 'investigar')" style="border-color:#6366f1;">
                <i class="fa-solid fa-microscope" style="color:#6366f1;"></i>
                <span>Investigar</span>
            </button>

            <!-- SOCRÁTICO -->
            <button class="btn-protocolo" onclick="window.executarProtocoloAI(\`${texto}\`, 'socratico')" style="border-color:#f59e0b;">
                <i class="fa-solid fa-lightbulb" style="color:#f59e0b;"></i>
                <span>Desafiar</span>
            </button>

            <!-- SÍNTESE -->
            <button class="btn-protocolo" onclick="window.executarProtocoloAI(\`${texto}\`, 'sintese')" style="border-color:#fbbf24;">
                <i class="fa-solid fa-atom" style="color:#fbbf24;"></i>
                <span>Resumir</span>
            </button>

            <!-- ORIGENS -->
            <button class="btn-protocolo" onclick="window.executarProtocoloAI(\`${texto}\`, 'origens')" style="border-color:#a855f7;">
                <i class="fa-solid fa-language" style="color:#a855f7;"></i>
                <span>Léxico</span>
            </button>

            <!-- COSMOS -->
            <button class="btn-protocolo" onclick="window.executarProtocoloAI(\`${texto}\`, 'cosmos')" style="border-color:#db2777;">
                <i class="fa-solid fa-meteor" style="color:#db2777;"></i>
                <span>Cosmos</span>
            </button>

        </div>
    </div>`;
}
