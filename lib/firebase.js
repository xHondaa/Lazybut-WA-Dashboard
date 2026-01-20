import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDRfmaidpJVIzek4fYmIZLuhN-9dO3Tsr8",
  authDomain: "lazybut-whatsapp.firebaseapp.com",
  projectId: "lazybut-whatsapp",
  storageBucket: "lazybut-whatsapp.firebasestorage.app",
  messagingSenderId: "545564281057",
  appId: "1:545564281057:web:704bba36ce2bfb047fcfa0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);