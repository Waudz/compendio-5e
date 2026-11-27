import {it,expect,vi} from 'vitest';
import {apiDePrevia} from './apiDePrevia';
import type {CodexApi,Conhecimento} from './conhecimento';
const row=(id:string,visible:boolean):Conhecimento=>({id,visible,version:1,category:'npc',systemId:'dnd5e-2014',title:'NOME REAL',secret:'SEGREDO',characterSheet:true});
it('título, imagem, campos e vínculos vêm da projeção do servidor; ocultos não entram na contagem',async()=>{
 const preview=vi.fn(async(_cid:string,id:string)=>({entry:{...row(id,true),title:'O Corvo',secret:undefined,characterSheet:undefined},links:[]}));
 const api={list:async()=>[row('visivel',true),row('oculto',false)],preview} as unknown as CodexApi;
 const publicApi=apiDePrevia(api),items=await publicApi.list('c');
 expect(items).toHaveLength(1);expect(items[0].title).toBe('O Corvo');expect(JSON.stringify(items)).not.toMatch(/NOME REAL|SEGREDO|oculto/);
 expect(preview).toHaveBeenCalledTimes(1);expect(preview).toHaveBeenCalledWith('c','visivel');
 expect(await publicApi.links('c','visivel')).toEqual([]);
});
it('nenhuma mutação, notificação ou definição privada do mestre é reutilizada na prévia',async()=>{
 const save=vi.fn(),api=apiDePrevia({save} as unknown as CodexApi);
 await expect(api.save('c',null,0,{category:'npc',systemId:'dnd5e-2014',title:'x'})).rejects.toThrow(/somente leitura/);
 await expect(api.unlink('c','x')).rejects.toThrow(/somente leitura/);expect(save).not.toHaveBeenCalled();
 expect(await api.feed('c')).toEqual({items:[],unread:0,discoveries:0});expect(await api.definitions?.('c')).toEqual([]);expect(await api.holders('c','x')).toEqual([]);
});
