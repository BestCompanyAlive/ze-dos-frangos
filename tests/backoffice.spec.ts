import { test, expect } from '@playwright/test';
import { clearStorage } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/admin.html');
  await clearStorage(page);
  await page.reload();
});

// ── NAVEGAÇÃO ─────────────────────────────────────────────────────────────

test('backoffice: navegação entre painéis actualiza título da topbar', async ({ page }) => {
  const paineis = [
    { nav: 'Prato do Dia',    titulo: 'Prato do Dia' },
    { nav: 'Sugestão do Mês', titulo: 'Sugestão do Mês' },
    { nav: 'Vinho do Mês',    titulo: 'Vinho do Mês' },
    { nav: 'Ementa',          titulo: 'Ementa' },
    { nav: 'Eventos',         titulo: 'Eventos & Campanhas' },
    { nav: 'Mais Vendidos',   titulo: 'Mais Vendidos' },
    { nav: 'Reservas',        titulo: 'Reservas' },
  ];

  for (const p of paineis) {
    await page.locator('.nav-item').filter({ hasText: p.nav }).click();
    await expect(page.locator('#topbar-title')).toHaveText(p.titulo);
  }
});

// ── SUGESTÃO DO MÊS ──────────────────────────────────────────────────────

test('backoffice → site: sugestão do mês guardada aparece no site', async ({ page, context }) => {
  await page.locator('.nav-item').filter({ hasText: 'Sugestão do Mês' }).click();

  await page.locator('#sugestao-admin-mes').fill('Julho');
  await page.locator('#sugestao-admin-nome').fill('Leitão à Bairrada');
  await page.locator('#sugestao-admin-preco').fill('16.00');
  await page.getByRole('button', { name: /guardar e publicar/i }).first().click();

  const sitePage = await context.newPage();
  await sitePage.goto('/');
  await expect(sitePage.getByText('Leitão à Bairrada')).toBeVisible();
  await expect(sitePage.getByText(/Sugestão de Julho/i)).toBeVisible();
  await sitePage.close();
});

// ── VINHO DO MÊS ─────────────────────────────────────────────────────────

test('backoffice → site: vinho do mês guardado aparece no site', async ({ page, context }) => {
  await page.locator('.nav-item').filter({ hasText: 'Vinho do Mês' }).click();

  await page.locator('#vinho-admin-mes').fill('Julho');
  await page.locator('#vinho-admin-nome').fill('Quinta do Crasto Reserva');
  await page.locator('#vinho-admin-preco').fill('22.00');
  await page.getByRole('button', { name: /guardar e publicar/i }).last().click();

  const sitePage = await context.newPage();
  await sitePage.goto('/');
  await expect(sitePage.getByText('Quinta do Crasto Reserva')).toBeVisible();
  await expect(sitePage.getByText(/Vinho de Julho/i)).toBeVisible();
  await sitePage.close();
});

// ── EMENTA ────────────────────────────────────────────────────────────────

test('backoffice → site: ementa guardada aparece no site', async ({ page, context }) => {
  await page.locator('.nav-item').filter({ hasText: 'Ementa' }).click();

  const firstInput = page.locator('.menu-item-row input').first();
  await firstInput.fill('Chouriço Especial');
  await page.getByRole('button', { name: /guardar ementa/i }).click();

  const sitePage = await context.newPage();
  await sitePage.goto('/');
  await expect(sitePage.getByText('Chouriço Especial')).toBeVisible();
  await sitePage.close();
});

// ── MENUS DE GRUPO ────────────────────────────────────────────────────────

test('backoffice → site: menu de grupo aparece na tab de grupos', async ({ page, context }) => {
  await page.locator('.nav-item').filter({ hasText: 'Ementa' }).click();
  await page.getByRole('button', { name: /Menus de Grupo/i }).click();
  await page.getByRole('button', { name: /Adicionar Menu/i }).click();

  await page.locator('.g-nome').fill('Menu Premium');
  await page.locator('.g-preco').fill('22');
  await page.locator('.g-desc').fill('Menu especial para ocasiões únicas.');
  // Grupos are saved by the main "Guardar Ementa" button (no separate grupos button)
  await page.getByRole('button', { name: /guardar ementa/i }).click();

  const sitePage = await context.newPage();
  await sitePage.goto('/');
  await sitePage.getByRole('button', { name: /grupo/i }).click();
  await expect(sitePage.getByText('Menu Premium')).toBeVisible();
  await sitePage.close();
});

