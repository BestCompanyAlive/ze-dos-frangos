// Autenticação do backoffice: entrada, saída, perfil, palavra-passe, sessões e
// registo de acessos. Exposto em /api/auth/*.
import { json, checkOrigin, getClientIp, readBody, atLeast } from './_shared/http.mjs';
import { requireSession, requireWriteAccess } from './_shared/guard.mjs';
import {
  createSession,
  clearCookie,
  revokeSession,
  revokeAllSessions,
  listSessions,
} from './_shared/session.mjs';
import {
  ensureUser,
  saveUser,
  checkPassword,
  validatePassword,
  setPassword,
  publicUser,
} from './_shared/user.mjs';
import { checkLimit, recordFailure, clearFailures } from './_shared/ratelimit.mjs';
import { audit, readAudit, EVENTOS } from './_shared/audit.mjs';

export const config = {
  path: ['/api/auth/:accao', '/api/auth/:accao/:sub'],
};

// Piso de tempo nas falhas de autenticação: sem isto, a diferença entre "conta
// bloqueada" (resposta imediata) e "password errada" (~100 ms de scrypt) seria
// mensurável do lado de fora.
const PISO_FALHA_MS = 400;

export default async (req) => {
  // O "netlify dev" acrescenta "/index.htm" ao caminho em alguns pedidos (o
  // resolvedor de ficheiros estáticos mete-se ao barulho antes de a função ser
  // chamada), por isso a rota é normalizada em vez de comparada em cru.
  const accao = new URL(req.url).pathname
    .replace(/^\/api\/auth\/?/, '')
    .replace(/\/index\.html?$/, '')
    .replace(/\/+$/, '');

  try {
    switch (`${req.method} ${accao}`) {
      case 'POST login': return await login(req);
      case 'POST logout': return await logout(req);
      case 'GET me': return await me(req);
      case 'POST password': return await mudarPassword(req);
      case 'POST profile': return await guardarPerfil(req);
      case 'GET sessions': return await sessoes(req);
      case 'POST sessions/revoke-others': return await terminarOutras(req);
      case 'GET audit': return await registoAcessos(req);
      default: return json({ error: 'não encontrado' }, 404);
    }
  } catch (erro) {
    // SESSION_SECRET em falta cai aqui. Mensagem clara para quem faz o deploy,
    // sem detalhes para quem estiver a sondar de fora.
    console.error('[auth]', erro);
    const configEmFalta = /SESSION_SECRET/.test(String(erro && erro.message));
    return json(
      { error: configEmFalta ? 'Autenticação por configurar no servidor.' : 'erro interno' },
      configEmFalta ? 503 : 500
    );
  }
};

async function login(req) {
  const inicio = Date.now();

  const origem = checkOrigin(req);
  if (origem) return origem;

  const ip = getClientIp(req);
  const limiteIp = await checkLimit('ip', ip);
  if (limiteIp.bloqueado) {
    await audit(EVENTOS.LOGIN_BLOQUEADO, { ip, userAgent: req.headers.get('user-agent') });
    return respostaBloqueio(limiteIp.segundos);
  }

  const { data, invalid } = await readBody(req, 8 * 1024);
  if (invalid) return json({ error: 'pedido inválido' }, 400);

  const username = String(data?.username || '').trim().toLowerCase();
  const password = String(data?.password || '');

  const { user, sessoesInvalidas } = await ensureUser();
  if (!user) {
    return json(
      { error: 'Conta de administrador por criar. Defina ADMIN_BOOTSTRAP_PASSWORD no Netlify.' },
      503
    );
  }
  // Uma reposição manual acabou de ser aplicada: nada do que existia antes vale.
  if (sessoesInvalidas) {
    await revokeAllSessions();
    await audit(EVENTOS.PASSWORD_REPOSTA, { ip, userAgent: req.headers.get('user-agent') });
  }

  // Tentativas contra a conta real bloqueiam a conta real. Tentativas com um
  // utilizador inexistente contam num balde à parte: nunca chegam a testar a
  // palavra-passe verdadeira, e sem esta separação bastava enviar utilizadores
  // ao acaso para deixar o administrador de fora do seu próprio painel. O
  // limite por IP continua a contar todas.
  const balde = username === user.username ? user.username : `desconhecido:${username || '-'}`;

  const limiteConta = await checkLimit('conta', balde);
  if (limiteConta.bloqueado) {
    await audit(EVENTOS.LOGIN_BLOQUEADO, { ip, userAgent: req.headers.get('user-agent') });
    await atLeast(inicio, PISO_FALHA_MS);
    return respostaBloqueio(limiteConta.segundos);
  }

  // A password é sempre verificada, mesmo com o utilizador errado, para o tempo
  // de resposta não revelar qual dos dois campos falhou.
  const passwordCerta = await checkPassword(user, password);
  if (username !== user.username || !passwordCerta) {
    await Promise.all([recordFailure('ip', ip), recordFailure('conta', balde)]);
    await audit(EVENTOS.LOGIN_FALHA, { ip, userAgent: req.headers.get('user-agent') });
    await atLeast(inicio, PISO_FALHA_MS);
    return json({ error: 'Credenciais inválidas.' }, 401);
  }

  await Promise.all([clearFailures('ip', ip), clearFailures('conta', user.username)]);

  const { cookie } = await createSession(req, user);
  await saveUser({ ...user, lastLoginAt: Date.now(), lastLoginIp: ip });
  await audit(EVENTOS.LOGIN_OK, { ip, userAgent: req.headers.get('user-agent') });

  return json({ ok: true, user: publicUser(user) }, 200, { 'Set-Cookie': cookie });
}

