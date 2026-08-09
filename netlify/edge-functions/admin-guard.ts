// Porta do backoffice.
//
// Corre na borda, antes de o Netlify servir o ficheiro estático /admin.html —
// que é exatamente o que faltava: sendo estático, o painel nunca passava por
// código nenhum e era servido a quem o pedisse.
//
// Aqui só se verifica a assinatura e a validade do cookie, sem tocar nos Blobs,
// para não acrescentar latência a cada carregamento. A revogação (sessão
// terminada, palavra-passe mudada) é imposta pelas funções: qualquer leitura ou
// escrita falha com 401, e o próprio painel chama /api/auth/me ao arrancar e
// reencaminha para a entrada. Uma sessão revogada consegue, no limite, ver a
// casca vazia do painel até o cookie expirar — e mais nada.
import type { Config, Context } from '@netlify/edge-functions';

const COOKIE_SEGURO = '__Host-zdf_sessao';
const COOKIE_LOCAL = 'zdf_sessao';
const PAGINA_ENTRADA = '/admin-login.html';

export default async (request: Request, context: Context) => {
  const segredo = Netlify.env.get('SESSION_SECRET');
  if (!segredo) return paraEntrada('config');

  const token = lerCookieSessao(request);
  if (!token) return paraEntrada();

  const payload = await verificarToken(token, segredo);
  if (!payload) return paraEntrada('expirada');

  return context.next();
};

export const config: Config = {
  path: ['/admin', '/admin/', '/admin.html'],
};

function paraEntrada(motivo?: string) {
  const destino = motivo ? `${PAGINA_ENTRADA}?motivo=${motivo}` : PAGINA_ENTRADA;
  return new Response(null, {
    status: 302,
    headers: {
      Location: destino,
      'Cache-Control': 'no-store, max-age=0',
      // Sem isto, uma resposta de redirecionamento pode ficar em cache
      // intermédia e aparecer a quem já tem sessão.
      Vary: 'Cookie',
    },
  });
}

function lerCookieSessao(request: Request): string | null {
  const cabecalho = request.headers.get('cookie');
  if (!cabecalho) return null;
  const cookies: Record<string, string> = {};
  for (const parte of cabecalho.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 1) continue;
    cookies[parte.slice(0, igual).trim()] = parte.slice(igual + 1).trim();
  }
  return cookies[COOKIE_SEGURO] || cookies[COOKIE_LOCAL] || null;
}

async function verificarToken(token: string, segredo: string) {
  const ponto = token.indexOf('.');
  if (ponto < 1) return null;
  const corpo = token.slice(0, ponto);
  const assinatura = token.slice(ponto + 1);

  let assinaturaBytes: Uint8Array;
  try {
    assinaturaBytes = deB64url(assinatura);
  } catch {
    return null;
  }

  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valida = await crypto.subtle.verify(
    'HMAC',
    chave,
    assinaturaBytes,
    new TextEncoder().encode(corpo)
  );
  if (!valida) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(deB64url(corpo)));
    if (!payload?.sid || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function deB64url(valor: string): Uint8Array {
  const b64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  const preenchido = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binario = atob(preenchido);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
