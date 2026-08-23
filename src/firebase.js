import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Same project as the web app — this config is a client identifier, not a
// secret, and is safe to commit either way. Every client (web, this Expo
// app, eventually the AR app) reads/writes the exact same Firestore/Storage
// data, which is what makes admin changes show up everywhere automatically
// with zero extra sync work.
const firebaseConfig = {
  apiKey: "AIzaSyBlbEhPopzySkTI6YOg18fVAOixVcKhIZM",
  authDomain: "arise-authentication-fda17.firebaseapp.com",
  databaseURL: "https://arise-authentication-fda17-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "arise-authentication-fda17",
  storageBucket: "arise-authentication-fda17.firebasestorage.app",
  messagingSenderId: "682892051669",
  appId: "1:682892051669:web:a4ca94a72ebcdb769e0e5c",
  measurementId: "G-0PZ511TTJL",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// React Native has no browser localStorage, so plain getAuth() can't persist
// a session between app launches — it needs an explicit persistence layer.
// AsyncStorage is React Native's equivalent, and this is the standard,
// Firebase-documented way to wire it up.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
