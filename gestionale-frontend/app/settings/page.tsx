'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { fetchWithAuth } from '@/lib/apiClient';

type MeResponse = {
  uid: string;
  email?: string;
  role: 'HOLDER' | 'TENANT';
  holderId?: string;
};

type HolderUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'HOLDER';
  holderId: string;
  createdAt: string | null;
  isCurrentUser: boolean;
};

function firebaseErrorMessage(error: any): string {
  const code = String(error?.code ?? '');

  if (code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'La password attuale non è corretta.';
  }
  if (code.includes('weak-password')) {
    return 'La nuova password non soddisfa i requisiti di sicurezza.';
  }
  if (code.includes('too-many-requests')) {
    return 'Troppi tentativi. Riprova tra qualche minuto.';
  }
  if (code.includes('requires-recent-login')) {
    return 'Per motivi di sicurezza devi effettuare nuovamente il login prima di cambiare password.';
  }
  if (code.includes('user-not-found')) {
    return 'Utente Firebase non trovato.';
  }

  return error?.message ?? 'Operazione non riuscita.';
}

export default function SettingsPage() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [holderUsers, setHolderUsers] = useState<HolderUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [userBusy, setUserBusy] = useState(false);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [resetBusyUid, setResetBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const hasPasswordProvider = useMemo(
    () => firebaseUser?.providerData.some((provider) => provider.providerId === 'password') ?? false,
    [firebaseUser],
  );

  const loadData = async () => {
    setLoading(true);
    setUserError(null);

    try {
      const meResponse = (await fetchWithAuth('/auth/me')) as MeResponse;
      setMe(meResponse);

      if (meResponse.role === 'HOLDER') {
        const users = (await fetchWithAuth('/auth/holder-users')) as HolderUser[];
        setHolderUsers(Array.isArray(users) ? users : []);
      } else {
        setHolderUsers([]);
      }
    } catch (error: any) {
      setUserError(error?.message ?? 'Errore nel caricamento delle impostazioni.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [authReady, firebaseUser]);

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!firebaseUser?.email) {
      setPasswordError('L’utente corrente non ha un indirizzo email disponibile.');
      return;
    }
    if (!hasPasswordProvider) {
      setPasswordError('Questo account non usa l’accesso email/password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('La conferma della nuova password non coincide.');
      return;
    }
    if (!currentPassword) {
      setPasswordError('Inserisci la password attuale.');
      return;
    }

    setPasswordBusy(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password aggiornata correttamente.');
    } catch (error: any) {
      setPasswordError(firebaseErrorMessage(error));
    } finally {
      setPasswordBusy(false);
    }
  };

  const sendResetEmail = async (email: string, uid?: string) => {
    setPasswordMessage(null);
    setPasswordError(null);
    setUserMessage(null);
    setUserError(null);
    if (uid) setResetBusyUid(uid);

    try {
      await sendPasswordResetEmail(auth, email);
      const message = `Email di reimpostazione password inviata a ${email}.`;
      if (uid) setUserMessage(message);
      else setPasswordMessage(message);
    } catch (error: any) {
      const message = firebaseErrorMessage(error);
      if (uid) setUserError(message);
      else setPasswordError(message);
    } finally {
      if (uid) setResetBusyUid(null);
    }
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setUserMessage(null);
    setUserError(null);

    const email = newUserEmail.trim().toLowerCase();
    const displayName = newUserName.trim();

    if (!email) {
      setUserError('Inserisci l’email del nuovo utente.');
      return;
    }

    setUserBusy(true);
    try {
      await fetchWithAuth('/auth/holder-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName: displayName || undefined,
        }),
      });

      // L'account viene creato dal backend con una password casuale non conoscibile.
      // Firebase invia quindi al nuovo utente il link per impostare la propria password.
      try {
        await sendPasswordResetEmail(auth, email);
        setUserMessage(
          `Utente creato e associato a ${me?.holderId ?? 'questo holder'}. Email per impostare la password inviata a ${email}.`,
        );
      } catch (mailError: any) {
        setUserMessage(
          `Utente creato e associato a ${me?.holderId ?? 'questo holder'}, ma l’email per impostare la password non è stata inviata automaticamente. Puoi reinviarla dalla lista utenti.`,
        );
      }

      setNewUserEmail('');
      setNewUserName('');
      await loadData();
    } catch (error: any) {
      setUserError(error?.message ?? 'Errore durante la creazione dell’utente.');
    } finally {
      setUserBusy(false);
    }
  };

  if (!authReady || loading) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <div className="surface-card p-6">Caricamento impostazioni…</div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="app-shell">
        <div className="app-container">
          <div className="surface-card p-6 space-y-4">
            <h1 className="page-title">Impostazioni</h1>
            <p className="page-subtitle">Devi effettuare il login per accedere a questa pagina.</p>
            <Link className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="/login">
              Vai al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <div className="surface-card p-6 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="page-title">Impostazioni</h1>
              <p className="page-subtitle">
                Gestisci il tuo account e le utenze che lavorano sullo stesso holder.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex w-fit rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="surface-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Il mio account</h2>
              <p className="mt-1 text-sm text-slate-600">
                {firebaseUser.email ?? me?.email ?? firebaseUser.uid}
                {me?.holderId ? ` · holderID: ${me.holderId}` : ''}
              </p>
            </div>

            {hasPasswordProvider ? (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Password attuale</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nuova password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Conferma nuova password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordBusy}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {passwordBusy ? 'Aggiornamento…' : 'Cambia password'}
                </button>
              </form>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Questo account accede tramite un provider esterno e non dispone di una password Firebase da modificare direttamente.
              </div>
            )}

            {firebaseUser.email && (
              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => void sendResetEmail(firebaseUser.email!)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Invia email di reimpostazione password
                </button>
              </div>
            )}

            {passwordMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}
          </section>

          {me?.role === 'HOLDER' && (
            <section className="surface-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Crea nuova utenza</h2>
                <p className="mt-1 text-sm text-slate-600">
                  La nuova utenza sarà associata automaticamente a <strong>{me.holderId ?? 'questo holder'}</strong> e vedrà gli stessi dati.
                </p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nome visualizzato</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(event) => setNewUserName(event.target.value)}
                    placeholder="es. Mario Rossi"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="utente@azienda.it"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={userBusy}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {userBusy ? 'Creazione…' : 'Crea utente e invia email password'}
                </button>
              </form>

              {userMessage && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {userMessage}
                </div>
              )}
              {userError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {userError}
                </div>
              )}
            </section>
          )}
        </div>

        {me?.role === 'HOLDER' && (
          <section className="surface-card p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Utenti associati all’holder</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Tutte queste utenze HOLDER accedono agli stessi dati di <strong>{me.holderId}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadData()}
                className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Aggiorna elenco
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Utente</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Creato</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {holderUsers.map((user) => (
                    <tr key={user.uid}>
                      <td className="px-4 py-3 text-slate-900">
                        {user.displayName || '—'}
                        {user.isCurrentUser && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            tu
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{user.email || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.email ? (
                          <button
                            type="button"
                            disabled={resetBusyUid === user.uid}
                            onClick={() => void sendResetEmail(user.email!, user.uid)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {resetBusyUid === user.uid ? 'Invio…' : 'Invia reset'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {holderUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Nessuna utenza trovata.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
