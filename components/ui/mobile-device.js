/**
 * Detecção comum do viewport BlueMobile.
 *
 * Um telemóvel em landscape pode ultrapassar 768px de largura, mas continua
 * a ser um dispositivo touch e deve manter a experiência mobile.
 */
const TOUCH_VIEWPORT_QUERY = '(pointer: coarse) and (hover: none)';

export function isMobileViewport() {
    return window.innerWidth <= 768 || window.matchMedia(TOUCH_VIEWPORT_QUERY).matches;
}

export function isTouchViewport() {
    return window.matchMedia(TOUCH_VIEWPORT_QUERY).matches;
}