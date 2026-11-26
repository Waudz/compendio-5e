-- 0015 — PROPOSTA, NÃO APLICADA. Aditiva; não aplicar em produção sem revisão. Requer 0001–0014.
-- O conteúdo canônico permanece em notes; este índice guarda referências e divulgação.
begin;
create table public.campaign_codex (
 id uuid primary key references public.notes(id) on delete cascade,
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 category text not null check(category in ('npc','location','organization','discovery','monster','item')),
 system_id text not null default 'dnd5e-2014' check(length(system_id) between 1 and 80),
 definition_id text check(length(definition_id) between 1 and 200),
 instance_id text check(length(instance_id) between 1 and 200),
 knowledge int not null default 0 check(knowledge between 0 and 4),
 image_path text,
 version int not null default 1,
 deleted_at timestamptz,
 check(image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
 check(category not in ('monster','item') or definition_id is not null)
);
create index campaign_codex_campaign on public.campaign_codex(campaign_id) where deleted_at is null;
create unique index campaign_codex_definition on public.campaign_codex(campaign_id,category,system_id,definition_id)
 where definition_id is not null and deleted_at is null;
alter table public.campaign_codex enable row level security;
revoke all on public.campaign_codex from public,anon,authenticated;
grant select on public.campaign_codex to authenticated;
create policy codex_master on public.campaign_codex for select to authenticated using(public.is_master(campaign_id));

-- Existing owner policies must not let an ex-master retain access to campaign secrets.
create function public.codex_note_access(p_note uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.campaign_codex c where c.id=p_note)
 or exists(select 1 from public.campaign_codex c where c.id=p_note and public.is_master(c.campaign_id))
$$;
revoke all on function public.codex_note_access(uuid) from public,anon;
grant execute on function public.codex_note_access(uuid) to authenticated;
create policy notes_codex_boundary on public.notes as restrictive to authenticated
 using(public.codex_note_access(id)) with check(public.codex_note_access(id));

-- Prevent a generic notes API from publishing secrets or moving the canonical record.
create function public.codex_note_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.campaign_codex c where c.id=old.id) then
  if not public.is_master(old.campaign_id) then raise exception 'sem_permissao' using errcode='42501'; end if;
  if new.visibility <> 'private' or new.campaign_id is distinct from old.campaign_id or new.owner_id<>old.owner_id or new.kind<>old.kind then
   raise exception 'registro_compendio_privado' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
create trigger codex_note_guard before update on public.notes for each row execute function public.codex_note_guard();
revoke all on function public.codex_note_guard() from public,anon,authenticated;

-- Only the projection crosses the player boundary. Neither secret meta nor unrevealed fields leave the server.
create function public.codex_list(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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

create table public.codex_notifications (
 id bigint generated always as identity primary key,
 entry_id uuid not null references public.campaign_codex(id) on delete cascade,
 recipient uuid not null references public.profiles(id) on delete cascade,
 knowledge int not null check(knowledge between 1 and 4),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(entry_id,recipient,knowledge)
);
create index codex_notifications_recipient on public.codex_notifications(recipient,created_at desc);
alter table public.codex_notifications enable row level security;
revoke all on public.codex_notifications from public,anon,authenticated;
grant select on public.codex_notifications to authenticated;
grant update(read_at) on public.codex_notifications to authenticated;
-- The projection helper below avoids depending on master-only table RLS in a player policy.
create function public.codex_visible(p_entry uuid, p_level int default 1) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.campaign_codex c join public.notes n on n.id=c.id
 where p_level between 1 and 4 and c.id=p_entry and c.deleted_at is null and n.deleted_at is null and public.is_member(c.campaign_id)
 and (public.is_master(c.campaign_id) or c.knowledge>=p_level))
$$;
revoke all on function public.codex_visible(uuid,int) from public,anon;
grant execute on function public.codex_visible(uuid,int) to authenticated;
create policy codex_notifications_read on public.codex_notifications for select to authenticated
 using(recipient=auth.uid() and public.codex_visible(entry_id,knowledge));
create policy codex_notifications_seen on public.codex_notifications for update to authenticated
 using(recipient=auth.uid() and public.codex_visible(entry_id,knowledge))
 with check(recipient=auth.uid() and public.codex_visible(entry_id,knowledge));

-- One transactional write path; id + version prevent stale overwrites. No client-supplied owner.
create function public.codex_save(p_campaign uuid,p_entry uuid,p_version int,p_data jsonb) returns uuid
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

create function public.codex_remove(p_campaign uuid,p_entry uuid,p_version int) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 update public.campaign_codex set deleted_at=now(),version=version+1 where id=p_entry and campaign_id=p_campaign and version=p_version and deleted_at is null;
 if not found then raise exception 'conflito_de_versao'; end if;
end $$;
revoke all on function public.codex_remove(uuid,uuid,int) from public,anon;
grant execute on function public.codex_remove(uuid,uuid,int) to authenticated;

-- Dedicated private bucket. campaign-assets is intentionally NOT reused (members have broad read there).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('codex-assets','codex-assets',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='codex-assets' and (public or file_size_limit is distinct from 5242880 or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'])) then
  raise exception 'bucket_codex_incompativel';
 end if;
end $$;
create function public.codex_asset_access(p_name text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare cid uuid; eid uuid;
begin
 if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 cid:=split_part(p_name,'/',1)::uuid; eid:=split_part(p_name,'/',2)::uuid;
 return exists(select 1 from public.campaign_codex c where c.id=eid and c.campaign_id=cid and c.deleted_at is null
 and (public.is_master(cid) or (not p_write and c.image_path=p_name and public.codex_visible(eid,3))));
end $$;
revoke all on function public.codex_asset_access(text,boolean) from public,anon;
grant execute on function public.codex_asset_access(text,boolean) to authenticated;
create policy codex_assets_read on storage.objects for select to authenticated using(bucket_id='codex-assets' and public.codex_asset_access(name,false));
create policy codex_assets_insert on storage.objects for insert to authenticated with check(bucket_id='codex-assets' and public.codex_asset_access(name,true));
-- No UPDATE/upsert policy: replacements always use a new immutable path.
create policy codex_assets_delete on storage.objects for delete to authenticated using(bucket_id='codex-assets' and public.codex_asset_access(name,true));
-- Holder projection returns only already-published identities, never inventories or private names.
create function public.codex_holders(p_campaign uuid,p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ref text;
begin
 if not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select definition_id into ref from public.campaign_codex where id=p_entry and campaign_id=p_campaign and category='item' and deleted_at is null and public.codex_visible(id,1);
 if ref is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',n.title))
 from public.character_sheets f join public.notes n on n.id=f.character_id
 where f.campaign_id=p_campaign and n.campaign_id=p_campaign and n.kind='character' and n.visibility='campaign' and n.deleted_at is null
 and exists(select 1 from jsonb_array_elements(coalesce(f.draft->'inventory','[]'::jsonb)) i where i->>'itemId'=ref and case when jsonb_typeof(i->'quantity')='number' then (i->>'quantity')::numeric>0 else false end)), '[]'::jsonb);
end $$;
revoke all on function public.codex_holders(uuid,uuid) from public,anon;
grant execute on function public.codex_holders(uuid,uuid) to authenticated;
commit;
