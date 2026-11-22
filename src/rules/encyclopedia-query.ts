import type {EncyclopediaEntry,EncyclopediaActor,EncyclopediaPlayerEntry,EncyclopediaMasterEntry} from './encyclopedia-visibility';
import {listEncyclopediaEntries} from './encyclopedia-visibility';
import type {NarrativeTrashRecord} from './encyclopedia-trash';

export type EncyclopediaIndexedEntry=EncyclopediaEntry&NarrativeTrashRecord;
export type EncyclopediaPage<T>={items:readonly T[];total:number;offset:number;limit:number};
export function encyclopediaPage(
 actor:EncyclopediaActor,records:readonly EncyclopediaIndexedEntry[],
 options:{offset:number;limit:number;query?:string;kind?:EncyclopediaEntry['kind'];includeTrash?:boolean}
):EncyclopediaPage<EncyclopediaPlayerEntry|EncyclopediaMasterEntry>{
 const {offset,limit}=options;
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100||
    (options.query!==undefined&&(typeof options.query!=='string'||options.query.length>200))||
    (options.kind!==undefined&&!['creature','character','place','organization','knowledge'].includes(options.kind)))
  throw Error('Invalid encyclopedia pagination');
 // Even a master must opt into the trash; players can never list trashed records.
 const active=records.filter(record=>record.deletedAt===null||
  (options.includeTrash===true&&actor.role==='master'&&actor.isActiveMember&&record.campaignId===actor.campaignId));
 const visible=listEncyclopediaEntries(actor,active);
 const needle=(options.query??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const filtered=visible.filter(entry=>{
  if(options.kind&&entry.kind!==options.kind)return false;
  if(!needle)return true;
  const searchable=[entry.name,entry.summary,...('publicDescription' in entry?[entry.publicDescription]:[])].join(' ');
  return searchable.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(needle);
 });
 return {items:filtered.slice(offset,offset+limit),total:filtered.length,offset,limit};
}