async function logout(req) {
  const origem = checkOrigin(req);
  if (origem) return origem;

  const auth = await requireSession(req);
  if (!(auth instanceof Response)) {
    await revokeSession(auth.session.sid);
    await audit(EVENTOS.LOGOUT, { ip: getClientIp(req), userAgent: req.headers.get('user-agent') });
  }
  // Mesmo sem sessão válida, limpar o cookie é o comportamento certo.
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(req) });
}

async function me(req) {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  return json({ user: publicUser(auth.user) });
}

async function mudarPassword(req) {
  const auth = await requireWriteAccess(req, { permitirPasswordPendente: true });
  if (auth instanceof Response) return auth;
  const { user, session } = auth;

  const { data, invalid } = await readBody(req, 8 * 1024);
  if (invalid) return json({ error: 'pedido inválido' }, 400);

  const atual = String(data?.atual || '');
  const nova = String(data?.nova || '');
  const ip = getClientIp(req);

  const limite = await checkLimit('conta', user.username);
  if (limite.bloqueado) return respostaBloqueio(limite.segundos);

  if (!(await checkPassword(user, atual))) {
    await recordFailure('conta', user.username);
    await audit(EVENTOS.LOGIN_FALHA, { ip, userAgent: req.headers.get('user-agent') });
    return json({ error: 'A palavra-passe atual está errada.' }, 401);
  }

  const problema = validatePassword(nova, user);
  if (problema) return json({ error: problema }, 400);
  if (await checkPassword(user, nova)) {
    return json({ error: 'A nova palavra-passe tem de ser diferente da atual.' }, 400);
  }

  const actualizado = await setPassword(user, nova);
  await clearFailures('conta', user.username);
  // Termina tudo, incluindo esta sessão, e emite uma nova: se a password foi
  // mudada por ter sido comprometida, nenhuma sessão antiga pode sobreviver.
  await revokeAllSessions();
  const { cookie } = await createSession(req, actualizado);
  await audit(EVENTOS.PASSWORD_ALTERADA, { ip, userAgent: req.headers.get('user-agent') });

  return json(
    { ok: true, user: publicUser(actualizado), sessoesTerminadas: true },
    200,
    { 'Set-Cookie': cookie }
  );
}

async function guardarPerfil(req) {
  const auth = await requireWriteAccess(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { data, invalid } = await readBody(req, 8 * 1024);
  if (invalid) return json({ error: 'pedido inválido' }, 400);

  const displayName = String(data?.displayName ?? user.displayName ?? '').trim().slice(0, 80);
  const email = String(data?.email ?? user.email ?? '').trim().slice(0, 160);

  if (!displayName) return json({ error: 'O nome não pode ficar vazio.' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: 'O email não parece válido.' }, 400);
  }

  const actualizado = await saveUser({ ...user, displayName, email });
  await audit(EVENTOS.PERFIL_ALTERADO, {
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });
  return json({ ok: true, user: publicUser(actualizado) });
}

async function sessoes(req) {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  return json({ sessoes: await listSessions(auth.session.sid) });
}

async function terminarOutras(req) {
  const auth = await requireWriteAccess(req);
  if (auth instanceof Response) return auth;
  const terminadas = await revokeAllSessions(auth.session.sid);
  await audit(EVENTOS.SESSOES_TERMINADAS, {
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  });
  return json({ ok: true, terminadas });
}

async function registoAcessos(req) {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  return json({ eventos: await readAudit(50) });
}

function respostaBloqueio(segundos) {
  return json(
    { error: 'Demasiadas tentativas. Tente de novo mais tarde.', retryAfter: segundos },
    429,
    { 'Retry-After': String(segundos) }
  );
}