// ── MAIS VENDIDOS ─────────────────────────────────────────────────────────

test('backoffice → site: mais vendidos aparecem no site após guardar', async ({ page, context }) => {
  await page.locator('.nav-item').filter({ hasText: 'Mais Vendidos' }).click();

  await page.getByRole('button', { name: /adicionar prato de carne/i }).click();
  await page.locator('.mv-nome').first().fill('Frango Piri-Piri');
  await page.locator('.mv-preco').first().fill('9.50');
  await page.getByRole('button', { name: /guardar mais vendidos/i }).click();

  const sitePage = await context.newPage();
  await sitePage.goto('/');
  await expect(sitePage.locator('#mais-vendidos-section')).toBeVisible();
  await expect(sitePage.getByText('Frango Piri-Piri')).toBeVisible();
  await sitePage.close();
});

// ── EVENTOS ──────────────────────────────────────────────────────────────

test('backoffice → site: evento publicado aparece no site com layout editorial', async ({ page, context }) => {
  await page.locator('.nav-item').filter({ hasText: 'Eventos' }).click();
  await page.getByRole('button', { name: /adicionar evento/i }).click();

  await page.locator('.ev-titulo').fill('Festa de Verão');
  await page.locator('.ev-data-inicio').fill('2026-08-15');
  await page.locator('.ev-desc').fill('Uma noite especial no verão.');
  await page.getByRole('button', { name: /guardar e publicar/i }).click();

  const sitePage = await context.newPage();
  await sitePage.goto('/');
  await expect(sitePage.locator('#eventos-section')).toBeVisible();
  // Title "Festa de Verão" is split: line1="Festa de", line2="Verão"
  await expect(sitePage.locator('.ev-title-line1')).toContainText('Festa de');
  await expect(sitePage.locator('.ev-title-line2')).toContainText('Verão');
  await sitePage.close();
});

// ── RESERVAS ─────────────────────────────────────────────────────────────

test('backoffice: reserva pendente aparece na gestão', async ({ page }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5);
  await page.evaluate((date) => {
    localStorage.setItem('reservas', JSON.stringify([{
      id: Date.now(),
      name: 'Maria Santos',
      email: 'maria@teste.pt',
      phone: '911222333',
      date,
      time: '12:30',
      guests: '2',
      status: 'pendente',
    }]));
  }, tomorrow.toISOString().split('T')[0]);

  // renderReservations() runs on page load — reload so it picks up injected data
  await page.reload();
  await page.locator('.nav-item').filter({ hasText: 'Reservas' }).click();
  await expect(page.getByText('Maria Santos')).toBeVisible();
});

test('backoffice: confirmar reserva muda estado para confirmada', async ({ page }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5);
  await page.evaluate((date) => {
    localStorage.setItem('reservas', JSON.stringify([{
      id: 9001,
      name: 'João Teste',
      email: 'joao@teste.pt',
      phone: '912000000',
      date,
      time: '12:30',
      guests: '2',
      status: 'pendente',
    }]));
  }, tomorrow.toISOString().split('T')[0]);

  await page.reload();
  await page.locator('.nav-item').filter({ hasText: 'Reservas' }).click();
  await expect(page.getByText('João Teste')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar' }).first().click();
  await expect(page.getByText(/confirmada/i).first()).toBeVisible();
});

test('backoffice: cancelar reserva confirmada pede confirmação no modal', async ({ page }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5);
  await page.evaluate((date) => {
    localStorage.setItem('reservas', JSON.stringify([{
      id: 9002,
      name: 'Ana Teste',
      email: 'ana@teste.pt',
      phone: '912000001',
      date,
      time: '13:00',
      guests: '3',
      status: 'confirmada',
    }]));
  }, tomorrow.toISOString().split('T')[0]);

  await page.reload();
  await page.locator('.nav-item').filter({ hasText: 'Reservas' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).first().click();

  await expect(page.locator('#cancel-modal-overlay')).toBeVisible();
  await expect(page.getByText(/Cancelar reserva/i)).toBeVisible();

  await page.getByRole('button', { name: /não, voltar/i }).click();
  await expect(page.locator('#cancel-modal-overlay')).toBeHidden();
  await expect(page.getByText(/confirmada/i).first()).toBeVisible();
});
