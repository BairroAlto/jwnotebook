// components/biblioteca-brain/biblio-fontes.js
import { iniciarVisualizacaoFontes } from '../brain-core/brain-engine.js';

export function render(estudo, container, db, auth) {
    iniciarVisualizacaoFontes("Biblioteca", estudo, container, db, auth);
}