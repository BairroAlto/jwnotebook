// components/topico-brain/topico-cita.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { abrirNotaNoEditor } from '../editor/editor.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export async function abrirSubtopicoNoBrain(subtopico) {
    // 1. Ativar Painel BRAIN
    if (window.switchPanel) window.switchPanel('brain');

    // 2. Ativar aba "Cita" (Botão 4 do grupo brain)
    const btnCita = document.querySelector('.sub-tabs.group-brain button:nth-child(4)');
    if (btnCita) {
        document.querySelectorAll('.sub-tabs.group-brain button').forEach(b => b.classList.remove('active'));
        btnCita.classList.add('active');
    }

    const container = document.getElementById('brain-resultado-pesquisa');
    if (!container) return;

    // 3. Garantir que o container está visível
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // 4. Injetar sub-abas (Caixas / Notas)
    container.innerHTML = `
        <div style="display:flex; gap:8px; margin-bottom:15px; padding: 5px;">
            <button id="btn-sub-caixas" class="btn-amt active" style="flex:1; height:32px;">Caixas</button>
            <button id="btn-sub-notas" class="btn-amt" style="flex:1; height:32px;">Notas</button>
        </div>
        <div id="subtopico-brain-content" style="display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    const display = document.getElementById('subtopico-brain-content');

    const carregarCaixas = async () => {
        display.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
        const ids = subtopico.caixas || [];
        if(ids.length === 0) { display.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; padding:20px;">Nenhuma caixa vinculada.</p>`; return; }

        const q = query(collection(db, "Local"), where("userId", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        let html = "";

        snap.forEach(docNota => {
            const nota = docNota.data();
            (nota.caixas || []).forEach(c => {
                if(ids.includes(c.id)) {
                    const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
                    const resumo = c.titulo || (c.conteudo ? c.conteudo.substring(0, 60) + "..." : "Sem conteúdo");
                    html += `
                        <div class="indice-card" style="border-left-color:${config.cor}; background:rgba(255,255,255,0.03);" onclick="window.irParaNotaECaixa('${docNota.id}', '${c.id}')">
                            <div class="label-tipo" style="color:${config.cor}"><i class="${config.icon}"></i> ${config.nome}</div>
                            <div class="resumo-texto">${resumo}</div>
                            <div style="font-size:8px; opacity:0.4; text-align:right; margin-top:4px;">Em: ${nota.nome}</div>
                        </div>`;
                }
            });
        });
        display.innerHTML = html || "Conteúdo não encontrado.";
    };

    const carregarNotas = async () => {
        display.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
        const ids = subtopico.notas || [];
        if(ids.length === 0) { display.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; padding:20px;">Nenhuma nota vinculada.</p>`; return; }

        let html = "";
        for(const notaId of ids) {
            const docSnap = await getDoc(doc(db, "Local", notaId));
            if(docSnap.exists()) {
                const d = docSnap.data();
                html += `
                <div class="menu-item-list" onclick="window.abrirNotaPeloBrain('${docSnap.id}')" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color);">
                    <i class="fa-solid fa-file-lines" style="color:var(--primary);"></i>
                    <span style="font-size:13px;">${d.nome}</span>
                </div>`;
            }
        }
        display.innerHTML = html;
    };

    document.getElementById('btn-sub-caixas').onclick = (e) => {
        document.getElementById('btn-sub-caixas').classList.add('active');
        document.getElementById('btn-sub-notas').classList.remove('active');
        carregarCaixas();
    };

    document.getElementById('btn-sub-notas').onclick = (e) => {
        document.getElementById('btn-sub-notas').classList.add('active');
        document.getElementById('btn-sub-caixas').classList.remove('active');
        carregarNotas();
    };

    carregarCaixas();
}