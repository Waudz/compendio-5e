/** A frozen, reviewed catalogue snapshot for offline use.
 * Snapshot metadata is a reproducibility record, not a cryptographic signature.
 */
import {contentKey} from './content-registry';
import {validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
export type OfflineCatalogueSnapshot={
 schemaVersion:1;catalogueRevision:string;createdAt:string;
 provenance:{source:string;license:string;reviewedBy:string};
 catalogue:RulesCatalogue;entryKeys:string[];
};
const identifier=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export function createOfflineCatalogueSnapshot(
 catalogue:RulesCatalogue,meta:{catalogueRevision:string;createdAt:string;source:string;license:string;reviewedBy:string}
):OfflineCatalogueSnapshot{
 validateRulesCatalogue(catalogue);
 if(!identifier.test(meta.catalogueRevision)||!Number.isFinite(Date.parse(meta.createdAt))||
  !meta.source.trim()||!meta.license.trim()||!meta.reviewedBy.trim())
  throw new Error('Invalid offline snapshot provenance');
 if(catalogue.registry.entries.some(e=>e.ref.revision!==meta.catalogueRevision))
  throw new Error('Catalogue entry revision mismatch');
 const copy=structuredClone(catalogue);
 const entryKeys=copy.registry.entries.map(e=>contentKey(e.ref)).sort();
 return {schemaVersion:1,catalogueRevision:meta.catalogueRevision,createdAt:meta.createdAt,
  provenance:{source:meta.source,license:meta.license,reviewedBy:meta.reviewedBy},
  catalogue:copy,entryKeys};
}
export function readOfflineCatalogueSnapshot(snapshot:unknown):RulesCatalogue{
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))
  throw new Error('Invalid offline snapshot');
 const value=snapshot as Partial<OfflineCatalogueSnapshot>;
 if(value.schemaVersion!==1||!value.catalogue||!value.provenance||
  typeof value.catalogueRevision!=='string'||!identifier.test(value.catalogueRevision)||
  typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||
  !value.provenance.source?.trim()||!value.provenance.license?.trim()||
  !value.provenance.reviewedBy?.trim()||!Array.isArray(value.entryKeys))
  throw new Error('Invalid offline snapshot metadata');
 validateRulesCatalogue(value.catalogue);
 const keys=value.catalogue.registry.entries.map(e=>contentKey(e.ref)).sort();
 if(keys.length!==value.entryKeys.length||keys.some((key,i)=>key!==value.entryKeys?.[i])||
  value.catalogue.registry.entries.some(e=>e.ref.revision!==value.catalogueRevision))
  throw new Error('Offline snapshot index mismatch');
 return structuredClone(value.catalogue);
}
