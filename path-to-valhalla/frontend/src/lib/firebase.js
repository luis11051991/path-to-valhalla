// ============================================================
// Firebase Initialization - Client Side (Frontend)
// Services: App, Auth, Analytics, Firestore (disabled by default)
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyD8uB80EmzkMUAILXdVWLOtLL0hIAA7qJc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'path-to-valhalla.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'path-to-valhalla',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'path-to-valhalla.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '109648813411',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:109648813411:web:d1e3364b24e765f5820756',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-HEKBL43R72',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Helper function to sign in with Google and pass the credential token to our backend
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();

    // Send token to our Express backend for session management
    const response = await fetch('http://localhost:3000/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) throw new Error('Firebase login failed');

    const data = await response.json();

    // Store our app's token (not the Firebase one)
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return { user: result.user, backendUser: data.user };
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export const signOutFirebase = async () => {
  await auth.signOut();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export default app;
