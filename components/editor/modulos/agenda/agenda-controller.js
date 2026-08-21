import { exigirAcessoFerramenta } from '../../../settings/feature-admin.js';
import { ativarNotificacoes, obterEstadoNotificacoes } from '../../../notifications/push-client.js';
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
}

function mensagemPermissao(estado) {
    const mensagens = {
        granted: 'Notificações autorizadas neste dispositivo.',
        denied: 'As notificações estão bloqueadas nas definições do dispositivo.',
        default: 'A autorização será pedida quando guardares o primeiro lembrete.',
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

    if (lembrete?.remindAt) preencherDataHora(lembrete.remindAt);
    else preencherDataInicial();

    if (!lembrete) {
        definirEstado('Ainda não existe um lembrete para esta nota.');
    } else if (lembrete.status === 'paused_plan') {
        definirEstado('O lembrete está suspenso porque o plano atual deixou de permitir esta funcionalidade.', 'error');
    } else if (lembrete.status === 'waiting_device') {
        definirEstado('Lembrete guardado. Falta ativar as notificações num dispositivo.', 'error');
    } else if (lembrete.status === 'sent') {
        definirEstado('O último lembrete desta nota já foi enviado.', 'success');
    } else if (lembrete.status === 'failed') {
        definirEstado('Não foi possível enviar o último lembrete. Podes agendá-lo novamente.', 'error');
    } else {
        const data = new Date(Number(lembrete.remindAt) * 1000);
        definirEstado(`Lembrete agendado para ${data.toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })}.`, 'success');
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
    try {
        lembreteAtual = await obterLembreteDaNota(notaId, auth);
        if (abertura !== aberturaAtual) return false;
        apresentarLembrete(lembreteAtual);
        await atualizarPermissao();
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
        definirEstado('A ativar as notificações e a guardar o lembrete...');
        try {
            const instante = obterInstanteEscolhido();
            await ativarNotificacoes(auth);
            lembreteAtual = await guardarLembreteDaNota(notaId, {
                remindAt: Math.floor(instante.getTime() / 1000),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            }, auth);
            apresentarLembrete(lembreteAtual);
            await atualizarPermissao();
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
