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
            console.error("Popup de confirmação de restauro não encontrado.");
            return resolve(confirm(`Restaurar a versão de ${dataBackup}?`));
        }

        if (msg) msg.innerHTML = `Desejas restaurar a versão de <br><b>${dataBackup}</b> como uma nova nota?`;
        
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
 * POPUP: Configurar Imagem do Cartão de Visita
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
 * POPUP: Confirmar remoção de vínculo de TÓPICO
 */
export function perguntarRemoverVinculo(nome) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-vinculo-overlay');
        const msg = document.getElementById('msg-confirmar-vinculo');
        const btnSim = document.getElementById('btn-confirmar-vinculo');
        const btnNao = document.getElementById('btn-cancelar-vinculo');

        if (msg) msg.innerHTML = `Deseja remover o vínculo com o tópico <b>"${nome}"</b>?`;
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
 * Pesquisa de textos bíblicos para o sistema de Neurónios
 */
export function pesquisarTextoBiblicoLocal(termo) {
    const cleanTerm = termo.trim().toLowerCase();
    if(cleanTerm.length < 2) return [];
    const regex = /^([1-3]?\s?[a-zA-Záàâãéèêíïóôõúüç]+)\s?(\d+)?(?::(\d+)?)?/i;
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
 * POPUP: Confirmar remoção de vínculo do Brain
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
 * Exibe um popup de aviso genérico
 */
export function mostrarAviso(mensagem) {
    const overlay = document.getElementById('popup-aviso-overlay');
    const texto = document.getElementById('msg-aviso-texto');
    const btn = document.getElementById('btn-fechar-aviso');

    if (!overlay || !texto) return alert(mensagem);

    // Garante que o texto está correto e ativa o popup
    texto.innerText = mensagem;
    
    // FORÇA O Z-INDEX MÁXIMO NO MOMENTO DA EXIBIÇÃO
    overlay.style.zIndex = "20000"; 
    overlay.classList.add('active');

    btn.onclick = () => {
        overlay.classList.remove('active');
    };
}

/**
 * Abre o popup para capturar URL e Título de um link
 */
export function abrirPopupLinkTopico(dadosIniciais = null) {
    console.log("🚀 [UTILS] Função abrirPopupLinkTopico iniciada.");

    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-link-topico-overlay');
        
        if (!overlay) {
            console.error("❌ [UTILS] ERRO CRÍTICO: O elemento HTML '#popup-link-topico-overlay' não foi encontrado no index.html.");
            return resolve(null);
        }

        const inputUrl = document.getElementById('link-topico-url');
        const inputTit = document.getElementById('link-topico-titulo');
        const btnSave = document.getElementById('btn-gravar-link-topico');
        const btnCancel = document.getElementById('btn-cancelar-link-topico');

        // Preencher se for edição
        inputUrl.value = dadosIniciais?.link || "";
        inputTit.value = dadosIniciais?.titulo || "";
        
        console.log("✨ [UTILS] A mostrar overlay e focar no input.");
        overlay.classList.add('active');
        inputUrl.focus();

        const fechar = (dados) => {
            console.log("🔒 [UTILS] A fechar popup e remover listeners.");
            overlay.classList.remove('active');
            btnSave.onclick = null;
            btnCancel.onclick = null;
            resolve(dados);
        };

        btnSave.onclick = () => {
            console.log("💾 [UTILS] Botão Gravar clicado no popup.");
            const url = inputUrl.value.trim();
            if (!url) {
                console.warn("⚠️ [UTILS] Tentativa de gravar sem URL.");
                inputUrl.style.borderColor = "#ef4444";
                return;
            }
            fechar({ link: url, titulo: inputTit.value.trim() });
        };

        btnCancel.onclick = () => {
            console.log("❌ [UTILS] Botão Cancelar clicado no popup.");
            fechar(null);
        };
    });
}