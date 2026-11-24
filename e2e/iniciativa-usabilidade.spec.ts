import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from './fixtures';

test('próximo turno conserva posição com nomes longos; busca única inclui personagens reais do demo', async ({ page }, info) => {
 await openDemo(page); await navigate(page, 'Iniciativa');
 await expect(page.getByRole('form', { name: 'Adicionar combatente' })).toHaveCount(0);
 await page.getByLabel('Buscar combatentes').fill('Lydia');
 await expect(page.getByRole('button', { name: 'Adicionar Lydia Valenmoor (personagem)', exact: true })).toBeVisible();
 await page.screenshot({ path: info.outputPath('busca-unica.png') });
 for (const [nome, iniciativa] of [['A', '20'], ['Guardião ancestral dos salões de prata e sombras', '10']]) {
   await page.getByRole('button', { name: 'Combatente avulso', exact: true }).click();
   const form = page.getByRole('form', { name: 'Adicionar combatente' });
   await form.getByLabel('Nome', { exact: true }).fill(nome); await form.getByLabel('Iniciativa', { exact: true }).fill(iniciativa);
   await form.getByLabel('PV (opcional)', { exact: true }).fill('10'); await form.getByRole('button', { name: 'Adicionar', exact: true }).click();
 }
 const proximo = page.getByRole('button', { name: 'Próximo turno', exact: true });
 await proximo.scrollIntoViewIfNeeded(); const antes = (await proximo.boundingBox())!;
 for (let i = 0; i < 4; i++) {
   await page.mouse.click(antes.x + antes.width / 2, antes.y + antes.height / 2);
   const depois = (await proximo.boundingBox())!;
   expect(Math.abs(antes.x - depois.x)).toBeLessThan(1); expect(Math.abs(antes.y - depois.y)).toBeLessThan(1);
 }
 await expect(page.getByText('Rodada 3', { exact: true })).toBeVisible();
 const modos = page.getByRole('group', { name: 'Visualização dos combatentes' });
 for (const button of await modos.getByRole('button').all()) { const box = (await button.boundingBox())!; expect(box.width).toBeLessThanOrEqual(34); }
 await expectNoHorizontalOverflow(page);
 await page.screenshot({ path: info.outputPath('controles-fixos.png') });
});

test('loot de criatura e baú aparece sem expandir; escolha abre janela contextual', async ({ page }, info) => {
 await openDemo(page); await navigate(page, 'Encontros');
 await page.getByLabel('Nome do encontro', { exact: true }).fill('Loot visível'); await page.getByRole('button', { name: 'Criar encontro', exact: true }).click();
 const enc = page.getByRole('region', { name: 'Página do encontro Loot visível' });
 const form = enc.getByRole('form', { name: 'Adicionar participante a Loot visível' });
 await form.getByLabel('Nome', { exact: true }).fill('Goblin'); await form.getByRole('button', { name: 'Adicionar', exact: true }).click();
 await enc.getByRole('button', { name: 'Escolher loot de Goblin', exact: true }).click();
 let dialogo = page.getByRole('dialog', { name: 'Escolher loot de Goblin' });
 await dialogo.getByLabel('Tipo de item em loot de Goblin').selectOption('personalizado');
 await dialogo.getByLabel('Nome do item', { exact: true }).fill('Chave de ferro'); await dialogo.getByRole('button', { name: 'Incluir item', exact: true }).click(); await dialogo.getByRole('button', { name: 'Concluir seleção', exact: true }).click();
 await expect(enc.getByText('Chave de ferro', { exact: true })).toBeVisible();
 await enc.getByRole('button', { name: 'Tesouros', exact: true }).click();
 await enc.getByLabel('Nome do recipiente').fill('Baú dourado'); await enc.getByRole('button', { name: 'Criar recipiente', exact: true }).click();
 await enc.getByRole('button', { name: 'Escolher loot de Baú dourado', exact: true }).click();
 dialogo = page.getByRole('dialog', { name: 'Escolher loot de Baú dourado' });
 await dialogo.getByLabel('Tipo de item em Baú dourado').selectOption('moeda'); await dialogo.getByLabel('Quantidade a adicionar em Baú dourado').fill('25');
 await dialogo.getByRole('button', { name: 'Incluir moeda', exact: true }).click(); await dialogo.getByRole('button', { name: 'Concluir seleção', exact: true }).click();
 await expect(enc.getByRole('heading', { name: /Baú dourado/ })).toBeVisible(); await expect(enc.getByText('peças de ouro', { exact: true })).toBeVisible();
 await expect(enc.locator('.loot-recipiente details')).toHaveCount(0); await expectNoHorizontalOverflow(page);
 await page.screenshot({ path: info.outputPath('loot-visivel.png') });
});

test('faixa fixa cobre as bordas e usa controles compactos em meia tela', async ({ page }, info) => {
 test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Divisão real no desktop.');
 await openDemo(page); await navigate(page, 'Iniciativa');
 await page.getByLabel('Buscar combatentes').fill('goblin');
 for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Adicionar Goblin do Bestiário', exact: true }).click();
 await page.getByLabel('Buscar combatentes').press('Escape');
 await page.getByRole('tab', { name: /^Iniciativa/ }).click({ button: 'right' });
 await page.getByRole('menuitem', { name: 'Abrir em nova coluna à direita', exact: true }).click();
 const conteudo = page.locator('.content.iniciativa'); await conteudo.hover(); await page.mouse.wheel(0, 950);
 const faixa = conteudo.locator('.ini-turnos-topo');
 await expect.poll(async () => {
   return faixa.evaluate(el => {
     const r = el.getBoundingClientRect(), pai = el.parentElement!.getBoundingClientRect();
     const ponta = document.elementFromPoint(r.left + 2, r.top + Math.min(20, r.height / 2));
     return { cobertura: r.top <= pai.top + 1 && r.left <= pai.left + 1 && r.right >= pai.left + el.parentElement!.clientWidth - 2, opaca: ponta === el || el.contains(ponta), compacto: getComputedStyle(el.querySelector('button')!).fontSize === '0px' };
   });
 }).toEqual({ cobertura: true, opaca: true, compacto: true });
 expect((await faixa.boundingBox())!.height).toBeLessThanOrEqual(230);
 for (const botao of await faixa.getByRole('button').all()) expect((await botao.boundingBox())!.width).toBeLessThanOrEqual(38);
 await expectNoHorizontalOverflow(page); await page.screenshot({ path: info.outputPath('faixa-opaca.png') });
});
