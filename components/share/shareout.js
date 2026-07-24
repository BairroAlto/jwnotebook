// components/share/shareout.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from '../../firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const noop = () => {};

async function carregarNotaPublica() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const feed = document.getElementById('view-feed');
    const tituloEl = document.getElementById('view-titulo');

    if (!id) return;

    try {
        const snap = await getDoc(doc(db, "RUA", id));
        if (!snap.exists()) {
            tituloEl.innerText = "Nota nÃ£o encontrada";
            return;
        }

        const nota = snap.data();
        tituloEl.innerText = nota.nome;

        const caixas = nota.caixas || [];
        // OrdenaÃ§Ã£o rigorosa
        caixas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        let contadorRaciocinio = 1;

        for (const caixa of caixas) {
            try {
                let elemento = null;
                // ImportaÃ§Ã£o dinÃ¢mica individual para evitar que um erro quebre o loop
                if (caixa.tipo === "subnota") {
                    const m = await import('../editor/ferramentas/subnota.js');
                    elemento = m.criarSubNotaAzul(caixa, noop, noop, noop, noop, noop, noop, noop);
                } else if (caixa.tipo === "questao") {
                    const m = await import('../editor/ferramentas/questao.js');
                    elemento = m.criarQuestaoVerde(caixa, noop, noop, noop, noop, noop, noop, noop);
                } else if (caixa.tipo === "raciocinio") {
                    const m = await import('../editor/ferramentas/raciocinio.js');
                    elemento = m.criarRaciocinioAmarelo(caixa, contadorRaciocinio++, noop, noop, noop, noop, noop, noop, noop);
                } else if (caixa.tipo === "elevador") {
                    const m = await import('../editor/ferramentas/elevador.js');
                    elemento = m.criarElevadorVermelho(caixa, noop, noop, noop, noop, noop, noop, noop);
                } else if (caixa.tipo === "cartaovisita") {
                    const m = await import('../editor/ferramentas/cartaovisita.js');
                    elemento = m.criarCartaoVisita(caixa, noop, noop, noop, noop);
                } else if (caixa.tipo === "citacaobiblica") {
                    const m = await import('../editor/ferramentas/citacaobiblica.js');
                    elemento = m.criarCitacaoBiblica(caixa, noop, noop, noop);
                } else {
                    const m = await import('../editor/ferramentas/contentor.js');
                    elemento = m.criarContentorLaranja(caixa, noop, noop, noop, noop, noop, noop, noop);
                }

                if (elemento) {
                    // ConfiguraÃ§Ãµes de exibiÃ§Ã£o do elemento
                    elemento.style.marginBottom = "20px";
                    elemento.style.pointerEvents = "none"; // Desativa cliques em tudo por seguranÃ§a

                    // ForÃ§ar expansÃ£o de todos os campos de texto
                    const textAreas = elemento.querySelectorAll('textarea, input');
                    textAreas.forEach(ta => {
                        ta.readOnly = true;
                        // ForÃ§ar altura baseada no conteÃºdo
                        ta.style.height = 'auto';
                        setTimeout(() => {
                            ta.style.height = ta.scrollHeight + 'px';
                        }, 200);
                    });

                    feed.appendChild(elemento);
                }
            } catch (err) {
                console.error("Erro ao renderizar bloco:", caixa.tipo, err);
            }
        }
    } catch (e) {
        console.error("Erro ao carregar RUA:", e);
    }
}

carregarNotaPublica();
