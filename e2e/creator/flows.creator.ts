import { test, expect, startCreator, chooseFighter, showSection, equip, sections, nameField,
  returnToCreator, leaveCreator, evidence, expectNoHorizontalOverflow, keyboardActivate } from './helpers';

test('Personagens → criador: atributos, escolhas de Guerreiro e ficha calculada', async ({ page }, info) => {
  await startCreator(page); await chooseFighter(page);
  await expect(page.getByRole('combobox', { name: 'Atributo str', exact: true })).toHaveValue('14');
  await expect(page.getByRole('combobox', { name: 'Atributo dex', exact: true })).toHaveValue('13');
  await expect(page.getByRole('group',{name:/^Proficiências de Guerreiro/}).getByRole('checkbox', { name: 'Acrobacia', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Ficha calculada' })).toContainText('PV máximo: 14');
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'guerreiro');
});

test('equipamentos: prévia, confirmação e inventário com escolhas alternativas', async ({ page }, info) => {
  await startCreator(page); await chooseFighter(page);
  await showSection(page, 'Inventário');
  await expect(page.getByText(/Inventário vazio/)).toBeVisible();
  await equip(page); await showSection(page, 'Inventário');
  const inventory = page.getByRole('region', { name: 'Inventário', exact: true });
  await expect(inventory.getByRole('button', { name: 'Consultar no Compêndio: Arco longo', exact: true })).toBeVisible();
  await expect(inventory.getByRole('button', { name: 'Consultar no Compêndio: Armadura de couro', exact: true })).toBeVisible();
  await expect(inventory.getByRole('button', { name: 'Consultar no Compêndio: Cota de malha', exact: true })).toHaveCount(0);
  // Confirmar novamente não pode duplicar instâncias concedidas.
  const count = await inventory.getByRole('button', { name: /^Consultar no Compêndio: .*$/ }).count();
  await showSection(page, 'Equipamento inicial');
  await page.getByRole('button', { name: 'Confirmar equipamentos SRD 2014', exact: true }).click();
  await showSection(page, 'Inventário');
  await expect(inventory.getByRole('button', { name: /^Consultar no Compêndio: .*$/ })).toHaveCount(count);
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'equipamento-inventario');
});

test('inventário: adicionar item, alterar quantidade, consultar no Compêndio e remover', async ({ page }, info) => {
  await startCreator(page); await chooseFighter(page); await showSection(page, 'Inventário');
  await page.getByRole('searchbox', { name: 'Buscar item para adicionar', exact: true }).fill('adaga');
  await page.getByRole('button', { name: 'Adicionar Adaga', exact: true }).click();
  const row = page.getByRole('region', { name: 'Inventário', exact: true }).getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'Consultar no Compêndio: Adaga', exact: true }) });
  await expect(row).toContainText('quantidade 1');
  await row.getByRole('button', { name: '+1: adicionar quantidade de Adaga', exact: true }).click();
  await expect(row).toContainText('quantidade 2');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
  await row.getByRole('button', { name: 'Consultar no Compêndio: Adaga', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Adaga', exact: true })).toBeVisible();
  await expect(page.getByText('Dagger', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'item-compendio');
  await returnToCreator(page);
  await expect(row).toContainText('quantidade 2');
  await row.getByRole('button', { name: '−1: remover quantidade de Adaga', exact: true }).click();
  await expect(row).toContainText('quantidade 1');
  await row.getByRole('button', { name: '−1: remover quantidade de Adaga', exact: true }).click();
  await expect(row).toHaveCount(0); await expect(page.getByText(/Inventário vazio/)).toBeVisible();
});

test('alterações não salvas: cancelar preserva e descartar encerra a ficha', async ({ page }) => {
  await startCreator(page); await nameField(page).fill('Rascunho E2E');
  await leaveCreator(page);
  const dialog = page.getByRole('alertdialog', { name: 'Alterações não salvas', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(dialog).toBeHidden();
  await expect(nameField(page)).toHaveValue('Rascunho E2E');
  await leaveCreator(page);
  await dialog.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(nameField(page)).toBeHidden();
});

test('alterações não salvas: salvar pelo diálogo e reabrir o personagem local', async ({ page }) => {
  await startCreator(page); await chooseFighter(page); await leaveCreator(page);
  await page.getByRole('alertdialog', { name: 'Alterações não salvas', exact: true })
    .getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await page.getByRole('button', { name: 'Abrir personagem guiado Guerreira E2E', exact: true }).click();
  await expect(nameField(page)).toHaveValue('Guerreira E2E');
  await expect(page.getByRole('group',{name:/^Proficiências de Guerreiro/}).getByRole('checkbox', { name: 'Atletismo', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
});

test('teclado: ordem do formulário e ativação das seções sem mouse', async ({ page }, info) => {
  await startCreator(page);
  await nameField(page).focus(); await page.keyboard.type('Teclado E2E');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Classe', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Raça', exact: true })).toBeFocused();
  await keyboardActivate(page, sections(page).getByRole('button', { name: 'Inventário', exact: true }));
  const search = page.getByRole('searchbox', { name: 'Buscar item para adicionar', exact: true });
  await search.focus(); await page.keyboard.type('adaga'); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Adicionar Adaga', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Consultar no Compêndio: Adaga', exact: true })).toBeVisible();
  await evidence(page, info, 'inventario-teclado');
});
