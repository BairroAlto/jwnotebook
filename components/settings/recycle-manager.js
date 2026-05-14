// components/settings/recycle-manager.js
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarItensReciclagem } from './recycle-ui.js';

/**
 * MOTOR DE VERIFICAÇÃO DE ITENS EXPIRADOS (+3 MESES)
 */
export async function verificarItensExpirados(db, userId) {
    console.log("🔍 [RECYCLE] A verificar validade dos itens ocultos...");
    
    // 3 meses em milissegundos (90 dias aprox)
    const tresMesesEmMs = 3 * 30 * 24 * 60 * 60 * 1000;
    const agora = Date.now();
    
    const itensExpirados = [];

    try {
        // 1. PROCURAR NOTAS INTEIRAS OCULTAS
        const qNotas = query(
            collection(db, "Local"), 
            where("userId", "==", userId), 
            where("estado", "==", "desativa")
        );
        const snapNotas = await getDocs(qNotas);

        snapNotas.forEach(docSnap => {
            const data = docSnap.data();
            if (data.timedelete) {
                const dataDelete = new Date(data.timedelete).getTime();
                if (agora - dataDelete > tresMesesEmMs) {
                    itensExpirados.push({ id: docSnap.id, tipoItem: 'nota', dados: data });
                }
            }
        });

        // 2. PROCURAR FERRAMENTAS (CAIXAS) DENTRO DE NOTAS ATIVAS
        const qCaixas = query(
            collection(db, "Local"), 
            where("userId", "==", userId), 
            where("estado", "==", "ativa")
        );
        const snapCaixas = await getDocs(qCaixas);

        snapCaixas.forEach(docSnap => {
            const data = docSnap.data();
            if (data.caixas) {
                data.caixas.forEach(caixa => {
                    if (caixa.estado === "desativa" && caixa.timedelete) {
                        const dataDelete = new Date(caixa.timedelete).getTime();
                        if (agora - dataDelete > tresMesesEmMs) {
                            itensExpirados.push({ 
                                id: docSnap.id, 
                                idCaixa: caixa.id, 
                                tipoItem: 'ferramenta', 
                                dados: caixa, 
                                nomeNota: data.nome 
                            });
                        }
                    }
                });
            }
        });

        // 3. SE ENCONTRAR ITENS, DISPARA A UI
        if (itensExpirados.length > 0) {
            console.log(`⚠️ [RECYCLE] Encontrados ${itensExpirados.length} itens expirados.`);
            dispararAlertaReciclagem(itensExpirados);
        } else {
            console.log("✅ [RECYCLE] Tudo em conformidade. Nenhum item expirado.");
        }

    } catch (error) {
        console.error("❌ [RECYCLE] Erro ao verificar itens:", error);
    }
}

/**
 * ATIVA A INTERFACE DE RECICLAGEM
 */
function dispararAlertaReciclagem(lista) {
    const btnTab = document.getElementById('btn-tab-reciclagem');
    const overlay = document.getElementById('popup-settings-overlay');

    if (btnTab && overlay) {
        // Torna a aba visível
        btnTab.style.display = 'flex';
        
        // Abre o popup de definições
        overlay.classList.add('active');

        // Seleciona a aba Reciclagem automaticamente
        btnTab.click();

        // Renderiza a lista de itens
        renderizarItensReciclagem(lista);
    }
}

// Adiciona este export ao components/settings/recycle-manager.js

export async function carregarTodaReciclagem(db, userId) {
    const container = document.getElementById('lista-reciclagem-expirada');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    const tresMesesEmMs = 3 * 30 * 24 * 60 * 60 * 1000;
    const agora = Date.now();
    const todosItensReciclagem = [];

    try {
        // 1. NOTAS OCULTAS
        const qNotas = query(collection(db, "Local"), where("userId", "==", userId), where("estado", "==", "desativa"));
        const snapNotas = await getDocs(qNotas);

        snapNotas.forEach(docSnap => {
            const data = docSnap.data();
            if (data.timedelete) {
                const msPassados = agora - new Date(data.timedelete).getTime();
                todosItensReciclagem.push({
                    id: docSnap.id,
                    tipoItem: 'nota',
                    dados: data,
                    expirado: msPassados > tresMesesEmMs
                });
            }
        });

        // 2. FERRAMENTAS OCULTAS (dentro de qualquer nota do user)
        const qTodasNotas = query(collection(db, "Local"), where("userId", "==", userId));
        const snapTodas = await getDocs(qTodasNotas);

        snapTodas.forEach(docSnap => {
            const data = docSnap.data();
            if (data.caixas) {
                data.caixas.forEach(caixa => {
                    if (caixa.estado === "desativa" && caixa.timedelete) {
                        const msPassados = agora - new Date(caixa.timedelete).getTime();
                        todosItensReciclagem.push({
                            id: docSnap.id,
                            idCaixa: caixa.id,
                            tipoItem: 'ferramenta',
                            dados: caixa,
                            nomeNota: data.nome,
                            expirado: msPassados > tresMesesEmMs
                        });
                    }
                });
            }
        });

        // 3. RENDERIZAR
        import('./recycle-ui.js').then(m => {
            m.renderizarItensReciclagem(todosItensReciclagem);
        });

    } catch (e) {
        console.error("Erro ao carregar reciclagem:", e);
        container.innerHTML = "Erro ao carregar itens.";
    }
}