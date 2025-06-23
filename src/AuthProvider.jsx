// src/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// 1) Create the context
const AuthContext = createContext();

// 2) Helper hook to consume
export function useAuth() {
  return useContext(AuthContext);
}

// 3) Provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // will store { uid, email, role, ... }
  const [loading, setLoading] = useState(true);

  // Signup: email/password, and also create a Firestore document for role
  async function signup(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    // By default, new users get role = "user"
    await setDoc(doc(db, "users", uid), { role: "user", email: email });
    return userCredential;
  }

  // Signin:
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Signout:
  function logout() {
    return signOut(auth);
  }

  // On mount, listen for auth changes:
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in. Look up their role in Firestore.
        const uid = user.uid;
        const docSnap = await getDoc(doc(db, "users", uid));
        let role = "user";
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role) role = data.role;
        } else {
          // If no user doc exists (rare), create one as "user"
          await setDoc(doc(db, "users", uid), { role: "user", email: user.email });
        }
        setCurrentUser({ uid, email: user.email, role });
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
