import AxeBuilder from '@axe-core/playwright';
import {test,expect,openDemo,navigate,expectNoHorizontalOverflow} from './fixtures';
import type {Page} from '@playwright/test';
async function campanha(page:Page){await navigate(page,'Compêndio');const area=page.getByRole('button',{name:'Campanha',exact:true});if(await area.count())await area.click();}
async function menu(page:Page){await page.getByRole('button',{name:(page.viewportSize()?.width??1440)<=700?'Menu':'Abrir menu global',exact:true}).click();return page.getByRole('dialog',{name:'Menu de navegação'});}
async function criar(page:Page){
 await campanha(page);await page.getByRole('button',{name:/^Personagens /}).click();
 await page.getByRole('button',{name:'Criar',exact:true}).click();await page.getByRole('menuitem',{name:'Criar NPC',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Novo registro',exact:true});await expect(form).toBeFocused();
 await expect(form.getByRole('textbox',{name:'Nome',exact:true})).not.toBeFocused();
 await form.getByRole('textbox',{name:'Nome',exact:true}).fill('Varyn');await form.getByRole('textbox',{name:'Alcunha',exact:true}).fill('Mercador velado');
 await form.getByRole('textbox',{name:'Notas privadas do mestre'}).fill('SEGREDO INACESSIVEL');
 await expectNoHorizontalOverflow(page);
 return form;
}
test('formulário sem teclado automático, navegação única e cartões quadrados',async({page},info)=>{
 await openDemo(page);const form=await criar(page);await info.attach('formulario',{body:await page.screenshot({path:info.outputPath('formulario.png')}),contentType:'image/png'});
 await form.getByRole('button',{name:'Salvar',exact:true}).click();await expect(form).toBeHidden();await expect(page.getByRole('heading',{name:'Varyn',exact:true})).toBeVisible();
 if((page.viewportSize()?.width??1440)>700)await page.getByRole('button',{name:'Voltar na aba',exact:true}).click();else await page.getByRole('button',{name:'Voltar',exact:true}).click();
 const card=page.locator('.cd-card-main').filter({hasText:'Varyn'});await expect(card).toBeVisible();
 const box=await card.boundingBox();expect(box).not.toBeNull();expect(Math.abs(box!.height-box!.width)).toBeLessThanOrEqual(2);
 expect(await page.locator('.cd-page > .cd-back').count()).toBe(0);
 await expectNoHorizontalOverflow(page);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await info.attach('cartoes',{body:await page.screenshot({path:info.outputPath('cartoes.png')}),contentType:'image/png'});
});
test('prévia global mantém nome público em lista, carta e título da aba',async({page},info)=>{
 await openDemo(page);const form=await criar(page);await form.getByRole('button',{name:'Salvar',exact:true}).click();await expect(form).toBeHidden();
 await page.getByRole('button',{name:'Mais ações do registro'}).click();await page.getByRole('menuitem',{name:'Gerenciar conhecimento'}).click();
 await page.getByRole('switch',{name:'Registro conhecido'}).check();await page.getByRole('button',{name:'Revelar Alcunha',exact:true}).click();await page.getByRole('button',{name:'Salvar conhecimento'}).click();await expect(page.getByRole('button',{name:'Mais ações do registro'})).toBeVisible();
 await (await menu(page)).getByRole('button',{name:'Ver como jogador',exact:true}).click();
 await campanha(page);await page.getByRole('button',{name:/^Personagens /}).click();
 await expect(page.getByRole('button',{name:/^Mercador velado/})).toBeVisible();await expect(page.getByRole('button',{name:/^Varyn/})).toHaveCount(0);
 await page.locator('.cd-card-main').filter({hasText:'Mercador velado',visible:true}).click();await expect(page.getByRole('heading',{name:'Mercador velado',exact:true})).toBeVisible();
 await expect(page.locator('body')).not.toContainText('SEGREDO INACESSIVEL');await expect(page.getByRole('button',{name:'Mais ações do registro'})).toHaveCount(0);
 if((page.viewportSize()?.width??1440)>700)await page.getByRole('button',{name:'Expandir para página completa'}).click();
 await expect(page.locator((page.viewportSize()?.width??1440)>700?'.workspace-tab-title':'.mobile-page-title').filter({hasText:'Varyn'})).toHaveCount(0);
 await expectNoHorizontalOverflow(page);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 await info.attach('previa',{body:await page.screenshot({path:info.outputPath('previa.png')}),contentType:'image/png'});
 await (await menu(page)).getByRole('button',{name:'Voltar à visão de mestre'}).click();await expect(page.locator('.previa-global-indicador')).toHaveCount(0);
});
