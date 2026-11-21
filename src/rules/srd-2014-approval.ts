/** Explicit editorial approval before a staged API record enters the canonical catalogue.
 * This is a client-independent domain check, not an authorization or license grant.
 */
import type {ReviewedSrdRecord} from './srd-2014-import';
import type {SrdStagingRecord} from './srd-2014-staging';
export type EditorialReview={
 reviewer:string;reviewedAt:string;sourceLicense:string;
 confirmsRuleset2014:boolean;confirmsRedistributionRights:boolean;
};
export type ApprovedSrdRecord={record:ReviewedSrdRecord;review:EditorialReview;provenance:SrdStagingRecord['provenance']};
export function approveStagedSrd2014(
 staged:SrdStagingRecord,review:EditorialReview
):ApprovedSrdRecord{
 if(staged.reviewed||staged.issues.length) throw new Error('Staged record requires unresolved review');
 if(!review.reviewer.trim()||!review.sourceLicense.trim()||
   !Number.isFinite(Date.parse(review.reviewedAt))||
   !review.confirmsRuleset2014||!review.confirmsRedistributionRights)
  throw new Error('Editorial approval requires 2014 and redistribution verification');
 const {collection,index,name,description,data}=staged;
 return {record:{collection,index,name,description,data:structuredClone(data),reviewed:true},
  review:{...review},provenance:{...staged.provenance}};
}
export function reviewedRecordsForImport(approvals:readonly ApprovedSrdRecord[]):ReviewedSrdRecord[]{
 return approvals.map(({record})=>({...record,data:structuredClone(record.data)}));
}
