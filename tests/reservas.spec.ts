import { test, expect } from '@playwright/test';
import { clearStorage } from './helpers';

// As reservas online ainda não estão activas: a página anuncia "brevemente" e
// encaminha o cliente para o telefone. Quando o formulário voltar, voltam
// também os testes de submissão (hora, pessoas, email e WhatsApp).

test.beforeEach(async ({ page }) => {
  await page.goto('/reservas');
  await clearStorage(page);
  await page.goto('/reservas');
});

test('reservas: página carrega com o hero de reservas', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Reserve a Sua Mesa/i })).toBeVisible();
});

test('reservas: anuncia que as reservas online estão para breve', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Brevemente Disponível/i })).toBeVisible();
  await expect(page.getByText(/As reservas online estarão disponíveis brevemente/i)).toBeVisible();
});

test('reservas: número de contacto visível e a ligar para o restaurante', async ({ page }) => {
  const cta = page.getByRole('link', { name: /913 977 751/ });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', 'tel:+351913977751');
});

test('reservas: formulário de reserva não está disponível', async ({ page }) => {
  await expect(page.locator('[name="nome"]')).toHaveCount(0);
  await expect(page.locator('#res-hora-btn')).toHaveCount(0);
  await expect(page.locator('#res-pessoas-btn')).toHaveCount(0);
  await expect(page.locator('#res-submit-email')).toHaveCount(0);
  await expect(page.locator('#res-submit-whatsapp')).toHaveCount(0);
});
