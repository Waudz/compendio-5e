import { test, expect, navigate, expectNoHorizontalOverflow } from './helpers';
import { openDemo } from '../fixtures';

// Frente do catálogo: monstro e magia em páginas próprias (aba no computador, tela inteira no celular), sem seletor de sistema.
test('Compêndio: link da conjuração do monstro abre a magia, a ficha continua aberta e a lista preserva a pesquisa', async ({ page }, info) => {
  await openDemo(page, 'mestre'); await navigate(page, 'Compêndio');
  await page.getByRole('button', {name:/^Bestiário /}).click();
  const busca = page.getByRole('searchbox', { name: 'Pesquisar no Compêndio', exact: true });
  await busca.fill('arquimago');
  await page.getByRole('list', { name: 'Resultados do Compêndio' }).getByRole('button', { name: /^Arquimago(?!\S)/ }).first().click();
  // no computador a ficha abre no pop-up; maximizar leva à página, que mantém a aba interna
  const maximizar = page.getByRole('button', { name: 'Maximizar', exact: true });
  if ((page.viewportSize()?.width ?? 1440) > 700) await maximizar.click();
  const ficha = page.getByRole('region', { name: 'Detalhes de Arquimago' });
  await expect(ficha).toBeVisible(); await expectNoHorizontalOverflow(page);
  // tudo em português e com o aviso de tradução por IA
  await expect(ficha.getByText(/ainda sem revisão humana/)).toBeVisible();
  await page.getByRole('navigation', { name: 'Seções da ficha' }).getByRole('button', { name: 'Habilidades', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  await ficha.getByRole('button', { name: 'Abrir a magia parar o tempo', exact: true }).click();
  const magia = page.getByRole('article', { name: 'Detalhes de Parar o Tempo' });
  await expect(magia).toBeVisible(); await expectNoHorizontalOverflow(page);
  await expect(magia.getByText('9º círculo', { exact: true })).toBeVisible();
  await info.attach('magia-aberta-pelo-monstro', { body: await page.screenshot(), contentType: 'image/png' });
  const celular = (page.viewportSize()?.width ?? 1440) <= 700;
  if (celular) await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  else await page.getByRole('button', {name:'Voltar na aba',exact:true}).click();
  await expect(ficha).toBeVisible();
  if (celular) await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  else await page.getByRole('button', {name:'Voltar na aba',exact:true}).click();
  await expect(busca).toHaveValue('arquimago');
  await expectNoHorizontalOverflow(page);
});
