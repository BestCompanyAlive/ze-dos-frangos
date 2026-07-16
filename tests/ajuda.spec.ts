import { test, expect } from '@playwright/test';
import { clearStorage, setupVaga } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/ajuda');
  await clearStorage(page);
});

test('ajuda: Recrutamento aparece antes de Perdidos e Achados', async ({ page }) => {
  await page.goto('/ajuda');
  const recrutamento = page.getByText('Trabalhe Connosco');
  const perdidos = page.getByText('Perdidos e Achados');
  const recY = await recrutamento.boundingBox().then(b => b?.y ?? 0);
  const perdY = await perdidos.boundingBox().then(b => b?.y ?? 0);
  expect(recY).toBeLessThan(perdY);
});

test('ajuda: formulário de recrutamento tem campos obrigatórios visíveis', async ({ page }) => {
  await page.goto('/ajuda');
  const inputs = page.locator('input[type="text"], input[type="email"], textarea').first();
  await expect(inputs).toBeVisible();
});

test('ajuda: secção Perdidos e Achados é visível', async ({ page }) => {
  await page.goto('/ajuda');
  await expect(page.getByText('Perdidos e Achados')).toBeVisible();
});

test('ajuda: vagas aparecem quando configuradas no backoffice', async ({ page }) => {
  await page.goto('/ajuda');
  await setupVaga(page);
  await page.goto('/ajuda');
  // The card renders: titulo, local, procura items, oferece items
  await expect(page.getByText('Empregado de Mesa')).toBeVisible();
  await expect(page.getByText(/Vila Real/i).first()).toBeVisible();
  await expect(page.getByText(/experiência mínima/i)).toBeVisible();
});

test('ajuda: sem vagas não aparece listagem', async ({ page }) => {
  await page.goto('/ajuda');
  await clearStorage(page);
  await page.goto('/ajuda');
  await expect(page.getByText('Empregado de Mesa')).toBeHidden();
});
