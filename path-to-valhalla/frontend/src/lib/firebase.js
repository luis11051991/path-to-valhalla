// ============================================================
// Firebase Initialization - Client Side (Frontend)
// Services: App, Auth (Google + Email/Password), Analytics, Firestore
// ============================================================

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { apiUrl } from "../constants/api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyD8uB80EmzkMUAILXdVWLOtLL0hIAA7qJc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "path-to-valhalla.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "path-to-valhalla",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "path-to-valhalla.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "109648813411",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:109648813411:web:d1e3364b24e765f5820756",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-HEKBL43R72",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// --- Google Provider ---
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");

// Helper para la API del backend
const backendFetch = async (path, body) => {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Firebase login failed");
  }
  return response.json();
};

// --- Login/Registro con Google ---
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken(true); // force refresh
    const data = await backendFetch("/api/v1/firebase-auth/firebase-login", { idToken });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return { user: result.user, backendUser: data.user, isNewPlayer: data.isNewPlayer };
  } catch (error) {
    console.error("Google sign-in error:", error);
    throw error;
  }
};

// --- Login con Email/Password ---
export const signInWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken(true); // force refresh
    const data = await backendFetch("/api/v1/firebase-auth/firebase-login", { idToken });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return { user: result.user, backendUser: data.user, isNewPlayer: data.isNewPlayer };
  } catch (error) {
    console.error("Email sign-in error:", error);
    throw error;
  }
};

// --- Registro con Email/Password ---
export const registerWithEmail = async (email, password, username) => {
  try {
    // Crear cuenta en Firebase Auth primero
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Actualizar displayName (nombre de usuario visible)
    await updateProfile(result.user, { displayName: username });

    // Enviar token al backend para crear/validar la cuenta del juego
    const idToken = await result.user.getIdToken(true); // force refresh
    const data = await backendFetch("/api/v1/firebase-auth/firebase-login", { idToken });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return { user: result.user, backendUser: data.user, isNewPlayer: data.isNewPlayer };
  } catch (error) {
    console.error("Email registration error:", error);
    throw error;
  }
};

// --- Cerrar sesi\u00f3n ---
export const signOutFirebase = async () => {
  await auth.signOut();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export default app;
