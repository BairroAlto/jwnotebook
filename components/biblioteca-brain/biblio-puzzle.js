// components/biblioteca-brain/biblio-puzzle.js
import { iniciarVisualizacaoPuzzle } from '../brain-core/brain-engine.js';

export function render(estudo, container, db, auth) {
    // CHAMADA: Passamos "Biblioteca" como alvo
    iniciarVisualizacaoPuzzle("Biblioteca", estudo, container, db, auth);
}