import AxeBuilder from '@axe-core/playwright';
import type { Locator } from '@playwright/test';
import {
  test,
  expect,
  startCreator,
  nameField,
  irEtapa,
  abaDaFicha,
  salvarParaFicha,
  navigate,
  expectNoHorizontalOverflow,
  expectInsidePanel,
  openEditor,
} from './helpers';
async function checks(group: Locator, n: number, used = new Set<string>()) {
  let added = 0;
  for (const item of await group.getByRole('checkbox').all()) {
    const name = await item.evaluate(
      (el: HTMLInputElement) => el.labels?.[0]?.textContent?.trim() ?? '',
    );
    if (!used.has(name) && (await item.isEnabled())) {
      await item.check();
      used.add(name);
      if (++added === n) break;
    }
  }
  expect(added).toBe(n);
}
/** Abre a seção de um grupo de magias (uma por vez) e a devolve. */
async function secao(page: Parameters<typeof startCreator>[0], nome: RegExp) {
  const grupo = page.getByRole('group', { name: nome });
  const titulo = grupo.getByRole('button', { name: nome });
  if (await titulo.getAttribute('aria-expanded') !== 'true') await titulo.click();
  await expect(titulo).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.grupo-magia-titulo[aria-expanded="true"]')).toHaveCount(1);
  return grupo;
}
async function activate(page: Parameters<typeof startCreator>[0]) {
  await startCreator(page);
  await expect(page.getByRole('button', { name: 'Ativar opções SRD 2014', exact: true })).toHaveCount(0);
  await irEtapa(page, 'Classe');
  await expect(page.getByRole('radio', { name: /^Guerreiro/ })).toHaveAttribute('aria-checked', 'true');
}
async function changeClass(page: Parameters<typeof startCreator>[0], nome: string) {
  await irEtapa(page, 'Classe');
  await page.getByRole('radio', { name: new RegExp('^' + nome) }).click();
  const confirmar = page.getByRole('button', { name: 'Confirmar troca de classe', exact: true });
  if (await confirmar.isVisible()) await confirmar.click();
  await expect(page.getByRole('radio', { name: new RegExp('^' + nome) })).toHaveAttribute('aria-checked', 'true');
}
const raca = async (page: Parameters<typeof startCreator>[0], nome: string) => { await irEtapa(page, 'Raça'); await page.getByRole('radio', { name: new RegExp('^' + nome) }).click(); };

