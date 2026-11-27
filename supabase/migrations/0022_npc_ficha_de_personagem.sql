-- 0022 — PROPOSTA, NÃO APLICADA. Requer 0001–0021. Não aplicar em produção sem autorização específica.
-- DEC-039, etapa 2: NPC do Compêndio com ficha de personagem, SEM segunda identidade. A ficha usa o mesmo ID do registro narrativo
-- (character_sheets.character_id = campaign_codex.id = notes.id). Um NPC tem no máximo uma ficha: de criatura (referência da 0020)
-- OU de personagem. A ficha é só do mestre; a projeção do jogador não muda.
-- Aditiva: nenhum dado existente é alterado. Reversão em supabase/rollback/0022_npc_ficha_de_personagem_down.sql.
begin;
do $$ begin
 if public.codex_capabilities() <> 21 then raise exception 'migracao_0022_exige_0021'; end if;
end $$;

create function private.npc_do_compendio(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_codex c join public.notes n on n.id = c.id
                  where c.id = p_id and c.category = 'npc' and n.kind = 'npc')
$$;
revoke all on function private.npc_do_compendio(uuid) from public, anon;
grant execute on function private.npc_do_compendio(uuid) to authenticated;

-- Fronteira própria, além das políticas existentes: ficha de NPC só para o mestre ATUAL (um antigo mestre, dono da linha, perde o acesso).
create policy character_sheets_npc_mestre on public.character_sheets as restrictive to authenticated
  using (not private.npc_do_compendio(character_id) or public.is_master(campaign_id))
  with check (not private.npc_do_compendio(character_id) or public.is_master(campaign_id));

-- A gravação comum da ficha (save_guided_character e a política de UPDATE) passa a aceitar também o NPC do Compêndio.
create or replace function private.nota_guiada_ativa(p_id uuid, p_campaign uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n
                  where n.id = p_id and n.campaign_id = p_campaign and n.owner_id = p_owner and n.kind = 'character'
                    and n.deleted_at is null and private.identidade_meta_valida(n.meta))
      or exists (select 1 from public.notes n join public.campaign_codex c on c.id = n.id
                  join public.campaign_members m on m.campaign_id = n.campaign_id and m.user_id = n.owner_id and m.role = 'mestre'
                 where n.id = p_id and n.campaign_id = p_campaign and n.owner_id = p_owner and n.kind = 'npc' and n.deleted_at is null
                   and c.category = 'npc' and c.deleted_at is null)
$$;

create or replace function private.notes_ficha_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ficha jsonb;
begin
  -- NPC do Compêndio com ficha de personagem: a nota continua sendo o registro narrativo privado do mestre. A ficha não reescreve
  -- título, texto nem metadados (é lá que ficam os segredos e o conhecimento por campo).
  if private.npc_do_compendio(old.id) and exists (select 1 from public.character_sheets s where s.character_id = old.id) then
    if new.kind <> old.kind or new.campaign_id is distinct from old.campaign_id or new.owner_id is distinct from old.owner_id
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'personagem_guiado_imutavel' using errcode = '42501';
    end if;
    return new;
  end if;
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
  -- as operações do servidor não passam pelas políticas: a ficha de NPC é só do mestre atual também aqui
  if private.npc_do_compendio(s.character_id) and not public.is_master(s.campaign_id) then
    raise exception 'ficha_nao_encontrada' using errcode = 'P0002';
  end if;
  return s;
end $$;

create policy character_combat_status_npc_mestre on public.character_combat_status as restrictive to authenticated
  using (not private.npc_do_compendio(character_id) or exists (select 1 from public.character_sheets s where s.character_id = character_combat_status.character_id and public.is_master(s.campaign_id)));

create or replace function private_ficha.recusar_destino_inativo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- um jogador não entrega itens a um NPC, mesmo conhecendo o ID de uma página revelada (nem descobre que ele tem ficha)
  if private_ficha.tipo_operacao(new.character_id) = 'transferencia' and not public.is_master(new.campaign_id)
     and private.npc_do_compendio(new.character_id) then
    raise exception 'destino_invalido' using errcode = 'P0002';
  end if;
  if private_ficha.tipo_operacao(new.character_id) = 'transferencia' and not public.is_master(new.campaign_id)
     and new.owner_id <> (select auth.uid()) and private.situacao_personagem(new.character_id) in ('aguardando', 'arquivado') then
    raise exception 'destino_invalido' using errcode = 'P0002';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ estado vital e PV persistentes
