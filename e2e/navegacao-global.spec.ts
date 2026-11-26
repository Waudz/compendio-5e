import {test,expect,openDemo,navigate} from './fixtures';
import type {Page} from '@playwright/test';
const desktop=(page:Page)=>(page.viewportSize()?.width??0)>700;
async function itens(page:Page){
 await openDemo(page);await navigate(page,'Compêndio');
 const regras=page.getByRole('group',{name:'Áreas do Compêndio'}).getByRole('button',{name:'Regras',exact:true});
 if(await regras.count())await regras.click();
 await page.getByRole('button',{name:/^Itens /}).click();
 await page.getByRole('searchbox',{name:'Pesquisar no Compêndio'}).fill('adaga');
}
const adaga=(page:Page)=>page.locator('.cd-card-main').filter({hasText:/^Adaga/}).first();
test('consulta normal preserva grupo e retorna à pesquisa pelo navegador',async({page})=>{
 await itens(page);
 await adaga(page).click();await expect(page.getByRole('heading',{name:'Adaga',exact:true})).toBeVisible();
 if(desktop(page))await expect(page.locator('.flexlayout__tabset')).toHaveCount(1);
 await page.goBack();await expect(page.getByRole('searchbox',{name:'Pesquisar no Compêndio'})).toHaveValue('adaga');
 await page.goForward();await expect(page.getByRole('heading',{name:'Adaga',exact:true})).toBeVisible();
});
test('contexto na ordem aprovada, grupo explícito e recuperação da aba',async({page})=>{
 test.skip(!desktop(page),'Abas e grupos pertencem ao desktop.');
 await itens(page);await adaga(page).click({button:'right'});
 await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Abrir em nova aba','Abrir em novo grupo','Abrir']);
 await page.getByRole('menuitem',{name:'Abrir em novo grupo',exact:true}).click();
 await expect(page.locator('.flexlayout__tabset')).toHaveCount(2);
 await page.getByRole('tab',{name:/^Adaga/}).click({button:'right'});
 await page.getByRole('menuitem',{name:'Fechar aba',exact:true}).click();
 await page.getByRole('button',{name:'Reabrir aba fechada',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Adaga',exact:true})).toBeVisible();
 await expect(page.locator('.flexlayout__tabset')).toHaveCount(1);
});
test('Ctrl e botão do meio abrem aba no mesmo grupo',async({page})=>{
 test.skip(!desktop(page),'Gestos de mouse no desktop.');
 await itens(page);await adaga(page).click({modifiers:['Control']});
 await expect(page.getByRole('heading',{name:'Adaga',exact:true})).toBeVisible();
 await expect(page.locator('.flexlayout__tabset')).toHaveCount(1);
 await navigate(page,'Compêndio');await adaga(page).click({button:'middle'});
 await expect(page.getByRole('heading',{name:'Adaga',exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:/^Adaga/})).toHaveCount(1);
});
