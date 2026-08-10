import { test, expect, request } from '@playwright/test';
import { SESSAO_ADMIN } from '../playwright.config';
import { BASE_URL, PASSWORD_TEMPORARIA, PASSWORD_TESTES, UTILIZADOR_TESTES } from './helpers';

// ══════════════════════════════════════════════════════════════════════════
// SEM SESSÃO — o que uma pessoa de fora consegue alcançar
// ══════════════════════════════════════════════════════════════════════════

test.describe('sem sessão', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('o backoffice não abre e reencaminha para a entrada', async ({ page }) => {
    await page.goto('/admin.html');
    expect(page.url()).toContain('/admin-login.html');
    await expect(page.locator('#form-entrada')).toBeVisible();
    // A casca do painel não pode ter sido servida.
    await expect(page.locator('#panel-dashboard')).toHaveCount(0);
  });

  test('um cookie de sessão forjado não abre o backoffice', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'zdf_sessao',
        value: 'eyJzaWQiOiJmYWxzbyIsImV4cCI6NDEwMjQ0NDgwMDAwMH0.assinatura-invalida',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.goto('/admin.html');
    expect(page.url()).toContain('/admin-login.html');
  });

  test('os dados públicos do site continuam a ser legíveis', async ({ page }) => {
    const res = await page.request.get('/.netlify/functions/data?key=siteGeral');
    expect(res.status()).toBe(200);
  });

  test('as reservas (dados pessoais de clientes) não são legíveis', async ({ page }) => {
    const res = await page.request.get('/.netlify/functions/data?key=reservas');
    expect(res.status()).toBe(401);
  });

  test('uma chave desconhecida não revela nada', async ({ page }) => {
    const res = await page.request.get('/.netlify/functions/data?key=segredo-qualquer');
    expect(res.status()).toBe(404);
  });

  test('não é possível escrever no site', async ({ page }) => {
    const res = await page.request.post('/.netlify/functions/data', {
      headers: { origin: BASE_URL },
      data: { key: 'siteGeral', value: JSON.stringify({ nome: 'Invadido' }) },
    });
    expect(res.status()).toBe(401);
  });

  test('nem os endpoints de conta respondem', async ({ page }) => {
    for (const caminho of ['me', 'sessions']) {
      const res = await page.request.get(`/api/auth/${caminho}`);
      expect(res.status(), `/api/auth/${caminho}`).toBe(401);
    }
  });

  test('palavra-passe errada devolve erro genérico, sem dizer o que falhou', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      headers: { origin: BASE_URL },
      data: { username: UTILIZADOR_TESTES, password: 'isto-nao-e-a-password' },
    });
    expect(res.status()).toBe(401);
    const corpo = await res.json();
    expect(corpo.error).toBe('Credenciais inválidas.');
    // Nada na resposta pode confirmar que o utilizador existe.
    expect(JSON.stringify(corpo)).not.toContain(UTILIZADOR_TESTES);
  });

  test('tentativas repetidas acabam bloqueadas', async ({ page }) => {
    // Utilizador inexistente de propósito: o bloqueio fica num balde à parte e
    // não tranca a conta real, que os restantes testes precisam de usar.
    let bloqueou = false;
    for (let i = 0; i < 8 && !bloqueou; i += 1) {
      const res = await page.request.post('/api/auth/login', {
        headers: { origin: BASE_URL },
        data: { username: 'naoexiste', password: `tentativa-${i}` },
      });
      if (res.status() === 429) {
        bloqueou = true;
        const corpo = await res.json();
        expect(corpo.retryAfter).toBeGreaterThan(0);
        expect(res.headers()['retry-after']).toBeTruthy();
      } else {
        expect(res.status()).toBe(401);
      }
    }
    expect(bloqueou, 'esperava um bloqueio 429 ao fim de algumas tentativas').toBeTruthy();
  });

  test('a entrada exige Origin do próprio site', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      headers: { origin: 'https://sitio-malicioso.example' },
      data: { username: UTILIZADOR_TESTES, password: PASSWORD_TESTES },
    });
    expect(res.status()).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// COM SESSÃO — usa o storageState gravado em auth.setup.ts
// ══════════════════════════════════════════════════════════════════════════

test('com sessão, o backoffice abre e mostra o utilizador', async ({ page }) => {
  await page.goto('/admin.html');
  expect(page.url()).toContain('/admin.html');
  await expect(page.locator('#panel-dashboard')).toBeVisible();
  await expect(page.locator('#sessao-nome')).not.toHaveText('…');
});

test('escrever a partir de outro site é recusado mesmo com sessão válida', async ({ page }) => {
  const res = await page.request.post('/.netlify/functions/data', {
    headers: { origin: 'https://sitio-malicioso.example' },
    data: { key: 'siteGeral', value: JSON.stringify({ nome: 'Invadido' }) },
  });
  expect(res.status()).toBe(403);
});

test('só é possível escrever nas chaves conhecidas', async ({ page }) => {
  const res = await page.request.post('/.netlify/functions/data', {
    headers: { origin: BASE_URL },
    data: { key: 'chave-inventada', value: '"x"' },
  });
  expect(res.status()).toBe(400);
});

