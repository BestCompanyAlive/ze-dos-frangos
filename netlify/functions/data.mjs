// Dados do site (Netlify Blobs).
//
// Leitura: só as chaves de conteúdo público são anónimas — é o que as páginas
// do site precisam. Tudo o resto exige sessão de administrador.
// Escrita: sempre com sessão válida e origem do próprio site.
import { getStore } from '@netlify/blobs';
import { json } from './_shared/http.mjs';
import { requireWriteAccess, requireSession } from './_shared/guard.mjs';

// Conteúdo que o site publica a toda a gente. É uma lista explícita, não uma
// lista de exclusões: uma chave nova é privada por omissão e só passa a pública
// quando alguém a acrescentar aqui de propósito.
const LEITURA_PUBLICA = new Set([
  'siteGeral',
  'menuData',
  'menuGrupos',
  'pratoDia',
  'sugestaoMes',
  'vinhoMes',
  'maisVendidos',
  'eventos',
  'galeria',
  'perdidosItens',
  'vagasEmprego',
  'siteHorarios',
  'siteContactos',
  'siteTakeaway',
  'reservasConfig',
]);

// Dados pessoais de clientes: nunca saem sem sessão.
const PRIVADAS = new Set(['reservas', 'candidaturas']);

const ESCRITA_PERMITIDA = new Set([...LEITURA_PUBLICA, ...PRIVADAS]);

// As fotos vão em base64 dentro do JSON, por isso o limite é generoso — mas tem
// de existir, senão qualquer sessão pode encher o armazenamento.
const MAX_BYTES = 4 * 1024 * 1024;

export default async (req) => {
  const store = getStore('site-data');
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'missing key' }, 400);

    if (!LEITURA_PUBLICA.has(key)) {
      // Chaves desconhecidas e chaves privadas respondem de forma diferente de
      // propósito: 404 não confirma a existência de nada, 401 diz ao backoffice
      // que a sessão caiu.
      if (!PRIVADAS.has(key)) return json({ error: 'não encontrado' }, 404);
      const auth = await requireSession(req);
      if (auth instanceof Response) return auth;
    }

    const value = await store.get(key, { type: 'text' });
    return json({ value: value ? JSON.parse(value) : null });
  }

  if (req.method === 'POST') {
    const auth = await requireWriteAccess(req);
    if (auth instanceof Response) return auth;

    const texto = await req.text().catch(() => null);
    if (texto === null) return json({ error: 'invalid json' }, 400);
    if (Buffer.byteLength(texto, 'utf8') > MAX_BYTES) {
      return json({ error: 'Conteúdo demasiado grande. Reduza o número ou o tamanho das fotos.' }, 413);
    }

    let body;
    try {
      body = JSON.parse(texto);
    } catch {
      return json({ error: 'invalid json' }, 400);
    }

    const { key, value } = body;
    if (!key) return json({ error: 'missing key' }, 400);
    if (!ESCRITA_PERMITIDA.has(key)) return json({ error: 'chave não permitida' }, 400);

    await store.set(key, JSON.stringify(value === undefined ? null : value));
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
