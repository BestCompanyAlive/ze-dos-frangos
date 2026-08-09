import { test as setup, expect, request } from '@playwright/test';
import { SESSAO_ADMIN } from '../playwright.config';
import { BASE_URL, PASSWORD_ARRANQUE, PASSWORD_TESTES, UTILIZADOR_TESTES } from './helpers';

// Prepara a conta de administrador e guarda o cookie de sessão para os restantes
// testes. É idempotente: o armazenamento local do Netlify Blobs (.netlify/) sobrevive
// entre execuções, por isso na primeira corrida faz o percurso completo — entrar com a
// palavra-passe de arranque e trocá-la — e nas seguintes entra logo com a definitiva.
setup('preparar sessão de administrador', async ({}) => {
  const api = await request.newContext({ baseURL: BASE_URL });

  const entrar = (password: string) =>
    api.post('/api/auth/login', {
      headers: { origin: BASE_URL },
      data: { username: UTILIZADOR_TESTES, password },
    });

  let res = await entrar(PASSWORD_TESTES);

  if (!res.ok()) {
    // Conta acabada de criar: entra com a palavra-passe de arranque e define a
    // definitiva. Uma entrada com sucesso limpa também os contadores de
    // tentativas falhadas acumulados na execução anterior.
    res = await entrar(PASSWORD_ARRANQUE);
    expect(
      res.ok(),
      `Não foi possível entrar com nenhuma das palavras-passe conhecidas (${res.status()}: ${await res.text()}). ` +
        'Verifique SESSION_SECRET e ADMIN_BOOTSTRAP_PASSWORD em tests/start-dev.sh.'
    ).toBeTruthy();

    const mudanca = await api.post('/api/auth/password', {
      headers: { origin: BASE_URL },
      data: { atual: PASSWORD_ARRANQUE, nova: PASSWORD_TESTES },
    });
    expect(mudanca.ok(), `Falha ao definir a palavra-passe de testes: ${await mudanca.text()}`).toBeTruthy();
  }

  const me = await api.get('/api/auth/me');
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).user.mustChangePassword).toBe(false);

  await api.storageState({ path: SESSAO_ADMIN });
  await api.dispose();
});
