import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const fallbackValues = {
  VITE_FIREBASE_API_KEY: "dummy_api_key",
  VITE_FIREBASE_AUTH_DOMAIN: "dummy.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "dummy",
  VITE_FIREBASE_STORAGE_BUCKET: "dummy.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456",
  VITE_FIREBASE_APP_ID: "1:123456:web:abcd",
};

function firebaseEnv(name) {
  const value = import.meta.env[name];
  if (value) return value;
  if (import.meta.env.PROD) {
    throw new Error(`Missing required Firebase environment variable: ${name}`);
  }
  return fallbackValues[name];
}

const firebaseConfig = {
  apiKey: firebaseEnv("VITE_FIREBASE_API_KEY"),
  authDomain: firebaseEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: firebaseEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: firebaseEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: firebaseEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: firebaseEnv("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
