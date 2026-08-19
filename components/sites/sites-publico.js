const root = document.getElementById('site-publico');
const partesDoCaminho = window.location.pathname.split('/').filter(Boolean);
const FEATURE_API_URL = 'https://storage.notabook.site';

function obterIdSite() {
  const queryId = new URLSearchParams(window.location.search).get('id');
  if (queryId) return queryId;
  const ultimo = partesDoCaminho.at(-1);
  if (!ultimo || ultimo === 'sites.html') return '';
  try { return decodeURIComponent(ultimo); } catch (_) { return ''; }
}

const id = obterIdSite();

function texto(valor) { return typeof valor === 'string' ? valor : ''; }

function dataCurta(timestamp) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) return '';
  return new Date(Number(timestamp)).toLocaleDateString('pt-PT');
}

function criarTarefaPublica(tarefa, bairro) {
  const linha = document.createElement('li');
  linha.className = `site-tarefa${tarefa.concluido === true ? ' concluida' : ''}`;

  const estado = document.createElement('span');
  estado.className = 'site-tarefa-estado';
  estado.setAttribute('aria-hidden', 'true');
  estado.textContent = tarefa.concluido === true ? '✓' : '○';

  const nome = document.createElement('span');
  nome.className = 'site-tarefa-nome';
  nome.textContent = texto(tarefa.nome) || 'Tarefa sem nome';
  linha.append(estado, nome);

  const datas = document.createElement('small');
  const etiquetas = [];
  if (bairro.mostrarDataTarefa) {
    const criada = dataCurta(tarefa.criadaEm);
    if (criada) etiquetas.push(`Criada em ${criada}`);
  }
  if (bairro.mostrarDataRealizacaoTarefa) {
    const realizada = dataCurta(tarefa.realizadaEm);
    if (realizada) etiquetas.push(`Concluída em ${realizada}`);
  }
  if (etiquetas.length) {
    datas.textContent = etiquetas.join(' · ');
    linha.appendChild(datas);
  }
  return linha;
}

function criarBairroPublico(caixa) {
  const bairro = caixa?.bairro;
  if (!bairro || !Array.isArray(bairro.grupos)) return null;

  const contentor = document.createElement('div');
  contentor.className = 'site-bairro';
  bairro.grupos.forEach(grupo => {
    const secao = document.createElement('section');
    secao.className = 'site-bairro-grupo';
    const titulo = document.createElement('h3');
    titulo.textContent = texto(grupo.nome) || 'Grupo de tarefas';
    secao.appendChild(titulo);

    const tarefas = document.createElement('ul');
    tarefas.className = 'site-tarefas';
    (Array.isArray(grupo.tarefas) ? grupo.tarefas : []).forEach(tarefa => {
      tarefas.appendChild(criarTarefaPublica(tarefa, bairro));
    });
    secao.appendChild(tarefas);
    contentor.appendChild(secao);
  });
  return contentor;
}

async function obterSitePublico(siteId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(siteId || ''))) return null;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 8000);
  try {
    const resposta = await fetch(
      `${FEATURE_API_URL}/sites/${encodeURIComponent(siteId)}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controlador.signal
      }
    );
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new Error(`Site API respondeu ${resposta.status}`);
    const dados = await resposta.json();
    return dados && dados.estado === 'on' ? dados : null;
  } finally {
    clearTimeout(temporizador);
  }
}

async function iniciar() {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return erro('Endereço inválido.');
  try {
    const site = await obterSitePublico(id);
    if (!site) return erro('Este site não está disponível.');
    console.debug('[SITES-PUBLICO] Configuração recebida.', {
      id,
      capaAltura: site.capaAltura || 'grande',
      temCapa: /^https:\/\//i.test(site.capaUrl || '')
    });
    root.classList.toggle('estendida', site.largura === 'esticada');
    document.title = `${texto(site.titulo) || 'Site'} — NotaBook`;
    root.replaceChildren();
    if (/^https:\/\//i.test(site.capaUrl || '')) {
      const capa = document.createElement('img');
      const altura = ['pequena', 'media', 'grande'].includes(site.capaAltura) ? site.capaAltura : 'grande';
      capa.className = `site-capa site-capa--${altura}`;
      capa.src = site.capaUrl; capa.alt = ''; capa.referrerPolicy = 'no-referrer'; root.append(capa);
    }
    const titulo = document.createElement('h1'); titulo.className = 'site-titulo'; titulo.textContent = texto(site.titulo); root.append(titulo);
    for (const caixa of Array.isArray(site.caixas) ? [...site.caixas].sort((a,b) => (a.ordem||0)-(b.ordem||0)) : []) {
      const article = document.createElement('article'); article.className = 'site-caixa';
      const tituloCaixa = texto(caixa.titulo) || (caixa.tipo === 'bairro' ? 'Bairro Tarefas' : '');
      if (tituloCaixa) { const h = document.createElement('h2'); h.textContent = tituloCaixa; article.append(h); }
      const bairro = caixa.tipo === 'bairro' ? criarBairroPublico(caixa) : null;
      if (bairro) article.appendChild(bairro);
      if (texto(caixa.conteudo)) { const p = document.createElement('p'); p.textContent = texto(caixa.conteudo); article.append(p); }
      if (article.childNodes.length) root.append(article);
    }
    if (site.mostrarBrowser && Array.isArray(site.browserIds) && site.browserIds.length) {
      const browser = document.createElement('nav'); browser.className = 'site-browser';
      const label = document.createElement('strong'); label.textContent = 'Browser'; browser.append(label);
      for (const browserId of site.browserIds) {
        const linked = await obterSitePublico(browserId);
        if (!linked) continue;
        const link = document.createElement('a'); link.href = `sites.html?id=${encodeURIComponent(browserId)}`; link.textContent = linked.titulo || 'Nota'; browser.append(link);
      }
      if (browser.children.length > 1) root.append(browser);
    }
  } catch { erro('Não foi possível carregar este site.'); }
}
function erro(mensagem) { root.className = 'site-erro'; root.textContent = mensagem; }
iniciar();
