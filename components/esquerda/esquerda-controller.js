// components/esquerda/esquerda-controller.js
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { LockManager } from '../editor/modulos/lock-manager.js';

/**
 * Controlador principal da navegação lateral esquerda.
 * Gere a troca de estados entre Local, Share, Pins e Lists.
 */
export function iniciarControladorEsquerda() {
    console.log("🖱️ [CONTROLLER] Navegação da Esquerda Ativa");

    const db = getFirestore();
    const auth = getAuth();

    document.addEventListener('click', async (e) => {
        const btnAba = e.target.closest('#left-buttons button');
        if (!btnAba) return;

        // 1. IDENTIFICAÇÃO DA ABA CLICADA
        const nomeAbaAlvo = btnAba.innerText.trim().toUpperCase();

        // 2. SEGURANÇA: LIBERTAR NOTAS SHARE AO SAIR DA ABA
        // Se o utilizador não está a ir para SHARE, mas estava a editar uma nota de Share, libertamos a tranca.
        if (nomeAbaAlvo !== 'SHARE') {
            if (window.notaAbertaId && window.dadosNotaOriginal?.onde === "share") {
                console.log("🔓 [CONTROLLER] Saindo da aba Share. Libertando tranca da nota...");
                if (auth.currentUser) {
                    await LockManager.libertar(db, window.notaAbertaId, auth.currentUser.uid);
                }
            }
        }

        // 3. LIMPEZA E ATIVAÇÃO VISUAL DOS BOTÕES DO TOPO
        document.querySelectorAll('#left-buttons button').forEach(b => {
            b.classList.remove('active', 'is-share');
        });
        
        btnAba.classList.add('active');

        // 4. REFERÊNCIAS DOS ELEMENTOS DE INTERFACE (CABEÇALHOS E LISTAS)
        const navLocal = document.getElementById('nav-pastas');
        const navShare = document.getElementById('nav-share');
        const navPins = document.getElementById('nav-pins'); // NOVO: Cabeçalho PINS
        
        const listaLocal = document.getElementById('lista-local');
        const listaShare = document.getElementById('lista-share');
        const listaPins = document.getElementById('lista-pins'); // NOVO: Lista PINS
        const listaLists = document.getElementById('lista-lists');

        // 5. LÓGICA DE VISIBILIDADE (O que mostrar em cada aba)
        switch (nomeAbaAlvo) {
            case 'SHARE':
                btnAba.classList.add('is-share'); // Aplica a linha vermelha via CSS
                alternarDisplays([navShare, listaShare], 'flex');
                alternarDisplays([navLocal, navPins, listaLocal, listaLists, listaPins], 'none');
                
                // Disparar o motor de leitura do Firebase para a aba Share
                if (typeof window.dispararLeituraShare === 'function') {
                    window.dispararLeituraShare();
                }
                break;

       case 'LOCAL':
    alternarDisplays([navLocal, listaLocal], 'flex');
    alternarDisplays([navShare, navPins, listaShare, listaLists, listaPins], 'none');
    // Forçar a atualização visual das classes active
    document.querySelectorAll('.item-local').forEach(el => {
        el.classList.toggle('active', el.dataset.id === window.itemSelecionadoId);
    });
    break;

case 'PINS':
    alternarDisplays([navPins, listaPins], 'flex');
    alternarDisplays([navLocal, navShare, listaLocal, listaShare, listaLists], 'none');
    // Forçar a atualização visual nos Pins
    document.querySelectorAll('#lista-pins .item-local').forEach(el => {
        // Nos pins, o ID real do item está no dataset.itemid
        el.classList.toggle('active', el.dataset.itemid === window.itemSelecionadoId);
    });
    break;
            case 'LISTS':
                alternarDisplays([listaLists], 'flex');
                alternarDisplays([navLocal, navShare, navPins, listaLocal, listaShare, listaPins], 'none');
                break;

            default:
                // Fallback para segurança
                alternarDisplays([navLocal, navShare, navPins, listaLocal, listaShare, listaLists, listaPins], 'none');
                break;
        }
    });
}

/**
 * Função utilitária para mudar o display de vários elementos ao mesmo tempo.
 */
function alternarDisplays(elementos, estado) {
    elementos.forEach(el => {
        if (el) el.style.display = estado;
    });
}