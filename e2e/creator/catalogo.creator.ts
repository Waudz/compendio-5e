import { test, expect, navigate, expectNoHorizontalOverflow } from './helpers';
import { openDemo } from '../fixtures';

// Frente do catálogo: navegação monstro -> magia dentro do Compêndio (sem aba nova, sem seletor de sistema), em desktop e celular.
test('Compêndio: link da conjuração do monstro abre a magia e "Voltar para o monstro" restaura a ficha', async ({ page }, info) => {
  await openDemo(page, 'mestre'); await navigate(page, 'Compêndio');
  await page.getByRole('button', {name:/^Bestiário /}).click();
  const busca = page.getByRole('searchbox', { name: 'Pesquisar no Compêndio', exact: true });
  await busca.fill('arquimago');
  await page.getByRole('button', { name: /^Arquimago/ }).first().click();
  const ficha = page.getByRole('article', { name: 'Detalhes de Arquimago' });
  await expect(ficha).toBeVisible(); await expectNoHorizontalOverflow(page);
  // tudo em português e com o aviso de tradução por IA
  await expect(ficha.getByText(/ainda sem revisão humana/)).toBeVisible();
  await ficha.getByRole('button', { name: 'Abrir a magia parar o tempo', exact: true }).click();
  const magia = page.getByRole('article', { name: 'Detalhes de Parar o Tempo' });
  await expect(magia).toBeVisible(); await expectNoHorizontalOverflow(page);
  await expect(magia.getByText('MAGIA',{exact:true})).toBeVisible();
  await info.attach('magia-aberta-pelo-monstro', { body: await page.screenshot(), contentType: 'image/png' });
  await magia.getByRole('button', { name: 'Voltar para Arquimago', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Detalhes de Arquimago' })).toBeVisible();
  await expect(page.getByRole('button',{name:'Voltar às categorias',exact:true})).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
