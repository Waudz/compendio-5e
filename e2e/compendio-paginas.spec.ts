import AxeBuilder from '@axe-core/playwright';
import {test,expect,openDemo,navigate,expectNoHorizontalOverflow} from './fixtures';
import type {Page,Locator} from '@playwright/test';
// o contador de novidades entra no mesmo título: o cartão é achado pelo começo do nome acessível
const portal=(page:Page,name:string)=>page.locator('.compendio-portal').and(page.getByRole('button',{name:new RegExp('^'+name+' ')}));
/** Volta como outro usuário depois da primeira visita: a área de trabalho de cada um é restaurada onde estava (por isso não vale `openDemo`, que exige o Início). */
async function reabrir(page:Page,role:'mestre'|'jogador'){await page.goto(`?demo=${role}`);await expect(page.getByRole('navigation',{name:/^(Menu principal|Navegação mobile)$/})).toBeVisible();}
async function home(page:Page){await navigate(page,'Compêndio');if(await page.locator('.cd-page:not(.cd-home)').filter({visible:true}).count())await page.getByRole('button',{name:(page.viewportSize()?.width??1440)<=700?'Voltar':'Voltar na aba',exact:true}).click();}
async function campaign(page:Page){const tab=page.getByRole('group',{name:'Áreas do Compêndio'}).getByRole('button',{name:'Campanha',exact:true});if(await tab.count())await tab.click();}
async function create(page:Page,category:string,title:string,publish=true,secret=''){
 await home(page);await campaign(page);await portal(page,category).click();if(category==='Personagens'){await page.getByRole('button',{name:'Criar',exact:true}).click();await page.getByRole('menuitem',{name:'Criar NPC',exact:true}).click();}else await page.getByRole('button',{name:'Novo registro',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Novo registro',exact:true});await form.getByRole('textbox',{name:'Nome',exact:true}).fill(title);await form.getByRole('textbox',{name:'Descrição compartilhada',exact:true}).fill('Descrição pública de '+title);await form.getByRole('textbox',{name:'Notas privadas do mestre',exact:true}).fill(secret);await form.getByRole('button',{name:'Salvar',exact:true}).click();await expect(form).toBeHidden();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 if(publish)await revealAll(page.locator('.cd-record-page').filter({has:page.getByRole('heading',{name:title,exact:true})}));
}
async function revealAll(record:Locator){await record.getByRole('button',{name:'Mais ações do registro'}).click();await record.getByRole('menuitem',{name:'Gerenciar conhecimento',exact:true}).click();await record.getByRole('button',{name:'Revelar tudo',exact:true}).click();await record.getByRole('button',{name:'Salvar conhecimento',exact:true}).click();await expect(record.getByRole('button',{name:'Mais ações do registro',exact:true})).toBeVisible();}
/** Sai de uma consulta aberta pela lista: no computador é a carta; no celular, uma página. */
async function sairDaConsulta(page:Page){if((page.viewportSize()?.width??0)<=700)await page.getByRole('button',{name:'Voltar',exact:true}).click();else await page.getByRole('button',{name:'Fechar consulta',exact:true}).click();}

test('largura do painel: duas áreas largas, abas em dois grupos e no celular',async({page},info)=>{
 await openDemo(page,'mestre');await navigate(page,'Compêndio');const root=page.locator('.cd-home');await expect(root).toBeVisible();
 const width=await root.evaluate(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight));
 await expect(root).toHaveAttribute('data-wide',String(width>=760));
 if(width>=760){const a=await page.getByRole('region',{name:'Campanha',exact:true}).boundingBox(),b=await page.getByRole('region',{name:'Regras',exact:true}).boundingBox();expect(a!.x).toBeLessThan(b!.x);expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);}
 else {await page.getByRole('button',{name:'Regras',exact:true}).click();await expect(portal(page,'Magias')).toBeVisible();}
 if((page.viewportSize()?.width??0)>700){await page.locator('.flexlayout__tab_button_content').filter({hasText:/^Compêndio$/}).first().click({button:'right'});await page.getByRole('menuitem',{name:'Abrir em nova coluna à direita',exact:true}).click();await expect(page.locator('.flexlayout__tabset')).toHaveCount(2);await expect(root).toHaveAttribute('data-wide','false');await expect(page.getByRole('group',{name:'Áreas do Compêndio'})).toBeVisible();
  // com dois grupos, a carta fica centralizada e contida no grupo em que foi aberta; o outro continua utilizável
  const grupo=page.locator('.carta-host').filter({has:page.getByRole('searchbox',{name:'Pesquisar em todo o Compêndio'})}).last();
  await grupo.getByRole('searchbox',{name:'Pesquisar em todo o Compêndio'}).fill('rapieira');await grupo.locator('.cd-result').filter({hasText:'Rapieira'}).first().click();
  const carta=grupo.getByRole('dialog',{name:'Consulta do Compêndio'});await expect(carta.getByRole('heading',{name:'Rapieira',exact:true})).toBeVisible();
  const g=(await grupo.boundingBox())!,c=(await carta.boundingBox())!;
  expect(c.x).toBeGreaterThanOrEqual(g.x);expect(c.x+c.width).toBeLessThanOrEqual(g.x+g.width+1);expect(c.y+c.height).toBeLessThanOrEqual(g.y+g.height+1);
  expect(Math.abs((c.x-g.x)-(g.x+g.width-c.x-c.width))).toBeLessThan(3);expect(c.width).toBeLessThanOrEqual(622);
  await expect(page.getByRole('dialog',{name:'Consulta do Compêndio'})).toHaveCount(1);
  await carta.getByRole('button',{name:'Fechar consulta'}).click();await expect(carta).toBeHidden();await expect(grupo.getByRole('searchbox',{name:'Pesquisar em todo o Compêndio'})).toHaveValue('rapieira');}
 await expectNoHorizontalOverflow(page);await info.attach('home-por-painel',{body:await page.screenshot(),contentType:'image/png'});
});

