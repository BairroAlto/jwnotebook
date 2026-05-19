// components/editor/modulos/sentinela-browser.js
import { ANOS_DISPONIVEIS, DISPONIVEL_PUBLICACOES } from '../../lists/repositorio-data.js';

export const SentinelaBrowser = {
    abrir: (callback) => {
        const overlay = document.getElementById('popup-codex-browser-overlay');
        const container = document.getElementById('codex-browser-lista');
        const navegação = document.getElementById('codex-navegacao-caminho');
        
        if (!overlay || !container) return;

        overlay.classList.add('active');
        let selecao = { ano: null, mes: null };

        const renderAnos = () => {
            navegação.innerText = "Modo Sentinela > Selecionar Ano";
            container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:15px;">
                ${ANOS_DISPONIVEIS.filter(a => a >= 2000).map(ano => 
                    `<button class="btn-amt" style="width:auto;height:40px;" onclick="window.setSentinelaAno('${ano}')">${ano}</button>`
                ).join('')}
            </div>`;
        };

        window.setSentinelaAno = (ano) => {
            selecao.ano = ano;
            renderMeses();
        };

        const renderMeses = () => {
            navegação.innerText = `Sentinela ${selecao.ano} > Mês`;
            container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:15px;">
                <button class="btn-amt" style="grid-column: span 3; margin-bottom:10px; color:var(--primary);" onclick="window.voltarAnosSentinela()"> <i class="fa-solid fa-arrow-left"></i> VOLTAR AOS ANOS</button>
                ${DISPONIVEL_PUBLICACOES.map(mes => 
                    `<button class="btn-amt" style="width:auto;height:40px;" onclick="window.setSentinelaMes('${mes}')">${mes}</button>`
                ).join('')}
            </div>`;
        };

        window.voltarAnosSentinela = () => renderAnos();

        window.setSentinelaMes = async (mes) => {
            selecao.mes = mes;
            container.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> A ler revista...</div>`;
            
            try {
                const url = `data/publicacoes/w/${selecao.ano}/${mes}.json`;
                const res = await fetch(url);
                if(!res.ok) throw new Error();
                const json = await res.json();
                renderArtigos(json);
            } catch (e) {
                alert("Esta edição da Sentinela não está disponível no repositório.");
                renderMeses();
            }
        };

        const renderArtigos = (json) => {
            navegação.innerText = `Sentinela > ${json.titulo}`;
            let html = `<button class="btn-amt" style="width:100%; margin-bottom:10px; color:var(--primary);" onclick="window.setSentinelaAno('${selecao.ano}')"> <i class="fa-solid fa-arrow-left"></i> VOLTAR AOS MESES</button>`;
            
            html += json.artigos.map((art, idx) => `
                <div class="menu-item-list" onclick="window.finalizarSelecaoSentinela(${idx})">
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <small style="color:var(--primary); font-size:9px; font-weight:800;">ARTIGO ${idx+1}</small>
                        <span style="font-size:13px; color:white; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${art.titulo}</span>
                    </div>
                </div>
            `).join('');
            
            container.innerHTML = html;

            window.finalizarSelecaoSentinela = (idx) => {
                overlay.classList.remove('active');
                callback(json, idx);
            };
        };

        renderAnos();
    }
};