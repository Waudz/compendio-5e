-- 0021 — PROPOSTA, NÃO APLICADA. Requer 0001–0020. Não aplicar em produção sem autorização específica.
-- Ciclo de vida dos personagens. Substitui a proposta anterior de "exclusão arquivada" (nunca aplicada).
--
-- Ideia central: perder o controle é TROCAR O DONO para o mestre da campanha. Todas as políticas já decidem por dono ou mestre
-- (ficha, vitais, status de combate, Realtime, definições de itens), então o antigo dono deixa de ler e de gravar sem política nova.
-- A situação do personagem fica fora da API. Sem linha em `private_ficha.ciclo` = personagem ativo.
--   aguardando  o jogador renunciou; ficha intacta, com o mestre, até a decisão dele
--   arquivado   ficha intacta, fora das listagens de ativos
--   npc         ficha intacta, controlada pelo mestre, listada entre os NPCs (mesmo registro, mesmo ID)
--   compendio   ficha técnica removida; identidade pública e vínculos continuam
--   excluido    ficha, vínculos e registro ativo removidos; documentos e históricos continuam
-- Onde a ficha é removida (compendio, excluido) fica antes uma cópia privada em `private_ficha.ciclo_eventos`, sem acesso pela API.
-- Nenhum dado existente é alterado ao aplicar. Reversão em supabase/rollback/0021_personagens_ciclo_de_vida_down.sql.
begin;

create table private_ficha.ciclo (
  character_id uuid primary key references public.notes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  state text not null check (state in ('aguardando', 'arquivado', 'npc', 'compendio', 'excluido')),
  previous_owner uuid,
  updated_at timestamptz not null default now()
);
create index ciclo_campaign on private_ficha.ciclo(campaign_id);

-- Histórico e idempotência: uma linha por operação aceita.
create table private_ficha.ciclo_eventos (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null,
  actor_id uuid not null,
  operation_id uuid not null,
  acao text not null,
  titulo text not null,
  copia jsonb,
  em timestamptz not null default now(),
  unique (character_id, operation_id)
);