test('SRD 2014: Maga completa escolhas, origem, equipamento e reabre sem perder versão/inventário', async ({
  page,
}, info) => {
  test.setTimeout(60_000);   // jornada completa (criação, ficha, recarregamento e edição): cerca de 25 s sozinha, acima de 30 s em paralelo
  await activate(page);
  await irEtapa(page, 'Identidade'); await nameField(page).fill('Maga 2014');
  await changeClass(page, 'Mago');
  await raca(page, 'Humano');
  await page.getByRole('combobox', { name: 'Idiomas da raça', exact: true }).selectOption('draconic');
  await irEtapa(page, 'Atributos');
  await page.getByRole('combobox', { name: 'Atributo str', exact: true }).selectOption('8');
  await page.getByRole('combobox', { name: 'Atributo int', exact: true }).selectOption('15');
  await irEtapa(page, 'Origem');
  await checks(page.getByRole('group', { name: /^Idiomas da origem/ }), 2);
  await irEtapa(page, 'Classe');
  await page.getByRole('combobox', { name: 'Nível', exact: true }).selectOption('3');
  await page.getByRole('combobox', { name: 'Subclasse', exact: true }).selectOption('evocation');
  const prof = page.getByRole('group', { name: /^Proficiências de Mago/ });
  await prof.getByRole('checkbox', { name: 'Arcanismo', exact: true }).check();
  await prof.getByRole('checkbox', { name: 'Investigação', exact: true }).check();
  const book = await secao(page, /^Grimório — seis/);
  await expect(book.getByRole('button', { name: /^Grimório — seis.* 0\/6$/ })).toBeVisible();
  await book.getByRole('button', { name: /^Ver detalhes de/ }).first().click();
  await expect(book.getByRole('region', { name: 'Detalhes de magia', exact: true })).toContainText('círculo');
  await book.getByRole('button', { name: 'Fechar detalhes de magia', exact: true }).click();
  const used = new Set<string>();
  await checks(book, 6, used);
  await expect(book.getByRole('button', { name: /^Grimório — seis.* 6\/6$/ })).toBeVisible();
  await expectInsidePanel(page);
  await expectNoHorizontalOverflow(page);
  await checks(
    await secao(page, /^Grimório — duas magias do nível 2/),
    2,
    used,
  );
  await checks(
    await secao(page, /^Grimório — duas magias do nível 3/),
    2,
    used,
  );
  await checks(await secao(page, /^Truques da classe/), 3);
  await checks(await secao(page, /^Magias preparadas/), 6);
  await irEtapa(page, 'Classe');
  await page.getByRole('combobox', { name: 'Ganho de PV por nível', exact: true }).selectOption('rolled');
  for (const [level, roll] of [[2, 4], [3, 5]]) {
    await page.getByRole('spinbutton', { name: `PV rolados no nível ${level} (d6)`, exact: true }).fill(String(roll));
    await page.getByRole('button', { name: `Confirmar PV do nível ${level}`, exact: true }).click();
  }
  await expect(page.getByRole('region', { name: 'Detalhes: Mago' })).toContainText('PV máximo: 21');
  await irEtapa(page, 'Equipamentos iniciais');
  await page.getByRole('button', { name: 'Adicionar equipamento da origem', exact: true }).click();
  await page.getByRole('button', { name: 'Atualizar símbolo sagrado da origem', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar equipamentos SRD 2014', exact: true }).click();
  await expect(page.getByText('Equipamento inicial da classe já confirmado. Mudanças são feitas no inventário.')).toBeVisible();
  await irEtapa(page, 'Revisão');
  await expect(page.getByText('Todas as escolhas estão concluídas.')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await info.attach('axe-expansao', { body: JSON.stringify(axe.violations), contentType: 'application/json' });
  expect(axe.violations).toEqual([]);
  await expectNoHorizontalOverflow(page);
  await expectInsidePanel(page);
  await salvarParaFicha(page);
  await abaDaFicha(page, 'Habilidades').click();
  const conjuracao = page.getByRole('region', { name: 'Conjuração', exact: true });
  await expect(conjuracao.getByRole('list', { name: 'Atributo, CD e ataque' })).toContainText(/INT\s*CD\s*13\s*Ataque/);
  await page.reload();
  await navigate(page, 'Personagens');
  await page.getByRole('button', { name: /^Maga 2014/ }).click();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
  await abaDaFicha(page, 'Inventário').click();
  await expect(page.getByLabel('Moedas de ouro (PO)')).toHaveValue('15');
  const inventario = page.getByRole('region', { name: 'Inventário do personagem' });
  await expect(inventario).toContainText('Livro de orações');
  await expect(inventario.getByRole('button', { name: 'Detalhes de Grimório', exact: true })).toBeVisible();
  await openEditor(page);
  await expect(nameField(page)).toHaveValue('Maga 2014');
  await irEtapa(page, 'Classe e nível');
  await expect(page.getByRole('radio', { name: /^Mago/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('spinbutton', { name: 'PV rolados no nível 3 (d6)', exact: true })).toHaveValue('5');
  await expectNoHorizontalOverflow(page);
  await expectInsidePanel(page);
  await info.attach('maga-edicao', { body: await page.screenshot(), contentType: 'image/png' });
});

test('SRD 2014: progressão até 20 preserva dados e as 12 classes aparecem sem chamar fontes externas', async ({
  page,
}, info) => {
  await activate(page);
  await irEtapa(page, 'Identidade'); await nameField(page).fill('Bárbara 2014');
  await irEtapa(page, 'Classe');
  await expect(page.getByRole('radiogroup', { name: 'Classe' }).getByRole('radio')).toHaveCount(12);
  await changeClass(page, 'Bárbaro');
  await page.getByRole('combobox', { name: 'Nível', exact: true }).selectOption('20');
  await page.getByRole('combobox', { name: 'Subclasse', exact: true }).selectOption('berserker');
  await expect(page.getByRole('region', { name: 'Detalhes: Bárbaro' })).toContainText('PV máximo:');
  await irEtapa(page, 'Identidade'); await expect(nameField(page)).toHaveValue('Bárbara 2014');
  await irEtapa(page, 'Classe');
  await expectNoHorizontalOverflow(page);
  await expectInsidePanel(page);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach('axe-progressao', {
    body: JSON.stringify(axe.violations),
    contentType: 'application/json',
  });
  expect(axe.violations).toEqual([]);
  await info.attach('barbara-nivel20', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('atributos rolados/antigos reabrem intactos e não passam por compra de pontos', async ({
  page,
}, info) => {
  await startCreator(page);
  await nameField(page).fill('Rolagens antigas');
  await irEtapa(page, 'Atributos');
  await page
    .getByRole('combobox', { name: 'Método de atributos', exact: true })
    .selectOption('manual');
  await page
    .getByRole('spinbutton', { name: 'Atributo str', exact: true })
    .fill('18');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Salvar', exact: true }),
  ).toBeDisabled();
  // Fixture de uma ficha antiga sem o campo de método, no armazenamento sintético deste contexto.
  const legacy = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (!key.startsWith('compendio5e:experimental:criador:v1:')) continue;
      const p = JSON.parse(localStorage.getItem(key)!);
      if (p.draft?.name === 'Rolagens antigas') {
        delete p.draft.abilityMethod;
        const value = JSON.stringify(p);
        localStorage.setItem(key, value);
        return { key, value };
      }
    }
    throw Error('Ficha sintética não encontrada.');
  });
  await page.reload();
  await navigate(page, 'Personagens');
  await page
    .getByRole('button', {
      name: /^Rolagens antigas/,
      exact: true,
    })
    .click();
  await openEditor(page);
  await expect(nameField(page)).toHaveValue('Rolagens antigas');
  await irEtapa(page, 'Atributos');
  await expect(
    page.getByRole('combobox', { name: 'Método de atributos', exact: true }),
  ).toHaveValue('preserved');
  await expect(
    page.getByRole('combobox', { name: 'Atributo str', exact: true }),
  ).toHaveValue('18');
  await expect(
    page.getByRole('combobox', { name: 'Atributo str', exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), legacy.key),
  ).toBe(legacy.value);
  await expectNoHorizontalOverflow(page);
  await expectInsidePanel(page);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach('axe-atributos-legados', {
    body: JSON.stringify(axe.violations),
    contentType: 'application/json',
  });
  expect(axe.violations).toEqual([]);
});
