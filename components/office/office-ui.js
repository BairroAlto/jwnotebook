import { $, normalizar } from './office-core.js';

export function finalizarLoading() {
    const loader = $('loading-screen');
    if (!loader) return;
    loader.style.opacity = "0";
    setTimeout(() => loader.style.display = "none", 350);
}

export function mostrarLogin() {
    const loading = $('loading-screen');
    const login = $('login-screen');
    if (loading) loading.style.display = "none";
    if (login) login.style.display = "flex";
}

export async function carregarMenuSuperior() {
    const menu = $('office-top-menu');
    if (!menu) return;
    const res = await fetch('components/topo/menu.html');
    menu.innerHTML = await res.text();
    menu.querySelectorAll('.nav-item').forEach(link => {
        const label = normalizar(link.textContent);
        link.classList.toggle('active', label.includes('escritorio'));
    });
}
