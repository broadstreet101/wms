import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCH9jmfQOoP4gIK41XX5O13tWLo9x7HICE",
  authDomain: "where-s-my-stuff-49e68.firebaseapp.com",
  projectId: "where-s-my-stuff-49e68",
  storageBucket: "where-s-my-stuff-49e68.firebasestorage.app",
  messagingSenderId: "786548521567",
  appId: "1:786548521567:web:f47555e9178839f420b9ea"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
