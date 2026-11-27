-- 0020 — PROPOSTA, NÃO APLICADA. Requer 0017, 0018 e 0019. Cartas do Compêndio e bestiário narrativo.
-- 1. O jogador nunca recebe estatísticas de criatura: nem seções técnicas, nem a definição, em nenhum nível de conhecimento.
-- 2. Novos campos narrativos. 3. Referências no texto (@[texto](id)) são saneadas na projeção do jogador.
-- 4. Ficha de combate opcional de NPC (referência a uma definição de criatura), visível somente ao mestre.
-- Nenhum registro é apagado ou convertido. Chaves de ficha já reveladas em criaturas permanecem gravadas e passam a ser ignoradas.
begin;
alter table public.campaign_codex add column combat_definition_id text
 check(combat_definition_id is null or (category='npc' and combat_definition_id ~ '^[a-z0-9]+([.-][a-z0-9]+)*$' and length(combat_definition_id)<=200));

-- Referência no texto narrativo. Destino fechado ao jogador: fica só o texto, sem o ID. Se o texto for o nome verdadeiro
-- ainda oculto (preenchimento automático do editor), é trocado pelo título público.
create function public.codex_refs_text(p_campaign uuid,p_text text) returns text language plpgsql stable security definer set search_path='' as $$
declare m text[]; result text:=p_text; target record; shown text; open boolean;
begin
 if p_text is null or position('@[' in p_text)=0 then return p_text; end if;
 for m in select regexp_matches(p_text,'(@\[([^]\n]{1,120})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\))','g') loop
  select n.id,n.title,c.id as entry,c.category,c.revealed into target from public.notes n left join public.campaign_codex c on c.id=n.id
   where n.id=m[3]::uuid and n.campaign_id=p_campaign;
  open:=target.id is not null and public.codex_node_open(p_campaign,target.id,true);
  shown:=m[2];
  if target.id is not null and lower(btrim(shown))=lower(btrim(target.title)) then
   if target.entry is not null and not 'name'=any(target.revealed) then
    shown:=case when open then public.codex_public_title(target.entry) else public.codex_neutral_title(target.category) end;
   elsif target.entry is null and not open then shown:='Pessoa desconhecida';
   end if;
  end if;
  result:=replace(result,m[1],case when open then '@['||replace(shown,']','')||']('||lower(m[3])||')' else shown end);
 end loop;
 return result;
end $$;
revoke all on function public.codex_refs_text(uuid,text) from public,anon,authenticated;

