/** Normalize API 2014 class records for a *preview* of the character creator.
 * The API class resource has a hit die but not the full 20-level feature progression.
 * Never invent missing grants or treat this preview as a playable class definition.
 */
import type {SrdStagingRecord} from './srd-2014-staging';
export type SrdClassPreview={
 id:string;name:string;hitDie:number;sourceUrl:string;
 canCreateCharacter:false;missing:string[];
};
export function srd2014ClassPreview(record:SrdStagingRecord):SrdClassPreview{
 if(record.collection!=='classes'||record.reviewed)
  throw new Error('Expected an unreviewed SRD 2014 class record');
 const data=record.data;
 if(data.index!==record.index||data.name!==record.name||
  !Number.isInteger(data.hit_die)||Number(data.hit_die)<1||Number(data.hit_die)>20)
  throw new Error('Invalid SRD 2014 class preview data');
 if(record.provenance.provider!=='dnd5eapi-2014'||
  record.provenance.url!=='https://www.dnd5eapi.co/api/2014/classes/'+record.index)
  throw new Error('Invalid class preview provenance');
 return {id:record.index,name:record.name,hitDie:Number(data.hit_die),
  sourceUrl:record.provenance.url,canCreateCharacter:false,
  missing:['20-level advancement data','reviewed class feature grants','editorial approval']};
}
