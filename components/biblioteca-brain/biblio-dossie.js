// components/biblioteca-brain/biblio-dossie.js
import { iniciarVisualizacaoDossie } from '../brain-core/brain-engine.js';

export function render(estudo, container, db, auth) {
    iniciarVisualizacaoDossie("Biblioteca", estudo, container, db, auth);
}