test('pesquisa global ignora acentos, abre página própria e mantém consulta ao retornar',async({page})=>{
 await openDemo(page,'mestre');await create(page,'Locais','Julkoun');
 // O registro recém-criado não fica selecionado em outra aba: esta prova é do retorno da consulta.
 if((page.viewportSize()?.width??0)<=700)await page.getByRole('button',{name:'Voltar',exact:true}).click();
 else await page.getByRole('button',{name:'Voltar na aba',exact:true}).click();
 await home(page);
 const rules=page.getByRole('group',{name:'Áreas do Compêndio'}).getByRole('button',{name:'Regras',exact:true});if(await rules.count())await rules.click();
 const search=page.getByRole('searchbox',{name:'Pesquisar em todo o Compêndio',exact:true});await search.fill('JÚLKOÙN');await expect(page.getByRole('heading',{name:'Campanha · Locais',exact:true})).toBeVisible();await page.locator('.cd-result').filter({hasText:'Julkoun'}).click();await expect(page.getByRole('heading',{name:'Julkoun',exact:true})).toBeVisible();
 await sairDaConsulta(page);
 await expect(search).toHaveValue('JÚLKOÙN');await search.fill('rapieira');await expect(page.getByRole('heading',{name:'Regras · Itens',exact:true})).toBeVisible();await expect(page.locator('.cd-result').filter({hasText:'Rapieira'})).toBeVisible();await expectNoHorizontalOverflow(page);
});

