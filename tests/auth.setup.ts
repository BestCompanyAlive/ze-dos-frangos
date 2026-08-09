import { test as setup, expect, request } from '@playwright/test';
import { SESSAO_ADMIN } from '../playwright.config';
import {
  BASE_URL,
  PASSWORDS_LOCAIS_CONHECIDAS,
  PASSWORD_TESTES,
  UTILIZADOR_TESTES,
} from './helpers';

// Prepara a conta de administrador e guarda o cookie de sessão para os restantes
// testes.
//
// É idempotente e tolerante ao estado: o armazenamento local do Netlify Blobs
// (.netlify/) sobrevive entre execuções, e a conta pode estar como os testes a
// deixaram, como o tests/repor-admin-local.mjs a deixou, ou acabada de criar a
// partir da palavra-passe de arranque. Tentamos as três e normalizamos.
setup('preparar sessão de administrador', async ({}) => {
  const api = await request.newContext({ baseURL: BASE_URL });

  const entrar = (password: string) =>
    api.post('/api/auth/login', {
      headers: { origin: BASE_URL },
      data: { username: UTILIZADOR_TESTES, password },
    });

  let usada: string | null = null;
  const falhas: string[] = [];
  for (const candidata of PASSWORDS_LOCAIS_CONHECIDAS) {
    const res = await entrar(candidata);
    if (res.ok()) {
      usada = candidata;
      break;
    }
    falhas.push(`${res.status()} ${(await res.text()).slice(0, 120)}`);
  }

  expect(
    usada,
    'Não foi possível entrar com nenhuma das palavras-passe locais conhecidas.\n' +
      `Respostas: ${falhas.join(' | ')}\n` +
      'Verifique que o servidor corre com "sh tests/start-dev.sh" (netlify dev, porta 4323) ' +
      'e não com "npm run dev" — o Astro sozinho não tem funções e /api/auth/login dá 404.\n' +
      'Para começar do zero: rm -rf .netlify/blobs-serve'
  ).not.toBeNull();

  // Normaliza para a palavra-passe dos testes. Também tira a conta do estado
  // "tem de mudar a palavra-passe" quando ela acabou de ser criada, que de outra
  // forma bloquearia todas as gravações da suite.
  if (usada !== PASSWORD_TESTES) {
    const mudanca = await api.post('/api/auth/password', {
      headers: { origin: BASE_URL },
      data: { atual: usada, nova: PASSWORD_TESTES },
    });
    expect(mudanca.ok(), `Falha ao definir a palavra-passe de testes: ${await mudanca.text()}`).toBeTruthy();
  }

  const me = await api.get('/api/auth/me');
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).user.mustChangePassword).toBe(false);

  await api.storageState({ path: SESSAO_ADMIN });
  await api.dispose();
});
