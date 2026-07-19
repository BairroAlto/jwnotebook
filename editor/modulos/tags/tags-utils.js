// components/editor/modulos/tags/tags-utils.js
import { BIBLE_DATA } from '../../../lists/bible-data.js';

/**
 * POPUP: Confirmar Restauro de Backup
 */
export function perguntarRestauroBackup(dataBackup) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-restauro-overlay');
        const msg = document.getElementById('msg-confirmar-restauro');
        const btnSim = document.getElementById('btn-confirmar-restauro-final');
        const btnNao = document.getElementById('btn-cancelar-restauro');

        if (!overlay) {
            console.error("Popup de confirmaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de restauro nÃƒÆ’Ã‚Â£o encontrado.");
            return resolve(confirm(`Restaurar a versÃƒÆ’Ã‚Â£o de ${dataBackup}?`));
        }

        if (msg) msg.innerHTML = `Desejas restaurar a versÃƒÆ’Ã‚Â£o de <br><b>${dataBackup}</b> como uma nova nota?`;
        
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
 * POPUP: Configurar Imagem do CartÃƒÆ’Ã‚Â£o de Visita
 */
export function abrirPopupImagemCartao(urlAtual, dimensaoAtual) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-cv-imagem-overlay');
        const inputUrl = document.getElementById('cv-input-url');
        const inputDim = document.getElementById('cv-input-dimensao');
        const btnGuardar = document.getElementById('cv-btn-guardar');
        const btnCancelar = document.getElementById('cv-btn-cancelar');

        if (inputUrl) inputUrl.value = urlAtual || "";
        if (inputDim) inputDim.value = dimensaoAtual || "pequena";
        
        overlay.classList.add('active');

        const fechar = (dados) => {
            overlay.classList.remove('active');
            btnGuardar.onclick = null;
            btnCancelar.onclick = null;
            resolve(dados);
        };

        btnGuardar.onclick = () => fechar({ url: inputUrl.value.trim(), dimensao: inputDim.value });
        btnCancelar.onclick = () => fechar(null);
    });
}

/**
 * POPUP: Confirmar remoÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de vÃƒÆ’Ã‚Â­nculo de TÃƒÆ’Ã¢â‚¬Å“PICO
 */
export function perguntarRemoverVinculo(nome) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-vinculo-overlay');
        const msg = document.getElementById('msg-confirmar-vinculo');
        const btnSim = document.getElementById('btn-confirmar-vinculo');
        const btnNao = document.getElementById('btn-cancelar-vinculo');

        if (!overlay || !btnSim || !btnNao) {
            return resolve(false);
        }

        if (msg) msg.innerHTML = `Deseja remover o v&iacute;nculo com o t&oacute;pico <b>"${nome}"</b>?`;
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
 * POPUP: Confirmar remoção genérica no Hub
 */
export function perguntarRemocaoHub({ titulo = "Remover item?", mensagem = "" } = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-remover-overlay');
        const tituloEl = document.getElementById('titulo-confirmar-remover');
        const msgEl = document.getElementById('msg-confirmar-remover');
        const btnSim = document.getElementById('btn-confirmar-remover-final');
        const btnNao = document.getElementById('btn-cancelar-remover');

        if (!overlay || !btnSim || !btnNao) return resolve(false);

        [btnSim, btnNao].forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = "auto";
            btn.style.opacity = "1";
        });
        btnSim.innerText = "Sim, Remover";

        if (tituloEl) tituloEl.innerText = titulo;
        if (msgEl) msgEl.innerText = mensagem || "Esta ação vai ocultar este item da tua nota.";

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
 * Pesquisa de textos bÃƒÆ’Ã‚Â­blicos para o sistema de NeurÃƒÆ’Ã‚Â³nios
 */
