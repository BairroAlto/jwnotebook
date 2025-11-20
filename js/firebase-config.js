// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
// Adicionamos a importação da Autenticação
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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

// Exporta o Firestore e a Autenticação
export const db = getFirestore(app);
export const auth = getAuth(app);
