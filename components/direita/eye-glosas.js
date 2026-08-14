// components/direita/eye-glosas.js
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

function obterGlosasComConteudo(caixa) {
    return (Array.isArray(caixa.glosas) ? caixa.glosas : [])
        .filter(glosa => glosa?.estado !== 'inativo' && String(glosa.conteudo || '').trim());
}

function criarCabecalhoCaixa(caixa) {
    const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const cabecalho = document.createElement('div');
    cabecalho.className = 'eye-glosa-group-header';

    const identidade = document.createElement('div');
    identidade.className = 'eye-glosa-group-identity';
    identidade.innerHTML = `<i class="${config.icon}" style="color:${config.cor};"></i>`;

    const textos = document.createElement('div');
    const tipo = document.createElement('span');
    tipo.className = 'eye-glosa-group-type';
    tipo.textContent = config.nome || 'Caixa';
    const titulo = document.createElement('strong');
    titulo.className = 'eye-glosa-group-title';
    titulo.textContent = caixa.titulo || config.nome || 'Caixa sem título';
    textos.append(tipo, titulo);
    identidade.appendChild(textos);

    const irParaCaixa = document.createElement('button');
    irParaCaixa.type = 'button';
    irParaCaixa.className = 'eye-glosa-focus-button';
    irParaCaixa.title = 'Ir para a caixa associada';
    irParaCaixa.setAttribute('aria-label', 'Ir para a caixa associada');
    irParaCaixa.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
    irParaCaixa.addEventListener('click', () => {
        const elemento = document.getElementById(`bloco-${caixa.id}`);
        if (!elemento) return;
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elemento.style.transition = 'box-shadow 0.2s ease';
        elemento.style.boxShadow = '0 0 0 2px var(--primary), 0 0 22px rgba(99,102,241,0.25)';
        setTimeout(() => { elemento.style.boxShadow = ''; }, 1600);
    });

    cabecalho.append(identidade, irParaCaixa);
    return cabecalho;
}

export function carregarGlosasDaNota(caixasFiltradas = []) {
    const container = document.getElementById('glosas-nota-container');
    const botao = document.getElementById('btn-tab-glosas');
    if (!container || !botao) return;

    const grupos = caixasFiltradas
        .map(caixa => ({ caixa, glosas: obterGlosasComConteudo(caixa) }))
        .filter(grupo => grupo.glosas.length > 0);

    const existemGlosasAtivas = caixasFiltradas.some(caixa =>
        Array.isArray(caixa.glosas) && caixa.glosas.some(glosa => glosa?.estado !== 'inativo')
    );

    // Mantem o separador acessivel enquanto existir uma glosa activa.
    botao.style.display = (grupos.length || existemGlosasAtivas) ? 'inline-flex' : 'none';
    if (!grupos.length) {
        container.innerHTML = existemGlosasAtivas
            ? '<div class="eye-glosa-empty">A glosa existe, mas o conte&uacute;do ainda est&aacute; a sincronizar.</div>'
            : '<div class="eye-glosa-empty">Nenhuma glosa com conte&uacute;do nesta nota.</div>';
        if (!existemGlosasAtivas && botao.classList.contains('active')) window.switchEyeTab?.('indice');
        return;
    }

    container.innerHTML = `
        <div class="eye-glosa-intro">
            <i class="fa-brands fa-stack-overflow"></i>
            <span>Glosas da nota</span>
        </div>
        <div class="eye-glosa-groups"></div>
    `;

    const gruposContainer = container.querySelector('.eye-glosa-groups');
    grupos.forEach(({ caixa, glosas }) => {
        const grupo = document.createElement('section');
        grupo.className = 'eye-glosa-group';
        grupo.appendChild(criarCabecalhoCaixa(caixa));

        const lista = document.createElement('div');
        lista.className = 'eye-glosa-items';
        glosas.forEach(glosa => {
            const item = document.createElement('article');
            item.className = 'eye-glosa-card';
            const marcador = document.createElement('i');
            marcador.className = 'fa-brands fa-stack-overflow eye-glosa-card-icon';
            const texto = document.createElement('p');
            texto.textContent = glosa.conteudo;
            item.append(marcador, texto);
            lista.appendChild(item);
        });

        grupo.appendChild(lista);
        gruposContainer.appendChild(grupo);
    });
}