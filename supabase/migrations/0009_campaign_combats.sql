-- 0009 — PROPOSTA, NÃO APLICADA ao Supabase hospedado. Só o responsável autoriza aplicar (DEC-20261123-G/H): apresentar este SQL,
-- os resultados de `supabase/combates-rls.test.ts` e o procedimento de reversão (`supabase/rollback/0009_campaign_combats_down.sql`) antes.
--
-- Combate ativo por campanha: UMA linha por campanha (`campaign_id` é a chave), somente o MESTRE da campanha lê/grava/finaliza (RLS via `public.is_master`,
-- que consulta a participação atual a cada operação). Jogadores, mestres de outras campanhas, usuários sem vínculo e `anon` não têm acesso, nem pela Data API.
-- Concorrência otimista por `version` (avança exatamente 1 por gravação); finalizar = DELETE condicionado à versão. Encontros são OUTRA tabela (0010).
-- Incremental: não toca em nenhuma tabela ou dado existente. Depende de 0001 (`campaigns`, `campaign_members`, `is_master`).
begin;

-- Validação independente de regras de sistema; dados vindos da Data API são não confiáveis.
create schema if not exists private_combates;
create function private_combates.valid_campaign_combat_state(s jsonb) returns boolean
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
revoke all on function private_combates.valid_campaign_combat_state(jsonb) from public, anon, authenticated;
grant usage on schema private_combates to authenticated;
grant execute on function private_combates.valid_campaign_combat_state(jsonb) to authenticated;


create table public.campaign_combats (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  state jsonb not null default '{"combatentes":[],"turno":null,"rodada":1}'::jsonb,
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_combats_state_content check (coalesce(private_combates.valid_campaign_combat_state(state), false)),
  constraint campaign_combats_state_object check (jsonb_typeof(state) = 'object'),
  constraint campaign_combats_state_combatants check (coalesce(jsonb_typeof(state -> 'combatentes') = 'array', false)),
  constraint campaign_combats_state_round check (coalesce(case when jsonb_typeof(state -> 'rodada') = 'number' then
    (state ->> 'rodada')::numeric between 1 and 9007199254740991
    and trunc((state ->> 'rodada')::numeric) = (state ->> 'rodada')::numeric else false end, false)),
  constraint campaign_combats_state_turn check (coalesce(jsonb_typeof(state -> 'turno') in ('null', 'string'), false))
);


-- Sem SECURITY DEFINER: não amplia privilégios. A versão deve avançar exatamente uma
-- unidade; o filtro WHERE version=esperada do adaptador evita sobrescrita concorrente.
create schema if not exists private_combates;
create function private_combates.guard_campaign_combat_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.version <> 1 then raise exception 'combate_versao_inicial_invalida'; end if;
  elsif new.version <> old.version + 1 then
    raise exception 'combate_versao_invalida';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function private_combates.guard_campaign_combat_version() from public, anon, authenticated;
create trigger campaign_combats_version before insert or update on public.campaign_combats
  for each row execute function private_combates.guard_campaign_combat_version();

alter table public.campaign_combats enable row level security;
revoke all on table public.campaign_combats from public, anon, authenticated;
grant select on table public.campaign_combats to authenticated;
grant insert (campaign_id, state, version) on table public.campaign_combats to authenticated;
-- Impede que clientes alterem campaign_id ou timestamps via UPDATE.
grant update (state, version) on table public.campaign_combats to authenticated;

create policy campaign_combats_master_select on public.campaign_combats
  for select to authenticated using ((select auth.uid()) is not null and public.is_master(campaign_id));

create policy campaign_combats_master_insert on public.campaign_combats
  for insert to authenticated with check ((select auth.uid()) is not null and public.is_master(campaign_id));

create policy campaign_combats_master_update on public.campaign_combats
  for update to authenticated
  using ((select auth.uid()) is not null and public.is_master(campaign_id))
  with check ((select auth.uid()) is not null and public.is_master(campaign_id));

-- Finalizar combate descarta a linha ativa, sem afetar encontros salvos (tabela separada).
-- A Data API limita DELETE ao mestre; o cliente exige version=esperada no WHERE.
grant delete on table public.campaign_combats to authenticated;
create policy campaign_combats_master_delete on public.campaign_combats
  for delete to authenticated
  using ((select auth.uid()) is not null and public.is_master(campaign_id));
-- O DELETE em cascata também ocorrerá se a campanha inteira for excluída por operação autorizada.
commit;
