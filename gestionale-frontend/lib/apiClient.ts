import { auth } from './firebaseClient';

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not logged in');
  }

  const token = await user.getIdToken();

  const url = `${BASE_URL}${path}`;
  console.log('Chiamo il backend su:', url);

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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
