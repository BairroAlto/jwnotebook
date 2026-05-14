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

/**
 * SINCRONIZADOR GLOBAL DA BARRA LATERAL
 */
window.sincronizarBarraLateralComNota = (idNota, dados, auth) => {
    const onde = (dados.onde || "local").toUpperCase();
    const uid = auth.currentUser.uid;

    console.log(`🎯 [SYNC] Sincronizando lateral para: ${onde} | Nota: ${idNota}`);

    // 1. FORÇAR MUDANÇA DE ABA (LOCAL / SHARE / PINS)
    const botoesAba = document.querySelectorAll('#left-buttons button');
    botoesAba.forEach(btn => {
        if (btn.innerText.trim().toUpperCase() === onde) {
            if (!btn.classList.contains('active')) btn.click();
        }
    });

    // 2. VIAJAR PARA A PASTA (Se for diferente da atual)
    if (onde === "LOCAL") {
        const pastaDestino = dados.pastapai || "root";
        if (window.pastaAtual !== pastaDestino) {
            window.pastaAtual = pastaDestino;
            window.historicoPastas = [{ id: "root", nome: "Local" }];
            if (pastaDestino !== "root") window.historicoPastas.push({ id: pastaDestino, nome: "Pasta" });
            
            if (typeof window.carregarPastaLocalManual === 'function') {
                window.carregarPastaLocalManual(pastaDestino);
            }
        }
    } else if (onde === "SHARE") {
        const pastaDestinoShare = dados[uid]?.pastapai || "home";
        if (window.pastaShareAtual !== pastaDestinoShare) {
            window.pastaShareAtual = pastaDestinoShare;
            window.historicoPastasShare = [{ id: "home", nome: "Share" }];
            if (pastaDestinoShare !== "home") window.historicoPastasShare.push({ id: pastaDestinoShare, nome: "Pasta" });

            if (typeof window.dispararLeituraShare === 'function') {
                window.dispararLeituraShare();
            }
        }
    }

    // 3. REFORÇO DE HIGHLIGHT (Tenta agora e tenta daqui a pouco)
    const aplicarDestaque = () => {
        document.querySelectorAll('.item-local').forEach(el => {
            const elId = el.getAttribute('data-id') || el.dataset.itemid;
            el.classList.toggle('active', elId === idNota);
        });
    };

    aplicarDestaque();
    setTimeout(aplicarDestaque, 500); // Segunda tentativa após o render do Firebase
};
