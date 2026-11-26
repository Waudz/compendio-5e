import { test, expect, startCreator, chooseFighter, completarGuerreira, equip, irEtapa, etapasNav, nameField, salvarParaFicha, abaDaFicha, acaoDoItem,
  leaveCreator, evidence, expectNoHorizontalOverflow, expectSingleScroll, expectInsidePanel, keyboardActivate, openEditor, isMobile, navigate } from './helpers';

test('Personagens → criador por etapas: atributos, escolhas de Guerreiro, pendências com atalho e salvamento incompleto', async ({ page }, info) => {
  await startCreator(page); await chooseFighter(page);
  await expect(page.getByRole('group', { name: /^Proficiências de Guerreiro/ }).getByRole('checkbox', { name: 'Acrobacia', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Detalhes: Guerreiro' })).toContainText('PV máximo: 14');
  await irEtapa(page, 'Atributos');
  await expect(page.getByRole('combobox', { name: 'Atributo str', exact: true })).toHaveValue('14');
  await expect(page.getByRole('combobox', { name: 'Atributo dex', exact: true })).toHaveValue('13');
  await irEtapa(page, 'Revisão');
  const pendentes = page.getByRole('region', { name: 'Escolhas pendentes' });
  await expect(pendentes).toContainText('Confirme o equipamento inicial da classe.');
  await pendentes.getByRole('button', { name: 'Ir para Raça', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Raça' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/Rascunho incompleto salvo/)).toBeVisible();
  await expect(etapasNav(page)).toBeVisible();
  await expectNoHorizontalOverflow(page); await expectSingleScroll(page); await expectInsidePanel(page); await evidence(page, info, 'guerreiro');
});

test('equipamentos iniciais: confirmados uma vez, vão para o inventário da ficha', async ({ page }, info) => {
  await startCreator(page); await completarGuerreira(page);
  await expect(page.getByRole('button', { name: 'Confirmar equipamentos SRD 2014' })).toHaveCount(0);   // não há como conceder de novo
  await salvarParaFicha(page);
  await abaDaFicha(page, 'Inventário').click();
  const inventario = page.getByRole('region', { name: 'Inventário do personagem' });
  await expect(inventario.getByRole('button', { name: 'Detalhes de Arco longo', exact: true })).toBeVisible();
  await expect(inventario.getByRole('button', { name: 'Detalhes de Armadura de couro', exact: true })).toBeVisible();
  await expect(inventario.getByRole('button', { name: 'Detalhes de Cota de malha', exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page); await expectSingleScroll(page); await evidence(page, info, 'equipamento-inventario');
});

test('inventário da ficha: adicionar, alterar quantidade, consultar no Compêndio, usar e excluir com confirmação', async ({ page }, info) => {
  await startCreator(page); await completarGuerreira(page); await salvarParaFicha(page);
  await abaDaFicha(page, 'Inventário').click();
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Adicionar item do catálogo' }).fill('adaga');
  await page.getByRole('button', { name: 'Adicionar Adaga', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar adição' }).click();
  const linha = page.getByRole('listitem', { name: 'Adaga', exact: true });
  await expect(linha).toContainText('×1');
  await acaoDoItem(page, 'Adaga', 'Alterar quantidade');
  await page.getByRole('dialog').getByRole('spinbutton', { name: 'Quantidade' }).fill('3');
  await page.getByRole('button', { name: 'Salvar quantidade' }).click();
  await expect(linha).toContainText('×3');
  // grade: cartões quadrados e alinhados
  await page.getByRole('button', { name: 'Ver em grade', exact: true }).click();
  const medidas = await page.locator('.ficha-itens.grade .item-cartao').evaluateAll(l => l.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  expect(medidas.length).toBeGreaterThan(3);
  for (const [w, h] of medidas) { expect(Math.abs(w - h)).toBeLessThanOrEqual(1); expect(w).toBe(medidas[0][0]); }
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'inventario-grade');
  await page.getByRole('button', { name: 'Adicionar item', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Adicionar item do catálogo' }).fill('poção de cura');
  await page.getByRole('button', { name: /^Adicionar Poção de cura$/i }).click();
  await page.getByRole('button', { name: 'Fechar adição' }).click();
  const pocao = (await page.getByRole('listitem', { name: /^poção de cura$/i }).getAttribute('aria-label'))!;
  await acaoDoItem(page, pocao, 'Usar');
  await expect(page.getByRole('button', { name: 'Usar e curar' })).toBeDisabled();
  await page.getByRole('dialog').getByRole('spinbutton').fill('6');
  await page.getByRole('button', { name: 'Usar e curar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('listitem', { name: pocao, exact: true })).toHaveCount(0);
  await acaoDoItem(page, 'Adaga', 'Excluir');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(linha).toBeVisible();
  await acaoDoItem(page, 'Adaga', 'Excluir');
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(linha).toHaveCount(0);
  await expect(page.getByTestId('estado-salvamento')).toHaveText('Tudo salvo.');
  await acaoDoItem(page, 'Arco longo', 'Ver detalhes');
  await page.getByRole('button', { name: 'Abrir no Compêndio: Arco longo' }).click();
  await expect(page.getByRole('heading', { name: 'Arco longo', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'item-compendio');
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

test('alterações não salvas: salvar pelo diálogo, reabrir e cancelar a edição volta à ficha', async ({ page }) => {
  await startCreator(page); await chooseFighter(page); await leaveCreator(page);
  await page.getByRole('alertdialog', { name: 'Alterações não salvas', exact: true }).getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await page.getByRole('button', { name: /^Guerreira E2E/ }).click();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
  await openEditor(page);
  await expect(nameField(page)).toHaveValue('Guerreira E2E');
  await irEtapa(page, 'Classe e nível');
  await expect(page.getByRole('group', { name: /^Proficiências de Guerreiro/ }).getByRole('checkbox', { name: 'Atletismo', exact: true })).toBeChecked();
  await expect(page.getByText('Alterações não salvas.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
  // o botão Voltar do navegador também sai da edição
  await openEditor(page); await page.goBack();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
});

test('subir de nível: fluxo próprio com comparação, sem refazer a criação', async ({ page }, info) => {
  await startCreator(page); await completarGuerreira(page); await salvarParaFicha(page);
  await page.getByRole('button', { name: 'Subir de nível', exact: true }).click();
  const passos = page.getByRole('navigation', { name: 'Etapas da subida de nível' });
  await expect(passos).toBeVisible();
  await expect(etapasNav(page)).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Nível 2' })).toBeVisible();
  await evidence(page, info, 'subir-nivel-inicio');
  const ir = async (nome: string) => {
    const compacto = passos.getByRole('combobox');
    if (await compacto.isVisible()) await compacto.selectOption({ label: (await compacto.locator('option').allTextContents()).find(t => t.startsWith(nome))! });
    else await passos.getByRole('button', { name: new RegExp('^' + nome) }).click();
  };
  await ir('Revisão');
  await expect(page.getByRole('table')).toContainText('PV máximos');
  await expectNoHorizontalOverflow(page); await expectSingleScroll(page); await evidence(page, info, 'subir-nivel-revisao');
  await page.getByRole('button', { name: 'Confirmar nível 2', exact: true }).click();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Nível 2' })).toBeVisible();
});

test('teclado: identidade em ordem e etapas ativadas sem mouse', async ({ page }, info) => {
  await startCreator(page);
  await nameField(page).focus(); await page.keyboard.type('Teclado E2E');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Alcunha', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Arquivo do retrato')).toBeFocused();   // o envio de retrato funciona sem mouse
  await page.keyboard.press('Tab');
  await expect(page.locator('.campo-retrato summary')).toBeFocused();
  if (!isMobile(page) && await etapasNav(page).getByRole('combobox').isHidden()) {
    await keyboardActivate(page, etapasNav(page).getByRole('button', { name: /^Raça/ }));
    await keyboardActivate(page, page.getByRole('radio', { name: /^Humano/ }));
    await expect(page.getByRole('radio', { name: /^Humano/ })).toHaveAttribute('aria-checked', 'true');
  } else {
    await etapasNav(page).getByRole('combobox').focus(); await expect(etapasNav(page).getByRole('combobox')).toBeFocused();
  }
  await evidence(page, info, 'teclado');
});

test('menus continuam preservando a posição do criador', async ({ page }) => {
  await startCreator(page); await nameField(page).fill('Posição E2E'); await irEtapa(page, 'Origem');
  if (!isMobile(page)) {
    await navigate(page, 'Diário');
    await page.getByRole('tab').filter({ hasText: 'Novo personagem' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Origem' })).toBeVisible();
  }
  await equip(page);
});
