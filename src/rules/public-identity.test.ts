import {describe,expect,it} from 'vitest';
import {defaultPublicIdentity,publicIdentityCard} from './public-identity';

describe('public character identity',()=>{
 const source={name:'Elyra',surname:'Voss',race:'Tiefling',characterClass:'Sorcerer',level:9,hp:72,inventory:['secret']};
 it('defaults to public name/race/class but never exposes level, HP or inventory',()=>{
  const card=publicIdentityCard(defaultPublicIdentity(),source);
  expect(card).toMatchObject({name:'Elyra',surname:'Voss',race:'Tiefling',characterClass:'Sorcerer'});
  expect(JSON.stringify(card)).not.toMatch(/level|hp|inventory|secret/);
 });
 it('allows an alias, title and independent concealment of surname and class',()=>{
  const card=publicIdentityCard({...defaultPublicIdentity(),
   title:'Herdeira das Sombras',
   name:{mode:'custom',customValue:'A Viajante'},
   surname:{mode:'hidden'},
   race:{mode:'custom',customValue:'Humana'},
   characterClass:{mode:'hidden'},
   description:'Uma figura envolta em mistério.'
  },source);
  expect(card).toEqual({imageUrl:null,title:'Herdeira das Sombras',
   name:'A Viajante',surname:null,race:'Humana',characterClass:null,
   description:'Uma figura envolta em mistério.'});
 });
 it('does not fall back to real values for an empty custom field',()=>{
  const card=publicIdentityCard({...defaultPublicIdentity(),name:{mode:'custom',customValue:'  '}},source);
  expect(card.name).toBeNull();
 });
});
