// A conta de administrador. É uma só, guardada nos Blobs em "user".
//
// A password nunca é guardada — só a derivação scrypt. As variáveis de ambiente
// servem apenas para criar a conta da primeira vez e para a reposição manual;
// depois disso a verdade está no Blob.
import { hashPassword, verifyPassword, sha256 } from './crypto.mjs';
import { getJSON, setJSON } from './store.mjs';

const USER_KEY = 'user';
const MIN_LENGTH = 12;
const MAX_LENGTH = 200;

// Lista curta e deliberada: as passwords que alguém escolheria mesmo para este
// site. Não substitui uma lista de milhões — o comprimento mínimo faz esse
// trabalho — mas apanha as escolhas óbvias.
const PASSWORDS_PROIBIDAS = [
  'zedosfrangos', 'zedosfrangos2026', 'zedosfrangos2025', 'churrasqueira',
  'password', 'palavrapasse', 'passworD123', 'administrador', 'adminadmin',
  '123456789012', 'qwertyuiop12', '111111111111', 'abcdefghijkl',
];

export async function loadUser() {
  return getJSON(USER_KEY);
}

export async function saveUser(user) {
  await setJSON(USER_KEY, user);
  return user;
}

/**
 * Garante que a conta existe e aplica uma eventual reposição manual.
 *
 * Reposição: define-se ADMIN_PASSWORD_RESET no Netlify e faz-se redeploy. Como
 * comparamos o SHA-256 do valor com o que ficou registado, a reposição corre
 * uma única vez — redeploys seguintes com a mesma variável não repetem nada.
 * A variável deve ser removida a seguir.
 *
 * Devolve o utilizador, ou null se ainda não houver conta nem forma de a criar.
 */
export async function ensureUser() {
  let user = await loadUser();

  const reset = process.env.ADMIN_PASSWORD_RESET;
  if (reset) {
    const marca = sha256(reset);
    if (!user || user.resetApplied !== marca) {
      const base = user || novoUtilizador();
      user = await saveUser({
        ...base,
        passwordHash: await hashPassword(reset),
        mustChangePassword: true,
        passwordChangedAt: Date.now(),
        resetApplied: marca,
      });
      return { user, sessoesInvalidas: true };
    }
  }

  if (!user) {
    const bootstrap = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!bootstrap) return { user: null };
    user = await saveUser({
      ...novoUtilizador(),
      passwordHash: await hashPassword(bootstrap),
      mustChangePassword: true,
      passwordChangedAt: Date.now(),
    });
  }

  return { user };
}

function novoUtilizador() {
  return {
    username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
    displayName: 'Administrador',
    passwordHash: '',
    mustChangePassword: true,
    createdAt: Date.now(),
    passwordChangedAt: 0,
    lastLoginAt: 0,
    lastLoginIp: '',
    resetApplied: null,
    // Espaço reservado para autenticação em dois passos, a acrescentar depois
    // sem alterar o formato do registo.
    totp: null,
  };
}

export async function checkPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return verifyPassword(password, user.passwordHash);
}

/** Devolve uma mensagem de erro, ou null se a password for aceitável. */
export function validatePassword(password, user) {
  if (typeof password !== 'string') return 'Palavra-passe inválida.';
  const pwd = password.normalize('NFKC');
  if (pwd.length < MIN_LENGTH) return `A palavra-passe tem de ter pelo menos ${MIN_LENGTH} caracteres.`;
  if (pwd.length > MAX_LENGTH) return 'A palavra-passe é demasiado longa.';
  if (pwd.trim() !== pwd) return 'A palavra-passe não pode começar nem acabar com espaços.';

  const minusculas = pwd.toLowerCase();
  if (PASSWORDS_PROIBIDAS.some((p) => minusculas === p || minusculas.includes(p))) {
    return 'Essa palavra-passe é demasiado previsível. Escolha outra.';
  }
  for (const campo of [user?.username, user?.displayName]) {
    const valor = String(campo || '').trim().toLowerCase();
    if (valor.length >= 4 && minusculas.includes(valor)) {
      return 'A palavra-passe não pode conter o seu nome de utilizador nem o seu nome.';
    }
  }
  // Um único caractere repetido, ou uma sequência trivial.
  if (/^(.)\1+$/.test(pwd)) return 'A palavra-passe é demasiado previsível. Escolha outra.';
  if (new Set(pwd).size < 5) return 'A palavra-passe tem pouca variedade de caracteres.';

  return null;
}

export async function setPassword(user, novaPassword) {
  return saveUser({
    ...user,
    passwordHash: await hashPassword(novaPassword),
    mustChangePassword: false,
    passwordChangedAt: Date.now(),
    // Depois de uma mudança voluntária, a reposição por variável de ambiente
    // fica "consumida" e não volta a disparar.
    resetApplied: user.resetApplied || null,
  });
}

/** O que pode ser devolvido ao browser — nunca a hash. */
export function publicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || '',
    mustChangePassword: !!user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt || 0,
    lastLoginAt: user.lastLoginAt || 0,
    lastLoginIp: user.lastLoginIp || '',
    twoFactorEnabled: !!user.totp,
  };
}
