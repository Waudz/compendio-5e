import {describe,expect,it} from 'vitest';
import {encyclopediaPage,type EncyclopediaIndexedEntry} from './encyclopedia-query';
const actor={campaignId:'camp-a',role:'player' as const,isActiveMember:true};
const base:EncyclopediaIndexedEntry={id:'a',campaignId:'camp-a',kind:'character',visibility:'hidden',name:'Segredo',summary:'Mistério',publicDescription:'Revelação',masterNotes:'Plano oculto',mechanics:{hp:99},deletedAt:null,deletedBy:null};
describe('encyclopedia safe query',()=>{
 it('filters hidden entries before pagination and total',()=>{
  const records=[base,{...base,id:'b',visibility:'summary' as const,name:'Élena'},{...base,id:'c',visibility:'full' as const,name:'Érico'}];
  const page=encyclopediaPage(actor,records,{offset:0,limit:1});
  expect(page.total).toBe(2);
  expect(page.items.map(x=>x.id)).toEqual(['b']);
  expect(JSON.stringify(page)).not.toMatch(/Plano oculto|hp|Segredo/);
 });
 it('searches visible entries with accent insensitive matching',()=>{
  const records=[{...base,visibility:'summary' as const,name:'Élena'}];
  expect(encyclopediaPage(actor,records,{offset:0,limit:10,query:'elena'}).total).toBe(1);
 });
 it('never exposes trashed records to players even when includeTrash is requested',()=>{
  const records=[{...base,visibility:'full' as const,deletedAt:'2026-11-20T00:00:00Z',deletedBy:'dm'}];
  expect(encyclopediaPage(actor,records,{offset:0,limit:10,includeTrash:true}).total).toBe(0);
  expect(encyclopediaPage({...actor,role:'master'},records,{offset:0,limit:10,includeTrash:true}).total).toBe(1);
 });
 it('denies access for former members and masters of other campaigns',()=>{
  const records=[{...base,visibility:'full' as const}];
  expect(encyclopediaPage({...actor,isActiveMember:false},records,{offset:0,limit:10}).total).toBe(0);
  expect(encyclopediaPage({...actor,role:'master',campaignId:'camp-b'},records,{offset:0,limit:10}).total).toBe(0);
 });
 it('validates pagination bounds',()=>{
  expect(()=>encyclopediaPage(actor,[base],{offset:-1,limit:10})).toThrow();
  expect(()=>encyclopediaPage(actor,[base],{offset:0,limit:101})).toThrow();
 });
});

describe('encyclopedia query cannot search undisclosed descriptions',()=>{
 it('does not find summary entries by a private full-description keyword',()=>{
  const summary={...base,visibility:'summary' as const,name:'Ferreiro',summary:'Artesão',publicDescription:'Senha secreta do portal'};
  expect(encyclopediaPage(actor,[summary],{offset:0,limit:10,query:'portal'}).total).toBe(0);
  expect(encyclopediaPage(actor,[summary],{offset:0,limit:10,query:'ferreiro'}).total).toBe(1);
  expect(JSON.stringify(encyclopediaPage(actor,[summary],{offset:0,limit:10}))).not.toContain('portal');
 });
 it('does not allow players to search master notes even on full entries',()=>{
  const full={...base,visibility:'full' as const,name:'Ferreiro',summary:'Artesão',masterNotes:'Senha rubra'};
  expect(encyclopediaPage(actor,[full],{offset:0,limit:10,query:'rubra'}).total).toBe(0);
 });
});
