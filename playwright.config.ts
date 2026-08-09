import { defineConfig, devices } from '@playwright/test';

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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // "netlify dev" por cima do Astro — dá acesso à função real (Netlify Blobs
    // local) para os dados do backoffice, tal como em produção. Ver tests/start-dev.sh.
    command: 'sh tests/start-dev.sh',
    url: 'http://localhost:4323',
    reuseExistingServer: true,
    timeout: 60000,
    env: { ADMIN_PASSWORD: 'teste1234' },
  },
});
