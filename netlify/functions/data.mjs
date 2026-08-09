import { getStore } from '@netlify/blobs';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'zedosfrangos2026';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async (req) => {
  const store = getStore('site-data');
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'missing key' }, 400);
    const value = await store.get(key, { type: 'text' });
    return json({ value: value ? JSON.parse(value) : null });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const { key, value, password } = body;
    if (password !== ADMIN_PASSWORD) return json({ error: 'unauthorized' }, 401);
    if (!key) return json({ error: 'missing key' }, 400);
    await store.set(key, JSON.stringify(value === undefined ? null : value));
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
