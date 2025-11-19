// js/firebase-config.js

// Importe as funções que você precisa dos SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// A configuração do seu aplicativo da web do Firebase
// SUBSTITUA PELAS SUAS CREDENCIAIS REAIS
const firebaseConfig = {
  apiKey: "AIzaSyAZmDPPbqyfnP3rfrT2-xsWg92qbbL2a-0",
  authDomain: "jwnotebook.firebaseapp.com",
  projectId: "jwnotebook",
  storageBucket: "jwnotebook.firebasestorage.app",
  messagingSenderId: "299467134440",
  appId: "1:299467134440:web:7b25d02c77fd09711f405d"
};

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);

// Inicialize o Cloud Firestore e exporte-o para ser usado em outros lugares
export const db = getFirestore(app);
