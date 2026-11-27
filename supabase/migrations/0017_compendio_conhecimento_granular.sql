-- 0017 — PROPOSTA, NÃO APLICADA. Requer 0015 e 0016. Conhecimento por campo, relações tipadas e descobertas.
-- Converte os níveis 0–4 existentes em chaves reveladas, sem ampliar o que o jogador já via.
begin;
alter table public.campaign_codex
 add column visible boolean not null default false,
 add column revealed text[] not null default '{}',
 add column announced text[] not null default '{}',
 add column registered boolean not null default true;

update public.campaign_codex set
 visible = knowledge>0,
 revealed = case
  when category<>'monster' and knowledge>0 then
   case when knowledge>=3 then array['name','description','image','holders','sheet','nickname','occupation','residence','type','region','map','inhabitants','history','context','personality','relationships','objectives','origin']
        when knowledge=2 then array['name','description','sheet','nickname','occupation','residence','type','region','map','inhabitants','history','context','personality','relationships','objectives','origin']
        else array['name','sheet'] end
  when knowledge=1 then array['name']
  when knowledge=2 then array['name','description','nickname','history']
  when knowledge=3 then array['name','description','nickname','history','image']
  when knowledge=4 then array['name','description','nickname','history','image','sheet']
  else '{}'::text[] end;
-- O que já era visível não gera aviso novo.
update public.campaign_codex set announced=array_append(revealed,'exists') where visible;

-- Vínculos: o jogador via quando as duas pontas tinham nível 2 ou mais.
alter table public.codex_links
 add column kind text not null default 'custom' check(kind ~ '^[a-z-]{1,30}$'),
 add column inverse text not null default 'Relacionado' check(length(btrim(inverse)) between 1 and 80),
 add column revealed boolean not null default false;
update public.codex_links l set inverse=l.relation,
 revealed = not exists(select 1 from public.campaign_codex c where c.id in (l.source_id,l.target_id) and c.knowledge<2);
update public.campaign_codex c set announced=c.announced || array(select 'link:'||l.id::text from public.codex_links l where l.revealed and c.id in (l.source_id,l.target_id)) where c.visible;
drop index public.codex_links_pair;
create unique index codex_links_pair on public.codex_links
 (campaign_id,least(source_id,target_id),greatest(source_id,target_id),kind,(case when kind='custom' then lower(least(relation,inverse)) else '' end));

