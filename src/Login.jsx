// src/Login.jsx
import React, { useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export default function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login, signup } = useAuth();
  const [error, setError] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const email = emailRef.current.value;
    const password = passwordRef.current.value;

    try {
      if (isSigningUp) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">{isSigningUp ? "Sign Up" : "Log In"}</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            ref={emailRef}
            required
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            ref={passwordRef}
            required
            className="w-full border px-3 py-2 rounded focus:outline-none focus:ring focus:ring-blue-300"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {isSigningUp ? "Sign Up" : "Log In"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        {isSigningUp ? (
          <>
            Already have an account?{" "}
            <button
              className="text-blue-500 hover:underline"
              onClick={() => setIsSigningUp(false)}
            >
              Log In
            </button>
          </>
        ) : (
          <>
            Need an account?{" "}
            <button
              className="text-blue-500 hover:underline"
              onClick={() => setIsSigningUp(true)}
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </div>
  );
}
