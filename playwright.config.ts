import { defineConfig, devices } from '@playwright/test';

// Sessão de administrador partilhada por todos os testes do painel, gravada
// pelo projeto "setup" (ver tests/auth.setup.ts).
export const SESSAO_ADMIN = 'tests/.auth/admin.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4323',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Entra no backoffice uma única vez e guarda o cookie de sessão.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: SESSAO_ADMIN },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // "netlify dev" por cima do Astro — dá acesso às funções reais (Netlify
    // Blobs local, autenticação, guarda de borda) tal como em produção.
    // Ver tests/start-dev.sh.
    command: 'sh tests/start-dev.sh',
    url: 'http://localhost:4323',
    reuseExistingServer: true,
    // O primeiro arranque tem de compilar o ambiente das edge functions (Deno),
    // o que demora bem mais do que o Astro sozinho.
    timeout: 180000,
    // As credenciais de desenvolvimento vivem no .env criado por
    // tests/start-dev.sh — o "netlify dev" ignora variáveis do processo e as
    // edge functions só veem as do .env.
  },
});
