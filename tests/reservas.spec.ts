import { test, expect } from '@playwright/test';
import { clearStorage } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/reservas');
  await clearStorage(page);
  await page.goto('/reservas');
});

test('reservas: página carrega com formulário visível', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Reserve/i })).toBeVisible();
  await expect(page.locator('[name="nome"]')).toBeVisible();
  await expect(page.locator('[name="email"]')).toBeVisible();
  await expect(page.locator('[name="telefone"]')).toBeVisible();
});

test('reservas: número de contacto visível', async ({ page }) => {
  await expect(page.getByText('913 977 751')).toBeVisible();
});

test('reservas: campos obrigatórios impedem submissão vazia', async ({ page }) => {
  await page.locator('#res-submit-email').click();
  await expect(page).toHaveURL('/reservas');
  await expect(page.locator('[name="nome"]')).toBeVisible();
});

test('reservas: sem data seleccionada mostra hint no dropdown de hora', async ({ page }) => {
  // Hint lives inside #res-hora-list which is closed; open dropdown first
  await page.locator('#res-hora-btn').click();
  await expect(page.locator('#res-hora-hint')).toBeVisible();
});

test('reservas: após seleccionar data o hint desaparece e horas ficam disponíveis', async ({ page }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  await page.locator('[name="data"]').fill(dateStr);
  await page.locator('[name="data"]').dispatchEvent('change');

  // Open the dropdown to inspect its contents
  await page.locator('#res-hora-btn').click();
  await expect(page.locator('#res-hora-hint')).toBeHidden();
  // Hora slots are plain divs (no data-val), first visible one should exist
  await expect(page.locator('#res-hora-list div').first()).toBeVisible();
});

test('reservas: botão WhatsApp abre wa.me com dados preenchidos', async ({ page }) => {
  await page.locator('[name="nome"]').fill('João Silva');
  await page.locator('[name="email"]').fill('joao@teste.pt');
  await page.locator('[name="telefone"]').fill('912345678');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await page.locator('[name="data"]').fill(tomorrow.toISOString().split('T')[0]);
  await page.locator('[name="data"]').dispatchEvent('change');

  // Open hora dropdown and pick the first available slot
  await page.locator('#res-hora-btn').click();
  await page.locator('#res-hora-list div').first().click();

  // Open pessoas dropdown and pick the first option
  await page.locator('#res-pessoas-btn').click();
  await page.locator('#res-pessoas-list .res-cso').first().click();

  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.locator('#res-submit-whatsapp').click(),
  ]);
  await expect(newPage.url()).toMatch(/wa\.me|api\.whatsapp\.com/i);
  await newPage.close();
});
