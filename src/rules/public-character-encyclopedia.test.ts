import {describe,expect,it} from 'vitest';
import {createPublicCharacterEntry,updatePublicCharacterIdentity} from './public-character-encyclopedia';
import {defaultPublicIdentity} from './public-identity';

describe('public character encyclopedia projection',()=>{
 const privateSource={
  name:'Elyra',surname:'Voss',race:'Tiefling',characterClass:'Feiticeira',
  level:11,currentHp:52,inventory:[{itemId:'secret-artifact'}],
  notes:'O segredo da campanha'
 };
 it('creates an allowlisted public entry without exposing sheet fields or notes',()=>{
  const entry=createPublicCharacterEntry({
   characterId:'char-1',campaignId:'camp-1',
   source:privateSource,settings:{...defaultPublicIdentity(),
    name:{mode:'custom',customValue:'A Viajante'},
    surname:{mode:'hidden'},characterClass:{mode:'hidden'},
    description:'Vista na estrada.'},
   campaignHistory:'Conhecida no festival.'
  });
  expect(entry.identity.name).toBe('A Viajante');
  expect(entry.identity.surname).toBeNull();
  expect(entry.identity.characterClass).toBeNull();
  expect(entry.campaignHistory).toBe('Conhecida no festival.');
  expect(JSON.stringify(entry)).not.toMatch(/Elyra|Voss|Feiticeira|secret-artifact|segredo|currentHp|level|notes/);
 });
 it('updates player description without erasing the DM campaign history',()=>{
  const initial=createPublicCharacterEntry({characterId:'char-1',campaignId:'camp-1',
   source:privateSource,settings:defaultPublicIdentity(),campaignHistory:'Salvou a aldeia.'});
  const next=updatePublicCharacterIdentity(initial,{...defaultPublicIdentity(),
   description:'Usa uma capa azul.',name:{mode:'hidden'}},privateSource);
  expect(next.campaignHistory).toBe('Salvou a aldeia.');
  expect(next.publicDescription).toBe('Usa uma capa azul.');
  expect(next.identity.name).toBeNull();
  expect(next.characterId).toBe(initial.characterId);
 });
 it('rejects missing campaign identity',()=>{
  expect(()=>createPublicCharacterEntry({characterId:'',campaignId:'camp-1',
   source:privateSource,settings:defaultPublicIdentity()})).toThrow('required');
 });
});