export function pesquisarTextoBiblicoLocal(termo) {
    const cleanTerm = termo.trim().toLowerCase();
    if(cleanTerm.length < 2) return [];
    const regex = /^([1-3]?\s?[a-zA-ZÃƒÆ’Ã‚Â¡ÃƒÆ’Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÆ’Ã‚Â£ÃƒÆ’Ã‚Â©ÃƒÆ’Ã‚Â¨ÃƒÆ’Ã‚ÂªÃƒÆ’Ã‚Â­ÃƒÆ’Ã‚Â¯ÃƒÆ’Ã‚Â³ÃƒÆ’Ã‚Â´ÃƒÆ’Ã‚ÂµÃƒÆ’Ã‚ÂºÃƒÆ’Ã‚Â¼ÃƒÆ’Ã‚Â§]+)\s?(\d+)?(?::(\d+)?)?/i;
    const match = cleanTerm.match(regex);
    if (!match) return [];
    
    const inputLivro = match[1].trim();
    const inputCap = match[2] ? parseInt(match[2]) : null;
    const inputVer = match[3] || null;

    const livrosMatch = BIBLE_DATA.filter(b => b.nome.toLowerCase().startsWith(inputLivro) || b.abrev.toLowerCase().startsWith(inputLivro));
    let resultados = [];
    livrosMatch.forEach(livro => {
        if (!inputCap) resultados.push(`${livro.nome} 1:1`);
        else if (inputCap <= livro.caps) {
            const maxV = livro.versiculos[inputCap - 1];
            if (!inputVer) for (let v = 1; v <= Math.min(maxV, 5); v++) resultados.push(`${livro.nome} ${inputCap}:${v}`);
            else for (let v = 1; v <= maxV; v++) if (v.toString().startsWith(inputVer)) resultados.push(`${livro.nome} ${inputCap}:${v}`);
        }
    });
    return resultados.slice(0, 15);
}

/**
 * POPUP: Confirmar remoÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de vÃƒÆ’Ã‚Â­nculo do Brain
 */
export function confirmarRemocaoBrain() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-brain-overlay');
        if(!overlay) return resolve(true);
        overlay.classList.add('active');
        document.getElementById('btn-confirmar-brain').onclick = () => { overlay.classList.remove('active'); resolve(true); };
        document.getElementById('btn-cancelar-brain').onclick = () => { overlay.classList.remove('active'); resolve(false); };
    });
}

/**
 * Exibe um popup de aviso genÃƒÆ’Ã‚Â©rico
 */
export function mostrarAviso(mensagem) {
    const overlay = document.getElementById('popup-aviso-overlay');
    const texto = document.getElementById('msg-aviso-texto');
    const btn = document.getElementById('btn-fechar-aviso');

    if (!overlay || !texto) return alert(mensagem);

    // Garante que o texto estÃƒÆ’Ã‚Â¡ correto e ativa o popup
    texto.innerText = mensagem;
    
    // FORÃƒÆ’Ã¢â‚¬Â¡A O Z-INDEX MÃƒÆ’Ã‚ÂXIMO NO MOMENTO DA EXIBIÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O
    overlay.style.zIndex = "20000"; 
    overlay.classList.add('active');

    btn.onclick = () => {
        overlay.classList.remove('active');
    };
}

/**
 * Abre o popup para capturar URL e TÃƒÆ’Ã‚Â­tulo de um link
 */
export function abrirPopupLinkTopico(dadosIniciais = null) {
    console.log("ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ [UTILS] FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o abrirPopupLinkTopico iniciada.");

    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-link-topico-overlay');
        
        if (!overlay) {
            console.error("ÃƒÂ¢Ã‚ÂÃ…â€™ [UTILS] ERRO CRÃƒÆ’Ã‚ÂTICO: O elemento HTML '#popup-link-topico-overlay' nÃƒÆ’Ã‚Â£o foi encontrado no index.html.");
            return resolve(null);
        }

        const inputUrl = document.getElementById('link-topico-url');
        const inputTit = document.getElementById('link-topico-titulo');
        const btnSave = document.getElementById('btn-gravar-link-topico');
        const btnCancel = document.getElementById('btn-cancelar-link-topico');

        // Preencher se for ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
        inputUrl.value = dadosIniciais?.link || "";
        inputTit.value = dadosIniciais?.titulo || "";
        
        console.log("ÃƒÂ¢Ã…â€œÃ‚Â¨ [UTILS] A mostrar overlay e focar no input.");
        overlay.classList.add('active');
        inputUrl.focus();

        const fechar = (dados) => {
            console.log("ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢ [UTILS] A fechar popup e remover listeners.");
            overlay.classList.remove('active');
            btnSave.onclick = null;
            btnCancel.onclick = null;
            resolve(dados);
        };

        btnSave.onclick = () => {
            console.log("ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¾ [UTILS] BotÃƒÆ’Ã‚Â£o Gravar clicado no popup.");
            const url = inputUrl.value.trim();
            if (!url) {
                console.warn("ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â [UTILS] Tentativa de gravar sem URL.");
                inputUrl.style.borderColor = "#ef4444";
                return;
            }
            fechar({ link: url, titulo: inputTit.value.trim() });
        };

        btnCancel.onclick = () => {
            console.log("ÃƒÂ¢Ã‚ÂÃ…â€™ [UTILS] BotÃƒÆ’Ã‚Â£o Cancelar clicado no popup.");
            fechar(null);
        };
    });
}
