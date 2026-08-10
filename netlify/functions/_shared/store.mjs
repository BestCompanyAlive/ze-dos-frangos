// Armazenamento da autenticação (Netlify Blobs).
//
// Consistência forte é obrigatória aqui: por omissão os Blobs são eventualmente
// consistentes, e isso partiria o rate limiting (contadores desatualizados) e a
// revogação de sessões (uma sessão terminada continuaria a ser aceite).
import { getStore } from '@netlify/blobs';

export function authStore() {
  return getStore({ name: 'auth', consistency: 'strong' });
}

export async function getJSON(key) {
  const raw = await authStore().get(key, { type: 'text' });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setJSON(key, value) {
  await authStore().set(key, JSON.stringify(value));
}

export async function del(key) {
  await authStore().delete(key);
}

export async function listKeys(prefix) {
  const { blobs } = await authStore().list({ prefix });
  return (blobs || []).map((b) => b.key);
}
