-- PROPOSTA 0006 — metadados de registros, quadro de Planejamento, restrição de tipos do mestre e capa da campanha.
-- NÃO APLICADA. Depende da 0005 (PR #32). Precisa de revisão e autorização do William antes de ir para supabase/migrations/.
-- Revisão pendente: as partes de `storage` não são exercitadas pelo PGlite dos testes (ele não tem o esquema `storage`);
-- validar no projeto de teste antes de produção. Rollback no fim do arquivo.

-- 1) Metadados por registro (data da sessão do Diário: {"sessao":{"dia":3,"mes":12,"ano":1491}}; quadro: {"colunas":[...]}).
alter table public.notes add column meta jsonb not null default '{}'::jsonb;
alter table public.notes add constraint notes_meta_check
  check (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 16384);

-- 2) Novo tipo 'board' (quadro de Planejamento: guarda só a ORDEM de colunas e cartões; os cartões são notas kind='scene').
alter table public.notes drop constraint notes_kind_check;
alter table public.notes add constraint notes_kind_check
  check (kind in ('note', 'page', 'scene', 'npc', 'location', 'faction', 'event', 'diary', 'board'));

-- 3) Só o MESTRE da campanha cria ou muda para os tipos de condução (diário, cena, quadro). Jogador continua com notas próprias.
create function public.notes_kind_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind in ('diary', 'scene', 'board') then
    if new.campaign_id is null or not public.is_master(new.campaign_id) then
      raise exception 'tipo_exclusivo_do_mestre' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger notes_kind_guard before insert or update of kind, campaign_id on public.notes
  for each row execute function public.notes_kind_guard();
-- 'board' e 'scene' nunca são compartilhados com a campanha (planejamento é do mestre); o Diário só vira 'campaign' por ação explícita.
alter table public.notes add constraint notes_planejamento_privado_check
  check (kind not in ('scene', 'board') or visibility = 'private');

-- 4) Capa da campanha: caminho no bucket privado campaign-assets (mesmo contrato da 0005: <campanha>/<uuid>).
alter table public.campaigns add column cover_path text;
alter table public.campaigns add constraint campaigns_cover_path_check
  check (cover_path is null or cover_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-assets', 'campaign-assets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Leitura: participantes da campanha dona do caminho. Escrita/exclusão: só o mestre dela.
create policy campaign_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'campaign-assets' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy campaign_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-assets' and public.is_master(((storage.foldername(name))[1])::uuid));
create policy campaign_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-assets' and public.is_master(((storage.foldername(name))[1])::uuid));

-- ROLLBACK (executar só se necessário; apaga metadados, quadros e a coluna da capa):
--   drop policy campaign_assets_select on storage.objects; drop policy campaign_assets_insert on storage.objects; drop policy campaign_assets_delete on storage.objects;
--   alter table public.campaigns drop column cover_path;
--   alter table public.notes drop constraint notes_planejamento_privado_check;
--   drop trigger notes_kind_guard on public.notes; drop function public.notes_kind_guard();
--   delete from public.notes where kind = 'board';
--   alter table public.notes drop constraint notes_kind_check; alter table public.notes add constraint notes_kind_check check (kind in ('note','page','scene','npc','location','faction','event','diary'));
--   alter table public.notes drop column meta;
