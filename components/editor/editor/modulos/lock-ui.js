// components/editor/modulos/lock-ui.js

export const LockUI = {

    /**
     * BLOQUEIA A INTERFACE (Modo Leitura)
     */
    mostrarAvisoBloqueio: (quemNome, exibirPopup = true) => {
        console.log("🔒 [UI] Bloqueando inputs e removendo foco.");

        // 1. REMOVER O CURSOR DE QUALQUER CAMPO (O truque do Blur)
        // Se o utilizador estava a escrever, o cursor desaparece instantaneamente.
        if (document.activeElement && 
           (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
            document.activeElement.blur();
        }

        // 2. DESATIVAR FISICAMENTE TODOS OS TEXTAREAS E INPUTS
        // Isto garante que, mesmo que o foco tente voltar, o browser não deixa escrever.
        const todosInputs = document.querySelectorAll('#editor-feed textarea, #editor-feed input, #editor-titulo');
        todosInputs.forEach(el => {
            el.disabled = true;
            el.style.cursor = "not-allowed";
        });

        // 3. Estilos visuais de bloqueio (O que já tinhas)
        const feed = document.getElementById('editor-feed');
        if (feed) {
            feed.style.pointerEvents = "none"; 
            feed.style.opacity = "0.4";        
            feed.style.filter = "grayscale(1) blur(0.5px)";
        }

        const titulo = document.getElementById('editor-titulo');
        if (titulo) {
            titulo.contentEditable = "false";
            titulo.style.opacity = "0.5";
        }

        const iconesAcao = ['btn-editor-lab', 'btn-editor-tags', 'btn-editor-restaurar'];
        iconesAcao.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.pointerEvents = "none"; el.style.opacity = "0.15"; }
        });

        // 4. Atualizar texto da barra (Sincronização)
        const info = document.getElementById('editor-info-text');
        if (info) {
            info.innerHTML = `<i class="fa-solid fa-lock"></i> Acesso de Leitura`;
            info.style.color = "#ef4444";
        }

        // 5. Popup de Aviso
        if (exibirPopup) {
            import('./tags/tags-utils.js').then(m => {
                if (typeof m.mostrarAviso === 'function') {
                    m.mostrarAviso(`Nota Trancada: "${quemNome}" está a editar agora.`);
                }
            });
        }
    },

    /**
     * LIBERTA A INTERFACE (Modo Escrita)
     */
    libertarEditor: () => {
        console.log("🔓 [UI] Restaurando inputs para modo edição.");

        // 1. REATIVAR TODOS OS INPUTS
        const todosInputs = document.querySelectorAll('#editor-feed textarea, #editor-feed input, #editor-titulo');
        todosInputs.forEach(el => {
            el.disabled = false;
            el.style.cursor = "text";
        });

        // 2. Restaurar estilos (O que já tinhas)
        const feed = document.getElementById('editor-feed');
        if (feed) {
            feed.style.pointerEvents = "auto";
            feed.style.opacity = "1";
            feed.style.filter = "none";
        }

        const titulo = document.getElementById('editor-titulo');
        if (titulo) {
            titulo.contentEditable = "true";
            titulo.style.opacity = "1";
        }

        const iconesAcao = ['btn-editor-lab', 'btn-editor-tags', 'btn-editor-restaurar'];
        iconesAcao.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.pointerEvents = "auto"; el.style.opacity = "1"; }
        });

        const info = document.getElementById('editor-info-text');
        if (info) {
            info.innerText = "Sincronizado";
            info.style.color = "var(--text-muted)";
        }
    }
};