create table private_ficha.transferencias (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.notes(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null,
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada', 'cancelada')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index transferencias_uma_pendente on private_ficha.transferencias(character_id) where status = 'pendente';

-- Marca, por transação, as funções do servidor que podem trocar o dono. Sem privilégio de API: o cliente não consegue forjar.
create table private_ficha.mudanca_ciclo (txid bigint not null, character_id uuid not null, primary key (txid, character_id));
revoke all on private_ficha.ciclo, private_ficha.ciclo_eventos, private_ficha.transferencias, private_ficha.mudanca_ciclo from public, anon, authenticated;

create function private.mudanca_de_ciclo(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private_ficha.mudanca_ciclo m where m.txid = txid_current() and m.character_id = p_id)
$$;
create function private.situacao_personagem(p_id uuid) returns text language sql stable security definer set search_path = '' as $$
  select c.state from private_ficha.ciclo c where c.character_id = p_id
$$;
revoke all on function private.mudanca_de_ciclo(uuid), private.situacao_personagem(uuid) from public, anon;
grant execute on function private.mudanca_de_ciclo(uuid), private.situacao_personagem(uuid) to authenticated;

-- Avisos do ciclo de vida (o mestre é avisado da renúncia; o destinatário, da oferta de transferência).
create table public.character_notices (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null,
  kind text not null check (kind in ('renuncia', 'oferta', 'oferta-aceita', 'oferta-recusada')),
  title text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index character_notices_recipient on public.character_notices(recipient, campaign_id, id desc);
alter table public.character_notices enable row level security;
revoke all on public.character_notices from public, anon, authenticated;
grant select on public.character_notices to authenticated;
grant update (read_at) on public.character_notices to authenticated;
create policy character_notices_read on public.character_notices for select to authenticated
  using (recipient = (select auth.uid()) and public.is_member(campaign_id));
create policy character_notices_seen on public.character_notices for update to authenticated
  using (recipient = (select auth.uid()) and public.is_member(campaign_id))
  with check (recipient = (select auth.uid()) and public.is_member(campaign_id));

-- ------------------------------------------------------------------ guardas existentes: a troca de dono só passa pela marca
create or replace function public.notes_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.owner_id <> old.owner_id and not private.mudanca_de_ciclo(old.id))
     or new.campaign_id is distinct from old.campaign_id or new.id <> old.id then
    raise exception 'campo_imutavel' using errcode = '23514';
  end if;
  new.version := old.version + 1;
  new.created_at := old.created_at;
  new.updated_at := now();
  if old.visibility = 'selected' and new.visibility <> 'selected' then
    delete from public.note_shares where note_id = old.id;
  end if;
  return new;
end $$;

create or replace function public.character_sheets_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.character_id is distinct from old.character_id or new.campaign_id is distinct from old.campaign_id
       or (new.owner_id is distinct from old.owner_id and not private.mudanca_de_ciclo(old.character_id))
       or new.created_at is distinct from old.created_at then
      raise exception 'campos_imutaveis' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  else
    -- um registro que saiu do ciclo sem ficha não ganha outra pela API
    if private.situacao_personagem(new.character_id) is not null then raise exception 'personagem_encerrado' using errcode = '42501'; end if;
    new.revision := 1; new.created_at := now(); new.updated_at := now();
  end if;
  return new;
end $$;

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

create policy notes_ciclo_delete on public.notes as restrictive for delete to authenticated
  using (private.situacao_personagem(id) is null);

-- Personagem aguardando decisão ou arquivado não recebe itens de outro jogador.
create function private_ficha.recusar_destino_inativo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private_ficha.tipo_operacao(new.character_id) = 'transferencia' and not public.is_master(new.campaign_id)
     and new.owner_id <> (select auth.uid()) and private.situacao_personagem(new.character_id) in ('aguardando', 'arquivado') then
    raise exception 'destino_invalido' using errcode = 'P0002';
  end if;
  return new;
end $$;
revoke all on function private_ficha.recusar_destino_inativo() from public, anon, authenticated;
create trigger character_sheets_zz_destino before update of draft on public.character_sheets
  for each row execute function private_ficha.recusar_destino_inativo();

-- ------------------------------------------------------------------ apoio (nada disto é chamável pela API)
create function private_ficha.trocar_dono(p_id uuid, p_novo uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into private_ficha.mudanca_ciclo(txid, character_id) values (txid_current(), p_id) on conflict do nothing;
  -- a chave composta liga ficha e nota por (id, campanha): o dono muda nas duas; a nota por último, para a apresentação ser refeita
  update public.character_sheets set owner_id = p_novo where character_id = p_id and owner_id <> p_novo;
  update public.notes set owner_id = p_novo where id = p_id and owner_id <> p_novo;
  delete from private_ficha.mudanca_ciclo m where m.txid = txid_current() and m.character_id = p_id;
end $$;

-- Combate e encontros guardam nome, PV e condições próprios: só a ligação viva com a ficha é desfeita.
create function private_ficha.desligar_referencias(p_campaign uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare combate jsonb; encontros jsonb;
begin
  select coalesce(jsonb_agg(c), '[]'::jsonb) into combate from public.campaign_combats b,
    lateral jsonb_array_elements(case when jsonb_typeof(b.state -> 'combatentes') = 'array' then b.state -> 'combatentes' else '[]'::jsonb end) c
   where b.campaign_id = p_campaign and c #>> '{ref,tipo}' = 'personagem' and c #>> '{ref,id}' = p_id::text;
  select coalesce(jsonb_agg(jsonb_build_object('encontro', x ->> 'id', 'participante', p)), '[]'::jsonb) into encontros
    from public.campaign_encounters b,
    lateral jsonb_array_elements(case when jsonb_typeof(b.state -> 'encontros') = 'array' then b.state -> 'encontros' else '[]'::jsonb end) x,
    lateral jsonb_array_elements(case when jsonb_typeof(x -> 'participantes') = 'array' then x -> 'participantes' else '[]'::jsonb end) p
   where b.campaign_id = p_campaign and p #>> '{ref,tipo}' = 'personagem' and p #>> '{ref,id}' = p_id::text;
  if jsonb_array_length(combate) > 0 then
    update public.campaign_combats b set version = b.version + 1, state = jsonb_set(b.state, '{combatentes}',
      (select coalesce(jsonb_agg(case when c #>> '{ref,tipo}' = 'personagem' and c #>> '{ref,id}' = p_id::text then c - 'ref' else c end order by n), '[]'::jsonb)
         from jsonb_array_elements(b.state -> 'combatentes') with ordinality t(c, n)))
     where b.campaign_id = p_campaign;
  end if;
  if jsonb_array_length(encontros) > 0 then
    update public.campaign_encounters b set version = b.version + 1, state = jsonb_set(b.state, '{encontros}',
      (select coalesce(jsonb_agg(case when jsonb_typeof(x -> 'participantes') = 'array' then jsonb_set(x, '{participantes}',
          (select coalesce(jsonb_agg(case when p #>> '{ref,tipo}' = 'personagem' and p #>> '{ref,id}' = p_id::text then p - 'ref' else p end order by po), '[]'::jsonb)
             from jsonb_array_elements(x -> 'participantes') with ordinality pp(p, po))) else x end order by eo), '[]'::jsonb)
         from jsonb_array_elements(b.state -> 'encontros') with ordinality ee(x, eo)))
     where b.campaign_id = p_campaign;
  end if;
  return jsonb_build_object('combate', combate, 'encontros', encontros);
end $$;

create function private_ficha.avisar(p_campaign uuid, p_para uuid, p_id uuid, p_tipo text, p_titulo text) returns void
language sql security definer set search_path = '' as $$
  insert into public.character_notices(campaign_id, recipient, character_id, kind, title)
  select p_campaign, p_para, p_id, p_tipo, p_titulo
   where p_para <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
     and exists (select 1 from public.campaign_members m where m.campaign_id = p_campaign and m.user_id = p_para)
$$;

create function private_ficha.mestre_de(p_campaign uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select m.user_id from public.campaign_members m where m.campaign_id = p_campaign and m.role = 'mestre'
$$;

create function private_ficha.definir_situacao(p_campaign uuid, p_id uuid, p_situacao text, p_anterior uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_situacao is null then
    delete from private_ficha.ciclo where character_id = p_id;
  else
    insert into private_ficha.ciclo(character_id, campaign_id, state, previous_owner) values (p_id, p_campaign, p_situacao, p_anterior)
    on conflict (character_id) do update set state = excluded.state,
      previous_owner = coalesce(excluded.previous_owner, private_ficha.ciclo.previous_owner), updated_at = now();
  end if;
end $$;

-- Uma ação sobre um personagem. Já autorizada e com ficha e nota travadas por quem chama.
create function private_ficha.aplicar_ciclo(p_id uuid, p_acao text, p_operacao uuid, p_destino uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.notes; s public.character_sheets; atual text; copia jsonb; refs jsonb; vistos jsonb; vinculos jsonb;
  mestre uuid; eu uuid := (select auth.uid()); anterior uuid;
begin
  select * into s from public.character_sheets where character_id = p_id;
  select * into n from public.notes where id = p_id;
  atual := private.situacao_personagem(p_id);
  mestre := private_ficha.mestre_de(n.campaign_id);
  anterior := case when n.owner_id <> mestre then n.owner_id end;

  if p_acao in ('renunciar', 'aguardar', 'arquivar', 'npc', 'reativar') then
    if s.character_id is null then raise exception 'sem_ficha' using errcode = 'P0002'; end if;
    update private_ficha.transferencias set status = 'cancelada', closed_at = now() where character_id = p_id and status = 'pendente';
    perform private_ficha.trocar_dono(p_id, mestre);
    perform private_ficha.definir_situacao(n.campaign_id, p_id,
      case p_acao when 'renunciar' then 'aguardando' when 'aguardar' then 'aguardando' when 'arquivar' then 'arquivado' when 'npc' then 'npc' end, anterior);
    if p_acao = 'renunciar' then perform private_ficha.avisar(n.campaign_id, mestre, p_id, 'renuncia', n.title); end if;

  elsif p_acao = 'transferir' then
    if s.character_id is null then raise exception 'sem_ficha' using errcode = 'P0002'; end if;
    if p_destino is null or p_destino = s.owner_id
       or not exists (select 1 from public.campaign_members m where m.campaign_id = n.campaign_id and m.user_id = p_destino) then
      raise exception 'destino_invalido' using errcode = 'P0002';
    end if;
    update private_ficha.transferencias set status = 'cancelada', closed_at = now() where character_id = p_id and status = 'pendente';
    if p_destino = mestre then
      -- o mestre assumir não depende de aceite
      perform private_ficha.trocar_dono(p_id, mestre);
      perform private_ficha.definir_situacao(n.campaign_id, p_id, null, null);
    else
      insert into private_ficha.transferencias(campaign_id, character_id, to_user, created_by) values (n.campaign_id, p_id, p_destino, eu);
      perform private_ficha.avisar(n.campaign_id, p_destino, p_id, 'oferta', n.title);
    end if;

  elsif p_acao = 'cancelar-transferencia' then
    update private_ficha.transferencias set status = 'cancelada', closed_at = now() where character_id = p_id and status = 'pendente';

  elsif p_acao in ('compendio', 'excluir') then
    if p_acao = 'compendio' and s.character_id is null then raise exception 'sem_ficha' using errcode = 'P0002'; end if;
    update private_ficha.transferencias set status = 'cancelada', closed_at = now() where character_id = p_id and status = 'pendente';
    if s.character_id is not null then
      select coalesce(jsonb_agg(v.item_id), '[]'::jsonb) into vistos from private_ficha.itens_vistos v where v.character_id = p_id;
      copia := jsonb_build_object('ficha', to_jsonb(s), 'itens_vistos', vistos);
    end if;
    perform private_ficha.trocar_dono(p_id, mestre);
    refs := private_ficha.desligar_referencias(n.campaign_id, p_id);
    copia := coalesce(copia, '{}'::jsonb) || jsonb_build_object('nota', to_jsonb(n), 'referencias', refs);
    -- a ficha técnica sai das tabelas da aplicação (a cópia acima é a única que resta)
    delete from public.character_sheets where character_id = p_id;
    insert into private_ficha.mudanca_ciclo(txid, character_id) values (txid_current(), p_id) on conflict do nothing;
    if p_acao = 'excluir' then
      select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) into vinculos from public.codex_links l where p_id in (l.source_id, l.target_id);
      copia := copia || jsonb_build_object('vinculos', vinculos);
      delete from public.codex_links l where p_id in (l.source_id, l.target_id);
      delete from public.character_notices where character_id = p_id;
      update public.notes set deleted_at = now() where id = p_id;
    end if;
    delete from private_ficha.mudanca_ciclo m where m.txid = txid_current() and m.character_id = p_id;
    perform private_ficha.definir_situacao(n.campaign_id, p_id, case p_acao when 'compendio' then 'compendio' else 'excluido' end, anterior);
  else
    raise exception 'acao_invalida' using errcode = '23514';
  end if;

  insert into private_ficha.ciclo_eventos(campaign_id, character_id, actor_id, operation_id, acao, titulo, copia)
  values (n.campaign_id, p_id, eu, p_operacao, p_acao, n.title, copia);
end $$;
revoke all on function private_ficha.trocar_dono(uuid, uuid), private_ficha.desligar_referencias(uuid, uuid),
  private_ficha.avisar(uuid, uuid, uuid, text, text), private_ficha.mestre_de(uuid), private_ficha.definir_situacao(uuid, uuid, text, uuid),
  private_ficha.aplicar_ciclo(uuid, text, uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ operações da API
-- Um ou vários personagens da mesma campanha numa única transação (tudo ou nada). Repetir a mesma operação não faz nada.
-- `p_revisoes` (id -> revisão da ficha) é obrigatória para as ações que removem a ficha: uma ficha alterada por outra sessão não é perdida.
create function public.character_lifecycle(p_campaign uuid, p_ids uuid[], p_action text, p_operation uuid,
                                           p_revisions jsonb default '{}'::jsonb, p_target uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid()); master boolean; cid uuid; n public.notes; s public.character_sheets; situacao text;
begin
  if eu is null or p_operation is null or p_ids is null or cardinality(p_ids) not between 1 and 200 or not public.is_member(p_campaign) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('renunciar', 'aguardar', 'arquivar', 'npc', 'reativar', 'transferir', 'cancelar-transferencia', 'compendio', 'excluir') then
    raise exception 'acao_invalida' using errcode = '23514';
  end if;
  master := public.is_master(p_campaign);
  if p_action = 'renunciar' then
    if cardinality(p_ids) <> 1 then raise exception 'acao_invalida' using errcode = '23514'; end if;
  elsif not master then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_action = 'transferir' and cardinality(p_ids) <> 1 then raise exception 'acao_invalida' using errcode = '23514'; end if;

  -- ordem fixa de travas (ficha, depois nota; ids em ordem): igual à gravação guiada, sem impasse entre operações cruzadas
  foreach cid in array array(select distinct x from unnest(p_ids) x order by x) loop
    select * into s from public.character_sheets where character_id = cid for update;
    select * into n from public.notes where id = cid for update;
    if n.id is null or n.campaign_id is distinct from p_campaign or n.kind <> 'character' then
      raise exception 'personagem_indisponivel' using errcode = 'P0002';
    end if;
    if exists (select 1 from private_ficha.ciclo_eventos e where e.character_id = cid and e.operation_id = p_operation) then
      if not exists (select 1 from private_ficha.ciclo_eventos e where e.character_id = cid and e.operation_id = p_operation and e.actor_id = eu and e.acao = p_action) then
        raise exception 'operacao_invalida' using errcode = '23514';
      end if;
      continue;
    end if;
    situacao := private.situacao_personagem(cid);
    if situacao = 'excluido' or n.deleted_at is not null then raise exception 'personagem_indisponivel' using errcode = 'P0002'; end if;
    if p_action = 'renunciar' then
      -- só o próprio dono de um personagem ativo renuncia
      if s.character_id is null or s.owner_id <> eu or situacao is not null or master then raise exception 'sem_permissao' using errcode = '42501'; end if;
    end if;
    if p_action in ('renunciar', 'compendio', 'excluir') and s.character_id is not null
       and (p_revisions ->> cid::text) is distinct from s.revision::text then
      raise exception 'conflito_de_revisao' using errcode = '40001';
    end if;
    perform private_ficha.aplicar_ciclo(cid, p_action, p_operation, p_target);
  end loop;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.character_lifecycle(uuid, uuid[], text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.character_lifecycle(uuid, uuid[], text, uuid, jsonb, uuid) to authenticated;

-- Situação dos personagens (quem não aparece está ativo). O mestre recebe também a transferência pendente, o dono anterior e quem
-- ficou sem jogador na campanha (as regras de leitura escondem dos outros a linha pública de quem saiu).
create function public.character_states(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare master boolean;
begin
  if (select auth.uid()) is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  master := public.is_master(p_campaign);
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', n.id, 'state', coalesce(c.state, 'ativo'),
        'pendingTo', case when master then t.to_user end, 'previousOwner', case when master then c.previous_owner end,
        'ownerLeft', case when master and f.sem_jogador then true end)) order by n.id)
      from public.notes n
      cross join lateral (select not exists (select 1 from public.campaign_members m where m.campaign_id = n.campaign_id and m.user_id = n.owner_id) as sem_jogador) f
      left join private_ficha.ciclo c on c.character_id = n.id
      left join private_ficha.transferencias t on t.character_id = n.id and t.status = 'pendente'
     where n.campaign_id = p_campaign and n.kind = 'character' and n.deleted_at is null
       and (master or n.visibility = 'campaign' or n.owner_id = (select auth.uid()))
       and (c.state is not null or (master and (t.id is not null or f.sem_jogador)))), '[]'::jsonb);
end $$;

-- Ofertas de transferência dirigidas a quem chama. Só o título público do personagem sai daqui.
create function public.character_offers(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'characterId', t.character_id, 'title', n.title, 'createdAt', t.created_at) order by t.created_at)
      from private_ficha.transferencias t join public.notes n on n.id = t.character_id
     where t.campaign_id = p_campaign and t.to_user = (select auth.uid()) and t.status = 'pendente' and n.deleted_at is null), '[]'::jsonb);
end $$;

create function public.character_offer_answer(p_offer uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t private_ficha.transferencias; s public.character_sheets; n public.notes; eu uuid := (select auth.uid()); mestre uuid;
begin
  if eu is null or p_accept is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into t from private_ficha.transferencias where id = p_offer;
  if t.id is null or t.to_user <> eu or not public.is_member(t.campaign_id) then raise exception 'oferta_indisponivel' using errcode = 'P0002'; end if;
  select * into s from public.character_sheets where character_id = t.character_id for update;
  select * into n from public.notes where id = t.character_id for update;
  select * into t from private_ficha.transferencias where id = p_offer for update;
  if t.status = (case when p_accept then 'aceita' else 'recusada' end) then return jsonb_build_object('ok', true, 'characterId', t.character_id); end if;
  if t.status <> 'pendente' or s.character_id is null or n.deleted_at is not null then raise exception 'oferta_indisponivel' using errcode = 'P0002'; end if;
  mestre := private_ficha.mestre_de(t.campaign_id);
  update private_ficha.transferencias set status = case when p_accept then 'aceita' else 'recusada' end, closed_at = now() where id = t.id;
  if p_accept then
    perform private_ficha.trocar_dono(t.character_id, eu);
    perform private_ficha.definir_situacao(t.campaign_id, t.character_id, null, null);
  end if;
  perform private_ficha.avisar(t.campaign_id, mestre, t.character_id, case when p_accept then 'oferta-aceita' else 'oferta-recusada' end, n.title);
  insert into private_ficha.ciclo_eventos(campaign_id, character_id, actor_id, operation_id, acao, titulo)
  values (t.campaign_id, t.character_id, eu, t.id, case when p_accept then 'transferencia-aceita' else 'transferencia-recusada' end, n.title);
  return jsonb_build_object('ok', true, 'characterId', t.character_id);
end $$;
revoke all on function public.character_states(uuid), public.character_offers(uuid), public.character_offer_answer(uuid, boolean) from public, anon;
grant execute on function public.character_states(uuid), public.character_offers(uuid), public.character_offer_answer(uuid, boolean) to authenticated;

-- Quem saiu das listagens de ativos não aparece como portador de itens.
create or replace function public.codex_holders(p_campaign uuid, p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ref text;
begin
 if not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select definition_id into ref from public.campaign_codex where id=p_entry and campaign_id=p_campaign and category='item' and deleted_at is null
  and public.codex_visible(id) and (public.is_master(p_campaign) or 'holders'=any(revealed));
 if ref is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',n.title))
 from public.character_sheets f join public.notes n on n.id=f.character_id
 where f.campaign_id=p_campaign and n.campaign_id=p_campaign and n.kind='character' and n.visibility='campaign' and n.deleted_at is null
 and coalesce(private.situacao_personagem(n.id), 'ativo') not in ('aguardando', 'arquivado')
 and exists(select 1 from jsonb_array_elements(private_ficha.lista(f.draft->'inventory')) i
  where (i->>'itemId'=ref or exists(select 1 from private_ficha.mascaras m where m.campaign_id=p_campaign and m.token=i->>'itemId' and m.definition_id=ref))
   and case when jsonb_typeof(i->'quantity')='number' then (i->>'quantity')::numeric>0 else false end)), '[]'::jsonb);
end $$;

create or replace function public.codex_capabilities() returns integer language sql stable set search_path = '' as $$ select 21 $$;
commit;
