import { test, expect, navigate, campaignName, expectNoHorizontalOverflow } from './fixtures';

// Interface do modo NUVEM exercitada com o servidor FALSO do modo de demonstração (`?demo=mestre&nuvem=1`, só em dev). Isto valida a tela, o salvamento automático e a retomada;
// a segurança do banco é validada à parte (supabase/*-rls.test.ts em PostgreSQL isolado) e o Supabase hospedado NÃO é tocado.
async function abrir(page: import('@playwright/test').Page, papel: 'mestre' | 'jogador' = 'mestre') {
  await page.goto(`?demo=${papel}&nuvem=1`);
  await expect(page.getByRole('heading', { name: campaignName, exact: true })).toBeVisible();
}

test('mestre: encontro → combate → turnos, dano, condição → recarregar → retomar em outro aparelho → finalizar → encontro continua salvo', async ({ page, context }) => {
  await abrir(page);
  // 1. prepara o encontro com um monstro do Bestiário
  await navigate(page, 'Encontros');
  await expect(page.getByRole('heading', { name: 'Encontros', exact: true })).toBeVisible();
  await expect(page.locator('[data-modo="nuvem"]')).toBeVisible();
  await page.getByLabel('Nome do encontro', { exact: true }).fill('Emboscada na estrada');
  await page.getByRole('button', { name: 'Criar encontro', exact: true }).click();
  const cartao = page.getByRole('region', { name: 'Página do encontro Emboscada na estrada' });
  await cartao.getByText('Adicionar do Bestiário', { exact: true }).click();
  await cartao.getByLabel('Buscar monstro').fill('goblin');
  await cartao.getByRole('button', { name: 'Adicionar Goblin do Bestiário', exact: true }).click();
  await expect(cartao.getByText(/Bestiário · PV 7/)).toBeVisible();
  await cartao.getByRole('button', { name: 'Voltar à lista de encontros' }).click();
  await page.getByRole('region', { name: 'Encontro Emboscada na estrada' }).getByRole('button', { name: 'Enviar para a Iniciativa', exact: true }).click();
  await expect(page.getByText(/foi enviado para a Iniciativa/)).toBeVisible();
  // 2. conduz o combate
  await navigate(page, 'Iniciativa');
  await expect(page.getByRole('heading', { name: 'Iniciativa', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Combatentes' }).getByText('Goblin', { exact: true })).toBeVisible();
  // a aba Encontros continua aberta (o menu não substitui abas): escopo no formulário do combate
  await page.getByRole('button', { name: 'Combatente avulso', exact: true }).click();
  const form = page.getByRole('form', { name: 'Adicionar combatente' });
  await form.getByLabel('Nome', { exact: true }).fill('Lydia');
  await form.getByRole('textbox', { name: 'Iniciativa', exact: true }).fill('18');
  await form.getByRole('combobox', { name: 'Lado' }).selectOption('aliado');
  await form.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByLabel('Iniciativa de Goblin', { exact: true }).fill('12'); await page.getByLabel('Iniciativa de Goblin', { exact: true }).blur();
  await page.getByRole('button', { name: 'Próximo turno', exact: true }).click(); await page.getByRole('button', { name: 'Próximo turno', exact: true }).click();
  await expect(page.getByText('Rodada 2', { exact: true })).toBeVisible();
  await page.getByLabel('Quantidade de dano ou cura de Goblin', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Causar dano a Goblin', exact: true }).click();
  await page.getByLabel('Adicionar condição a Goblin', { exact: true }).selectOption('Caído');
  await expect(page.getByLabel('PV de Goblin', { exact: true })).toHaveText('PV 4/7');
  await expect(page.locator('[data-sync="salvo"]', { hasText: 'o combate' })).toHaveCount(0);
  // Confirma a persistência em outra página antes de recarregar a original.
  await expect(async () => {
    const outra = await page.context().newPage();
    try {
      await outra.goto('?demo=mestre&nuvem=1');
      await navigate(outra, 'Iniciativa');
      await expect(outra.getByLabel('PV de Goblin', { exact: true })).toHaveText('PV 4/7');
      await expect(outra.getByRole('button', { name: 'Remover condição Caído de Goblin' })).toBeVisible();
      await expect(outra.getByText('Rodada 2', { exact: true })).toBeVisible();
    } finally { await outra.close(); }
  }).toPass({ timeout: 20000 });
  await expectNoHorizontalOverflow(page);
  // 3. F5 e "outro aparelho" (outra aba do mesmo navegador, sem estado local de tela)
  await page.reload(); await navigate(page, 'Iniciativa');
  await expect(page.getByText('Rodada 2', { exact: true })).toBeVisible(); await expect(page.getByLabel('PV de Goblin', { exact: true })).toHaveText('PV 4/7');
  await expect(page.getByRole('button', { name: 'Remover condição Caído de Goblin' })).toBeVisible();
  const outra = await context.newPage(); await outra.goto('?demo=mestre&nuvem=1'); await navigate(outra, 'Iniciativa');
  await expect(outra.getByLabel('PV de Goblin', { exact: true })).toHaveText('PV 4/7'); await outra.close();
  // 4. finaliza explicitamente; o encontro continua salvo e pode ser reutilizado
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Mais ações do combate', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar combate', exact: true }).click();
  await expect(page.getByText('Nenhum combatente ainda')).toBeVisible();
  await navigate(page, 'Encontros');
  await expect(page.getByRole('region', { name: 'Encontro Emboscada na estrada' })).toBeVisible();
  await page.getByRole('region', { name: 'Encontro Emboscada na estrada' }).getByRole('button', { name: 'Enviar para a Iniciativa', exact: true }).click();
  await navigate(page, 'Iniciativa');
  await expect(page.getByRole('group', { name: 'Combatentes' }).getByText('Goblin', { exact: true })).toBeVisible();
  await expect(page.getByText('Rodada 1', { exact: true })).toBeVisible();
});

test('jogador não vê iniciativa nem encontros, nem pela navegação nem pelo conteúdo', async ({ page }) => {
  await abrir(page, 'jogador');
  await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Iniciativa', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Encontros', exact: true })).toHaveCount(0);
});
