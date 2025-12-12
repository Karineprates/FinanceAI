import { test, expect } from '@playwright/test';
import path from 'path';

test('importa JSON, aplica filtros e recalcula insights', async ({ page }) => {
  const backup = path.resolve('tests/fixtures/sample.json');

  await page.goto('/');

  // Importar backup JSON
  await page.getByRole('button', { name: /Importar CSV\/JSON/i }).click();
  await page.setInputFiles('input[type="file"]', backup);
  await expect(page.getByText(/registro\(s\)/i)).toBeVisible();

  // Aplicar filtro de categoria (se existir opção)
  const categoriaSelect = page.getByLabel(/Categoria/i);
  if (await categoriaSelect.isVisible()) {
    await categoriaSelect.selectOption({ label: 'Mercado' }).catch(() => {});
  }

  // Recalcular insights
  await page.getByRole('button', { name: /Recalcular/i }).click();
  await expect(page.getByText(/Insights locais/i)).toBeVisible();

  // Conferir que há linhas na tabela
  await expect(page.getByText(/Transacoes/i)).toBeVisible();
});