test('o painel de conta mostra a sessão atual', async ({ page }) => {
  await page.goto('/admin.html');
  await page.locator('#nav-conta').click();
  await expect(page.locator('#topbar-title')).toHaveText('Definições da Conta');

  await page.locator('.conta-tab[data-conta-tab="seguranca"]').click();
  await expect(page.locator('#sessoes-lista')).toContainText('Esta sessão');
});

test('terminar sessão limpa o cookie e volta a fechar o backoffice', async ({ browser }) => {
  // Contexto próprio: não pode tocar na sessão partilhada pelos outros testes.
  const contexto = await browser.newContext();
  const api = contexto.request;

  const entrada = await api.post('/api/auth/login', {
    headers: { origin: BASE_URL },
    data: { username: UTILIZADOR_TESTES, password: PASSWORD_TESTES },
  });
  expect(entrada.ok()).toBeTruthy();

  const pagina = await contexto.newPage();
  await pagina.goto('/admin.html');
  expect(pagina.url()).toContain('/admin.html');

  await pagina.locator('#btn-terminar-sessao').click();
  await pagina.waitForURL(/admin-login/);

  await pagina.goto('/admin.html');
  expect(pagina.url()).toContain('/admin-login.html');

  await contexto.close();
});

// Deixa a conta em PASSWORD_TESTES venha ela do estado em que vier, e reescreve a
// sessão partilhada do storageState — mudar a palavra-passe revoga-a, e sem isto
// os testes dos outros ficheiros entravam sem cookie.
//
// Tenta primeiro a palavra-passe de testes: no caminho feliz acerta à primeira e
// não gasta tentativas falhadas, que ao fim de 5 em 15 minutos trancam a conta
// (ver netlify/functions/_shared/ratelimit.mjs).
async function reporPasswordDeTestes() {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const entrar = (password: string) =>
    ctx.post('/api/auth/login', {
      headers: { origin: BASE_URL },
      data: { username: UTILIZADOR_TESTES, password },
    });

  let atual: string | null = null;
  for (const candidata of [PASSWORD_TESTES, PASSWORD_TEMPORARIA]) {
    if ((await entrar(candidata)).ok()) {
      atual = candidata;
      break;
    }
  }

  if (atual === null) {
    await ctx.dispose();
    throw new Error(
      'Não consegui repor a palavra-passe de testes: a conta local não está nem ' +
        'na de testes nem na temporária. Reponha-a com "node tests/repor-admin-local.mjs".'
    );
  }

  if (atual === PASSWORD_TEMPORARIA) {
    const reposicao = await ctx.post('/api/auth/password', {
      headers: { origin: BASE_URL },
      data: { atual: PASSWORD_TEMPORARIA, nova: PASSWORD_TESTES },
    });
    if (!reposicao.ok()) {
      await ctx.dispose();
      throw new Error(`Falha ao repor a palavra-passe de testes: ${await reposicao.text()}`);
    }
  }

  await ctx.storageState({ path: SESSAO_ADMIN });
  await ctx.dispose();
}

test('mudar a palavra-passe termina as sessões abertas noutros dispositivos', async ({ browser }) => {
  const primeiro = await request.newContext({ baseURL: BASE_URL });
  const segundo = await request.newContext({ baseURL: BASE_URL });

  try {
    for (const ctx of [primeiro, segundo]) {
      const res = await ctx.post('/api/auth/login', {
        headers: { origin: BASE_URL },
        data: { username: UTILIZADOR_TESTES, password: PASSWORD_TESTES },
      });
      expect(res.ok()).toBeTruthy();
    }
    expect((await segundo.get('/api/auth/me')).status()).toBe(200);

    const mudanca = await primeiro.post('/api/auth/password', {
      headers: { origin: BASE_URL },
      data: { atual: PASSWORD_TESTES, nova: PASSWORD_TEMPORARIA },
    });
    expect(mudanca.ok(), await mudanca.text()).toBeTruthy();

    // A outra sessão morreu; a que fez a mudança recebeu um cookie novo.
    expect((await segundo.get('/api/auth/me')).status()).toBe(401);
    expect((await primeiro.get('/api/auth/me')).status()).toBe(200);
  } finally {
    // Tem mesmo de ser num finally: se uma asserção acima falhar, a conta fica na
    // palavra-passe temporária e todas as execuções seguintes morriam no setup,
    // até alguém correr o tests/repor-admin-local.mjs à mão.
    await primeiro.dispose();
    await segundo.dispose();
    await reporPasswordDeTestes();
  }
});

test('a política de palavras-passe é imposta no servidor', async ({ page }) => {
  const fracas = ['curta', 'zedosfrangos2026', 'aaaaaaaaaaaaaaa'];
  for (const fraca of fracas) {
    const res = await page.request.post('/api/auth/password', {
      headers: { origin: BASE_URL },
      data: { atual: PASSWORD_TESTES, nova: fraca },
    });
    expect(res.status(), `aceitou "${fraca}"`).toBe(400);
  }
});
