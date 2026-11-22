import {describe,expect,it} from 'vitest';
import {encyclopediaActorFromMembership} from './encyclopedia-membership';
import {readEncyclopediaEntry,type EncyclopediaEntry} from './encyclopedia-visibility';

const entry:EncyclopediaEntry={
 id:'entry',campaignId:'camp',kind:'character',visibility:'hidden',
 name:'Segredo',summary:'',publicDescription:'',masterNotes:'DM',mechanics:null
};
describe('authenticated campaign membership mapping',()=>{
 it('maps mestre to master with full campaign access',()=>{
  const actor=encyclopediaActorFromMembership('camp','dm',{
   campaign_id:'camp',user_id:'dm',role:'mestre'
  });
  expect(actor).toEqual({campaignId:'camp',role:'master',isActiveMember:true});
  expect(readEncyclopediaEntry(actor,entry).access).toBe('master');
 });
 it('maps jogador to player without exposing hidden entries',()=>{
  const actor=encyclopediaActorFromMembership('camp','player',{
   campaign_id:'camp',user_id:'player',role:'jogador'
  });
  expect(actor).toEqual({campaignId:'camp',role:'player',isActiveMember:true});
  expect(readEncyclopediaEntry(actor,entry).access).toBe('denied');
 });
 it.each([
  ['missing session',null,{campaign_id:'camp',user_id:'dm',role:'mestre'}],
  ['missing membership','dm',null],
  ['wrong user','other',{campaign_id:'camp',user_id:'dm',role:'mestre'}],
  ['wrong campaign','dm',{campaign_id:'other',user_id:'dm',role:'mestre'}],
  ['unknown role','dm',{campaign_id:'camp',user_id:'dm',role:'admin'}]
 ])('denies %s',(_label,user,membership)=>{
  const actor=encyclopediaActorFromMembership('camp',user,membership);
  expect(actor.isActiveMember).toBe(false);
  expect(readEncyclopediaEntry(actor,entry).access).toBe('denied');
 });
});
