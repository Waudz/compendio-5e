-- 0010 — PROPOSTA, NÃO APLICADA ao Supabase hospedado. Só o responsável autoriza aplicar: apresentar este SQL, os resultados de
-- `supabase/encontros-rls.test.ts` e a reversão (`supabase/rollback/0010_campaign_encounters_down.sql`) antes.
--
-- Encontros PREPARADOS da campanha (lista de encontros com participantes), separados do combate ativo (0009): finalizar um combate nunca apaga encontros.
-- UMA linha por campanha (`state.encontros` é a lista), somente o MESTRE lê e grava (RLS via `public.is_master`, participação atual a cada operação).
-- Concorrência otimista por `version` (avança exatamente 1 por gravação). Sem DELETE para o cliente: a linha some apenas se a campanha for excluída (cascata).
-- Incremental: não toca em nenhuma tabela ou dado existente. Depende de 0001 e 0009 (usa o schema `private_combates`, criado pela 0009).
begin;

create schema if not exists private_combates;
-- Os dados da Data API são não confiáveis: o formato é revalidado no banco.
create function private_combates.valid_campaign_encounters_state(s jsonb) returns boolean
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
revoke all on function private_combates.valid_campaign_encounters_state(jsonb) from public, anon, authenticated;
grant usage on schema private_combates to authenticated;
grant execute on function private_combates.valid_campaign_encounters_state(jsonb) to authenticated;

create table public.campaign_encounters (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  state jsonb not null default '{"encontros":[]}'::jsonb,
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_encounters_state_content check (coalesce(private_combates.valid_campaign_encounters_state(state), false))
);

create function private_combates.guard_campaign_encounters_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.version <> 1 then raise exception 'encontros_versao_inicial_invalida'; end if;
  elsif new.version <> old.version + 1 then
    raise exception 'encontros_versao_invalida';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function private_combates.guard_campaign_encounters_version() from public, anon, authenticated;
create trigger campaign_encounters_version before insert or update on public.campaign_encounters
  for each row execute function private_combates.guard_campaign_encounters_version();

alter table public.campaign_encounters enable row level security;
revoke all on table public.campaign_encounters from public, anon, authenticated;
grant select on table public.campaign_encounters to authenticated;
grant insert (campaign_id, state, version) on table public.campaign_encounters to authenticated;
grant update (state, version) on table public.campaign_encounters to authenticated;

create policy campaign_encounters_master_select on public.campaign_encounters
  for select to authenticated using ((select auth.uid()) is not null and public.is_master(campaign_id));
create policy campaign_encounters_master_insert on public.campaign_encounters
  for insert to authenticated with check ((select auth.uid()) is not null and public.is_master(campaign_id));
create policy campaign_encounters_master_update on public.campaign_encounters
  for update to authenticated
  using ((select auth.uid()) is not null and public.is_master(campaign_id))
  with check ((select auth.uid()) is not null and public.is_master(campaign_id));
commit;