-- Campos genéricos antigos passam aos campos específicos aprovados.
alter table public.notes disable trigger codex_note_guard;
update public.notes n set meta=jsonb_set(n.meta,'{codex}',
 (n.meta->'codex') - 'identity'
 || case when n.meta#>>'{codex,identity}' is null then '{}'::jsonb else jsonb_build_object(case c.category when 'npc' then 'occupation' when 'location' then 'inhabitants' else 'type' end, n.meta#>>'{codex,identity}') end)
 from public.campaign_codex c where c.id=n.id and jsonb_typeof(n.meta->'codex')='object' and (n.meta->'codex') ? 'identity';
update public.notes n set meta=jsonb_set(n.meta,'{codex}',((n.meta->'codex') - 'region') || jsonb_build_object('residence',n.meta#>>'{codex,region}'))
 from public.campaign_codex c where c.id=n.id and c.category='npc' and jsonb_typeof(n.meta->'codex')='object' and (n.meta->'codex') ? 'region';
update public.notes n set meta=jsonb_set(n.meta,'{codex}',((n.meta->'codex') - 'history') || jsonb_build_object('context',n.meta#>>'{codex,history}'))
 from public.campaign_codex c where c.id=n.id and c.category='discovery' and jsonb_typeof(n.meta->'codex')='object' and (n.meta->'codex') ? 'history';
alter table public.notes enable trigger codex_note_guard;

-- Notificações passam a ser uma por operação que traz informação nova.
drop policy codex_notifications_read on public.codex_notifications;
drop policy codex_notifications_seen on public.codex_notifications;
drop policy codex_assets_read on storage.objects;
drop policy codex_assets_insert on storage.objects;
drop policy codex_assets_delete on storage.objects;
alter table public.codex_notifications drop column knowledge;
alter table public.codex_notifications add column is_new boolean not null default true;
drop function public.codex_visible(uuid,int);
alter table public.campaign_codex drop column knowledge;

create function public.codex_visible(p_entry uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.campaign_codex c join public.notes n on n.id=c.id
 where c.id=p_entry and c.deleted_at is null and n.deleted_at is null and public.is_member(c.campaign_id)
 and (public.is_master(c.campaign_id) or c.visible))
$$;
revoke all on function public.codex_visible(uuid) from public,anon;
grant execute on function public.codex_visible(uuid) to authenticated;
create policy codex_notifications_read on public.codex_notifications for select to authenticated
 using(recipient=auth.uid() and public.codex_visible(entry_id));
create policy codex_notifications_seen on public.codex_notifications for update to authenticated
 using(recipient=auth.uid() and public.codex_visible(entry_id))
 with check(recipient=auth.uid() and public.codex_visible(entry_id));

create or replace function public.codex_asset_access(p_name text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare cid uuid; eid uuid;
begin
 if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 cid:=split_part(p_name,'/',1)::uuid; eid:=split_part(p_name,'/',2)::uuid;
 return exists(select 1 from public.campaign_codex c where c.id=eid and c.campaign_id=cid and c.deleted_at is null
 and (public.is_master(cid) or (not p_write and c.image_path=p_name and 'image'=any(c.revealed) and public.codex_visible(eid))));
end $$;
create policy codex_assets_read on storage.objects for select to authenticated using(bucket_id='codex-assets' and public.codex_asset_access(name,false));
create policy codex_assets_insert on storage.objects for insert to authenticated with check(bucket_id='codex-assets' and public.codex_asset_access(name,true));
create policy codex_assets_delete on storage.objects for delete to authenticated using(bucket_id='codex-assets' and public.codex_asset_access(name,true));

create function public.codex_neutral_title(p_category text) returns text language sql immutable set search_path='' as $$
 select case p_category when 'npc' then 'Pessoa desconhecida' when 'location' then 'Local desconhecido'
  when 'organization' then 'Organização desconhecida' when 'monster' then 'Criatura desconhecida' else 'Descoberta sem nome' end
$$;
revoke all on function public.codex_neutral_title(text) from public,anon,authenticated;

-- Único título que atravessa a fronteira do jogador (listas, vínculos, busca e notificações).
create function public.codex_public_title(p_entry uuid) returns text language sql stable security definer set search_path='' as $$
 select case when 'name'=any(c.revealed) then n.title
  when 'nickname'=any(c.revealed) and nullif(btrim(n.meta#>>'{codex,nickname}'),'') is not null then btrim(n.meta#>>'{codex,nickname}')
  else public.codex_neutral_title(c.category) end
 from public.campaign_codex c join public.notes n on n.id=c.id where c.id=p_entry
$$;
revoke all on function public.codex_public_title(uuid) from public,anon,authenticated;

-- Visibilidade de uma ponta: p_player força a perspectiva do jogador (usada também na prévia do mestre).
create function public.codex_node_open(p_campaign uuid,p_node uuid,p_player boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.notes n left join public.campaign_codex c on c.id=n.id
 where n.id=p_node and n.campaign_id=p_campaign and n.deleted_at is null and (
  (n.kind='character' and c.id is null and (n.visibility='campaign' or (not p_player and (public.is_master(p_campaign) or n.owner_id=auth.uid()))))
  or (c.id is not null and c.deleted_at is null and (not p_player or c.visible))))
$$;
revoke all on function public.codex_node_open(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function public.codex_node_visible(p_campaign uuid,p_node uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_member(p_campaign) and public.codex_node_open(p_campaign,p_node,not public.is_master(p_campaign))
$$;

-- Identidade completa: nome verdadeiro e a ficha inteira já revelados. Só então o ID de catálogo sai do servidor.
create function public.codex_identified(p_revealed text[],p_sheet jsonb) returns boolean language sql immutable set search_path='' as $$
 select 'name'=any(p_revealed) and ('sheet'=any(p_revealed) or (
  jsonb_array_length(coalesce(p_sheet,'[]'::jsonb))>0 and not exists(select 1 from jsonb_array_elements(coalesce(p_sheet,'[]'::jsonb)) s where not ('sheet:'||(s->>'k'))=any(p_revealed))))
$$;
revoke all on function public.codex_identified(text[],jsonb) from public,anon,authenticated;

create function public.codex_links_projection(p_campaign uuid,p_entry uuid,p_player boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by item->>'relation', item->>'title'),'[]'::jsonb) from (
  select jsonb_strip_nulls(jsonb_build_object('id',l.id,'targetId',n.id,'kind',l.kind,
   'title',case when p_player and c.id is not null then public.codex_public_title(n.id) else n.title end,
   'category',case when c.id is null then 'character'
     when p_player and c.category='item' and not public.codex_identified(c.revealed,n.meta->'sheet') then 'discovery' else c.category end,
   'relation',case when l.source_id=p_entry then l.relation else l.inverse end,
   'outgoing',l.source_id=p_entry,
   'revealed',case when not p_player then l.revealed end)) item
  from public.codex_links l join public.notes n on n.id=case when l.source_id=p_entry then l.target_id else l.source_id end
  left join public.campaign_codex c on c.id=n.id
  where l.campaign_id=p_campaign and (l.source_id=p_entry or l.target_id=p_entry) and (not p_player or l.revealed)
   and public.codex_node_open(p_campaign,n.id,p_player)) s
$$;
revoke all on function public.codex_links_projection(uuid,uuid,boolean) from public,anon,authenticated;

create function public.codex_project(p_entry uuid,p_player boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.campaign_codex; n public.notes; full_id boolean; sheet jsonb;
begin
 select * into c from public.campaign_codex where id=p_entry;
 select * into n from public.notes where id=p_entry;
 sheet:=case when jsonb_typeof(n.meta->'sheet')='array' then n.meta->'sheet' else '[]'::jsonb end;
 if not p_player then
  return jsonb_strip_nulls(jsonb_build_object('id',c.id,'category',c.category,'systemId',c.system_id,'version',c.version,
   'title',n.title,'description',n.content,'fields',n.meta->'codex','sheet',sheet,'framing',n.meta->'framing',
   'imagePath',c.image_path,'imageDefinitionId',c.definition_id,'definitionId',c.definition_id,'instanceId',c.instance_id,
   'secret',n.meta->>'secret','visible',c.visible,'revealed',to_jsonb(c.revealed),'registered',c.registered));
 end if;
 full_id:=c.definition_id is not null and public.codex_identified(c.revealed,sheet);
 return jsonb_strip_nulls(jsonb_build_object('id',c.id,
  'category',case when c.category='item' and not full_id then 'discovery' else c.category end,
  'systemId',c.system_id,'version',c.version,'visible',true,
  'title',public.codex_public_title(c.id),
  'description',case when 'description'=any(c.revealed) then n.content end,
  'fields',(select jsonb_object_agg(f.key,f.value) from jsonb_each(case when jsonb_typeof(n.meta->'codex')='object' then n.meta->'codex' else '{}'::jsonb end) f where f.key=any(c.revealed)),
  'sheet',(select jsonb_agg(s.value order by s.ordinality) from jsonb_array_elements(sheet) with ordinality s where 'sheet'=any(c.revealed) or ('sheet:'||(s.value->>'k'))=any(c.revealed)),
  'framing',case when 'image'=any(c.revealed) then n.meta->'framing' end,
  'imagePath',case when 'image'=any(c.revealed) then c.image_path end,
  'imageDefinitionId',case when 'image'=any(c.revealed) and 'name'=any(c.revealed) then c.definition_id end,
  'definitionId',case when full_id then c.definition_id end,
  'relatedTerms',(select jsonb_agg(x->>'title') from jsonb_array_elements(public.codex_links_projection(c.campaign_id,c.id,true)) x)));
end $$;
revoke all on function public.codex_project(uuid,boolean) from public,anon,authenticated;

create or replace function public.codex_list(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare master boolean;
begin
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 master := public.is_master(p_campaign);
 return coalesce((select jsonb_agg(p.item order by p.item->>'title') from (
  select public.codex_project(c.id,not master) item from public.campaign_codex c join public.notes n on n.id=c.id
  where c.campaign_id=p_campaign and c.deleted_at is null and n.deleted_at is null and (master or c.visible)) p), '[]'::jsonb);
end $$;

create function public.codex_preview(p_campaign uuid,p_entry uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if not public.codex_node_open(p_campaign,p_entry,false) or not exists(select 1 from public.campaign_codex where id=p_entry) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if not (select visible from public.campaign_codex where id=p_entry) then return jsonb_build_object('entry',null,'links','[]'::jsonb); end if;
 return jsonb_build_object('entry',public.codex_project(p_entry,true),'links',public.codex_links_projection(p_campaign,p_entry,true));
end $$;
revoke all on function public.codex_preview(uuid,uuid) from public,anon;
grant execute on function public.codex_preview(uuid,uuid) to authenticated;

create or replace function public.codex_links_for(p_campaign uuid,p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.codex_node_visible(p_campaign,p_entry) then raise exception 'sem_permissao' using errcode='42501'; end if;
 return public.codex_links_projection(p_campaign,p_entry,not public.is_master(p_campaign));
end $$;

-- Um aviso por operação quando algo ainda não anunciado passa a ser visível. Ocultar e revelar de novo não repete.
create function public.codex_announce(p_entry uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex; n public.notes; keys text[]; fresh boolean;
begin
 select * into c from public.campaign_codex where id=p_entry for update;
 if c.id is null or not c.visible or c.deleted_at is not null then return; end if;
 select * into n from public.notes where id=p_entry;
 keys:=array['exists']
  || array(select k from unnest(c.revealed) k where
      (k='name') or (k='description' and coalesce(n.content,'[]'::jsonb) not in ('[]'::jsonb,'[{"type":"paragraph","content":[]}]'::jsonb))
      or (k='image' and (c.image_path is not null or c.definition_id is not null))
      or nullif(btrim(n.meta#>>array['codex',k]),'') is not null)
  -- A ficha inteira é um marcador único: sincronizar a definição (inclusive em registros migrados) não gera aviso repetido.
  || array(select distinct case when 'sheet'=any(c.revealed) then 'sheet' else 'sheet:'||(s->>'k') end from jsonb_array_elements(case when jsonb_typeof(n.meta->'sheet')='array' then n.meta->'sheet' else '[]'::jsonb end) s
      where 'sheet'=any(c.revealed) or (('sheet:'||(s->>'k'))=any(c.revealed) and not 'sheet'=any(c.announced)))
  || array(select 'link:'||(x->>'id') from jsonb_array_elements(public.codex_links_projection(c.campaign_id,c.id,true)) x);
 if keys <@ c.announced then return; end if;
 fresh:=not 'exists'=any(c.announced);
 insert into public.codex_notifications(entry_id,recipient,is_new)
  select c.id,m.user_id,fresh from public.campaign_members m where m.campaign_id=c.campaign_id and m.role<>'mestre';
 update public.campaign_codex set announced=array(select distinct a from unnest(c.announced||keys) a) where id=c.id;
end $$;
revoke all on function public.codex_announce(uuid) from public,anon,authenticated;

create function public.codex_check_sheet(p_sheet jsonb) returns void language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p_sheet)<>'array' then raise exception 'ficha_invalida'; end if;
 if jsonb_array_length(p_sheet)>60 or octet_length(p_sheet::text)>100000 or exists(select 1 from jsonb_array_elements(p_sheet) s where
  jsonb_typeof(s)<>'object' or coalesce(s->>'k','') !~ '^[a-z0-9-]{1,40}$' or jsonb_typeof(s->'l') is distinct from 'string' or jsonb_typeof(s->'v') is distinct from 'string'
  or length(s->>'l')>80 or (select count(*) from jsonb_object_keys(s))<>3)
  or (select count(*)<>count(distinct s->>'k') from jsonb_array_elements(p_sheet) s)
 then raise exception 'ficha_invalida'; end if;
end $$;
revoke all on function public.codex_check_sheet(jsonb) from public,anon,authenticated;

-- Conteúdo apenas. A visibilidade é alterada exclusivamente por codex_reveal; registro novo nasce secreto.
create or replace function public.codex_save(p_campaign uuid,p_entry uuid,p_version int,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex; nid uuid; cat text; note_kind text; path text; meta_new jsonb; reg boolean;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>140000 or octet_length((p_data-'sheet')::text)>48000 then raise exception 'dados_invalidos'; end if;
 if p_version is null or p_version<0 or (p_entry is not null and p_version=0) then raise exception 'versao_invalida'; end if;
 if p_data ? 'fields' and (jsonb_typeof(p_data->'fields')<>'object' or exists(select 1 from jsonb_each(p_data->'fields') f where f.key not in ('nickname','race','age','occupation','birthplace','residence','type','region','map','inhabitants','memberCount','history','context','personality','relationships','objectives','origin','purpose','provisional') or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>4000)) then raise exception 'campos_invalidos'; end if;
 if p_data ? 'framing' and (jsonb_typeof(p_data->'framing')<>'object' or exists(select 1 from jsonb_each(p_data->'framing') f where f.key not in ('zoom','x','y') or jsonb_typeof(f.value)<>'number') or not coalesce((p_data#>>'{framing,zoom}')::numeric between 1 and 3 and (p_data#>>'{framing,x}')::numeric between 0 and 100 and (p_data#>>'{framing,y}')::numeric between 0 and 100,false)) then raise exception 'enquadramento_invalido'; end if;
 if p_data ? 'sheet' then perform public.codex_check_sheet(p_data->'sheet'); end if;
 cat:=p_data->>'category'; reg:=coalesce((p_data->>'registered')::boolean,true);
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
  values(nid,p_campaign,auth.uid(),note_kind,btrim(p_data->>'title'),coalesce(p_data->'description','[]'::jsonb),'private',jsonb_build_object('secret',p_data->>'secret','sheet',coalesce(p_data->'sheet','[]'::jsonb),'codex',coalesce(p_data->'fields','{}'::jsonb),'framing',coalesce(p_data->'framing','{"zoom":1,"x":50,"y":50}'::jsonb)));
  insert into public.campaign_codex(id,campaign_id,category,system_id,definition_id,instance_id,image_path,registered)
  values(nid,p_campaign,cat,coalesce(p_data->>'systemId','dnd5e-2014'),nullif(p_data->>'definitionId',''),nullif(p_data->>'instanceId',''),path,reg);
 else
  select meta into meta_new from public.notes where id=nid;
  update public.notes set title=btrim(p_data->>'title'),content=coalesce(p_data->'description','[]'::jsonb),meta=jsonb_build_object('secret',p_data->>'secret','sheet',coalesce(p_data->'sheet',meta_new->'sheet','[]'::jsonb),'codex',coalesce(p_data->'fields',meta_new->'codex','{}'::jsonb),'framing',coalesce(p_data->'framing',meta_new->'framing','{"zoom":1,"x":50,"y":50}'::jsonb)) where id=nid;
  update public.campaign_codex set image_path=path,registered=registered or reg where id=nid;
  perform public.codex_announce(nid);
 end if;
 return nid;
end $$;

-- Estado completo da divulgação de um registro (e dos vínculos informados) numa transação: no máximo um aviso.
create function public.codex_reveal(p_campaign uuid,p_entry uuid,p_version int,p_visible boolean,p_revealed text[],p_links jsonb default '{}'::jsonb,p_sheet jsonb default null) returns void
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into c from public.campaign_codex where id=p_entry and campaign_id=p_campaign and deleted_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_visible is null or p_revealed is null or cardinality(p_revealed)>120 or exists(select 1 from unnest(p_revealed) k where k is null or not (k in ('name','description','image','holders','sheet','nickname','race','age','occupation','birthplace','residence','type','region','map','inhabitants','memberCount','history','context','personality','relationships','objectives','origin','purpose','provisional') or k ~ '^sheet:[a-z0-9-]{1,40}$')) then raise exception 'chaves_invalidas'; end if;
 if p_links is null or jsonb_typeof(p_links)<>'object' or exists(select 1 from jsonb_each(p_links) x where jsonb_typeof(x.value)<>'boolean' or not exists(select 1 from public.codex_links l where l.campaign_id=p_campaign and l.id::text=x.key and p_entry in (l.source_id,l.target_id))) then raise exception 'vinculo_invalido'; end if;
 if p_sheet is not null then
  perform public.codex_check_sheet(p_sheet);
  update public.notes set meta=jsonb_set(meta,'{sheet}',p_sheet) where id=p_entry and meta->'sheet' is distinct from p_sheet;
 end if;
 update public.codex_links l set revealed=(x.value)::boolean from jsonb_each_text(p_links) x where l.campaign_id=p_campaign and l.id::text=x.key;
 update public.campaign_codex set visible=p_visible,revealed=array(select distinct k from unnest(p_revealed) k order by k),registered=registered or p_visible,version=version+1 where id=p_entry;
 perform public.codex_announce(p_entry);
end $$;
revoke all on function public.codex_reveal(uuid,uuid,int,boolean,text[],jsonb,jsonb) from public,anon;
grant execute on function public.codex_reveal(uuid,uuid,int,boolean,text[],jsonb,jsonb) to authenticated;

drop function public.codex_link(uuid,uuid,uuid,text);
create function public.codex_link(p_campaign uuid,p_source uuid,p_target uuid,p_kind text,p_relation text,p_inverse text,p_revealed boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not public.is_master(p_campaign) or not public.codex_node_open(p_campaign,p_source,false) or not public.codex_node_open(p_campaign,p_target,false) then raise exception 'sem_permissao' using errcode='42501'; end if;
 insert into public.codex_links(campaign_id,source_id,target_id,kind,relation,inverse,revealed)
  values(p_campaign,p_source,p_target,p_kind,btrim(p_relation),btrim(p_inverse),coalesce(p_revealed,false)) returning id into result;
 if p_revealed then
  perform public.codex_announce(case when exists(select 1 from public.campaign_codex where id=p_source and visible) then p_source else p_target end);
 end if;
 return result;
end $$;
revoke all on function public.codex_link(uuid,uuid,uuid,text,text,text,boolean) from public,anon;
grant execute on function public.codex_link(uuid,uuid,uuid,text,text,text,boolean) to authenticated;

create or replace function public.codex_notification_feed(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare master boolean;
begin
 if not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 master:=public.is_master(p_campaign);
 return (with authorized as (
  select a.id,a.entry_id,a.is_new,a.read_at,a.created_at,
   case when master then n.title else public.codex_public_title(c.id) end title,
   case when not master and c.category='item' then 'discovery' else c.category end category
  from public.codex_notifications a join public.campaign_codex c on c.id=a.entry_id join public.notes n on n.id=c.id
  where a.recipient=auth.uid() and c.campaign_id=p_campaign and public.codex_visible(c.id)
 ) select jsonb_build_object('unread',count(*) filter(where read_at is null),
 'discoveries',count(*) filter(where read_at is null and category in ('discovery','item')),
 'items',coalesce((select jsonb_agg(to_jsonb(recent)) from (select * from authorized order by created_at desc,id desc limit 50) recent),'[]'::jsonb)) from authorized);
end $$;

-- Posse continua derivada dos inventários; para o jogador é uma informação revelável como as demais.
create or replace function public.codex_holders(p_campaign uuid,p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ref text;
begin
 if not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select definition_id into ref from public.campaign_codex where id=p_entry and campaign_id=p_campaign and category='item' and deleted_at is null
  and public.codex_visible(id) and (public.is_master(p_campaign) or 'holders'=any(revealed));
 if ref is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',n.title))
 from public.character_sheets f join public.notes n on n.id=f.character_id
 where f.campaign_id=p_campaign and n.campaign_id=p_campaign and n.kind='character' and n.visibility='campaign' and n.deleted_at is null
 and exists(select 1 from jsonb_array_elements(coalesce(f.draft->'inventory','[]'::jsonb)) i where i->>'itemId'=ref and case when jsonb_typeof(i->'quantity')='number' then (i->>'quantity')::numeric>0 else false end)), '[]'::jsonb);
end $$;

create or replace function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 17 $$;
commit;
