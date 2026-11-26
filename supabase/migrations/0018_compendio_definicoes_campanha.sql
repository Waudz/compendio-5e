-- 0018 — PROPOSTA, NÃO APLICADA. Requer 0017. Monstros e itens personalizados por campanha.
-- O catálogo global não é alterado: a campanha guarda apenas substituições (mesmo ID) e criações (ID `custom-…`).
begin;
create table public.campaign_definitions (
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 kind text not null check(kind in ('monster','item')),
 definition_id text not null check(definition_id ~ '^[a-z0-9]+([.-][a-z0-9]+)*$' and length(definition_id)<=200),
 base_id text check(length(base_id) between 1 and 200),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=120000 and coalesce(jsonb_typeof(data->'definition')='object' and data#>>'{definition,id}'=definition_id and length(btrim(data#>>'{definition,nome}')) between 1 and 120,false)),
 version int not null default 1,
 updated_at timestamptz not null default now(),
 primary key(campaign_id,kind,definition_id)
);
alter table public.campaign_definitions enable row level security;
revoke all on public.campaign_definitions from public,anon,authenticated;
grant select on public.campaign_definitions to authenticated;
create policy campaign_definitions_master on public.campaign_definitions for select to authenticated using(public.is_master(campaign_id));

-- A página registrada acompanha a definição (referência viva): ficha atualizada e nome herdado enquanto não tiver sido trocado.
create function public.codex_definition_sync(p_campaign uuid,p_kind text,p_definition_id text,p_sheet jsonb,p_old_name text,p_new_name text) returns void
language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 for eid in select id from public.campaign_codex where campaign_id=p_campaign and category=p_kind and system_id='dnd5e-2014' and definition_id=p_definition_id and deleted_at is null for update loop
  update public.notes set
   title=case when p_old_name is not null and title=left(p_old_name,120) then left(p_new_name,120) else title end,
   meta=jsonb_set(meta,'{sheet}',p_sheet) where id=eid;
  perform public.codex_announce(eid);
 end loop;
end $$;
revoke all on function public.codex_definition_sync(uuid,text,text,jsonb,text,text) from public,anon,authenticated;

-- p_version 0 cria; demais valores exigem a versão atual. p_base_name é o nome anterior quando ainda não havia linha.
create function public.codex_definition_save(p_campaign uuid,p_kind text,p_definition_id text,p_version int,p_base_id text,p_data jsonb,p_sheet jsonb,p_base_name text default null) returns int
language plpgsql security definer set search_path='' as $$
declare old public.campaign_definitions; result int;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 perform public.codex_check_sheet(p_sheet);
 select * into old from public.campaign_definitions where campaign_id=p_campaign and kind=p_kind and definition_id=p_definition_id for update;
 if p_version is null or coalesce(old.version,0)<>p_version then raise exception 'conflito_de_versao'; end if;
 if old.definition_id is null then
  insert into public.campaign_definitions(campaign_id,kind,definition_id,base_id,data) values(p_campaign,p_kind,p_definition_id,p_base_id,p_data);
  result:=1;
 else
  result:=old.version+1;
  update public.campaign_definitions set data=p_data,version=result,updated_at=now() where campaign_id=p_campaign and kind=p_kind and definition_id=p_definition_id;
 end if;
 perform public.codex_definition_sync(p_campaign,p_kind,p_definition_id,p_sheet,coalesce(old.data#>>'{definition,nome}',p_base_name),p_data#>>'{definition,nome}');
 return result;
end $$;
revoke all on function public.codex_definition_save(uuid,text,text,int,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.codex_definition_save(uuid,text,text,int,text,jsonb,jsonb,text) to authenticated;

-- Restaurar o padrão (substituição) ou excluir uma criação. Criação com página na campanha não é excluída, para não órfã-la.
create function public.codex_definition_remove(p_campaign uuid,p_kind text,p_definition_id text,p_version int,p_sheet jsonb default null,p_original_name text default null) returns void
language plpgsql security definer set search_path='' as $$
declare old public.campaign_definitions;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into old from public.campaign_definitions where campaign_id=p_campaign and kind=p_kind and definition_id=p_definition_id for update;
 if old.definition_id is null or old.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_definition_id like 'custom-%' then
  if exists(select 1 from public.campaign_codex where campaign_id=p_campaign and category=p_kind and definition_id=p_definition_id and deleted_at is null) then raise exception 'definicao_em_uso'; end if;
 else
  if p_sheet is null or p_original_name is null then raise exception 'padrao_ausente'; end if;
  perform public.codex_check_sheet(p_sheet);
  perform public.codex_definition_sync(p_campaign,p_kind,p_definition_id,p_sheet,old.data#>>'{definition,nome}',p_original_name);
 end if;
 delete from public.campaign_definitions where campaign_id=p_campaign and kind=p_kind and definition_id=p_definition_id;
end $$;
revoke all on function public.codex_definition_remove(uuid,text,text,int,jsonb,text) from public,anon;
grant execute on function public.codex_definition_remove(uuid,text,text,int,jsonb,text) to authenticated;
create or replace function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 18 $$;
commit;
