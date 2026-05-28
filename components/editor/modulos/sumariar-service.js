// components/editor/modulos/sumariar-service.js
import { SumarIAEngine } from './sumariar-ia-engine.js';

let selecaoManualIds = null; // null significa "Tudo"

export const SumariarService = {

    /**
     * 1. CONFIGURADOR DA CAIXA INDIVIDUAL (Disparado pela Lupa da Caixa)
     */
    abrirConfigurador: (caixa, onUpdateUI) => {
        const overlay = document.getElementById('popup-sumariar-form-overlay');
        if (!overlay) return console.error("Popup SumarIAr não encontrado.");

        overlay.classList.add('active');
        selecaoManualIds = null; // Reset de seleção anterior
        document.getElementById('status-selecao-sumar').innerText = "Toda a nota será processada.";

        // Configurações padrão
        let config = { format: 'lista', size: 'medio', style: 'normal' };

        // Botão X do cabeçalho
        const btnFechar = overlay.querySelector('.btn-fechar-sumar');
        if (btnFechar) btnFechar.onclick = () => overlay.classList.remove('active');

        // Botão "Resumir Tudo" (Reset da seleção manual)
        document.getElementById('btn-sumar-tudo').onclick = () => {
            selecaoManualIds = null;
            document.querySelectorAll('#btn-sumar-tudo, #btn-sumar-apenas').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-sumar-tudo').classList.add('active');
            document.getElementById('status-selecao-sumar').innerText = "Toda a nota será processada.";
        };

        // Botão "Escolher Blocos"
        document.getElementById('btn-sumar-apenas').onclick = async () => {
            const selecionados = await SumariarService.abrirSeletorBlocos();
            if (selecionados && selecionados.length > 0) {
                selecaoManualIds = selecionados;
                document.querySelectorAll('#btn-sumar-tudo, #btn-sumar-apenas').forEach(b => b.classList.remove('active'));
                document.getElementById('btn-sumar-apenas').classList.add('active');
                document.getElementById('status-selecao-sumar').innerText = `${selecionados.length} bloco(s) selecionado(s).`;
            }
        };

        // Gestão Visual dos Cards de Opção
        const atualizarCards = () => {
            overlay.querySelectorAll('.opt-card').forEach(card => {
                const isActive = config[card.dataset.group] === card.dataset.value;
                card.classList.toggle('active', isActive);
            });
        };

        overlay.querySelectorAll('.opt-card').forEach(card => {
            card.onclick = () => {
                config[card.dataset.group] = card.dataset.value;
                atualizarCards();
            };
        });

        // BOTÃO FINAL: GERAR RESUMO
        document.getElementById('btn-gerar-resumo-final').onclick = async () => {
            overlay.classList.remove('active');
            
            // Ativar estado de loading na caixa física
            caixa.loading = true;
            onUpdateUI();

            // Preparar conteúdo para a IA
            const listaOriginal = window.caixasAtuais || [];
            const textoParaIA = listaOriginal
                .filter(c => {
                    const isAtivo = c.estado === 'on';
                    const isManual = selecaoManualIds ? selecaoManualIds.includes(c.id) : true;
                    const isTextual = !['webcard', 'galeria', 'citacaobiblica', 'sumariar'].includes(c.tipo);
                    return isAtivo && isManual && isTextual;
                })
                .map(c => (c.titulo ? `[${c.titulo}] ` : "") + c.conteudo)
                .join("\n\n");

            if (!textoParaIA) {
                caixa.loading = false;
                caixa.conteudo = "Conteúdo insuficiente para gerar um resumo.";
                onUpdateUI();
                return;
            }

            // Chamar Motor IA
            const resposta = await SumarIAEngine.gerarResumo(textoParaIA, config);
            
            caixa.loading = false;
            caixa.conteudo = (resposta === "ERROR") ? "Erro ao sintonizar satélite gratuito." : resposta;
            caixa.timestamp = new Date().toISOString();
            
            onUpdateUI(); // Redesenha a caixa e salva no Firebase
        };

        atualizarCards(); // Reset visual ao abrir
    },

    /**
     * 2. SELETOR DE BLOCOS (Popup de Checkboxes)
     */
    abrirSeletorBlocos: () => {
        return new Promise((resolve) => {
            const subOverlay = document.createElement('div');
            subOverlay.className = "popup-overlay active";
            subOverlay.style.zIndex = "11000";
            
            // Filtro: apenas blocos de texto/raciocínio ativos
            const lista = (window.caixasAtuais || []).filter(c => 
                c.estado === 'on' && 
                !['webcard', 'galeria', 'citacaobiblica', 'sumariar'].includes(c.tipo)
            );
            
            subOverlay.innerHTML = `
                <div class="popup-content" style="max-width:380px;">
                    <div class="popup-header"><h3>Selecionar Conteúdo</h3></div>
                    <div style="padding:15px; max-height:300px; overflow-y:auto; background:var(--bg-body);">
                        ${lista.map(c => `
                            <label style="display:flex; gap:12px; padding:12px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; align-items:center;">
                                <input type="checkbox" value="${c.id}" checked style="width:18px; height:18px;">
                                <div style="display:flex; flex-direction:column; overflow:hidden;">
                                    <span style="font-size:13px; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.titulo || 'Sem título'}</span>
                                    <small style="font-size:10px; opacity:0.5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.conteudo.substring(0,40)}...</small>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    <div class="popup-footer" style="padding:15px; text-align:right;">
                        <button id="confirm-sub-sumar" class="btn-xray-main" style="height:45px; padding:0 25px; border-radius:12px;">CONCLUÍDO</button>
                    </div>
                </div>`;
            
            document.body.appendChild(subOverlay);
            subOverlay.querySelector('#confirm-sub-sumar').onclick = () => {
                const ids = Array.from(subOverlay.querySelectorAll('input:checked')).map(i => i.value);
                subOverlay.remove();
                resolve(ids);
            };
        });
    },

    /**
     * 3. SUMÁRIO GLOBAL (Disparado pelo Laboratório)
     */
    abrirSumarioGlobal: async () => {
        const overlay = document.getElementById('popup-sumar-global-overlay');
        const body = document.getElementById('sumar-global-body');
        const btnConverter = document.getElementById('btn-converter-em-caixa');

        if (!overlay || !body) return;

        overlay.classList.add('active');
        btnConverter.style.display = "none";

        body.innerHTML = `
            <div style="text-align:center; padding:40px; color:#10b981;">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px;"></i>
                <p style="margin-top:20px; font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">BookAI a analisar toda a nota...</p>
            </div>`;

        // Recolha Global (apenas texto)
        const textoFull = (window.caixasAtuais || [])
            .filter(c => c.estado === 'on' && !['webcard', 'galeria', 'citacaobiblica', 'sumariar'].includes(c.tipo))
            .map(c => (c.titulo ? `[${c.titulo}] ` : "") + c.conteudo)
            .join("\n\n");

        if (!textoFull) {
            body.innerHTML = "Não foi encontrado conteúdo textual suficiente para sumariar.";
            return;
        }

        // Configurações Predefinidas para o Global (Lista, Médio, Normal)
        const configDefault = { format: 'lista', size: 'medio', style: 'normal' };
        const resposta = await SumarIAEngine.gerarResumo(textoFull, configDefault);

        if (resposta === "ERROR") {
            body.innerHTML = "Erro ao sintonizar com os modelos gratuitos. Tenta de novo.";
        } else {
            body.innerHTML = `<div style="white-space: pre-wrap;">${resposta}</div>`;
            btnConverter.style.display = "flex";
            
            // Acção de Converter em Caixa Real
            btnConverter.onclick = async () => {
                const novaCaixa = {
        id: crypto.randomUUID(),
        tipo: "sumariar", // 🎯 Importante: tipo 'sumariar' para a fábrica correta
        conteudo: resposta,
        estado: "on",
        foco: "original",
        protecao: "fechado",
        timestamp: new Date().toISOString(),
        // Define a ordem como a maior atual + 1 para ser o "mais recente"
        ordem: (window.caixasAtuais.length > 0) 
            ? Math.max(...window.caixasAtuais.map(c => c.ordem || 0)) + 1 
            : 1
    };

               // 2. Injetar na memória RAM do editor
    if (!window.caixasAtuais) window.caixasAtuais = [];
    window.caixasAtuais.push(novaCaixa);

    // 3. Fechar popup
    overlay.classList.remove('active');

    // 4. Disparar a gravação e o redesenho usando a ponte que criámos
    if (typeof window.atualizarFeedEGravarGlobal === 'function') {
        await window.atualizarFeedEGravarGlobal(true);
        console.log("✅ [SUMARIAR] Caixa criada e sincronizada.");
    } else {
        console.error("❌ Falha crítica: Ponte de atualização do editor não encontrada.");
        alert("Resumo gerado, mas falha ao atualizar editor. Faz refresh à página.");
    }
};
        }
    }
};
