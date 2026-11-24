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
  await page.getByRole('button', { name: 'Combatente avulso', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Goblin de teste');
  await page.getByRole('textbox', { name: 'Iniciativa', exact: true }).fill('12');
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
  if ((page.viewportSize()?.width ?? 1440) > 700) {
    await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Iniciativa', exact: true })).toHaveCount(0);
    return;
  }
  await navigate(page, 'Iniciativa');
  await expect(page.getByText('Somente o mestre da campanha pode acessar este módulo.', { exact: true })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Adicionar combatente' })).toHaveCount(0);
});

test('mestre só descarta combate ao confirmar Finalizar; F5 mantém o combate até lá', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Iniciativa');
  await page.getByRole('button', { name: 'Combatente avulso', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Sentinela');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.reload();
  await navigate(page, 'Iniciativa');
  await expect(page.getByRole('group', { name: 'Combatentes' }).getByText('Sentinela', { exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Finalizar combate', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Combatentes' }).getByText('Sentinela', { exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Finalizar combate', exact: true }).click();
  await expect(page.getByText('Nenhum combatente ainda', { exact: true })).toBeVisible();
  await page.reload();
  await navigate(page, 'Iniciativa');
  await expect(page.getByText('Nenhum combatente ainda', { exact: true })).toBeVisible();
});

test('finalizar combate preserva encontros preparados para reutilização', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Encontros');
  await page.getByRole('form', { name: 'Novo encontro' }).getByLabel('Nome do encontro').fill('Emboscada de teste');
  await page.getByRole('button', { name: 'Criar encontro' }).click();
  const encontro = page.getByRole('region', { name: 'Página do encontro Emboscada de teste' });
  await encontro.getByRole('form', { name: 'Adicionar participante a Emboscada de teste' }).getByLabel('Nome').fill('Goblin');
  await encontro.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await encontro.getByRole('button', { name: 'Voltar à lista de encontros' }).click();
  await page.getByRole('region', { name: 'Encontro Emboscada de teste' }).getByRole('button', { name: 'Enviar para a Iniciativa' }).click();
  await navigate(page, 'Iniciativa');
  await expect(page.getByRole('group', { name: 'Combatentes' }).getByText('Goblin', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Finalizar combate' }).click();
  await expect(page.getByText('Nenhum combatente ainda', { exact: true })).toBeVisible();
  await navigate(page, 'Encontros');
  await expect(page.getByRole('heading', { name: 'Emboscada de teste' })).toBeVisible();
  await page.reload();
  await navigate(page, 'Encontros');
  await expect(page.getByRole('heading', { name: 'Emboscada de teste' })).toBeVisible();
});
