// Sessões do backoffice.
//
// O cookie leva { sid, exp } assinado com HMAC-SHA256: dá para validar sem
// tocar no armazenamento, que é o que permite ao guarda de borda proteger o
// /admin.html sem latência. O registo correspondente nos Blobs é o que permite
// revogar — terminar sessão, terminar as outras, ou invalidar tudo ao mudar a
// palavra-passe.
import { signPayload, verifyPayload, randomToken } from './crypto.mjs';
import { getJSON, setJSON, del, listKeys } from './store.mjs';
import { parseCookies, isSecureRequest, getClientIp } from './http.mjs';

// Em produção usamos o prefixo __Host-, que faz o próprio browser impor Secure,
// Path=/ e ausência de Domain — um subdomínio comprometido deixa de conseguir
// escrever o cookie de sessão. Em http://localhost (netlify dev) o prefixo não
// é aceite, por isso aí fica o nome simples.
export const COOKIE_SEGURO = '__Host-zdf_sessao';
export const COOKIE_LOCAL = 'zdf_sessao';

const DURACAO_ABSOLUTA_MS = 12 * 60 * 60 * 1000;
const INATIVIDADE_MS = 30 * 60 * 1000;
const INTERVALO_RENOVACAO_MS = 5 * 60 * 1000;

const chaveSessao = (sid) => `session:${sid}`;

function nomeCookie(req) {
  return isSecureRequest(req) ? COOKIE_SEGURO : COOKIE_LOCAL;
}

function serializarCookie(nome, valor, { maxAge, secure }) {
  const partes = [
    `${nome}=${valor}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (secure) partes.push('Secure');
  return partes.join('; ');
}

/** Cria a sessão e devolve { sid, cookie } pronto para o cabeçalho Set-Cookie. */
export async function createSession(req, user) {
  const sid = randomToken(32);
  const agora = Date.now();
  const expiraEm = agora + DURACAO_ABSOLUTA_MS;

  await setJSON(chaveSessao(sid), {
    username: user.username,
    criadaEm: agora,
    ultimaAtividade: agora,
    expiraEm,
    ip: getClientIp(req),
    userAgent: String(req.headers.get('user-agent') || '').slice(0, 200),
  });

  const token = signPayload({ sid, exp: expiraEm });
  return {
    sid,
    cookie: serializarCookie(nomeCookie(req), token, {
      maxAge: Math.floor(DURACAO_ABSOLUTA_MS / 1000),
      secure: isSecureRequest(req),
    }),
  };
}

export function clearCookie(req) {
  return serializarCookie(nomeCookie(req), '', { maxAge: 0, secure: isSecureRequest(req) });
}

/** Lê e valida a assinatura do cookie. Não toca no armazenamento. */
export function readCookieToken(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_SEGURO] || cookies[COOKIE_LOCAL];
  if (!token) return null;
  const payload = verifyPayload(token);
  if (!payload || !payload.sid || !payload.exp) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}

/**
 * Valida a sessão de ponta a ponta: assinatura, expiração absoluta, registo por
 * revogar e inatividade. Devolve { sid, registo } ou null.
 */
export async function loadSession(req) {
  const payload = readCookieToken(req);
  if (!payload) return null;

  const registo = await getJSON(chaveSessao(payload.sid));
  if (!registo) return null;

  const agora = Date.now();
  if (agora > registo.expiraEm || agora - registo.ultimaAtividade > INATIVIDADE_MS) {
    await del(chaveSessao(payload.sid));
    return null;
  }

  // Renovação deslizante, mas só de 5 em 5 minutos — sem isto seria uma escrita
  // nos Blobs em cada pedido.
  if (agora - registo.ultimaAtividade > INTERVALO_RENOVACAO_MS) {
    registo.ultimaAtividade = agora;
    await setJSON(chaveSessao(payload.sid), registo);
  }

  return { sid: payload.sid, registo };
}

export async function revokeSession(sid) {
  await del(chaveSessao(sid));
}

/** Termina todas as sessões, exceto opcionalmente uma. Devolve quantas terminou. */
export async function revokeAllSessions(exceptoSid = null) {
  const chaves = await listKeys('session:');
  let terminadas = 0;
  await Promise.all(
    chaves.map(async (chave) => {
      if (exceptoSid && chave === chaveSessao(exceptoSid)) return;
      await del(chave);
      terminadas += 1;
    })
  );
  return terminadas;
}

/** Sessões ativas, para o painel de segurança. */
export async function listSessions(sidAtual) {
  const chaves = await listKeys('session:');
  const agora = Date.now();
  const sessoes = await Promise.all(
    chaves.map(async (chave) => {
      const registo = await getJSON(chave);
      if (!registo) return null;
      if (agora > registo.expiraEm || agora - registo.ultimaAtividade > INATIVIDADE_MS) return null;
      return {
        atual: chave === chaveSessao(sidAtual),
        criadaEm: registo.criadaEm,
        ultimaAtividade: registo.ultimaAtividade,
        ip: registo.ip,
        userAgent: registo.userAgent,
      };
    })
  );
  return sessoes.filter(Boolean).sort((a, b) => b.ultimaAtividade - a.ultimaAtividade);
}
