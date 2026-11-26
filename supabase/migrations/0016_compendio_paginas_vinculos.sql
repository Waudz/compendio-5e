-- 0016 — PROPOSTA, NÃO APLICADA. Requer 0015. Sem backfill nem alteração dos registros existentes.
begin;
create or replace function public.codex_list(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare master boolean;
begin
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 master := public.is_master(p_campaign);
 return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',c.id,'category',c.category,'systemId',c.system_id,'knowledge',c.knowledge,'version',c.version,
  'title',n.title,
  'description',case when master or c.knowledge>=2 then n.content end,
  'fields',case when master or c.knowledge>=2 then n.meta->'codex' end,
  'relatedTerms',case when master or c.knowledge>=2 then coalesce((select jsonb_agg(target.title) from public.codex_links edge join public.notes target on target.id=case when edge.source_id=c.id then edge.target_id else edge.source_id end where edge.campaign_id=c.campaign_id and (edge.source_id=c.id or edge.target_id=c.id) and public.codex_node_visible(c.campaign_id,target.id)),'[]'::jsonb) end,
  'framing',case when master or c.knowledge>=3 then n.meta->'framing' end,
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
 if p_data ? 'fields' and (jsonb_typeof(p_data->'fields')<>'object' or exists(select 1 from jsonb_each(p_data->'fields') f where f.key not in ('nickname','identity','region','history','personality','relationships','map','objectives','type','origin') or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>4000)) then raise exception 'campos_invalidos'; end if;
 if p_data ? 'framing' and (jsonb_typeof(p_data->'framing')<>'object' or exists(select 1 from jsonb_each(p_data->'framing') f where f.key not in ('zoom','x','y') or jsonb_typeof(f.value)<>'number') or not coalesce((p_data#>>'{framing,zoom}')::numeric between 1 and 3 and (p_data#>>'{framing,x}')::numeric between 0 and 100 and (p_data#>>'{framing,y}')::numeric between 0 and 100,false)) then raise exception 'enquadramento_invalido'; end if;
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
  values(nid,p_campaign,auth.uid(),note_kind,btrim(p_data->>'title'),coalesce(p_data->'description','[]'::jsonb),'private',jsonb_build_object('secret',p_data->>'secret','stats',p_data->'stats','codex',coalesce(p_data->'fields','{}'::jsonb),'framing',coalesce(p_data->'framing','{"zoom":1,"x":50,"y":50}'::jsonb)));
  insert into public.campaign_codex(id,campaign_id,category,system_id,definition_id,instance_id,knowledge,image_path)
  values(nid,p_campaign,cat,coalesce(p_data->>'systemId','dnd5e-2014'),nullif(p_data->>'definitionId',''),nullif(p_data->>'instanceId',''),k,path);
 else
  update public.notes set title=btrim(p_data->>'title'),content=coalesce(p_data->'description','[]'::jsonb),meta=jsonb_build_object('secret',p_data->>'secret','stats',p_data->'stats','codex',coalesce(p_data->'fields',meta->'codex','{}'::jsonb),'framing',coalesce(p_data->'framing',meta->'framing','{"zoom":1,"x":50,"y":50}'::jsonb)) where id=nid;
  update public.campaign_codex set knowledge=k,image_path=path where id=nid;
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
  update public.campaign_codex set version=version+1 where id=old.id;
 end if;
 return new;
end $$;
revoke all on function public.codex_note_guard() from public,anon,authenticated;

create table public.codex_links (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 source_id uuid not null references public.notes(id) on delete cascade,
 target_id uuid not null references public.notes(id) on delete cascade,
 relation text not null default 'Relacionado' check(length(btrim(relation)) between 1 and 80),
 check(source_id<>target_id)
);
create unique index codex_links_pair on public.codex_links(campaign_id,least(source_id,target_id),greatest(source_id,target_id));
create index codex_links_target on public.codex_links(target_id);
alter table public.codex_links enable row level security;
revoke all on public.codex_links from public,anon,authenticated;
grant select on public.codex_links to authenticated;
create policy codex_links_master on public.codex_links for select to authenticated using(public.is_master(campaign_id));
create function public.codex_node_visible(p_campaign uuid,p_node uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_member(p_campaign) and exists(select 1 from public.notes n where n.id=p_node and n.campaign_id=p_campaign and n.deleted_at is null and (
  (n.kind='character' and (n.visibility='campaign' or n.owner_id=auth.uid())) or public.codex_visible(n.id,2)))
$$;
revoke all on function public.codex_node_visible(uuid,uuid) from public,anon;
grant execute on function public.codex_node_visible(uuid,uuid) to authenticated;
create function public.codex_links_for(p_campaign uuid,p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.codex_node_visible(p_campaign,p_entry) then raise exception 'sem_permissao' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'targetId',n.id,'title',n.title,'category',coalesce(c.category,'character'),'relation',l.relation) order by n.title)
 from public.codex_links l join public.notes n on n.id=case when l.source_id=p_entry then l.target_id else l.source_id end
 left join public.campaign_codex c on c.id=n.id
 where l.campaign_id=p_campaign and (l.source_id=p_entry or l.target_id=p_entry) and public.codex_node_visible(p_campaign,n.id)), '[]'::jsonb);
end $$;
revoke all on function public.codex_links_for(uuid,uuid) from public,anon;
grant execute on function public.codex_links_for(uuid,uuid) to authenticated;
create function public.codex_link(p_campaign uuid,p_source uuid,p_target uuid,p_relation text default 'Relacionado') returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_master(p_campaign) or not public.codex_node_visible(p_campaign,p_source) or not public.codex_node_visible(p_campaign,p_target) then raise exception 'sem_permissao' using errcode='42501'; end if;
 insert into public.codex_links(campaign_id,source_id,target_id,relation) values(p_campaign,p_source,p_target,btrim(p_relation)) returning id into result;
 return result;
end $$;
revoke all on function public.codex_link(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.codex_link(uuid,uuid,uuid,text) to authenticated;
create function public.codex_unlink(p_campaign uuid,p_link uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 delete from public.codex_links where id=p_link and campaign_id=p_campaign;
end $$;
revoke all on function public.codex_unlink(uuid,uuid) from public,anon;
grant execute on function public.codex_unlink(uuid,uuid) to authenticated;
create function public.codex_notification_feed(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 return (with authorized as (
  select a.id,a.entry_id,a.knowledge,a.read_at,a.created_at,n.title,c.category from public.codex_notifications a
  join public.campaign_codex c on c.id=a.entry_id join public.notes n on n.id=c.id
  where a.recipient=auth.uid() and c.campaign_id=p_campaign and public.codex_visible(c.id,a.knowledge)
 ) select jsonb_build_object('unread',count(*) filter(where read_at is null),
 'discoveries',count(*) filter(where read_at is null and category in ('discovery','item')),
 'items',coalesce((select jsonb_agg(to_jsonb(recent)) from (select * from authorized order by created_at desc,id desc limit 50) recent),'[]'::jsonb)) from authorized);
end $$;
revoke all on function public.codex_notification_feed(uuid) from public,anon;
grant execute on function public.codex_notification_feed(uuid) to authenticated;
create function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 16 $$;
revoke all on function public.codex_capabilities() from public,anon;
grant execute on function public.codex_capabilities() to authenticated;
commit;
