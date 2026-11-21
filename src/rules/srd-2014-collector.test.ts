import {describe,expect,it,vi} from 'vitest';
import {collectSrd2014Collection,type SrdFetch} from './srd-2014-collector';
const response=(value:unknown,status=200)=>({ok:status===200,status,json:async()=>value});
const index={count:2,results:[{index:'fighter'},{index:'barbarian'}]};
const fighter={index:'fighter',name:'Fighter',desc:['Martial class'],hit_die:10};
const barbarian={index:'barbarian',name:'Barbarian',desc:['Raging class'],hit_die:12};
const now='2026-11-20T16:00:00Z';
describe('controlled SRD 2014 collection',()=>{
 it('fetches versioned index and every detail before staging',async()=>{
  const fetcher=vi.fn(async(url:string)=>{
   if(url.endsWith('/classes'))return response(index);
   if(url.endsWith('/fighter'))return response(fighter);
   if(url.endsWith('/barbarian'))return response(barbarian);
   throw new Error('Unexpected URL: '+url);
  });
  const result=await collectSrd2014Collection('classes',fetcher,now);
  expect(result.records.map(r=>r.index)).toEqual(['fighter','barbarian']);
  expect(result.records.every(r=>r.reviewed===false)).toBe(true);
  expect(result.expectedCount).toBe(2);
  expect(fetcher.mock.calls.map(c=>c[0])).toEqual([
   'https://www.dnd5eapi.co/api/2014/classes',
   'https://www.dnd5eapi.co/api/2014/classes/fighter',
   'https://www.dnd5eapi.co/api/2014/classes/barbarian']);
 });
 it('rejects incomplete indices instead of silently importing partial data',async()=>{
  const fetcher:SrdFetch=async()=>response({count:3,results:[{index:'fighter'}]});
  await expect(collectSrd2014Collection('classes',fetcher,now)).rejects.toThrow('Incomplete');
 });
 it('rejects duplicate indices and failed detail requests',async()=>{
  const duplicates:SrdFetch=async()=>response({count:2,results:[{index:'fighter'},{index:'fighter'}]});
  await expect(collectSrd2014Collection('classes',duplicates,now)).rejects.toThrow('Duplicate');
  const failure:SrdFetch=async url=>response(url.endsWith('/classes')?{count:1,results:[{index:'fighter'}]}:{},url.endsWith('/classes')?200:503);
  await expect(collectSrd2014Collection('classes',failure,now)).rejects.toThrow('503');
 });
 it('rejects unversioned or unknown collections before requesting',async()=>{
  const fetcher=vi.fn(async()=>response(index));
  await expect(collectSrd2014Collection('unknown' as 'classes',fetcher,now)).rejects.toThrow('Invalid');
  expect(fetcher).not.toHaveBeenCalled();
 });
});
