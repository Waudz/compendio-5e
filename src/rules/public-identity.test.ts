import {describe,expect,it} from 'vitest';
import {defaultPublicIdentity,isPublicIdentity,presentation,publicIdentityCard} from './public-identity';

describe('identidade pública do personagem',()=>{
 const source={name:'Elyra Voss',alias:'A Andarilha',race:'Tiefling',characterClass:'Feiticeira',portrait:'https://exemplo.com/r.png',level:'9',hp:72,inventory:['secret']};
 it('por padrão usa os campos públicos da ficha (inclusive o nível) e o mesmo retrato, sem PV ou inventário',()=>{
  const card=publicIdentityCard(defaultPublicIdentity(),source);
  expect(card).toEqual({name:'Elyra Voss',alias:'A Andarilha',race:'Tiefling',characterClass:'Feiticeira',level:'9',description:'',imageUrl:'https://exemplo.com/r.png'});
  expect(JSON.stringify(card)).not.toMatch(/hp|inventory|secret/);
 });
 it('campo não personalizado acompanha a ficha; o personalizado permanece',()=>{
  const identity={...defaultPublicIdentity(),name:{mode:'custom' as const,value:'A Viajante'}};
  const card=publicIdentityCard(identity,{...source,name:'Outro Nome',alias:'Nova alcunha'});
  expect(card.name).toBe('A Viajante');
  expect(card.alias).toBe('Nova alcunha');
 });
 it('campo oculto ou personalizado vazio não revela o valor verdadeiro',()=>{
  const card=publicIdentityCard({...defaultPublicIdentity(),name:{mode:'custom',value:'  '},alias:{mode:'hidden'},race:{mode:'hidden'}},source);
  expect(card).toMatchObject({name:null,alias:null,race:null});
  expect(JSON.stringify(card)).not.toMatch(/Elyra|Andarilha|Tiefling/);
 });
 it('mostra nome com alcunha, ou só um deles',()=>{
  expect(presentation({name:'Thorin',alias:'O Escudo'})).toEqual({nome:'Thorin',alcunha:'O Escudo'});
  expect(presentation({name:'Thorin',alias:null})).toEqual({nome:'Thorin',alcunha:null});
  expect(presentation({name:null,alias:'O Escudo'})).toEqual({nome:'O Escudo',alcunha:null});
  expect(presentation({name:null,alias:null}).nome).toBe('Identidade desconhecida');
 });
 it('recusa formatos desconhecidos',()=>{
  expect(isPublicIdentity(defaultPublicIdentity())).toBe(true);
  expect(isPublicIdentity({title:1})).toBe(false);
  expect(isPublicIdentity({...defaultPublicIdentity(),race:{mode:'real'}})).toBe(false);
 });
});
