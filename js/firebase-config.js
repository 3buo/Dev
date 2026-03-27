import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyBa-d5nGmHqiJV0Es9LgT1S3gW4iFRBpyw", 
    authDomain: "activities-app-web.firebaseapp.com", 
    projectId: "activities-app-web", 
    storageBucket: "activities-app-web.firebasestorage.app", 
    messagingSenderId: "494543385836", 
    appId: "1:494543385836:web:8774fd9e43948de535e1c9" 
};
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);