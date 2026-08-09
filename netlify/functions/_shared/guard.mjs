// Porteiro das funções: converte um pedido numa sessão válida, ou numa resposta
// de erro. Tudo o que precisa de autenticação passa por aqui.
import { json, checkOrigin } from './http.mjs';
import { loadSession } from './session.mjs';
import { loadUser } from './user.mjs';

/**
 * Devolve { user, session } quando o pedido está autenticado, ou uma Response
 * quando não está. Quem chama faz:
 *
 *   const auth = await requireSession(req);
 *   if (auth instanceof Response) return auth;
 */
export async function requireSession(req) {
  const session = await loadSession(req);
  if (!session) return json({ error: 'sessão inválida ou expirada' }, 401);

  const user = await loadUser();
  if (!user || user.username !== session.registo.username) {
    return json({ error: 'sessão inválida ou expirada' }, 401);
  }

  return { user, session };
}

/**
 * Sessão válida + origem do próprio site. Para tudo o que altera estado.
 *
 * Com uma mudança de palavra-passe pendente (primeiro acesso ou reposição
 * manual), a conta só pode mudar a palavra-passe — não pode publicar nada. Sem
 * isto, uma password de arranque partilhada por email dava acesso de escrita
 * completo enquanto não fosse trocada.
 */
export async function requireWriteAccess(req, { permitirPasswordPendente = false } = {}) {
  const origem = checkOrigin(req);
  if (origem) return origem;

  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;

  if (auth.user.mustChangePassword && !permitirPasswordPendente) {
    return json({ error: 'É necessário definir uma nova palavra-passe antes de continuar.', mustChangePassword: true }, 403);
  }

  return auth;
}
