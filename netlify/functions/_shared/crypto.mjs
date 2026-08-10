// Primitivas criptográficas do backoffice. Só usa "node:crypto" — sem dependências.
//
// Pastas e ficheiros começados por "_" dentro de netlify/functions não são
// publicados como funções; são só código partilhado, incluído no bundle de quem
// os importa.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

// N=32768 leva ~100 ms num contentor de função — caro o suficiente para tornar
// a força bruta offline pouco atraente, rápido o suficiente para um login.
// O maxmem por omissão do Node (32 MB) não chega para N=32768, daí o valor explícito.
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEY_LEN = 64;
const SALT_LEN = 16;

export function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function fromB64url(str) {
  return Buffer.from(String(str), 'base64url');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('base64url');
}

/** Comparação de tempo constante que não rebenta com comprimentos diferentes. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  // Comprimentos diferentes já revelam a diferença, mas comparamos à mesma
  // contra um valor do mesmo tamanho para não devolver mais cedo.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Devolve "scrypt$N$r$p$<salt>$<hash>". */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(String(password).normalize('NFKC'), salt, KEY_LEN, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return ['scrypt', N, r, p, b64url(salt), b64url(derived)].join('$');
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const params = {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_PARAMS.maxmem,
  };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) return false;
  const expected = fromB64url(hashB64);
  let derived;
  try {
    derived = await scrypt(String(password).normalize('NFKC'), fromB64url(saltB64), expected.length, params);
  } catch {
    return false;
  }
  return safeEqual(b64url(derived), b64url(expected));
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET em falta ou demasiado curta (mínimo 32 caracteres).');
  }
  return secret;
}

/** Assina um objeto como "<payload>.<hmac>" (ambos em base64url). */
export function signPayload(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Verifica a assinatura e devolve o objeto, ou null se for inválido. */
export function verifyPayload(token) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected;
  try {
    expected = createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  } catch {
    return null;
  }
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
}
