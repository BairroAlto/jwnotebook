import { guardarPreferenciasUtilizador } from '../settings/preferences.js';
import { PLUGS_LOJA, normalizarPlugsInstalados } from './plug-catalog.js';
import { acessoDoItem, criarCartaoLoja } from './store-card.js';

function publicarEstado(instalados, acessos) {
    const permitidos = PLUGS_LOJA.filter(plug => {
        const acesso = acessoDoItem(plug, acessos);
        return instalados.includes(plug.id)
            && acesso.allowed !== false
            && Number(acesso.active) !== 0;
    }).map(plug => plug.id);

    window.NotaBookPlugsInstalados = instalados;
    window.NotaBookPlugsPermitidos = permitidos;
    const botaoEye = document.getElementById('btn-tab-plugs');
    if (botaoEye) {
        botaoEye.hidden = permitidos.length === 0;
        botaoEye.style.display = permitidos.length ? '' : 'none';
        if (!permitidos.length && botaoEye.classList.contains('active')) window.switchEyeTab?.('indice');
    }
    window.dispatchEvent(new CustomEvent('notabook:plugs-alterados', {
        detail: { instalados: [...instalados], permitidos: [...permitidos] }
    }));
}

export function obterPlugsInstalados() {
    return normalizarPlugsInstalados(window.NotaBookPlugsInstalados);
}

export async function inicializarLojaPlugs({ db, auth, userPrefs, acessos }) {
    const lista = document.getElementById('plug-store-list');
    if (!lista || !auth?.currentUser) return;

    const guardados = Array.isArray(userPrefs.plugsInstalados) ? userPrefs.plugsInstalados : [];
    let instalados = normalizarPlugsInstalados(guardados);
    if (instalados.length !== guardados.length) {
        guardarPreferenciasUtilizador(db, auth.currentUser.uid, { plugsInstalados: instalados })
            .catch(erro => console.info('[PLUGS] Não foi possível limpar instalações antigas:', erro.message));
    }

    const actualizar = () => {
        publicarEstado(instalados, acessos);
        lista.replaceChildren(...PLUGS_LOJA.map(plug => (
            criarCartaoLoja(plug, instalados, acessoDoItem(plug, acessos), async id => {
                const estavaInstalado = instalados.includes(id);
                instalados = normalizarPlugsInstalados(estavaInstalado
                    ? instalados.filter(item => item !== id)
                    : [...instalados, id]);
                userPrefs.plugsInstalados = [...instalados];
                actualizar();

                try {
                    await guardarPreferenciasUtilizador(db, auth.currentUser.uid, {
                        plugsInstalados: instalados
                    });
                } catch (erro) {
                    console.error('[PLUGS] Não foi possível guardar a instalação:', erro);
                    instalados = normalizarPlugsInstalados(estavaInstalado
                        ? [...instalados, id]
                        : instalados.filter(item => item !== id));
                    userPrefs.plugsInstalados = [...instalados];
                    actualizar();
                }
            })
        )));
    };

    actualizar();
}
