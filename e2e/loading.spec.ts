import { test, expect, openDemo } from './fixtures';

test('sem configuração e sem sessão não abre o workspace', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Ambiente não configurado' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('O aplicativo exige conta');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ambiente não configurado' })).toBeVisible();
});

for (const role of ['mestre', 'jogador'] as const) {
  test(`carrega demonstração ${role} e recarrega sem dados reais`, async ({ page }) => {
    await openDemo(page, role);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sociedade do Véu Negro', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Diário', exact: true }).getByRole('button', { name: 'Ver registro completo', exact: true })).toBeVisible();
  });
}
