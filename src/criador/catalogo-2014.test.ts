import {it,expect} from 'vitest';
import {todasAsMagias,itemPorId} from '../catalogue/contratos';
import {spells2014,canonicalItem2014} from './regras-2014';

it('mantém os IDs, círculos e listas de classe do snapshot de personagem compatíveis com o contrato público 2014', async()=>{
 const canonical=await todasAsMagias();
 expect(spells2014).toHaveLength(canonical.length);
 const byId=new Map(canonical.map(m=>[m.id,m]));
 for(const spell of spells2014){const m=byId.get(spell.id);expect(m,spell.id).toBeDefined();expect(spell.level,spell.id).toBe(m!.nivel);expect([...spell.classes].sort(),spell.id).toEqual([...m!.classes].sort());}
 expect(itemPorId(canonicalItem2014('srd51:item/longsword'))?.en).toBe('Longsword');
});
