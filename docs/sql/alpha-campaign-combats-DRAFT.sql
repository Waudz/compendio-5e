-- RASCUNHO PARA REVISÃO: NÃO EXECUTAR EM PRODUÇÃO SEM APROVAÇÃO.
-- Converter em migração oficial usando Supabase CLI em ambiente de desenvolvimento.
-- Usa public.is_master(uuid), já existente e auditada no projeto compendio-5e.
begin;

create table public.campaign_combats (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  state jsonb not null default '{"combatentes":[],"turno":null,"rodada":1}'::jsonb,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_combats_state_object check (jsonb_typeof(state) = 'object'),
  constraint campaign_combats_state_combatants check (jsonb_typeof(state -> 'combatentes') = 'array'),
  constraint campaign_combats_state_round check (jsonb_typeof(state -> 'rodada') = 'number')
);

alter table public.campaign_combats enable row level security;
revoke all on table public.campaign_combats from public, anon, authenticated;
grant select, insert, update on table public.campaign_combats to authenticated;

create policy campaign_combats_master_select on public.campaign_combats
  for select to authenticated using ((select auth.uid()) is not null and public.is_master(campaign_id));

create policy campaign_combats_master_insert on public.campaign_combats
  for insert to authenticated with check ((select auth.uid()) is not null and public.is_master(campaign_id));

create policy campaign_combats_master_update on public.campaign_combats
  for update to authenticated
  using ((select auth.uid()) is not null and public.is_master(campaign_id))
  with check ((select auth.uid()) is not null and public.is_master(campaign_id));

-- Nenhuma policy DELETE: preserva histórico contra exclusão direta via Data API.
-- O DELETE em cascata só ocorrerá se uma campanha inteira for excluída por operação autorizada.
commit;
