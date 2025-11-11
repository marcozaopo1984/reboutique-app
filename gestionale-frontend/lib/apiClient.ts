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
  console.log('Chiamo il backend su:', url);   // <--- LOG DI CONTROLLO

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed: ${res.status} - ${text}`);
  }

  return res.json();
}
