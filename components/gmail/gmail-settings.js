import { normalizarPreferenciasGmail } from './gmail-service.js';

export function abrirConfiguradorGmail(caixa, cliente) {
    return new Promise(resolve => {
        const overlay = document.getElementById('popup-gmail-overlay');
        const conta = document.getElementById('gmail-config-conta');
        const estado = document.getElementById('gmail-config-estado');
        const ligar = document.getElementById('btn-ligar-gmail');
        const desligar = document.getElementById('btn-desligar-gmail');
        const limite = document.getElementById('gmail-limite');
        const filtro = document.getElementById('gmail-filtro');
        const cancelar = document.getElementById('btn-cancelar-gmail');
        const confirmar = document.getElementById('btn-confirmar-gmail');
        if (!overlay || !conta || !estado || !ligar || !desligar || !limite || !filtro || !cancelar || !confirmar) {
            resolve(null);
            return;
        }

        const preferencias = normalizarPreferenciasGmail(caixa.gmailPreferencias);
        limite.value = String(preferencias.limite);
        filtro.value = preferencias.filtro;
        overlay.classList.add('active');

        const atualizarLigacao = (mensagem = '') => {
            const perfil = cliente.obterPerfil();
            const ligado = cliente.estaLigado();
            conta.textContent = ligado ? (perfil?.email || 'Conta Google ligada') : 'Nenhuma conta ligada';
            estado.textContent = mensagem || (ligado
                ? `${cliente.obterLeiturasRestantes()} leituras disponíveis hoje.`
                : 'O conteúdo dos emails não é guardado na nota.');
            estado.dataset.tipo = ligado ? 'ligado' : 'desligado';
            ligar.hidden = ligado;
            desligar.hidden = !ligado;
        };

        const removerSubscricao = cliente.subscrever(novoEstado => atualizarLigacao(novoEstado.mensagem));
        atualizarLigacao();

        const fechar = dados => {
            overlay.classList.remove('active');
            removerSubscricao();
            ligar.onclick = null;
            desligar.onclick = null;
            cancelar.onclick = null;
            confirmar.onclick = null;
            resolve(dados);
        };

        ligar.onclick = async () => {
            ligar.disabled = true;
            try {
                await cliente.ligar();
            } catch (erro) {
                estado.textContent = erro.message || 'Não foi possível ligar o Gmail.';
                estado.dataset.tipo = 'erro';
            } finally {
                ligar.disabled = false;
                atualizarLigacao(estado.textContent);
            }
        };
        desligar.onclick = async () => {
            desligar.disabled = true;
            try { await cliente.desligar(); } finally {
                desligar.disabled = false;
                atualizarLigacao();
            }
        };
        cancelar.onclick = () => fechar(null);
        confirmar.onclick = () => fechar(normalizarPreferenciasGmail({
            limite: limite.value,
            filtro: filtro.value
        }));
    });
}
