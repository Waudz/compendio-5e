/** Offline review report. Never treats staged records as publication-ready. */
import type {SrdCollectionResult} from './srd-2014-collector';
export type SrdReviewSummary={
 collection:string;total:number;unreviewed:number;withIssues:number;
 issuesByType:Record<string,number>;identifiers:string[];
};
export function summarizeSrd2014Collection(result:SrdCollectionResult):SrdReviewSummary{
 if(result.expectedCount!==result.records.length)
  throw new Error('Incomplete collection review report');
 const issuesByType:Record<string,number>={};
 let withIssues=0;
 let unreviewed=0;
 for(const record of result.records){
  if(record.collection!==result.collection)throw new Error('Mixed collections in review report');
  if(!record.reviewed)unreviewed++;
  if(record.issues.length)withIssues++;
  for(const issue of record.issues)issuesByType[issue]=(issuesByType[issue]??0)+1;
 }
 return {collection:result.collection,total:result.records.length,unreviewed,withIssues,
  issuesByType,identifiers:result.records.map(r=>r.index).sort()};
}
