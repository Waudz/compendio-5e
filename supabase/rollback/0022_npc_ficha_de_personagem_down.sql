-- Somente com autorização e backup. Recusa quando já existe NPC com ficha de personagem: nenhuma ficha é apagada pela reversão.
begin;
do $$ begin
 if exists (select 1 from public.character_sheets s where private.npc_do_compendio(s.character_id)) then
  raise exception 'reversao_0022_recusada: ha NPCs com ficha de personagem; preserve ou remova essas fichas antes';
 end if;
end $$;
drop function public.codex_npc_sheet_create(uuid, uuid, int, jsonb);
drop policy character_sheets_npc_mestre on public.character_sheets;
drop policy character_combat_status_npc_mestre on public.character_combat_status;

-- funções substituídas voltam ao texto anterior
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

drop function private.npc_do_compendio(uuid);
create or replace function public.codex_capabilities() returns integer language sql stable set search_path = '' as $$ select 21 $$;
commit;
