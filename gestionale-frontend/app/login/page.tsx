'use client';

import { FormEvent, useState } from 'react';
import { auth } from '../../lib/firebaseClient';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/tenants'); // dopo login vai a tenants
    } catch (err: any) {
      setError(err.message ?? 'Login error');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/tenants');
    } catch (err: any) {
      setError(err.message ?? 'Google login error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Reboutique – Login
        </h1>

        {user ? (
          <div className="space-y-4">
            <p className="text-sm">
              Logged in as <strong>{user.email ?? user.uid}</strong>
            </p>
            <button
              onClick={() => router.push('/tenants')}
              className="w-full border rounded-md py-2"
            >
              Go to tenants
            </button>
            <button
              onClick={handleLogout}
              className="w-full border rounded-md py-2 mt-2"
            >
              Logout
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-4 mb-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full border rounded-md px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border rounded-md px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
              <button
                type="submit"
                className="w-full border rounded-md py-2"
              >
                Login with email
              </button>
            </form>

            <button
              onClick={handleGoogleLogin}
              className="w-full border rounded-md py-2"
            >
              Login with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}
