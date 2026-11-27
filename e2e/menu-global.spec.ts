import {test, expect, openDemo} from './fixtures';
for (const role of ['mestre','jogador'] as const) {
  test(`menu global ${role}: ações por papel, foco, preferências e Sobre`, async ({page}) => {
    await openDemo(page, role);
    const mobile = (page.viewportSize()?.width ?? 1440) <= 700;
    const trigger = mobile
      ? page.getByRole('navigation',{name:'Navegação mobile'}).getByRole('button',{name:'Menu',exact:true})
      : page.getByRole('button',{name:'Abrir menu global',exact:true});
    if (mobile) await expect(page.locator('.mobile-topbar').getByRole('button',{name:'Abrir menu',exact:true})).toHaveCount(0);
    await trigger.click();
    const menu = page.getByRole('dialog',{name:'Menu de navegação'});
    await expect(menu).toBeVisible();
    const expected = role === 'mestre'
      ? ['Fechar menu','Ver como jogador','Gerenciar campanhas','Personagens','Diário','Encontros','Minha conta','Configurações','Sobre o Compêndio','Sair']
      : ['Fechar menu','Minhas campanhas','Meus personagens','Diário','Minha conta','Configurações','Sobre o Compêndio','Sair'];
    await expect(menu.getByRole('button')).toHaveText(expected.map(x => x === 'Fechar menu' ? '' : x));
    await expect(menu.locator('footer')).toContainText(/Compêndio \d+\.\d+\.\d+ · Alpha/);
    if (mobile) await expect(page.locator('.mobile-bottom-nav [aria-current="page"]')).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await menu.getByRole('button',{name:'Configurações',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Configurações',exact:true})).toBeVisible();
    await page.getByLabel('Tema neste aparelho').selectOption('claro');
    await expect(page.locator('html')).toHaveAttribute('data-tema','claro');
    await trigger.click(); await menu.getByRole('button',{name:'Sobre o Compêndio',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Sobre o Compêndio',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Repositório e documentação do projeto',exact:true})).toHaveAttribute('href','https://github.com/Waudz/compendio-5e');
  });
}
