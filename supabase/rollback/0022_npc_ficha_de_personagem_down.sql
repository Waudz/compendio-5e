-- Somente com autorização e backup. Recusa quando já existe NPC com ficha de personagem: nenhuma ficha é apagada pela reversão.
begin;
do $$ begin
 if exists (select 1 from public.character_sheets s where private.npc_do_compendio(s.character_id))
    or exists (select 1 from public.campaign_codex c where c.combat_definition_id like 'custom-npc-%')
    or exists (select 1 from private_ficha.npc_ficha_eventos e where e.copia is not null)
    or exists (select 1 from public.character_life)
    or exists (select 1 from public.campaign_combats b where b.state::text like '%"npc"%')
    or exists (select 1 from public.campaign_encounters b where b.state::text like '%"npc"%') then
  raise exception 'reversao_0022_recusada: ha fichas de NPC ou copias em retencao; preserve-as antes';
 end if;
end $$;
drop function public.codex_npc_sheet_set(uuid, uuid, int, jsonb, uuid, int, text);
drop policy character_sheets_npc_mestre on public.character_sheets;
drop policy character_combat_status_npc_mestre on public.character_combat_status;

-- funções substituídas voltam ao texto anterior
create or replace function private_combates.valid_campaign_combat_state(s jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare c jsonb; cond jsonb; ids text[] := '{}'; ident text; pv numeric; maximo numeric;
begin
  if s is null or jsonb_typeof(s) <> 'object' or octet_length(s::text) > 1048576 then return false; end if;
  if jsonb_typeof(s -> 'combatentes') is distinct from 'array' then return false; end if;
  if jsonb_array_length(s -> 'combatentes') > 1000 then return false; end if;
  for c in select value from jsonb_array_elements(s -> 'combatentes') loop
    if jsonb_typeof(c) <> 'object' then return false; end if;
    if jsonb_typeof(c -> 'id') is distinct from 'string' or jsonb_typeof(c -> 'nome') is distinct from 'string' then return false; end if;
    ident := c ->> 'id';
    if char_length(btrim(ident)) = 0 or char_length(ident) > 128 or ident = any(ids) then return false; end if;
    ids := array_append(ids, ident);
    if char_length(btrim(c ->> 'nome')) = 0 or char_length(c ->> 'nome') > 200 then return false; end if;
    if jsonb_typeof(c -> 'lado') is distinct from 'string' or (c ->> 'lado') not in ('aliado','inimigo','neutro') then return false; end if;
    if jsonb_typeof(c -> 'iniciativa') is distinct from 'number' then return false; end if;
    if abs((c ->> 'iniciativa')::numeric) > 9007199254740991 then return false; end if;
    if c ? 'pvMax' then
      if jsonb_typeof(c -> 'pvMax') is distinct from 'number' then return false; end if;
      maximo := (c ->> 'pvMax')::numeric;
      if maximo < 1 or maximo > 9007199254740991 or trunc(maximo) <> maximo then return false; end if;
    end if;
    if c ? 'pv' then
      if not (c ? 'pvMax') or jsonb_typeof(c -> 'pv') is distinct from 'number' then return false; end if;
      pv := (c ->> 'pv')::numeric;
      if pv < 0 or pv > maximo or trunc(pv) <> pv then return false; end if;
    end if;
    if c ? 'condicoes' then   -- condições: lista de textos curtos (a lista de cada sistema fica na interface)
      if jsonb_typeof(c -> 'condicoes') is distinct from 'array' or jsonb_array_length(c -> 'condicoes') > 16 then return false; end if;
      for cond in select value from jsonb_array_elements(c -> 'condicoes') loop
        if jsonb_typeof(cond) is distinct from 'string' or char_length(btrim(cond #>> '{}')) = 0 or char_length(cond #>> '{}') > 40 then return false; end if;
      end loop;
    end if;
    if c ? 'ref' then   -- referência a monstro do catálogo ou personagem da campanha
      if jsonb_typeof(c -> 'ref') <> 'object' or (c -> 'ref' ->> 'tipo') is null or (c -> 'ref' ->> 'tipo') not in ('monstro', 'personagem')
         or jsonb_typeof(c -> 'ref' -> 'id') is distinct from 'string' or char_length(btrim(c -> 'ref' ->> 'id')) = 0 or char_length(c -> 'ref' ->> 'id') > 128 then return false; end if;
    end if;
  end loop;
  if cardinality(ids) = 0 then return s -> 'turno' = 'null'::jsonb; end if;
  return coalesce(jsonb_typeof(s -> 'turno') = 'string' and (s ->> 'turno') = any(ids), false);
end $$;

create or replace function private_combates.valid_campaign_encounters_state(s jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare e jsonb; p jsonb; eids text[] := '{}'; pids text[]; ident text; q numeric; hp numeric;
begin
  if s is null or jsonb_typeof(s) <> 'object' or octet_length(s::text) > 2097152 then return false; end if;
  if jsonb_typeof(s -> 'encontros') is distinct from 'array' or jsonb_array_length(s -> 'encontros') > 200 then return false; end if;
  for e in select value from jsonb_array_elements(s -> 'encontros') loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'id') is distinct from 'string' or jsonb_typeof(e -> 'nome') is distinct from 'string' then return false; end if;
    ident := e ->> 'id';
    if char_length(btrim(ident)) = 0 or char_length(ident) > 128 or ident = any(eids) then return false; end if;
    eids := array_append(eids, ident);
    if char_length(btrim(e ->> 'nome')) = 0 or char_length(e ->> 'nome') > 80 then return false; end if;
    if jsonb_typeof(e -> 'participantes') is distinct from 'array' or jsonb_array_length(e -> 'participantes') > 200 then return false; end if;
    pids := '{}';
    for p in select value from jsonb_array_elements(e -> 'participantes') loop
      if jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'id') is distinct from 'string' or jsonb_typeof(p -> 'nome') is distinct from 'string' then return false; end if;
      ident := p ->> 'id';
      if char_length(btrim(ident)) = 0 or char_length(ident) > 128 or ident = any(pids) then return false; end if;
      pids := array_append(pids, ident);
      if char_length(btrim(p ->> 'nome')) = 0 or char_length(p ->> 'nome') > 200 then return false; end if;
      if jsonb_typeof(p -> 'quantidade') is distinct from 'number' then return false; end if;
      q := (p ->> 'quantidade')::numeric;
      if q < 1 or q > 50 or trunc(q) <> q then return false; end if;
      if p ? 'pv' then
        if jsonb_typeof(p -> 'pv') is distinct from 'number' then return false; end if;
        hp := (p ->> 'pv')::numeric;
        if hp < 1 or hp > 9007199254740991 or trunc(hp) <> hp then return false; end if;
      end if;
      if p ? 'ref' then   -- referência opcional a um item do catálogo/ficha: { tipo: 'monstro' | 'personagem', id }
        if jsonb_typeof(p -> 'ref') <> 'object' or (p -> 'ref' ->> 'tipo') is null or (p -> 'ref' ->> 'tipo') not in ('monstro', 'personagem')
           or jsonb_typeof(p -> 'ref' -> 'id') is distinct from 'string' or char_length(btrim(p -> 'ref' ->> 'id')) = 0 or char_length(p -> 'ref' ->> 'id') > 128 then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
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

create or replace function private_ficha.purgar_copias() returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update private_ficha.ciclo_eventos set copia = null, copia_expira_em = null where copia is not null and copia_expira_em <= now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function private.nota_guiada_ativa(p_id uuid, p_campaign uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n
                  where n.id = p_id and n.campaign_id = p_campaign and n.owner_id = p_owner and n.kind = 'character'
                    and n.deleted_at is null and private.identidade_meta_valida(n.meta))
$$;

create or replace function private.notes_ficha_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ficha jsonb;
begin
  -- registro com situação própria não vai para a lixeira nem é apagado logicamente fora das funções do ciclo
  if new.deleted_at is distinct from old.deleted_at and private.situacao_personagem(old.id) is not null and not private.mudanca_de_ciclo(old.id) then
    raise exception 'personagem_guiado_nao_exclui' using errcode = '42501';
  end if;
  select s.draft into ficha from public.character_sheets s where s.character_id = new.id;
  if found then
    if new.kind <> 'character' or new.campaign_id is distinct from old.campaign_id
       or (new.owner_id is distinct from old.owner_id and not private.mudanca_de_ciclo(old.id)) then
      raise exception 'personagem_guiado_imutavel' using errcode = '42501';
    end if;
    if new.deleted_at is not null then raise exception 'personagem_guiado_nao_exclui' using errcode = '42501'; end if;
    if not private.identidade_meta_valida(new.meta) then raise exception 'identidade_invalida' using errcode = '23514'; end if;
    new.meta := jsonb_build_object('guiado', true, 'identidadePublica', private_ficha.projetar(new.meta, ficha, new.campaign_id));
    new.title := private.titulo_publico(new.meta);
    new.visibility := 'campaign';
  end if;
  return new;
end $$;

create or replace function private_ficha.travar(p_id uuid) returns public.character_sheets
language plpgsql security definer set search_path = '' as $$
declare s public.character_sheets;
begin
  if (select auth.uid()) is null then raise exception 'nao_autenticado' using errcode = '42501'; end if;
  select * into s from public.character_sheets c where c.character_id = p_id for update;
  if not found or not (public.is_master(s.campaign_id) or (s.owner_id = (select auth.uid()) and public.is_member(s.campaign_id))) then
    raise exception 'ficha_nao_encontrada' using errcode = 'P0002';
  end if;
  return s;
end $$;

create or replace function private_ficha.recusar_destino_inativo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private_ficha.tipo_operacao(new.character_id) = 'transferencia' and not public.is_master(new.campaign_id)
     and new.owner_id <> (select auth.uid()) and private.situacao_personagem(new.character_id) in ('aguardando', 'arquivado') then
    raise exception 'destino_invalido' using errcode = 'P0002';
  end if;
  return new;
end $$;

create or replace function public.codex_set_combat_sheet(p_campaign uuid,p_entry uuid,p_version int,p_definition_id text) returns void
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

create or replace function public.codex_remove(p_campaign uuid,p_entry uuid,p_version int) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 update public.campaign_codex set deleted_at=now(),version=version+1 where id=p_entry and campaign_id=p_campaign and version=p_version and deleted_at is null;
 if not found then raise exception 'conflito_de_versao'; end if;
end $$;

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

drop function public.character_life_set(uuid, uuid, jsonb, uuid, int);
drop table public.character_life;
drop table private_ficha.npc_ficha_eventos;
drop function private.npc_do_compendio(uuid);
create or replace function public.codex_capabilities() returns integer language sql stable set search_path = '' as $$ select 21 $$;
commit;
