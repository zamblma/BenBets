import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDhU3SOsUyOUdTgVdHzUt3wVOMU4o6L3jQ",
  authDomain: "benbets-bbd49.firebaseapp.com",
  projectId: "benbets-bbd49",
  storageBucket: "benbets-bbd49.firebasestorage.app",
  messagingSenderId: "362414137859",
  appId: "1:362414137859:web:fd35faa4f4361b8def2436"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
