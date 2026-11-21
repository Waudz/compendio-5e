import {describe,expect,it} from 'vitest';
import {campaignNavigation,isCampaignTabVisible,PLAYER_SHEET_SUBPAGES} from './campaign-navigation';
describe('campaign navigation roles',()=>{
 it('gives initiative only to the master',()=>{
  expect(campaignNavigation('master').map(x=>x.label)).toEqual(['Início','Anotações','Iniciativa','Compêndio','Menu']);
  expect(isCampaignTabVisible('master','initiative')).toBe(true);
  expect(isCampaignTabVisible('player','initiative')).toBe(false);
 });
 it('gives sheet only to the player, with inventory as subpage',()=>{
  expect(campaignNavigation('player').map(x=>x.label)).toEqual(['Início','Anotações','Ficha','Compêndio','Menu']);
  expect(isCampaignTabVisible('player','sheet')).toBe(true);
  expect(isCampaignTabVisible('master','sheet')).toBe(false);
  expect(PLAYER_SHEET_SUBPAGES).toEqual(['sheet','inventory']);
  expect(campaignNavigation('player').map(x=>x.id)).not.toContain('inventory');
 });
});
