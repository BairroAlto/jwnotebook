import { obterClienteGmail, normalizarPreferenciasGmail } from '../../gmail/gmail-service.js';
import { abrirConfiguradorGmail } from '../../gmail/gmail-settings.js';
import { iniciarSelecaoFerramentas } from './tool-selection.js';

function criarMensagem(texto, tipo = 'normal') {
    const mensagem = document.createElement('div');
    mensagem.className = `gmail-tool__mensagem gmail-tool__mensagem--${tipo}`;
    mensagem.textContent = texto;
    return mensagem;
}

function formatarDataEmail(valor) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    const hoje = new Date();
    const mesmoDia = data.toDateString() === hoje.toDateString();
    return new Intl.DateTimeFormat('pt-PT', mesmoDia
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short' }
    ).format(data);
}

function criarAvatarEmail(mensagem) {
    const avatar = document.createElement('span');
    avatar.className = 'gmail-email__avatar';
    avatar.textContent = String(mensagem.remetente || mensagem.emailRemetente || '?').trim().charAt(0).toLocaleUpperCase('pt-PT') || '?';
    return avatar;
}

function criarLinhaEmail(mensagem, cliente) {
    const linha = document.createElement('article');
    linha.className = `gmail-email${mensagem.naoLido ? ' gmail-email--nao-lido' : ''}`;

    const gatilho = document.createElement('button');
    gatilho.type = 'button';
    gatilho.className = 'gmail-email__gatilho';
    gatilho.setAttribute('aria-expanded', 'false');
    gatilho.setAttribute('aria-label', `Ler email: ${mensagem.assunto}`);

    const avatar = criarAvatarEmail(mensagem);
    const conteudo = document.createElement('span');
    conteudo.className = 'gmail-email__conteudo';

    const topo = document.createElement('span');
    topo.className = 'gmail-email__topo';
    const remetente = document.createElement('strong');
    remetente.className = 'gmail-email__remetente';
    remetente.textContent = mensagem.remetente;
    const data = document.createElement('time');
    data.className = 'gmail-email__data';
    const dataEmail = new Date(mensagem.data);
    if (!Number.isNaN(dataEmail.getTime())) data.dateTime = dataEmail.toISOString();
    data.textContent = formatarDataEmail(mensagem.data);
    topo.append(remetente, data);

    const assunto = document.createElement('span');
    assunto.className = 'gmail-email__assunto';
    assunto.textContent = mensagem.assunto;

    const excerto = document.createElement('span');
    excerto.className = 'gmail-email__excerto';
    excerto.textContent = mensagem.excerto || 'Sem pré-visualização.';
    conteudo.append(topo, assunto, excerto);

    const indicadores = document.createElement('span');
    indicadores.className = 'gmail-email__indicadores';
    if (mensagem.naoLido) {
        const ponto = document.createElement('span');
        ponto.className = 'gmail-email__ponto';
        ponto.title = 'Não lido';
        indicadores.appendChild(ponto);
    }
    const seta = document.createElement('i');
    seta.className = 'fa-solid fa-chevron-down gmail-email__toggle';
    seta.setAttribute('aria-hidden', 'true');
    indicadores.appendChild(seta);
    gatilho.append(avatar, conteudo, indicadores);

    const detalhe = document.createElement('div');
    detalhe.className = 'gmail-email__detalhe';
    detalhe.hidden = true;
    const corpo = document.createElement('div');
    corpo.className = 'gmail-email__corpo';
    const abrirNoGmail = document.createElement('a');
    abrirNoGmail.className = 'gmail-email__link';
    abrirNoGmail.href = mensagem.link;
    abrirNoGmail.target = '_blank';
    abrirNoGmail.rel = 'noopener noreferrer';
    abrirNoGmail.textContent = 'Abrir no Gmail';
    detalhe.append(corpo, abrirNoGmail);

    gatilho.onclick = async () => {
        const abrir = detalhe.hidden;
        detalhe.hidden = !abrir;
        linha.classList.toggle('gmail-email--aberto', abrir);
        gatilho.setAttribute('aria-expanded', String(abrir));
        seta.classList.toggle('fa-chevron-up', abrir);
        seta.classList.toggle('fa-chevron-down', !abrir);
        if (!abrir || corpo.dataset.carregado === 'true' || corpo.dataset.carregando === 'true') return;

        corpo.dataset.carregando = 'true';
        corpo.textContent = 'A carregar o conteúdo…';
        try {
            const detalheEmail = await cliente.carregarMensagem(mensagem.id);
            corpo.textContent = detalheEmail?.corpo || 'Este email não contém texto legível.';
            corpo.dataset.carregado = 'true';
        } catch (erro) {
            corpo.textContent = erro.message || 'Não foi possível carregar o conteúdo deste email.';
        } finally {
            delete corpo.dataset.carregando;
        }
    };

    linha.append(gatilho, detalhe);
    return linha;
}

