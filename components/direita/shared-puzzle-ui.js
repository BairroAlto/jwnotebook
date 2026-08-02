// components/direita/shared-puzzle-ui.js
import { updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { BrainBoxFactory } from '../ui/brain-box-component.js';

window._puzzleTimers = window._puzzleTimers || new Map();

export const SharedPuzzleUI = {
    /**
     * RENDERIZA O QUADRO MANUAL USANDO A FÁBRICA PADRONIZADA
     */
    renderQuadroManual: (q, index, listaCompleta, refDoc, callbacks) => {
        const { setEstaAEscrever, moverItem, apagarItem, enviarItem } = callbacks;

        return BrainBoxFactory.criar(q, index, {
            onUpdate: (novoTexto) => {
                setEstaAEscrever(true);
                q.conteudo = novoTexto;

                if (window._puzzleTimers.has(q.id)) clearTimeout(window._puzzleTimers.get(q.id));

                const timer = setTimeout(async () => {
                    try {
                        const snap = await getDoc(refDoc);
                        const novosQuadros = snap.data().Puzzle.quadros.map(item => 
                            item.id === q.id ? { ...item, conteudo: novoTexto } : item
                        );
                        await updateDoc(refDoc, { "Puzzle.quadros": novosQuadros });
                        setEstaAEscrever(false);
                    } catch (err) { console.error(err); }
                }, 1200);

                window._puzzleTimers.set(q.id, timer);
            },
            onMove: moverItem,
            onSend: (data) => { if (enviarItem) enviarItem(data); },
            onDelete: async (id) => {
                const confirmou = await SharedPuzzleUI.confirmarAcao(
                    "Apagar Anotação?", 
                    "Tens a certeza que desejas eliminar este quadro permanentemente?"
                );
                if (confirmou) apagarItem(id);
            }
        });
    },

    /**
     * POPUP DE CONFIRMAÇÃO (PROMISE)
     */
    confirmarAcao: (t, m) => new Promise(res => { 
        const overlay = document.getElementById('popup-confirmar-puzzle-overlay');
        if(!overlay) return res(confirm(m));
        document.getElementById('puzzle-confirm-titulo').innerText = t;
        document.getElementById('puzzle-confirm-msg').innerText = m;
        overlay.classList.add('active');
        document.getElementById('btn-puzzle-confirm-sim').onclick = () => { overlay.classList.remove('active'); res(true); };
        document.getElementById('btn-puzzle-confirm-cancelar').onclick = () => { overlay.classList.remove('active'); res(false); };
    }),

    /**
     * POPUP 1: ESCOLHER TIPO DE NOTA (NOTA SIMPLES VS CAIXA CONECTORA)
     */
    abrirPopupTipoNota: () => new Promise(resolve => {
        let overlay = document.getElementById('popup-tipo-puzzle-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'popup-tipo-puzzle-overlay';
            overlay.className = 'popup-overlay';
            overlay.style.cssText = 'z-index: 99999; backdrop-filter: blur(10px); background: rgba(15,23,42,0.7);';
            overlay.innerHTML = `
                <div class="popup-content" style="max-width:380px; width:90%; padding:22px; border-radius:18px; background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 50px rgba(0,0,0,0.7); text-align:center;">
                    <div style="font-size:16px; font-weight:800; color:#f8fafc; margin-bottom:6px; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fa-solid fa-plus-circle" style="color:var(--primary, #6366f1);"></i> Adicionar ao Puzzle
                    </div>
                    <div style="font-size:12px; color:#94a3b8; margin-bottom:20px;">Escolhe o formato da nota a criar:</div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button id="btn-tipo-simples" style="padding:14px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:white; cursor:pointer; font-weight:700; font-size:13px; display:flex; align-items:center; gap:12px; transition:0.2s;">
                            <i class="fa-solid fa-note-sticky" style="color:#fbbf24; font-size:20px; width:24px;"></i>
                            <div style="text-align:left;">
                                <div style="color:#f8fafc;">Nota Simples</div>
                                <small style="color:#64748b; font-weight:500;">Anotação rápida em texto</small>
                            </div>
                        </button>
                        <button id="btn-tipo-conectora" style="padding:14px 16px; border-radius:12px; border:1px solid rgba(99,102,241,0.35); background:rgba(99,102,241,0.14); color:white; cursor:pointer; font-weight:700; font-size:13px; display:flex; align-items:center; gap:12px; transition:0.2s;">
                            <i class="fa-solid fa-diagram-project" style="color:#818cf8; font-size:20px; width:24px;"></i>
                            <div style="text-align:left;">
                                <div style="color:#f8fafc;">Caixa Conectora</div>
                                <small style="color:#a5b4fc; font-weight:500;">Ferramenta completa para o estudo</small>
                            </div>
                        </button>
                    </div>
                    <button id="btn-tipo-cancelar" style="margin-top:16px; background:none; border:none; color:#64748b; font-size:12px; font-weight:700; cursor:pointer;">Cancelar</button>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        overlay.classList.add('active');

        const btnSimples = overlay.querySelector('#btn-tipo-simples');
        const btnConectora = overlay.querySelector('#btn-tipo-conectora');
        const btnCancelar = overlay.querySelector('#btn-tipo-cancelar');

        const fechar = (escolha) => {
            overlay.classList.remove('active');
            resolve(escolha);
        };

        btnSimples.onclick = () => fechar('simples');
        btnConectora.onclick = () => fechar('conectora');
        btnCancelar.onclick = () => fechar(null);
    }),

    /**
     * POPUP 2: SELETOR DE TIPO DE FERRAMENTA (CONTENTOR, QUESTÃO, SUBNOTA, RACIOCÍNIO)
     */
    abrirSeletorTipoFerramenta: () => new Promise(resolve => {
        let overlay = document.getElementById('popup-seletor-ferramenta-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'popup-seletor-ferramenta-overlay';
            overlay.className = 'popup-overlay';
            overlay.style.cssText = 'z-index: 99999; backdrop-filter: blur(10px); background: rgba(15,23,42,0.7);';
            overlay.innerHTML = `
                <div class="popup-content" style="max-width:380px; width:90%; padding:22px; border-radius:18px; background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 50px rgba(0,0,0,0.7); text-align:center;">
                    <div style="font-size:16px; font-weight:800; color:#f8fafc; margin-bottom:6px; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fa-solid fa-toolbox" style="color:#818cf8;"></i> Tipo de Ferramenta
                    </div>
                    <div style="font-size:12px; color:#94a3b8; margin-bottom:18px;">Selecione o formato da caixa conectora:</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <button data-tipo="contentor" style="padding:14px; border-radius:12px; border:1px solid rgba(249,115,22,0.3); background:rgba(249,115,22,0.12); color:#fdba74; cursor:pointer; font-weight:800; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:6px;">
                            <i class="fa-solid fa-box-archive" style="font-size:18px;"></i> Contentor
                        </button>
                        <button data-tipo="questao" style="padding:14px; border-radius:12px; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.12); color:#6ee7b7; cursor:pointer; font-weight:800; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:6px;">
                            <i class="fa-solid fa-circle-question" style="font-size:18px;"></i> Questão
                        </button>
                        <button data-tipo="subnota" style="padding:14px; border-radius:12px; border:1px solid rgba(59,130,246,0.3); background:rgba(59,130,246,0.12); color:#93c5fd; cursor:pointer; font-weight:800; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:6px;">
                            <i class="fa-solid fa-file-pen" style="font-size:18px;"></i> Subnota
                        </button>
                        <button data-tipo="raciocinio" style="padding:14px; border-radius:12px; border:1px solid rgba(245,158,11,0.3); background:rgba(245,158,11,0.12); color:#fde047; cursor:pointer; font-weight:800; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:6px;">
                            <i class="fa-solid fa-brain" style="font-size:18px;"></i> Raciocínio
                        </button>
                    </div>
                    <button id="btn-ferramenta-cancelar" style="margin-top:16px; background:none; border:none; color:#64748b; font-size:12px; font-weight:700; cursor:pointer;">Cancelar</button>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        overlay.classList.add('active');

        const btns = overlay.querySelectorAll('button[data-tipo]');
        const btnCancelar = overlay.querySelector('#btn-ferramenta-cancelar');

        const fechar = (tipo) => {
            overlay.classList.remove('active');
            resolve(tipo);
        };

        btns.forEach(b => b.onclick = () => fechar(b.dataset.tipo));
        btnCancelar.onclick = () => fechar(null);
    })
};