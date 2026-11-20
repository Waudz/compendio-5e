/** Validate the API's 20 class-level resources before considering them for editorial review.
 * These records are NOT playable features: grants still require explicit interpretation.
 */
import {indexSrd2014ClassLevels,type SrdClassLevel,type SrdLevelIndex} from './srd-2014-level-adapter';
export type SrdClassLevelStaging={
 classId:string;sourceUrl:string;fetchedAt:string;reviewed:false;
 levels:SrdLevelIndex[];missing:['reviewed feature effects','class choice mappings','editorial approval'];
};
const id=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function stageSrd2014ClassLevels(
 classId:string,payload:unknown,fetchedAt:string
):SrdClassLevelStaging{
 if(!id.test(classId)||!Number.isFinite(Date.parse(fetchedAt)))
  throw new Error('Invalid class level provenance');
 if(!Array.isArray(payload))throw new Error('Expected class level resource array');
 const levels=indexSrd2014ClassLevels(classId,payload as SrdClassLevel[]);
 return {classId,sourceUrl:'https://www.dnd5eapi.co/api/2014/classes/'+classId+'/levels',
  fetchedAt,reviewed:false,levels,
  missing:['reviewed feature effects','class choice mappings','editorial approval']};
}
