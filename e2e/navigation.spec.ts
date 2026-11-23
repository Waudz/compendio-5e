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

test('mestre usa iniciativa local, preserva PV e rodada ao recarregar', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Iniciativa');
  await expect(page.getByRole('heading', { name: 'Iniciativa', exact: true })).toBeVisible();
  await page.getByLabel('Nome', { exact: true }).fill('Goblin de teste');
  await page.getByLabel('Iniciativa', { exact: true }).fill('12');
  await page.getByLabel('PV (opcional)', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByLabel('Quantidade de dano ou cura de Goblin de teste').fill('3');
  await page.getByRole('button', { name: 'Causar dano a Goblin de teste' }).click();
  await page.getByRole('button', { name: 'Próximo turno', exact: true }).click();
  await expect(page.getByLabel('PV de Goblin de teste', { exact: true })).toHaveText('PV 4/7');
  await page.reload();
  await navigate(page, 'Iniciativa');
  await expect(page.getByLabel('PV de Goblin de teste', { exact: true })).toHaveText('PV 4/7');
  await expect(page.getByText('Rodada 2', { exact: true })).toBeVisible();
});

test('jogador não acessa o conteúdo de iniciativa', async ({ page }) => {
  await openDemo(page, 'jogador');
  await navigate(page, 'Iniciativa');
  await expect(page.getByText('Somente o mestre da campanha pode acessar este módulo.', { exact: true })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Adicionar combatente' })).toHaveCount(0);
});