function criarConviteLigacao(aoLigar) {
    const convite = document.createElement('div');
    convite.className = 'gmail-tool__convite';
    convite.innerHTML = `
        <span class="gmail-tool__convite-icone"><i class="fa-solid fa-envelope"></i></span>
        <strong>Liga a tua conta Gmail</strong>
        <span>Consulta os emails recentes sem guardar o conteúdo na nota.</span>
    `;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'gmail-tool__ligar';
    botao.innerHTML = '<i class="fa-brands fa-google"></i> Ligar Gmail';
    botao.onclick = aoLigar;
    convite.appendChild(botao);
    return convite;
}

export function criarGmail(caixa, onAlterar, onApagar, onMover, onAddAbaixo) {
    iniciarSelecaoFerramentas();
    caixa.gmailPreferencias = normalizarPreferenciasGmail(caixa.gmailPreferencias);
    const auth = window.notaAtualContext?.auth || window.auth;
    const cliente = obterClienteGmail(auth);

    const caixaDiv = document.createElement('section');
    caixaDiv.className = 'tool-interativa gmail-tool';

    const header = document.createElement('div');
    header.className = 'tool-barra gmail-tool__barra';
    header.innerHTML = `
        <div class="gmail-tool__acoes">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo"></i>
            <span class="gmail-tool__separador"></span>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar Gmail"></i>
            <i class="fa-solid fa-rotate btn-atualizar" title="Atualizar emails"></i>
        </div>
        <div class="gmail-tool__marca"><i class="fa-solid fa-envelope"></i><span>Gmail</span></div>
        <i class="fa-solid fa-trash btn-lixeira" title="Ocultar"></i>
    `;

    const corpo = document.createElement('div');
    corpo.className = 'gmail-tool__corpo';
    let carregamentoEmCurso = false;

    const renderizarDesligado = () => {
        corpo.replaceChildren(criarConviteLigacao(async evento => {
            const botao = evento.currentTarget;
            botao.disabled = true;
            try {
                await cliente.ligar();
                await atualizarMensagens(true);
            } catch (erro) {
                corpo.replaceChildren(criarMensagem(erro.message || 'Não foi possível ligar o Gmail.', 'erro'));
            } finally {
                botao.disabled = false;
            }
        }));
    };

    const atualizarMensagens = async (ignorarCache = false) => {
        if (carregamentoEmCurso) return;
        if (!cliente.estaLigado()) {
            renderizarDesligado();
            return;
        }

        carregamentoEmCurso = true;
        header.querySelector('.btn-atualizar').classList.add('fa-spin');
        corpo.replaceChildren(criarMensagem('A atualizar os emails recentes…', 'carregar'));
        try {
            const mensagens = await cliente.carregarMensagens(caixa.gmailPreferencias, { ignorarCache });
            if (!mensagens.length) {
                corpo.replaceChildren(criarMensagem('Não foram encontrados emails para este filtro.'));
                return;
            }

            const cabecalhoLista = document.createElement('div');
            cabecalhoLista.className = 'gmail-tool__resumo';
            const perfil = cliente.obterPerfil();
            cabecalhoLista.innerHTML = `
                <span>${perfil?.email || 'Gmail'}</span>
                <small>${mensagens.length} emails · ${cliente.obterLeiturasRestantes()} leituras hoje</small>
            `;
            const lista = document.createElement('div');
            lista.className = 'gmail-tool__lista';
            lista.append(...mensagens.map(mensagem => criarLinhaEmail(mensagem, cliente)));
            corpo.replaceChildren(cabecalhoLista, lista);
        } catch (erro) {
            if (!cliente.estaLigado()) renderizarDesligado();
            else corpo.replaceChildren(criarMensagem(erro.message || 'Não foi possível carregar os emails.', 'erro'));
        } finally {
            carregamentoEmCurso = false;
            header.querySelector('.btn-atualizar').classList.remove('fa-spin');
        }
    };

    header.querySelector('.btn-lupa').onclick = async () => {
        const preferencias = await abrirConfiguradorGmail(caixa, cliente);
        if (!preferencias) {
            if (!cliente.estaLigado()) renderizarDesligado();
            return;
        }
        caixa.gmailPreferencias = preferencias;
        onAlterar(caixa);
        await atualizarMensagens(true);
    };
    header.querySelector('.btn-atualizar').onclick = () => atualizarMensagens(true);
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, 'cima');
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, 'baixo');
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    const removerSubscricao = cliente.subscrever(estado => {
        if (!caixaDiv.isConnected) {
            removerSubscricao();
            return;
        }
        if (!estado.ligado) renderizarDesligado();
    });

    caixaDiv.append(header, corpo);
    caixaDiv.refreshGmail = () => atualizarMensagens(true);
    cliente.restaurarSessao().then(ligado => {
        if (ligado) atualizarMensagens();
        else renderizarDesligado();
    });
    return caixaDiv;
}