-- Estado vital (vivo, morto, desconhecido) é da identidade narrativa: separado do ciclo de gestão, das condições e dos PV.
-- `pv`, `temp` e `condicoes` só servem ao NPC com ficha de CRIATURA (a de personagem guarda os seus na própria ficha).
create table public.character_life (
  note_id uuid primary key references public.notes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  estado text not null default 'vivo' check (estado in ('vivo', 'morto', 'desconhecido')),
  pv int check (pv between 0 and 100000),
  temp int not null default 0 check (temp between 0 and 999),
  condicoes jsonb not null default '[]'::jsonb check (jsonb_typeof(condicoes) = 'array' and jsonb_array_length(condicoes) <= 16 and octet_length(condicoes::text) <= 2000),
  operacao uuid,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create index character_life_campaign on public.character_life(campaign_id);
alter table public.character_life enable row level security;
revoke all on public.character_life from public, anon, authenticated;
grant select on public.character_life to authenticated;
-- o mestre lê tudo; o jogador, só o estado do aventureiro que é dele (NPC chega a ele apenas pela projeção, se revelado)
create policy character_life_read on public.character_life for select to authenticated
  using (public.is_master(campaign_id)
    or exists (select 1 from public.character_sheets s where s.character_id = character_life.note_id and s.owner_id = (select auth.uid())
               and public.is_member(s.campaign_id) and not private.npc_do_compendio(s.character_id)));

-- Escrita única, só do mestre. As regras de dano, cura e condições são as do aplicativo (as mesmas da ficha): o servidor guarda o
-- resultado com versão otimista e identificador de operação (repetir não muda nada).
create function public.character_life_set(p_campaign uuid, p_note uuid, p_patch jsonb, p_operation uuid, p_version int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.notes; r public.character_life; criatura boolean;
begin
  if (select auth.uid()) is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into n from public.notes x where x.id = p_note and x.campaign_id = p_campaign and x.deleted_at is null for update;
  if n.id is null or not (n.kind = 'character' or private.npc_do_compendio(n.id)) then raise exception 'personagem_indisponivel' using errcode = 'P0002'; end if;
  if p_operation is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb
     or exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('estado', 'pv', 'temp', 'condicoes')) then
    raise exception 'dados_invalidos' using errcode = '23514';
  end if;
  select * into r from public.character_life v where v.note_id = p_note;
  if r.note_id is not null and r.operacao = p_operation then return to_jsonb(r) - 'operacao'; end if;
  if p_patch ?| array['pv', 'temp', 'condicoes'] then
    select c.combat_definition_id is not null into criatura from public.campaign_codex c where c.id = p_note and c.category = 'npc' and c.deleted_at is null;
    if not coalesce(criatura, false) then raise exception 'estado_da_ficha' using errcode = '23514'; end if;
    if p_version is distinct from coalesce(r.version, 0) then raise exception 'conflito_de_versao'; end if;
    if (p_patch ? 'pv' and jsonb_typeof(p_patch -> 'pv') not in ('number', 'null'))
       or (p_patch ? 'temp' and jsonb_typeof(p_patch -> 'temp') <> 'number')
       or (p_patch ? 'condicoes' and (jsonb_typeof(p_patch -> 'condicoes') <> 'array'
           or exists (select 1 from jsonb_array_elements(p_patch -> 'condicoes') x
                       where jsonb_typeof(x) <> 'string' or char_length(btrim(x #>> '{}')) not between 1 and 40))) then
      raise exception 'dados_invalidos' using errcode = '23514';
    end if;
  end if;
  insert into public.character_life(note_id, campaign_id) values (p_note, p_campaign) on conflict (note_id) do nothing;
  update public.character_life v set
    estado = coalesce(p_patch ->> 'estado', v.estado),
    pv = case when p_patch ? 'pv' then (p_patch ->> 'pv')::int else v.pv end,
    temp = coalesce((p_patch ->> 'temp')::int, v.temp),
    condicoes = coalesce(p_patch -> 'condicoes', v.condicoes),
    operacao = p_operation, version = case when r.note_id is null then 1 else v.version + 1 end, updated_at = now()
   where v.note_id = p_note returning * into r;
  return to_jsonb(r) - 'operacao';
end $$;
revoke all on function public.character_life_set(uuid, uuid, jsonb, uuid, int) from public, anon;
grant execute on function public.character_life_set(uuid, uuid, jsonb, uuid, int) to authenticated;

-- Combate e encontros preparados passam a aceitar a referência a um NPC com ficha de criatura.
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
      if jsonb_typeof(c -> 'ref') <> 'object' or (c -> 'ref' ->> 'tipo') is null or (c -> 'ref' ->> 'tipo') not in ('monstro', 'personagem', 'npc')
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
        if jsonb_typeof(p -> 'ref') <> 'object' or (p -> 'ref' ->> 'tipo') is null or (p -> 'ref' ->> 'tipo') not in ('monstro', 'personagem', 'npc')
           or jsonb_typeof(p -> 'ref' -> 'id') is distinct from 'string' or char_length(btrim(p -> 'ref' ->> 'id')) = 0 or char_length(p -> 'ref' ->> 'id') > 128 then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
end $$;

-- O estado vital é revelado pelo conhecimento por campo já existente.
create or replace function public.codex_reveal(p_campaign uuid,p_entry uuid,p_version int,p_visible boolean,p_revealed text[],p_links jsonb default '{}'::jsonb,p_sheet jsonb default null) returns void
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into c from public.campaign_codex where id=p_entry and campaign_id=p_campaign and deleted_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_visible is null or p_revealed is null or cardinality(p_revealed)>120 or exists(select 1 from unnest(p_revealed) k where k is null or not (k in ('name','description','image','holders','sheet','vitalStatus','nickname','race','age','occupation','birthplace','residence','type','region','map','inhabitants','memberCount','history','context','personality','relationships','objectives','origin','purpose','provisional','classLevel','leadership','headquarters','classification','appearance','habitat','behavior','diet','capabilities','weaknesses','defenses','strategies','sightings') or k ~ '^sheet:[a-z0-9-]{1,40}$')) then raise exception 'chaves_invalidas'; end if;
 if p_links is null or jsonb_typeof(p_links)<>'object' or exists(select 1 from jsonb_each(p_links) x where jsonb_typeof(x.value)<>'boolean' or not exists(select 1 from public.codex_links l where l.campaign_id=p_campaign and l.id::text=x.key and p_entry in (l.source_id,l.target_id))) then raise exception 'vinculo_invalido'; end if;
 if p_sheet is not null then
  perform public.codex_check_sheet(p_sheet);
  update public.notes set meta=jsonb_set(meta,'{sheet}',p_sheet) where id=p_entry and meta->'sheet' is distinct from p_sheet;
 end if;
 update public.codex_links l set revealed=(x.value)::boolean from jsonb_each_text(p_links) x where l.campaign_id=p_campaign and l.id::text=x.key;
 update public.campaign_codex set visible=p_visible,revealed=array(select distinct k from unnest(p_revealed) k where c.category<>'monster' or not (k='sheet' or k like 'sheet:%') order by k),registered=registered or p_visible,version=version+1 where id=p_entry;
 perform public.codex_announce(p_entry);
end $$;

-- ------------------------------------------------------------------ histórico e retenção das fichas de NPC
-- Uma linha por operação aceita (idempotência). `copia` guarda a ficha técnica removida ou substituída: fora da API, 30 dias.
create table private_ficha.npc_ficha_eventos (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  entry_id uuid not null,
  actor_id uuid not null,
  operation_id uuid not null,
  removida text check (removida in ('personagem', 'criatura')),
  nova text check (nova in ('personagem', 'criatura')),
  titulo text not null,
  copia jsonb,
  copia_expira_em timestamptz check (copia is null or copia_expira_em is not null),
  em timestamptz not null default now(),
  unique (entry_id, operation_id)
);
create index npc_ficha_eventos_expira on private_ficha.npc_ficha_eventos(copia_expira_em) where copia is not null;
revoke all on private_ficha.npc_ficha_eventos from public, anon, authenticated;

-- A limpeza diária já agendada pela 0021 passa a apagar também as cópias vencidas das fichas de NPC.
create or replace function private_ficha.purgar_copias() returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; m integer;
begin
  update private_ficha.ciclo_eventos set copia = null, copia_expira_em = null where copia is not null and copia_expira_em <= now();
  get diagnostics n = row_count;
  update private_ficha.npc_ficha_eventos set copia = null, copia_expira_em = null where copia is not null and copia_expira_em <= now();
  get diagnostics m = row_count;
  return n + m;
end $$;

-- Porta única da ficha técnica de um NPC: adicionar, substituir ou remover (p_nova nula), numa transação só.
-- p_nova: {"tipo":"personagem","draft":{...}} ou {"tipo":"criatura","definicao":{...},"base":"goblin","secoes":[...]}.
-- A identidade narrativa (título, texto, segredos, retrato, vínculos, divulgação) não é tocada.
create function public.codex_npc_sheet_set(p_campaign uuid, p_entry uuid, p_version int, p_nova jsonb, p_operation uuid,
                                           p_revision int default null, p_confirm text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.campaign_codex; n public.notes; s public.character_sheets; d public.campaign_definitions; eu uuid := (select auth.uid());
  tipo text := p_nova ->> 'tipo'; propria text := 'custom-npc-' || p_entry::text;
  removida text; copia jsonb; vistos jsonb; refs jsonb; feita record; revisao int; quando timestamptz;
begin
  if eu is null or p_operation is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into c from public.campaign_codex x where x.id = p_entry and x.campaign_id = p_campaign and x.deleted_at is null for update;
  if c.id is null then raise exception 'conflito_de_versao'; end if;
  select e.actor_id, e.nova into feita from private_ficha.npc_ficha_eventos e where e.entry_id = p_entry and e.operation_id = p_operation;
  if found then
    if feita.actor_id <> eu or feita.nova is distinct from tipo then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    select x.revision, x.updated_at into revisao, quando from public.character_sheets x where x.character_id = p_entry;
    return jsonb_strip_nulls(jsonb_build_object('revision', revisao, 'updatedAt', quando));
  end if;
  if c.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
  select * into n from public.notes x where x.id = p_entry for update;
  if c.category <> 'npc' or n.kind <> 'npc' or n.deleted_at is not null or n.owner_id <> eu then
    raise exception 'npc_indisponivel' using errcode = 'P0002';
  end if;
  if p_nova is not null and (jsonb_typeof(p_nova) <> 'object' or tipo is null or tipo not in ('personagem', 'criatura')) then
    raise exception 'dados_invalidos' using errcode = '23514';
  end if;
  if tipo = 'personagem' and (jsonb_typeof(p_nova -> 'draft') is distinct from 'object' or p_nova #>> '{draft,id}' is distinct from p_entry::text) then
    raise exception 'dados_invalidos' using errcode = '23514';
  end if;
  if tipo = 'criatura' and (jsonb_typeof(p_nova -> 'definicao') is distinct from 'object' or p_nova #>> '{definicao,id}' is distinct from propria
       or coalesce(btrim(p_nova #>> '{definicao,nome}'), '') = '' or octet_length((p_nova -> 'definicao')::text) > 140000) then
    raise exception 'dados_invalidos' using errcode = '23514';
  end if;
  perform private_ficha.purgar_copias();
  select * into s from public.character_sheets x where x.character_id = p_entry for update;
  if s.character_id is not null then removida := 'personagem';
  elsif c.combat_definition_id = propria then removida := 'criatura';
  end if;
  if p_nova is null and removida is null and c.combat_definition_id is null then raise exception 'sem_ficha' using errcode = 'P0002'; end if;
  -- perder uma ficha própria exige intenção declarada; a de personagem, também a revisão que o mestre está vendo
  if removida is not null and p_confirm is distinct from 'remover-ficha' then raise exception 'confirmacao_exigida' using errcode = '23514'; end if;
  if removida = 'personagem' and p_revision is distinct from s.revision then raise exception 'conflito_de_revisao' using errcode = '40001'; end if;

  if removida = 'personagem' then
    select coalesce(jsonb_agg(v.item_id), '[]'::jsonb) into vistos from private_ficha.itens_vistos v where v.character_id = p_entry;
    refs := private_ficha.desligar_referencias(p_campaign, p_entry);
    copia := jsonb_build_object('ficha', to_jsonb(s), 'itens_vistos', vistos, 'referencias', refs);
    delete from public.character_sheets x where x.character_id = p_entry;
  end if;
  update public.campaign_codex set combat_definition_id = null where id = p_entry;
  select * into d from public.campaign_definitions x where x.campaign_id = p_campaign and x.kind = 'monster' and x.definition_id = propria for update;
  if d.definition_id is not null then
    if removida = 'criatura' then copia := jsonb_build_object('definicao', to_jsonb(d)); end if;
    delete from public.campaign_definitions x where x.campaign_id = p_campaign and x.kind = 'monster' and x.definition_id = propria;
  end if;

  if tipo = 'personagem' then
    insert into public.character_sheets(character_id, campaign_id, owner_id, draft) values (p_entry, p_campaign, eu, p_nova -> 'draft')
      returning character_sheets.revision, character_sheets.updated_at into revisao, quando;
  elsif tipo = 'criatura' then
    perform public.codex_definition_save(p_campaign, 'monster', propria, 0, nullif(p_nova ->> 'base', ''),
      jsonb_build_object('definition', p_nova -> 'definicao'), coalesce(p_nova -> 'secoes', '[]'::jsonb), null);
    update public.campaign_codex set combat_definition_id = propria where id = p_entry;
  end if;
  update public.character_life set pv = null, temp = 0, condicoes = '[]'::jsonb, operacao = null, version = version + 1 where note_id = p_entry;
  update public.campaign_codex set version = version + 1 where id = p_entry;
  insert into private_ficha.npc_ficha_eventos(campaign_id, entry_id, actor_id, operation_id, removida, nova, titulo, copia, copia_expira_em)
  values (p_campaign, p_entry, eu, p_operation, removida, tipo, n.title, copia, case when copia is not null then now() + interval '30 days' end);
  return jsonb_strip_nulls(jsonb_build_object('revision', revisao, 'updatedAt', quando));
end $$;
revoke all on function public.codex_npc_sheet_set(uuid, uuid, int, jsonb, uuid, int, text) from public, anon;
grant execute on function public.codex_npc_sheet_set(uuid, uuid, int, jsonb, uuid, int, text) to authenticated;

create or replace function public.codex_set_combat_sheet(p_campaign uuid,p_entry uuid,p_version int,p_definition_id text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.campaign_codex;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into c from public.campaign_codex where id=p_entry and campaign_id=p_campaign and category='npc' and deleted_at is null for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'conflito_de_versao'; end if;
 if p_definition_id like 'custom-%' and not exists(select 1 from public.campaign_definitions d where d.campaign_id=p_campaign and d.kind='monster' and d.definition_id=p_definition_id) then
  raise exception 'definicao_inexistente' using errcode='P0002'; end if;
 if p_definition_id is not null and exists(select 1 from public.character_sheets s where s.character_id=p_entry) then
  raise exception 'npc_ja_tem_ficha' using errcode='23514';
 end if;
 if c.combat_definition_id like 'custom-npc-%' and c.combat_definition_id is distinct from p_definition_id then
  raise exception 'ficha_propria_exige_substituicao' using errcode='23514';
 end if;
 if p_definition_id like 'custom-npc-%' and p_definition_id is distinct from 'custom-npc-'||p_entry::text then
  raise exception 'definicao_inexistente' using errcode='P0002';
 end if;
 update public.campaign_codex set combat_definition_id=p_definition_id,version=version+1 where id=p_entry;
end $$;

-- Excluir a página não pode deixar uma ficha sem identidade: a ficha precisa ser removida antes.
create or replace function public.codex_remove(p_campaign uuid,p_entry uuid,p_version int) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if exists(select 1 from public.character_sheets s where s.character_id=p_entry and s.campaign_id=p_campaign)
    or exists(select 1 from public.campaign_codex c where c.id=p_entry and c.campaign_id=p_campaign and c.combat_definition_id like 'custom-npc-%') then
  raise exception 'npc_com_ficha' using errcode='23514';
 end if;
 update public.campaign_codex set deleted_at=now(),version=version+1 where id=p_entry and campaign_id=p_campaign and version=p_version and deleted_at is null;
 if not found then raise exception 'conflito_de_versao'; end if;
end $$;

-- A projeção do MESTRE passa a dizer se há ficha de personagem. A do jogador não muda.
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
   'secret',n.meta->>'secret','combatDefinitionId',c.combat_definition_id,
   'characterSheet',case when exists(select 1 from public.character_sheets s where s.character_id=c.id) then true end,'vitalStatus',coalesce((select v.estado from public.character_life v where v.note_id=c.id),'vivo'),'visible',c.visible,'revealed',to_jsonb(c.revealed),'registered',c.registered));
 end if;
 -- criatura: o jogador nunca recebe seção técnica nem a identificação da definição, em nenhum nível de conhecimento
 monster:=c.category='monster';
 if monster then sheet:='[]'::jsonb; end if;
 full_id:=not monster and c.definition_id is not null and public.codex_identified(c.revealed,sheet);
 -- sem número de versão: ele contaria edições secretas
 return jsonb_strip_nulls(jsonb_build_object('id',c.id,
  'category',case when c.category='item' and not full_id then 'discovery' else c.category end,
  'systemId',c.system_id,'visible',true,
  'vitalStatus',case when 'vitalStatus'=any(c.revealed) and c.category='npc' then coalesce((select v.estado from public.character_life v where v.note_id=c.id),'vivo') end,
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

create or replace function public.codex_capabilities() returns integer language sql stable set search_path = '' as $$ select 22 $$;
commit;