test('NPC narrativo, vínculos bidirecionais, segredo e notificações por usuário',async({page},info)=>{
 test.setTimeout(60000);
 await openDemo(page,'mestre');await create(page,'Personagens','Aldren',false,'SEGREDO DO MESTRE');await create(page,'Locais','Julkoun');
 await page.getByRole('button',{name:'Mais ações do registro'}).click();await page.getByRole('menuitem',{name:'Editar registro',exact:true}).click();const editorDoLocal=page.getByRole('dialog',{name:'Editar registro',exact:true});await editorDoLocal.getByRole('button',{name:'Vincular registro',exact:true}).click();const link=editorDoLocal.getByRole('group',{name:'Vincular registro',exact:true});await link.getByRole('searchbox',{name:'Pesquisar registro',exact:true}).fill('ÁLDRÉN');await link.getByRole('list',{name:'Resultados de registros'}).getByRole('button',{name:'Aldren NPC',exact:true}).click();await link.getByRole('combobox',{name:'Tipo de relação',exact:true}).selectOption({label:'Habitante'});await link.getByRole('checkbox',{name:'Revelar este vínculo aos jogadores'}).check();await link.getByRole('button',{name:'Vincular',exact:true}).click();await expect(link).toBeHidden();await editorDoLocal.getByRole('button',{name:'Salvar',exact:true}).click();await expect(editorDoLocal).toBeHidden();
 const current=page.locator('.cd-record-page').filter({has:page.getByRole('heading',{name:'Julkoun',exact:true})});const habitantes=current.getByRole('region',{name:'Registros relacionados',exact:true});await expect(habitantes.getByRole('button',{name:/^Aldren Habitante/})).toBeVisible();
 await reabrir(page,'jogador');await navigate(page,'Compêndio');await campaign(page);await portal(page,'Locais').click();await page.locator('.cd-card-main').filter({hasText:'Julkoun'}).click();await expect(page.getByRole('heading',{name:'Julkoun',exact:true})).toBeVisible();await expect(page.getByText('SEGREDO DO MESTRE',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/^Aldren(?: |$)/})).toHaveCount(0);
 await reabrir(page,'mestre');await navigate(page,'Compêndio');await campaign(page);await portal(page,'Personagens').click();if(await page.getByRole('combobox',{name:'Filtrar registros'}).isVisible())await page.getByRole('combobox',{name:'Filtrar registros'}).selectOption('NPCs');else await page.getByRole('button',{name:'NPCs',exact:true}).click();await page.locator('.cd-card-main').filter({hasText:'Aldren'}).click();const npc=page.locator('.cd-record-page').filter({has:page.getByRole('heading',{name:'Aldren',exact:true})});await expect(npc.getByRole('region',{name:'Registros relacionados'}).getByRole('button',{name:/^Julkoun Reside em/})).toBeVisible();await expect(npc.getByRole('heading',{name:'Registros relacionados',exact:true})).toHaveCount(1);await revealAll(npc);
 await create(page,'Descobertas','Carta de Dain');await reabrir(page,'jogador');await navigate(page,'Compêndio');await campaign(page);await expect(portal(page,'Descobertas').locator('.cd-badge')).toHaveText('1 novidade');await page.getByRole('button',{name:/^Notificações,/}).filter({visible:true}).click();const notices=page.getByRole('dialog',{name:'Notificações',exact:true});await notices.locator('.cd-notice-link').filter({hasText:'Carta de Dain'}).click();await expect(page.getByRole('heading',{name:'Carta de Dain',exact:true})).toBeVisible();await page.reload();await navigate(page,'Compêndio');await campaign(page);await expect(portal(page,'Descobertas').locator('.cd-badge')).toHaveCount(0);await expectNoHorizontalOverflow(page);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);await info.attach('compendio-final',{body:await page.screenshot(),contentType:'image/png'});
});


test('marcar todas como lidas persiste após recarregar e atualiza Descobertas',async({page},info)=>{
 await openDemo(page,'mestre');await create(page,'Descobertas','Carta um');await create(page,'Descobertas','Carta dois');
 await reabrir(page,'jogador');await navigate(page,'Compêndio');await campaign(page);
 await expect(portal(page,'Descobertas').locator('.cd-badge')).toHaveText('2 novidades');
 await page.getByRole('button',{name:/^Notificações,/}).filter({visible:true}).click();
 const dialog=page.getByRole('dialog',{name:'Notificações',exact:true});
 await dialog.getByRole('button',{name:'Marcar todas como lidas',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Marcar todas como lidas',exact:true})).toHaveCount(0);
 await expect(dialog.getByText(/^Lida ·/)).toHaveCount(2);
 await info.attach('notificacoes-lidas',{body:await page.screenshot(),contentType:'image/png'});
 await page.reload();await navigate(page,'Compêndio');await campaign(page);
 await expect(portal(page,'Descobertas').locator('.cd-badge')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Notificações',exact:true}).filter({visible:true})).toBeVisible();
 await expectNoHorizontalOverflow(page);
});
