import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCH9jmqOoP4gIK41XX5O13tWLo9x7HICE",
  authDomain: "where-s-my-stuff-49e68.firebaseapp.com",
  projectId: "where-s-my-stuff-49e68",
  storageBucket: "where-s-my-stuff-49e68.firebasestorage.app",
  messagingSenderId: "786548521567",
  appId: "1:786548521567:web:f47555e9178839f420b9ea",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}