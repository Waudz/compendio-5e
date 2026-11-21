import { test, expect, openDemo, navigate, campaignName } from './fixtures';

for (const role of ['mestre', 'jogador'] as const) {
  test(`navegação ${role}: Diário, Conta e retorno à campanha`, async ({ page }) => {
    await openDemo(page, role);
    await navigate(page, 'Diário');
    await expect(page.getByRole('heading', { name: 'Diário', exact: true })).toBeVisible();
    await expect(page.getByText('3ª Sessão — O Festival', { exact: true })).toBeVisible();
    await navigate(page, 'Conta');
    await expect(page.getByRole('heading', { name: 'Conta', exact: true })).toBeVisible();
    await expect(page.getByText(`${role}@demo.local`, { exact: true })).toBeVisible();
    await navigate(page, 'Início');
    await expect(page.getByRole('heading', { name: campaignName, exact: true })).toBeVisible();
  });
}

test('a navegação não apresenta a Iniciativa demonstrativa como combate implementado', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Iniciativa');
  await expect(page.getByRole('heading', { name: 'Iniciativa', exact: true })).toBeVisible();
  await expect(page.getByText('Este módulo ainda não foi desenvolvido.', { exact: true })).toBeVisible();
});
