import { marcarNotificacaoPalcoComoVista, removerNotificacaoPalco, watchPalcoNotifications } from './palco-store.js';

let latest = [];

export function iniciarNotificacoesPalco(onChange) {
    return watchPalcoNotifications(items => {
        latest = items;
        if (typeof onChange === "function") onChange(items);
    });
}

export function obterNotificacoesPalco() {
    return latest;
}

export async function concluirNotificacaoPalco(notification) {
    await marcarNotificacaoPalcoComoVista(notification);
}

export async function eliminarNotificacaoPalco(notificationId) {
    await removerNotificacaoPalco(notificationId);
}
