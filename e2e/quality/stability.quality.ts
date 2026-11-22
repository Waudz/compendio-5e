import { test, expect, openDemo, navigate, mobile, expectNoHorizontalOverflow } from './helpers';

test('alternância rápida estabiliza na última página e recarrega conforme o layout', async ({ page }) => {
  await openDemo(page);
  for (const name of ['Conta','Diário','Anotações','Início','Conta','Diário']) await navigate(page, name);
  await expect(page.getByRole('heading', { name: 'Diário', exact: true })).toBeVisible();
  await expect(page.getByText('3ª Sessão — O Festival', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: mobile(page) ? 'Sociedade do Véu Negro' : 'Diário', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('trocar papéis sintéticos, voltar e avançar no navegador mantém a identidade', async ({ page }) => {
  await openDemo(page, 'mestre'); await openDemo(page, 'jogador');
  await navigate(page,'Conta'); await expect(page.getByText('jogador@demo.local',{exact:true})).toBeVisible();
  await page.goBack(); await navigate(page,'Conta'); await expect(page.getByText('mestre@demo.local',{exact:true})).toBeVisible();
  await page.goForward(); await navigate(page,'Conta'); await expect(page.getByText('jogador@demo.local',{exact:true})).toBeVisible();
});

test('Voltar do aplicativo retorna à tela de origem no celular', async ({ page }) => {
  test.skip(!mobile(page), 'Histórico de telas mobile, distinto das abas do desktop.');
  await openDemo(page); await navigate(page,'Diário');
  await expect(page.getByRole('heading',{name:'Diário',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Voltar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sociedade do Véu Negro',exact:true})).toBeVisible();
});
