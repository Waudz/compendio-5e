/** Publication boundary: only editorially approved records may produce an offline catalogue.
 * This function performs no network I/O and cannot approve source rights itself.
 */
import {importReviewedSrd2014} from './srd-2014-import';
import {type ApprovedSrdRecord,reviewedRecordsForImport} from './srd-2014-approval';
import {createOfflineCatalogueSnapshot,type OfflineCatalogueSnapshot} from './offline-catalogue-snapshot';
export type SrdPublicationMetadata={revision:string;createdAt:string};
export function buildApprovedSrd2014Snapshot(
 approvals:readonly ApprovedSrdRecord[],meta:SrdPublicationMetadata
):OfflineCatalogueSnapshot{
 if(approvals.length===0)throw new Error('Cannot publish an empty approved catalogue');
 const keys=new Set<string>();
 const licenseSet=new Set<string>();
 const reviewers=new Set<string>();
 for(const approval of approvals){
  if(!approval.record.reviewed||!approval.review.confirmsRuleset2014||
   !approval.review.confirmsRedistributionRights||
   !approval.review.reviewer.trim()||!approval.review.sourceLicense.trim()||
   !Number.isFinite(Date.parse(approval.review.reviewedAt)))
   throw new Error('Invalid editorial approval');
  if(approval.provenance.provider!=='dnd5eapi-2014'||
   approval.provenance.url!==
    'https://www.dnd5eapi.co/api/2014/'+approval.record.collection+'/'+approval.record.index||
   !Number.isFinite(Date.parse(approval.provenance.fetchedAt)))
   throw new Error('Invalid SRD 2014 provenance');
  const key=approval.record.collection+':'+approval.record.index;
  if(keys.has(key))throw new Error('Duplicate approved SRD record: '+key);
  keys.add(key);
  licenseSet.add(approval.review.sourceLicense);
  reviewers.add(approval.review.reviewer);
 }
 if(licenseSet.size!==1)throw new Error('Mixed source licenses require separate publication');
 const catalogue=importReviewedSrd2014(reviewedRecordsForImport(approvals),meta.revision);
 return createOfflineCatalogueSnapshot(catalogue,{
  catalogueRevision:meta.revision,createdAt:meta.createdAt,
  source:'https://www.dnd5eapi.co/api/2014',
  license:[...licenseSet][0],reviewedBy:[...reviewers].sort().join(', ')
 });
}
