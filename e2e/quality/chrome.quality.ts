import { test, expect, openDemo, navigate, mobile } from './helpers';

test('barras mobile não interceptam o criador e liberam o espaço ao ocultar', async ({page},info)=>{
 await openDemo(page,'jogador'); await navigate(page,'Personagens');
 await page.getByRole('button',{name:/Criar personagem/}).click();
 await expect(page.getByRole('textbox',{name:'Nome do personagem',exact:true})).toBeVisible();
 const creator=page.locator('.content.criador.auth.wide');
 if(!mobile(page)){
   const panel=page.locator('.flexlayout__tab:visible').filter({has:creator});
   const a=await creator.boundingBox(),b=await panel.boundingBox();
   expect(a).not.toBeNull();expect(b).not.toBeNull();expect(Math.abs(a!.width-b!.width)).toBeLessThanOrEqual(2);
   return;
 }
 const root=page.locator('.mobile-simple'), screen=page.locator('.mobile-screen');
 const top=page.locator('.mobile-topbar'), bottom=page.locator('.mobile-bottom-nav');
 const bounds=async()=>({root:(await root.boundingBox())!,screen:(await screen.boundingBox())!,top:(await top.boundingBox())!,bottom:(await bottom.boundingBox())!});
 await expect.poll(async()=>{const b=await bounds();return Math.abs(b.screen.y-b.top.y-b.top.height)+Math.abs(b.bottom.y-b.screen.y-b.screen.height);}).toBeLessThanOrEqual(2);
 // a primeira etapa (Identidade) é curta; a de Raça tem rolagem para exercitar as barras
 const etapas=page.getByRole('navigation',{name:'Etapas do personagem'});
 if(await etapas.getByRole('combobox').isVisible()) await etapas.getByRole('combobox').selectOption('raca');
 else await etapas.getByRole('button',{name:/^Raça/}).click();
 await expect(page.getByRole('radiogroup',{name:'Raça'})).toBeVisible();
 await screen.evaluate(el=>{el.scrollTop=0;});
 await page.getByRole('heading',{name:'Novo personagem',exact:true}).click();
 await screen.hover(); await page.mouse.wheel(0,200);
 await expect.poll(()=>screen.evaluate(el=>el.scrollTop)).toBeGreaterThan(48);
 await page.mouse.wheel(0,200);
 await expect(page.locator('.app')).toHaveClass(/chrome-hidden/);
 await expect.poll(async()=>{const b=await bounds();return Math.abs(b.root.height-b.screen.height)+Math.abs(b.root.y-b.screen.y);}).toBeLessThanOrEqual(2);
 await expect(top).toBeHidden(); await expect(bottom).toBeHidden();
 // Um frame posterior confirma que o redimensionamento não reexibe as barras sozinho.
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await expect(page.locator('.app')).toHaveClass(/chrome-hidden/);
 await page.mouse.wheel(0,-160);
 await expect(page.locator('.app')).not.toHaveClass(/chrome-hidden/);
 await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeVisible();
 await info.attach('barras-mobile-restauradas',{body:await page.screenshot(),contentType:'image/png'});
});
