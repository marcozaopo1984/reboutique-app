'use client';

import { FormEvent, useEffect, useState } from 'react';
import { auth } from '../../lib/firebaseClient';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/apiClient';

type MeResponse = {
  uid: string;
  email?: string;
  role: 'HOLDER' | 'TENANT';
  holderId?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login'); // 👈 login vs registrazione tenant
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Chiama il backend per sapere chi sono (HOLDER o TENANT) e fa redirect
  const goToDashboardByRole = async () => {
    try {
      const me = (await fetchWithAuth('/auth/me')) as MeResponse;
      if (me.role === 'HOLDER') {
        router.push('/dashboard');           // dashboard gestionale
      } else {
        router.push('/search-properties'); // tenant: motore di ricerca
      }
    } catch (err: any) {
      console.error('Error fetching /auth/me', err);
      setError(err.message ?? 'Errore nel recupero del profilo utente');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        // LOGIN email/password
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // REGISTRAZIONE TENANT email/password
        // Il guard sul backend creerà users/{uid} con role: 'TENANT'
        await createUserWithEmailAndPassword(auth, email, password);
      }

      await goToDashboardByRole();
    } catch (err: any) {
      setError(err.message ?? 'Login/registrazione error');
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Inserisci prima il tuo indirizzo email.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice('Email di reimpostazione password inviata. Controlla la tua casella di posta.');
    } catch (err: any) {
      setError(err.message ?? 'Errore durante l’invio dell’email di reimpostazione');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Utente nuovo → TENANT; utente esistente → ruolo da Firestore
      await goToDashboardByRole();
    } catch (err: any) {
      setError(err.message ?? 'Google login error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
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
              onClick={goToDashboardByRole}
              className="w-full border rounded-md py-2"
            >
              Go to dashboard
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
            {/* Toggle login / registrazione tenant */}
            <div className="flex mb-4 border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 text-sm ${
                  mode === 'login'
                    ? 'bg-slate-200 font-semibold'
                    : 'bg-white'
                }`}
              >
                Login (holder o tenant)
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 text-sm ${
                  mode === 'register'
                    ? 'bg-slate-200 font-semibold'
                    : 'bg-white'
                }`}
              >
                Registrati come tenant
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mb-4">
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
              {error && <p className="text-red-500 text-sm">{error}</p>}
              {notice && <p className="text-emerald-700 text-sm">{notice}</p>}
              <button
                type="submit"
                className="w-full border rounded-md py-2"
              >
                {mode === 'login'
                  ? 'Login with email'
                  : 'Register as tenant with email'}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="w-full text-sm text-slate-600 underline underline-offset-4"
                >
                  Password dimenticata?
                </button>
              )}
            </form>

            <button
              onClick={handleGoogleLogin}
              className="w-full border rounded-md py-2"
            >
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  );
}
