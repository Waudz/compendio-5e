import {describe,it,expect} from 'vitest';
import {createModel,findTab,groupCount} from './workspace';
import {visitPage,stepHistory,currentPage,historyOf} from './tabHistory';
import {saveLayout,loadLayout} from './persistence';
import {openContentLink,navigate} from './navigation';
describe('histórico independente por aba',()=>{
 it('navega sem criar grupo, volta/avança e corta somente o futuro da aba',()=>{
  const m=createModel(),id='secao:personagens';
  visitPage(m,id,{kind:'item',ref:'dagger',title:'Adaga'});
  navigate(m,{kind:'secao',ref:'compendio'});
  visitPage(m,'secao:compendio',{kind:'magia',ref:'light'});
  stepHistory(m,id,0); expect(currentPage(findTab(m,id)!)).toMatchObject({ref:'personagens'});
  expect(currentPage(findTab(m,'secao:compendio')!)).toMatchObject({ref:'light'});
  stepHistory(m,id,1);expect(findTab(m,id)!.getName()).toBe('Adaga');
  stepHistory(m,id,0);visitPage(m,id,{kind:'item',ref:'shield'});
  expect(historyOf(findTab(m,id)!).pages.map(p=>p.ref)).toEqual(['personagens','shield']);
  expect(groupCount(m)).toBe(1);
 });
 it('restaura IDs e índice sem persistir títulos secretos',()=>{
  const m=createModel(),id='secao:personagens';
  visitPage(m,id,{kind:'item',ref:'dagger',title:'Segredo'});
  let raw='';const store={setItem:(_k:string,v:string)=>{raw=v;},getItem:()=>raw};
  const scope={user:'u',campaign:'c',device:'d'};
  saveLayout(m.toJson(),scope,store);expect(raw).not.toContain('Segredo');
  const restored=createModel(loadLayout(scope,store));
  expect(currentPage(findTab(restored,id)!)).toEqual({kind:'item',ref:'dagger'});
  stepHistory(restored,id,0);expect(currentPage(findTab(restored,id)!).ref).toBe('personagens');
 });
 it('usa o grupo oposto da origem em abertura explícita, sem terceiro grupo',()=>{
  const m=createModel();openContentLink(m,{kind:'item',ref:'dagger'},'secao:personagens');
  openContentLink(m,{kind:'magia',ref:'light'},'item:dagger');
  expect(groupCount(m)).toBe(2);
  expect(findTab(m,'magia:light')!.getParent()).toBe(findTab(m,'secao:personagens')!.getParent());
 });
});
it('histórico inválido não é restaurado e a nova aba não duplica registro em uso',()=>{
 const m=createModel();visitPage(m,'secao:personagens',{kind:'item',ref:'dagger'});
 navigate(m,{kind:'secao',ref:'personagens'});
 expect(findTab(m,'secao:personagens~2')).toBeTruthy();
 expect(currentPage(findTab(m,'secao:personagens')!).ref).toBe('dagger');
});
