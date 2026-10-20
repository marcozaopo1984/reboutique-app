import { auth } from './firebaseClient';

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Share only requests that are still running, never completed financial data.
const pendingReads = new Map<string, Promise<unknown>>();

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not logged in');
  }

  const token = await user.getIdToken();
  const url = `${BASE_URL}${path}`;
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  // Signals and custom fetch options must retain their independent semantics.
  const shareRead = method === 'GET' &&
    Object.keys(options).every((key) => key === 'method' || key === 'headers');
  const key = JSON.stringify([user.uid, token, url, Array.from(headers.entries()).sort()]);
  if (method !== 'GET' && method !== 'HEAD') pendingReads.clear();

  if (shareRead) {
    const pending = pendingReads.get(key);
    if (pending) return structuredClone(await pending);
  }

  const request = performRequest(url, options, headers);
  if (shareRead) pendingReads.set(key, request);
  try {
    const data = await request;
    return shareRead ? structuredClone(data) : data;
  } finally {
    if (shareRead && pendingReads.get(key) === request) pendingReads.delete(key);
    if (method !== 'GET' && method !== 'HEAD') pendingReads.clear();
  }
}

async function performRequest(url: string, options: RequestInit, headers: Headers) {
  const res = await fetch(url, {
    ...options,
    headers,
  });

  //  Se non è ok, costruisco un messaggio di errore senza dare per scontato il JSON
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        message += ` - ${text}`;
      }
    } catch {
      // nessun body, lascio solo lo status
    }
    throw new Error(message);
  }

  // DELETE / 204 / risposte senza body: NON chiamo res.json()
  if (
    res.status === 204 ||
    res.headers.get('content-length') === '0'
  ) {
    return null;
  }

  // provo a fare il parse JSON; se non è JSON valido, torno null
  try {
    return await res.json();
  } catch {
    return null;
  }
}