create function public.codex_refs_json(p_campaign uuid,p_value jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 case jsonb_typeof(p_value)
  when 'string' then return to_jsonb(public.codex_refs_text(p_campaign,p_value#>>'{}'));
  when 'array' then return coalesce((select jsonb_agg(public.codex_refs_json(p_campaign,e.value) order by e.ordinality) from jsonb_array_elements(p_value) with ordinality e),'[]'::jsonb);
  when 'object' then return coalesce((select jsonb_object_agg(e.key,public.codex_refs_json(p_campaign,e.value)) from jsonb_each(p_value) e),'{}'::jsonb);
  else return p_value;
 end case;
end $$;
revoke all on function public.codex_refs_json(uuid,jsonb) from public,anon,authenticated;

create or replace function public.codex_project(p_entry uuid,p_player boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.campaign_codex; n public.notes; full_id boolean; sheet jsonb; monster boolean;
begin
 select * into c from public.campaign_codex where id=p_entry;
 select * into n from public.notes where id=p_entry;
 sheet:=case when jsonb_typeof(n.meta->'sheet')='array' then n.meta->'sheet' else '[]'::jsonb end;
 if not p_player then
  return jsonb_strip_nulls(jsonb_build_object('id',c.id,'category',c.category,'systemId',c.system_id,'version',c.version,
   'title',n.title,'description',n.content,'fields',n.meta->'codex','sheet',sheet,'framing',n.meta->'framing',
   'imagePath',c.image_path,'imageDefinitionId',c.definition_id,'definitionId',c.definition_id,'instanceId',c.instance_id,
   'secret',n.meta->>'secret','combatDefinitionId',c.combat_definition_id,'visible',c.visible,'revealed',to_jsonb(c.revealed),'registered',c.registered));
 end if;
 -- criatura: o jogador nunca recebe seção técnica nem a identificação da definição, em nenhum nível de conhecimento
 monster:=c.category='monster';
 if monster then sheet:='[]'::jsonb; end if;
 full_id:=not monster and c.definition_id is not null and public.codex_identified(c.revealed,sheet);
 -- sem número de versão: ele contaria edições secretas
 return jsonb_strip_nulls(jsonb_build_object('id',c.id,
  'category',case when c.category='item' and not full_id then 'discovery' else c.category end,
  'systemId',c.system_id,'visible',true,
  'title',public.codex_public_title(c.id),
  'description',case when 'description'=any(c.revealed) then public.codex_refs_json(c.campaign_id,n.content) end,
  'fields',(select jsonb_object_agg(f.key,public.codex_refs_json(c.campaign_id,f.value)) from jsonb_each(case when jsonb_typeof(n.meta->'codex')='object' then n.meta->'codex' else '{}'::jsonb end) f where f.key=any(c.revealed)),
  'sheet',(select jsonb_agg(s.value order by s.ordinality) from jsonb_array_elements(sheet) with ordinality s where 'sheet'=any(c.revealed) or ('sheet:'||(s.value->>'k'))=any(c.revealed)),
  'framing',case when 'image'=any(c.revealed) then n.meta->'framing' end,
  'imagePath',case when 'image'=any(c.revealed) then c.image_path end,
  'imageDefinitionId',case when 'image'=any(c.revealed) and 'name'=any(c.revealed) then c.definition_id end,
  'definitionId',case when full_id then c.definition_id end,
  'relatedTerms',(select jsonb_agg(x->>'title') from jsonb_array_elements(public.codex_links_projection(c.campaign_id,c.id,true)) x)));
end $$;

create or replace function public.codex_announce(p_entry uuid) returns void language plpgsql security definer set search_path='' as $$
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
      where c.category<>'monster' and ('sheet'=any(c.revealed) or (('sheet:'||(s->>'k'))=any(c.revealed) and not 'sheet'=any(c.announced))))
  || array(select 'link:'||(x->>'id') from jsonb_array_elements(public.codex_links_projection(c.campaign_id,c.id,true)) x);
 if keys <@ c.announced then return; end if;
 fresh:=not 'exists'=any(c.announced);
 insert into public.codex_notifications(entry_id,recipient,is_new)
  select c.id,m.user_id,fresh from public.campaign_members m where m.campaign_id=c.campaign_id and m.role<>'mestre';
 update public.campaign_codex set announced=array(select distinct a from unnest(c.announced||keys) a) where id=c.id;
end $$;

create or replace function public.codex_save(p_campaign uuid,p_entry uuid,p_version int,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex; nid uuid; cat text; note_kind text; path text; meta_new jsonb; reg boolean;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>140000 or octet_length((p_data-'sheet')::text)>48000 then raise exception 'dados_invalidos'; end if;
 if p_version is null or p_version<0 or (p_entry is not null and p_version=0) then raise exception 'versao_invalida'; end if;
 if p_data ? 'fields' and (jsonb_typeof(p_data->'fields')<>'object' or exists(select 1 from jsonb_each(p_data->'fields') f where f.key not in ('nickname','race','age','occupation','birthplace','residence','type','region','map','inhabitants','memberCount','history','context','personality','relationships','objectives','origin','purpose','provisional','classLevel','leadership','headquarters','classification','appearance','habitat','behavior','diet','capabilities','weaknesses','defenses','strategies','sightings') or jsonb_typeof(f.value)<>'string' or length(f.value #>> '{}')>4000)) then raise exception 'campos_invalidos'; end if;
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

create or replace function public.codex_reveal(p_campaign uuid,p_entry uuid,p_version int,p_visible boolean,p_revealed text[],p_links jsonb default '{}'::jsonb,p_sheet jsonb default null) returns void
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into c from public.campaign_codex where id=p_entry and campaign_id=p_campaign and deleted_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_visible is null or p_revealed is null or cardinality(p_revealed)>120 or exists(select 1 from unnest(p_revealed) k where k is null or not (k in ('name','description','image','holders','sheet','nickname','race','age','occupation','birthplace','residence','type','region','map','inhabitants','memberCount','history','context','personality','relationships','objectives','origin','purpose','provisional','classLevel','leadership','headquarters','classification','appearance','habitat','behavior','diet','capabilities','weaknesses','defenses','strategies','sightings') or k ~ '^sheet:[a-z0-9-]{1,40}$')) then raise exception 'chaves_invalidas'; end if;
 if p_links is null or jsonb_typeof(p_links)<>'object' or exists(select 1 from jsonb_each(p_links) x where jsonb_typeof(x.value)<>'boolean' or not exists(select 1 from public.codex_links l where l.campaign_id=p_campaign and l.id::text=x.key and p_entry in (l.source_id,l.target_id))) then raise exception 'vinculo_invalido'; end if;
 if p_sheet is not null then
  perform public.codex_check_sheet(p_sheet);
  update public.notes set meta=jsonb_set(meta,'{sheet}',p_sheet) where id=p_entry and meta->'sheet' is distinct from p_sheet;
 end if;
 update public.codex_links l set revealed=(x.value)::boolean from jsonb_each_text(p_links) x where l.campaign_id=p_campaign and l.id::text=x.key;
 update public.campaign_codex set visible=p_visible,revealed=array(select distinct k from unnest(p_revealed) k where c.category<>'monster' or not (k='sheet' or k like 'sheet:%') order by k),registered=registered or p_visible,version=version+1 where id=p_entry;
 perform public.codex_announce(p_entry);
end $$;

create or replace function public.codex_definition_remove(p_campaign uuid,p_kind text,p_definition_id text,p_version int,p_sheet jsonb default null,p_original_name text default null) returns void
language plpgsql security definer set search_path='' as $$
declare old public.campaign_definitions;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into old from public.campaign_definitions where campaign_id=p_campaign and kind=p_kind and definition_id=p_definition_id for update;
 if old.definition_id is null or old.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_definition_id like 'custom-%' then
  if exists(select 1 from public.campaign_codex where campaign_id=p_campaign and deleted_at is null and ((category=p_kind and definition_id=p_definition_id) or (p_kind='monster' and combat_definition_id=p_definition_id))) then raise exception 'definicao_em_uso'; end if;
 else
  if p_sheet is null or p_original_name is null then raise exception 'padrao_ausente'; end if;
  perform public.codex_check_sheet(p_sheet);
  perform public.codex_definition_sync(p_campaign,p_kind,p_definition_id,p_sheet,old.data#>>'{definition,nome}',p_original_name);
 end if;
 delete from public.campaign_definitions where campaign_id=p_campaign and kind=p_kind and definition_id=p_definition_id;
end $$;

create or replace function public.codex_definitions_for(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare master boolean;
begin
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 master:=public.is_master(p_campaign);
 return coalesce((
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind',d.kind,'definitionId',d.definition_id,
    'baseId',case when master then d.base_id end,'version',d.version,
    'data',jsonb_build_object('definition',d.data->'definition','descricao',d.data->'descricao'))) order by d.updated_at,d.definition_id)
  from public.campaign_definitions d where d.campaign_id=p_campaign and (master
   -- definições de criaturas são exclusivas do mestre, mesmo com a página totalmente revelada
   or (d.kind='item' and exists(select 1 from public.campaign_codex c join public.notes n on n.id=c.id
        where c.campaign_id=p_campaign and c.category=d.kind and c.system_id='dnd5e-2014' and c.definition_id=d.definition_id
         and c.visible and c.deleted_at is null and n.deleted_at is null and public.codex_identified(c.revealed,n.meta->'sheet')))
   or (d.kind='item' and exists(select 1 from private_ficha.itens_vistos v join public.character_sheets s on s.character_id=v.character_id
        where s.campaign_id=p_campaign and s.owner_id=auth.uid() and v.item_id=d.definition_id)))
 ),'[]'::jsonb) || coalesce((
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind','item','definitionId',m.token,'version',1,'mask',true,
    'identifiesAs',case when master then m.definition_id end,
    'data',jsonb_build_object('definition',jsonb_strip_nulls(jsonb_build_object('id',m.token,'en','Unidentified','nome',m.nome,'categoria','equipamento','raridade','mundano','peso',m.peso)),
      'descricao',nullif(m.descricao,'')))) order by m.created_at,m.token)
  from private_ficha.mascaras m where m.campaign_id=p_campaign and m.identified_at is null and (master
   or exists(select 1 from private_ficha.itens_vistos v join public.character_sheets s on s.character_id=v.character_id
        where s.campaign_id=p_campaign and s.owner_id=auth.uid() and v.item_id=m.token))
 ),'[]'::jsonb);
end $$;

-- Ficha de combate de um NPC: reutiliza uma definição de criatura (catálogo ou da campanha). Nada é criado automaticamente.
create function public.codex_set_combat_sheet(p_campaign uuid,p_entry uuid,p_version int,p_definition_id text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into c from public.campaign_codex where id=p_entry and campaign_id=p_campaign and category='npc' and deleted_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_definition_id like 'custom-%' and not exists(select 1 from public.campaign_definitions d where d.campaign_id=p_campaign and d.kind='monster' and d.definition_id=p_definition_id) then
  raise exception 'definicao_inexistente' using errcode='P0002'; end if;
 update public.campaign_codex set combat_definition_id=p_definition_id,version=version+1 where id=p_entry;
end $$;
revoke all on function public.codex_set_combat_sheet(uuid,uuid,int,text) from public,anon;
grant execute on function public.codex_set_combat_sheet(uuid,uuid,int,text) to authenticated;

create or replace function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 20 $$;
commit;
