-- Somente com autorização e backup. Preserva campos e vínculos em arquivo privado; notes/imagens não são apagados.
begin;
create schema if not exists private_codex_archive;
revoke all on schema private_codex_archive from public,anon,authenticated;
create table if not exists private_codex_archive.links_snapshots(created_at timestamptz default now(),data jsonb);
revoke all on private_codex_archive.links_snapshots from public,anon,authenticated;
insert into private_codex_archive.links_snapshots(data) select jsonb_build_object('links',coalesce((select jsonb_agg(to_jsonb(l)) from public.codex_links l),'[]'::jsonb),'notes',coalesce((select jsonb_agg(to_jsonb(n)) from public.notes n join public.campaign_codex c on c.id=n.id),'[]'::jsonb));
drop function public.codex_capabilities();
drop function public.codex_notification_feed(uuid);
drop function public.codex_unlink(uuid,uuid);
drop function public.codex_link(uuid,uuid,uuid,text);
drop function public.codex_links_for(uuid,uuid);
drop function public.codex_node_visible(uuid,uuid);
drop table public.codex_links;
create or replace function public.codex_list(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare master boolean;
begin
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 master := public.is_master(p_campaign);
 return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',c.id,'category',c.category,'systemId',c.system_id,'knowledge',c.knowledge,'version',c.version,
  'title',n.title,
  'description',case when master or c.knowledge>=2 then n.content end,
  'imagePath',case when master or c.knowledge>=3 then c.image_path end,
  'imageDefinitionId',case when master or c.knowledge>=3 then c.definition_id end,
  'definitionId',case when master or c.category='item' or c.knowledge=4 then c.definition_id end,
  'instanceId',case when master then c.instance_id end,
  'stats',case when master or c.knowledge=4 then n.meta->'stats' end,
  'secret',case when master then n.meta->>'secret' end
 )) order by n.title) from public.campaign_codex c join public.notes n on n.id=c.id
 where c.campaign_id=p_campaign and c.deleted_at is null and n.deleted_at is null and (master or c.knowledge>0)), '[]'::jsonb);
end $$;
revoke all on function public.codex_list(uuid) from public,anon;
grant execute on function public.codex_list(uuid) to authenticated;


create or replace function public.codex_save(p_campaign uuid,p_entry uuid,p_version int,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex; nid uuid; k int; cat text; note_kind text; path text;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise exception 'dados_invalidos'; end if;
 if p_version is null or p_version<0 or (p_entry is not null and p_version=0) then raise exception 'versao_invalida'; end if;
 if p_data ? 'stats' and jsonb_typeof(p_data->'stats') not in ('object','null') then raise exception 'estatisticas_invalidas'; end if;
 cat:=p_data->>'category'; k:=coalesce((p_data->>'knowledge')::int,0);
 if cat not in ('npc','location','organization','discovery','monster','item') or cat is null then raise exception 'categoria_invalida'; end if;
 if jsonb_typeof(coalesce(p_data->'description','[]'::jsonb))<>'array' then raise exception 'descricao_invalida'; end if;
 note_kind:=case cat when 'npc' then 'npc' when 'location' then 'location' when 'organization' then 'faction' else 'page' end;
 if p_entry is not null then
  select * into c from public.campaign_codex where id=p_entry and campaign_id=p_campaign and deleted_at is null for update;
  if c.id is null or c.version<>p_version then raise exception 'conflito_de_versao'; end if;
  if c.instance_id is distinct from nullif(p_data->>'instanceId','') or c.category<>cat or c.definition_id is distinct from nullif(p_data->>'definitionId','') or c.system_id<>coalesce(p_data->>'systemId','dnd5e-2014') then raise exception 'referencia_imutavel'; end if;
  nid:=c.id;
 else
  if p_version<>0 then raise exception 'versao_invalida'; end if;
  nid:=gen_random_uuid();
 end if;
 path:=nullif(p_data->>'imagePath','');
 if path is not null and (split_part(path,'/',1)<>p_campaign::text or split_part(path,'/',2)<>nid::text) then raise exception 'imagem_de_outro_registro'; end if;
 if p_entry is null then
  insert into public.notes(id,campaign_id,owner_id,kind,title,content,visibility,meta)
  values(nid,p_campaign,auth.uid(),note_kind,btrim(p_data->>'title'),coalesce(p_data->'description','[]'::jsonb),'private',jsonb_build_object('secret',p_data->>'secret','stats',p_data->'stats'));
  insert into public.campaign_codex(id,campaign_id,category,system_id,definition_id,instance_id,knowledge,image_path)
  values(nid,p_campaign,cat,coalesce(p_data->>'systemId','dnd5e-2014'),nullif(p_data->>'definitionId',''),nullif(p_data->>'instanceId',''),k,path);
 else
  update public.notes set title=btrim(p_data->>'title'),content=coalesce(p_data->'description','[]'::jsonb),meta=jsonb_build_object('secret',p_data->>'secret','stats',p_data->'stats') where id=nid;
  update public.campaign_codex set knowledge=k,image_path=path,version=version+1 where id=nid;
 end if;
 if k>coalesce(c.knowledge,0) then
  insert into public.codex_notifications(entry_id,recipient,knowledge)
  select nid,m.user_id,k from public.campaign_members m where m.campaign_id=p_campaign and m.user_id<>auth.uid()
  on conflict(entry_id,recipient,knowledge) do nothing;
 end if;
 return nid;
end $$;
revoke all on function public.codex_save(uuid,uuid,int,jsonb) from public,anon;
grant execute on function public.codex_save(uuid,uuid,int,jsonb) to authenticated;

create or replace function public.codex_note_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.campaign_codex c where c.id=old.id) then
  if not public.is_master(old.campaign_id) then raise exception 'sem_permissao' using errcode='42501'; end if;
  if new.visibility <> 'private' or new.campaign_id is distinct from old.campaign_id or new.owner_id<>old.owner_id or new.kind<>old.kind then
   raise exception 'registro_compendio_privado' using errcode='42501';
  end if;
 end if;
 return new;
end $$;

commit;
