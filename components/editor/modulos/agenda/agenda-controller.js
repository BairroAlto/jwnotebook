import { exigirAcessoFerramenta } from '../../../settings/feature-admin.js';
import {
    alterarNotificacoesDispositivo,
    listarDispositivosNotificacao,
    obterEstadoNotificacoes
} from '../../../notifications/push-client.js';
import {
    cancelarLembreteDaNota,
    guardarLembreteDaNota,
    obterLembreteDaNota
} from './agenda-client.js';

const FEATURE_AGENDA_NOTA = 'ferramenta_agenda_nota';
const ESTADOS_ATIVOS = new Set(['pending', 'processing', 'waiting_device', 'paused_plan']);
let aberturaAtual = 0;

function elemento(id) {
    return document.getElementById(id);
}

function doisDigitos(valor) {
    return String(valor).padStart(2, '0');
}

function preencherDataHora(instante) {
    const data = new Date(Number(instante) * 1000);
    if (!Number.isFinite(data.getTime())) return;
    elemento('agenda-nota-data').value = [
        data.getFullYear(),
        doisDigitos(data.getMonth() + 1),
        doisDigitos(data.getDate())
    ].join('-');
    elemento('agenda-nota-hora').value = `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}

function preencherDataInicial() {
    const data = new Date(Date.now() + 60 * 60 * 1000);
    data.setSeconds(0, 0);
    preencherDataHora(Math.floor(data.getTime() / 1000));
}

function obterInstanteEscolhido() {
    const data = elemento('agenda-nota-data')?.value;
    const hora = elemento('agenda-nota-hora')?.value;
    if (!data || !hora) throw new Error('Escolhe a data e a hora do lembrete.');
    const instante = new Date(`${data}T${hora}:00`);
    if (!Number.isFinite(instante.getTime())) throw new Error('A data ou a hora não é válida.');
    if (instante.getTime() < Date.now() + 60_000) {
        throw new Error('Escolhe uma hora futura, com pelo menos um minuto de antecedência.');
    }
    return instante;
}

function definirEstado(mensagem = '', tipo = '') {
    const estado = elemento('agenda-nota-estado');
    if (!estado) return;
    estado.textContent = mensagem;
    estado.dataset.state = tipo;
}

function definirOcupado(ocupado) {
    ['agenda-nota-guardar', 'agenda-nota-cancelar', 'agenda-nota-relembrar', 'agenda-nota-data', 'agenda-nota-hora']
        .forEach(id => {
            const campo = elemento(id);
            if (campo) campo.disabled = ocupado;
        });
    document.querySelectorAll('.agenda-nota-dispositivo-switch').forEach(botao => {
        botao.disabled = ocupado || botao.dataset.indisponivel === 'true';
    });
}

function mensagemPermissao(estado) {
    const mensagens = {
        granted: 'Este dispositivo pode receber notificações quando estiver ligado na lista abaixo.',
        denied: 'As notificações estão bloqueadas nas definições deste dispositivo.',
        default: 'Liga este dispositivo abaixo para autorizares as notificações.',
        insecure: 'As notificações requerem uma ligação HTTPS segura.',
        unsupported: 'Este dispositivo não suporta notificações da aplicação.'
    };
    return mensagens[estado.permissao] || mensagens.unsupported;
}

async function atualizarPermissao() {
    const caixa = elemento('agenda-nota-permissao');
    if (!caixa) return;
    const estado = await obterEstadoNotificacoes();
    caixa.dataset.state = estado.permissao;
    caixa.textContent = mensagemPermissao(estado);
}

function apresentarLembrete(lembrete) {
    const ativo = Boolean(lembrete && ESTADOS_ATIVOS.has(lembrete.status));
    const toggle = elemento('agenda-nota-relembrar');
    const campos = elemento('agenda-nota-campos');
    const guardar = elemento('agenda-nota-guardar');
    const cancelar = elemento('agenda-nota-cancelar');
    if (!toggle || !campos || !guardar || !cancelar) return;

    toggle.checked = ativo;
    campos.hidden = !ativo;
    guardar.hidden = !ativo;
    cancelar.hidden = !ativo;

    if (lembrete?.remindAt && ativo) preencherDataHora(lembrete.remindAt);
    else preencherDataInicial();

    if (!lembrete || lembrete.status === 'cancelled') {
        definirEstado('Ainda não existe um lembrete ativo para esta nota.');
    } else if (lembrete.status === 'paused_plan') {
        definirEstado('O lembrete está suspenso porque o plano atual deixou de permitir esta funcionalidade.', 'error');
    } else if (lembrete.status === 'waiting_device') {
        definirEstado('Lembrete guardado. Liga pelo menos um dispositivo para o receberes.', 'error');
    } else if (lembrete.status === 'sent') {
        definirEstado('O último lembrete desta nota já foi enviado.', 'success');
    } else if (lembrete.status === 'failed') {
        definirEstado('Não foi possível enviar o último lembrete. Podes agendá-lo novamente.', 'error');
    } else {
        const data = new Date(Number(lembrete.remindAt) * 1000);
        definirEstado(`Lembrete agendado para ${data.toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })}.`, 'success');
    }
}

function iconeDoDispositivo(dispositivo) {
    const descricao = `${dispositivo.platform} ${dispositivo.label}`.toLowerCase();
    if (/iphone|ipad|android|mobile/.test(descricao)) return 'fa-mobile-screen-button';
    return 'fa-laptop';
}

function mostrarListaEmEspera() {
    const lista = elemento('agenda-nota-dispositivos-lista');
    if (!lista) return;
    const estado = document.createElement('div');
    estado.className = 'agenda-nota-dispositivos-loading';
    estado.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span>A carregar dispositivos...</span>';
    lista.replaceChildren(estado);
}

function mostrarErroDispositivos(mensagem) {
    const lista = elemento('agenda-nota-dispositivos-lista');
    if (!lista) return;
    const estado = document.createElement('div');
    estado.className = 'agenda-nota-dispositivos-vazio';
    estado.textContent = mensagem;
    lista.replaceChildren(estado);
}

function renderizarDispositivos(dispositivos, aoAlterar) {
    const lista = elemento('agenda-nota-dispositivos-lista');
    if (!lista) return;
    lista.replaceChildren();

    if (!dispositivos.length) {
        mostrarErroDispositivos('Não foram encontrados dispositivos com sessão iniciada.');
        return;
    }

    dispositivos.forEach(dispositivo => {
        const linha = document.createElement('div');
        linha.className = 'agenda-nota-dispositivo';

        const icone = document.createElement('span');
        icone.className = 'agenda-nota-dispositivo-icone';
        icone.innerHTML = `<i class="fa-solid ${iconeDoDispositivo(dispositivo)}" aria-hidden="true"></i>`;

        const texto = document.createElement('span');
        texto.className = 'agenda-nota-dispositivo-texto';
        const nome = document.createElement('span');
        nome.className = 'agenda-nota-dispositivo-nome';
        nome.textContent = dispositivo.label || 'Dispositivo sem nome';
        if (dispositivo.atual) {
            const atual = document.createElement('span');
            atual.className = 'agenda-nota-dispositivo-atual';
            atual.textContent = 'Este dispositivo';
            nome.appendChild(atual);
        }

        const detalhe = document.createElement('small');
        detalhe.className = 'agenda-nota-dispositivo-detalhe';
        detalhe.textContent = dispositivo.enabled
            ? 'Notificações ligadas'
            : (!dispositivo.atual && !dispositivo.canEnable
                ? 'Abre este dispositivo para poderes ligá-lo'
                : 'Notificações desligadas');
        texto.append(nome, detalhe);

        const botao = document.createElement('button');
        const indisponivel = !dispositivo.enabled && !dispositivo.atual && !dispositivo.canEnable;
        botao.type = 'button';
        botao.className = 'agenda-nota-dispositivo-switch';
        botao.setAttribute('role', 'switch');
        botao.setAttribute('aria-checked', String(Boolean(dispositivo.enabled)));
        botao.setAttribute('aria-label', `${dispositivo.enabled ? 'Desligar' : 'Ligar'} notificações em ${dispositivo.label}`);
        botao.dataset.indisponivel = String(indisponivel);
        botao.disabled = indisponivel;
        botao.innerHTML = `<span>${dispositivo.enabled ? 'On' : 'Off'}</span>`;
        botao.onclick = () => aoAlterar(dispositivo);

        linha.append(icone, texto, botao);
        lista.appendChild(linha);
    });
}

async function carregarDispositivos(auth, abertura, aoAlterar, { mostrarEspera = true } = {}) {
    if (mostrarEspera) mostrarListaEmEspera();
    try {
        const dispositivos = await listarDispositivosNotificacao(auth);
        if (abertura !== aberturaAtual) return [];
        renderizarDispositivos(dispositivos, aoAlterar);
        return dispositivos;
    } catch (erro) {
        if (abertura === aberturaAtual) mostrarErroDispositivos(erro.message);
        return [];
    }
}

export async function abrirAgendaDaNota({ notaId, auth = window.auth } = {}) {
    const permitido = await exigirAcessoFerramenta(
        auth,
        FEATURE_AGENDA_NOTA,
        'A Agenda da Nota requer o plano definido pelo administrador.'
    );
    if (!permitido) return false;

    const abertura = ++aberturaAtual;
    const loading = elemento('agenda-nota-loading');
    const conteudo = elemento('agenda-nota-conteudo');
    if (!loading || !conteudo || !notaId) return false;
    loading.hidden = false;
    conteudo.hidden = true;

    let lembreteAtual = null;
    let aoAlterarDispositivo;

    aoAlterarDispositivo = async (dispositivo) => {
        if (abertura !== aberturaAtual) return;
        const ligar = !dispositivo.enabled;
        definirOcupado(true);
        definirEstado(`${ligar ? 'A ligar' : 'A desligar'} as notificações neste dispositivo...`);
        try {
            await alterarNotificacoesDispositivo(dispositivo, ligar, auth);
            await Promise.all([
                carregarDispositivos(auth, abertura, aoAlterarDispositivo, { mostrarEspera: false }),
                atualizarPermissao()
            ]);
            lembreteAtual = await obterLembreteDaNota(notaId, auth);
            if (abertura === aberturaAtual) apresentarLembrete(lembreteAtual);
        } catch (erro) {
            definirEstado(erro.message, 'error');
        } finally {
            if (abertura === aberturaAtual) definirOcupado(false);
        }
    };

    try {
        const [resultadoLembrete] = await Promise.all([
            obterLembreteDaNota(notaId, auth),
            atualizarPermissao(),
            carregarDispositivos(auth, abertura, aoAlterarDispositivo)
        ]);
        if (abertura !== aberturaAtual) return false;
        lembreteAtual = resultadoLembrete;
        apresentarLembrete(lembreteAtual);
    } catch (erro) {
        if (abertura !== aberturaAtual) return false;
        apresentarLembrete(null);
        definirEstado(erro.message, 'error');
    } finally {
        if (abertura === aberturaAtual) {
            loading.hidden = true;
            conteudo.hidden = false;
        }
    }

    const toggle = elemento('agenda-nota-relembrar');
    const campos = elemento('agenda-nota-campos');
    const guardar = elemento('agenda-nota-guardar');
    const cancelar = elemento('agenda-nota-cancelar');

    const cancelarAtual = async () => {
        definirOcupado(true);
        definirEstado('A cancelar o lembrete...');
        try {
            await cancelarLembreteDaNota(notaId, auth);
            lembreteAtual = null;
            apresentarLembrete(null);
            definirEstado('Lembrete cancelado.', 'success');
        } catch (erro) {
            apresentarLembrete(lembreteAtual);
            definirEstado(erro.message, 'error');
        } finally {
            definirOcupado(false);
        }
    };

    toggle.onchange = async () => {
        if (!toggle.checked && lembreteAtual && ESTADOS_ATIVOS.has(lembreteAtual.status)) {
            const confirmou = window.confirm('Cancelar o lembrete agendado para esta nota?');
            if (!confirmou) {
                toggle.checked = true;
                return;
            }
            await cancelarAtual();
            return;
        }

        campos.hidden = !toggle.checked;
        guardar.hidden = !toggle.checked;
        cancelar.hidden = !(toggle.checked && lembreteAtual && ESTADOS_ATIVOS.has(lembreteAtual.status));
        if (toggle.checked && !elemento('agenda-nota-data').value) preencherDataInicial();
    };

    guardar.onclick = async () => {
        definirOcupado(true);
        definirEstado('A guardar o lembrete...');
        try {
            const instante = obterInstanteEscolhido();
            lembreteAtual = await guardarLembreteDaNota(notaId, {
                remindAt: Math.floor(instante.getTime() / 1000),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            }, auth);
            apresentarLembrete(lembreteAtual);
        } catch (erro) {
            definirEstado(erro.message, 'error');
        } finally {
            definirOcupado(false);
        }
    };

    cancelar.onclick = cancelarAtual;
    return true;
}

export { FEATURE_AGENDA_NOTA };
