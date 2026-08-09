// Utilitários de HTTP partilhados pelas funções: respostas, cookies, IP do
// cliente e a verificação de origem que protege contra CSRF.

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function parseCookies(req) {
  const header = req.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function isSecureRequest(req) {
  const forwarded = req.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getClientIp(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'desconhecido'
  );
}

/**
 * Defesa contra CSRF: qualquer pedido que altere estado tem de trazer "Origin"
 * (ou "Referer") do próprio site. Em conjunto com SameSite=Strict no cookie de
 * sessão, um site terceiro não consegue agir em nome do administrador.
 * Devolve uma Response de erro quando rejeita, ou null quando está tudo bem.
 */
export function checkOrigin(req) {
  const host = req.headers.get('host');
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const source = origin || referer;
  if (!source || !host) return json({ error: 'origem inválida' }, 403);
  let sourceHost;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return json({ error: 'origem inválida' }, 403);
  }
  if (sourceHost !== host) return json({ error: 'origem inválida' }, 403);
  return null;
}

/**
 * Garante que uma resposta demora pelo menos `ms` desde `startedAt`. Usado nas
 * falhas de autenticação para que o tempo de resposta não revele se o
 * utilizador existe, se a password chegou a ser verificada, ou se a conta está
 * bloqueada.
 */
export async function atLeast(startedAt, ms) {
  const remaining = ms - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
}

export function readBody(req, maxBytes = 1024 * 1024) {
  return req
    .text()
    .then((text) => {
      if (Buffer.byteLength(text, 'utf8') > maxBytes) return { tooLarge: true };
      try {
        return { data: JSON.parse(text || '{}') };
      } catch {
        return { invalid: true };
      }
    })
    .catch(() => ({ invalid: true }));
}
