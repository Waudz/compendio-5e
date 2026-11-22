import AxeBuilder from '@axe-core/playwright';
import type { Locator } from '@playwright/test';
import {
  test,
  expect,
  startCreator,
  nameField,
  showSection,
  navigate,
  expectNoHorizontalOverflow,
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
async function activate(page: Parameters<typeof startCreator>[0]) {
  await startCreator(page);
  await page
    .getByRole('button', { name: 'Ativar opções SRD 2014', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Confirmar nova versão de regras',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Classe', exact: true }),
  ).toHaveValue('fighter');
  await expect(nameField(page)).toBeFocused();
}
async function changeClass(
  page: Parameters<typeof startCreator>[0],
  id: string,
) {
  await page
    .getByRole('combobox', { name: 'Classe', exact: true })
    .selectOption(id);
  await page
    .getByRole('button', { name: 'Confirmar troca de classe', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Classe', exact: true }),
  ).toHaveValue(id);
}

test('SRD 2014: Maga completa escolhas, origem, equipamento e reabre sem perder versão/inventário', async ({
  page,
}, info) => {
  await activate(page);
  await nameField(page).fill('Maga 2014');
  await nameField(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Classe', exact: true })).toBeFocused();
  await changeClass(page, 'wizard');
  await page
    .getByRole('combobox', { name: 'Raça', exact: true })
    .selectOption('human');
  await page
    .getByRole('combobox', { name: 'Atributo str', exact: true })
    .selectOption('8');
  await page
    .getByRole('combobox', { name: 'Atributo int', exact: true })
    .selectOption('15');
  await page
    .getByRole('combobox', { name: 'Nível', exact: true })
    .selectOption('3');
  await page
    .getByRole('combobox', { name: 'Subclasse', exact: true })
    .selectOption('evocation');
  const prof = page.getByRole('group', { name: /^Proficiências de Mago/ });
  await prof.getByRole('checkbox', { name: 'Arcanismo', exact: true }).check();
  await prof
    .getByRole('checkbox', { name: 'Investigação', exact: true })
    .check();
  await page
    .getByRole('combobox', { name: 'Idiomas da raça', exact: true })
    .selectOption('draconic');
  await checks(page.getByRole('group', { name: /^Idiomas da origem/ }), 2);
  const used = new Set<string>();
  await checks(page.getByRole('group', { name: /^Grimório — seis/ }), 6, used);
  await checks(
    page.getByRole('group', { name: /^Grimório — duas magias do nível 2/ }),
    2,
    used,
  );
  await checks(
    page.getByRole('group', { name: /^Grimório — duas magias do nível 3/ }),
    2,
    used,
  );
  await checks(page.getByRole('group', { name: /^Truques da classe/ }), 3);
  await checks(page.getByRole('group', { name: /^Magias preparadas/ }), 6);
  await page
    .getByRole('button', {
      name: 'Aplicar equipamento da origem e 15 po',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Aplicar equipamento da origem e 15 po',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('spinbutton', { name: 'Ouro', exact: true }),
  ).toHaveValue('15');
  await showSection(page, 'Equipamento inicial');
  await page
    .getByRole('button', {
      name: 'Confirmar equipamentos SRD 2014',
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Equipamentos iniciais aplicados' }),
  ).toBeVisible();
  await showSection(page, 'Ficha');
  await expect(
    page.getByRole('region', { name: 'Ficha calculada' }),
  ).toContainText('Estado: escolhas concluídas');
  await expect(
    page.getByRole('region', { name: 'Resumo de jogo SRD 2014' }),
  ).toContainText('CD de magia 13');
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach('axe-expansao', {
    body: JSON.stringify(axe.violations),
    contentType: 'application/json',
  });
  expect(axe.violations).toEqual([]);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Salvar', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await navigate(page, 'Personagens');
  await page
    .getByRole('button', {
      name: 'Abrir personagem guiado Maga 2014',
      exact: true,
    })
    .click();
  await expect(nameField(page)).toHaveValue('Maga 2014');
  await expect(
    page.getByRole('combobox', { name: 'Classe', exact: true }),
  ).toHaveValue('wizard');
  await expect(
    page.getByRole('spinbutton', { name: 'Ouro', exact: true }),
  ).toHaveValue('15');
  await showSection(page, 'Inventário');
  await expect(
    page.getByRole('region', { name: 'Inventário', exact: true }),
  ).toContainText('Livro de orações');
  await expect(
    page.getByRole('button', {
      name: 'Consultar no Compêndio: Grimório',
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await info.attach('maga-inventario', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('SRD 2014: progressão até 20 preserva dados e as 12 classes aparecem sem chamar fontes externas', async ({
  page,
}, info) => {
  await activate(page);
  await nameField(page).fill('Bárbara 2014');
  await expect(
    page
      .getByRole('combobox', { name: 'Classe', exact: true })
      .getByRole('option'),
  ).toHaveCount(12);
  await changeClass(page, 'barbarian');
  await page
    .getByRole('combobox', { name: 'Nível', exact: true })
    .selectOption('20');
  await page
    .getByRole('combobox', { name: 'Subclasse', exact: true })
    .selectOption('berserker');
  await expect(
    page.getByRole('region', { name: 'Ficha calculada' }),
  ).toContainText('PV máximo:'); // nome/descrição do legado pode permanecer em inglês
  await expect(nameField(page)).toHaveValue('Bárbara 2014');
  await expect(
    page.getByRole('region', { name: 'Opções SRD 2014' }),
  ).toContainText('Sem espaços de magia');
  await expectNoHorizontalOverflow(page);
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
      name: 'Abrir personagem guiado Rolagens antigas',
      exact: true,
    })
    .click();
  await expect(nameField(page)).toHaveValue('Rolagens antigas');
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
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach('axe-atributos-legados', {
    body: JSON.stringify(axe.violations),
    contentType: 'application/json',
  });
  expect(axe.violations).toEqual([]);
});
