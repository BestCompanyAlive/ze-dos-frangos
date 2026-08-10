import { test, expect } from '@playwright/test';
import {
  clearStorage, setupSugestaoMes, setupVinhoMes,
  setupMaisVendidos, setupEvento, setupMenuGrupos, setupEmenta,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);
});

// ── NAVEGAÇÃO ──────────────────────────────────────────────────────────────

test('navegação: links do menu levam às secções correctas', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[href="#sobre"], a[href="/#sobre"]').first().click();
  await expect(page.locator('#sobre')).toBeInViewport({ ratio: 0.3 });

  await page.locator('a[href="#ementa"], a[href="/#ementa"]').first().click();
  await expect(page.locator('#ementa')).toBeInViewport({ ratio: 0.3 });
});

test('navegação: botão Reservar leva para /reservas', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[href="/reservas"]').first().click();
  await expect(page).toHaveURL('/reservas');
});

// ── EMENTA ────────────────────────────────────────────────────────────────

test('ementa: tabs alternam correctamente', async ({ page }) => {
  await page.goto('/');
  // rótulo do botão → data-panel correspondente (ver src/pages/index.astro)
  const tabs: Record<string, string> = { Carnes: 'principais', Peixe: 'peixe', Sobremesas: 'sobremesas' };
  for (const [label, panel] of Object.entries(tabs)) {
    await page.getByRole('button', { name: label }).click();
    // painel activo ganha a classe "active" (opacity:1) via Layout.astro tab handler
    const painel = page.locator(`.menu-panel[data-panel="${panel}"]`);
    await expect(painel).toHaveClass(/active/);
    await expect(painel).toHaveCSS('opacity', '1');
  }
});

test('ementa: dados do backoffice substituem os hardcoded', async ({ page }) => {
  await page.goto('/');
  await setupEmenta(page);
  await page.goto('/');
  // Entradas tab is active by default
  await expect(page.getByText('Chouriço Especial da Casa')).toBeVisible();
  await expect(page.getByText('4,50')).toBeVisible();

  await page.getByRole('button', { name: 'Carnes' }).click();
  await expect(page.getByText('Frango no Churrasco')).toBeVisible();
});

test('ementa: menus de grupo aparecem quando configurados no backoffice', async ({ page }) => {
  await page.goto('/');
  await setupMenuGrupos(page);
  await page.goto('/');
  await page.getByRole('button', { name: /grupo/i }).click();
  await expect(page.getByText('Menu Executivo')).toBeVisible();
  await expect(page.getByText('Ideal para grupos com paladar distinto')).toBeVisible();
});

// ── SUGESTÃO DO MÊS ──────────────────────────────────────────────────────

test('sugestão do mês: aparece com nome correcto quando configurada', async ({ page }) => {
  await page.goto('/');
  await setupSugestaoMes(page);
  await page.goto('/');
  // Use first() to avoid strict-mode error if the name appears in multiple elements
  await expect(page.getByText('Cabrito Assado').first()).toBeVisible();
  await expect(page.getByText(/Sugestão de Julho/i)).toBeVisible();
});

// ── VINHO DO MÊS ─────────────────────────────────────────────────────────

test('vinho do mês: aparece com nome correcto quando configurado', async ({ page }) => {
  await page.goto('/');
  await setupVinhoMes(page);
  await page.goto('/');
  await expect(page.getByText('Quinta de Ventozelo Tinto')).toBeVisible();
  await expect(page.getByText(/Vinho de Julho/i)).toBeVisible();
});

// ── EVENTOS ──────────────────────────────────────────────────────────────

test('eventos: secção aparece com layout editorial quando configurada', async ({ page }) => {
  await page.goto('/');
  await setupEvento(page);
  await page.goto('/');

  const section = page.locator('#eventos-section');
  await expect(section).toBeVisible();
  // Title is split into two spans: line1 ("Jantar de") + line2 ("Natal")
  await expect(section.locator('.ev-title-line1')).toContainText('Jantar de');
  await expect(section.locator('.ev-title-line2')).toContainText('Natal');
  await expect(section.getByText(/Está-se a aproximar/i)).toBeVisible();
  await expect(section.getByRole('link', { name: /reservar mesa/i })).toHaveAttribute('href', '/reservas');
});

test('eventos: secção fica oculta sem eventos configurados', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);
  await page.goto('/');
  await expect(page.locator('#eventos-section')).toBeHidden();
});

// ── MAIS VENDIDOS ─────────────────────────────────────────────────────────

test('mais vendidos: grelha 3+3 aparece quando configurada', async ({ page }) => {
  await page.goto('/');
  await setupMaisVendidos(page);
  await page.goto('/');

  const section = page.locator('#mais-vendidos-section');
  await expect(section).toBeVisible();
  await expect(section.getByText('Frango no Churrasco')).toBeVisible();
  await expect(section.getByText('Dourada Grelhada')).toBeVisible();
  await expect(section.locator('#mv-carne-grid > div')).toHaveCount(3);
  await expect(section.locator('#mv-peixe-grid > div')).toHaveCount(3);
});

test('mais vendidos: secção fica oculta sem dados', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);
  await page.goto('/');
  await expect(page.locator('#mais-vendidos-section')).toBeHidden();
});

// ── FOOTER ────────────────────────────────────────────────────────────────

test('footer: horários, morada e telefone visíveis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Terça/)).toBeVisible();
  await expect(page.getByText(/11h30/)).toBeVisible();
  await expect(page.getByText(/19h00/)).toBeVisible();
  await expect(page.getByText(/913.977.751|913977751/)).toBeVisible();
  await expect(page.getByText(/Largo do Pioledo/)).toBeVisible();
});
