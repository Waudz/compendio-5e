-- Reversão da 0012: volta ao estado FECHADO da 0011 (sem privilégio de API, políticas iniciais). NÃO apaga nenhuma linha de character_sheets nem de notes.
-- Seguro para rodar com dados: só remove funções, gatilho, restrições e privilégios adicionados pela 0012.

drop function if exists public.create_guided_character(uuid, text, jsonb, boolean, jsonb);
drop function if exists public.save_guided_character(uuid, integer, jsonb, text, jsonb, boolean);
drop trigger if exists character_sheets_guard on public.character_sheets;
drop function if exists public.character_sheets_guard();

alter table public.character_sheets drop constraint if exists character_sheets_draft_id_check;
alter table public.character_sheets drop constraint if exists character_sheets_nota_campanha_fk;
alter table public.notes drop constraint if exists notes_guiado_meta_check;
alter table public.notes drop constraint if exists notes_id_campaign_uniq;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'character_sheets' loop
    execute format('drop policy %I on public.character_sheets', p.policyname);
  end loop;
end $$;
create policy character_sheets_select on public.character_sheets for select to authenticated
  using ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id));
create policy character_sheets_insert on public.character_sheets for insert to authenticated
  with check (owner_id = auth.uid() and public.is_member(campaign_id)
    and exists (select 1 from public.notes n where n.id = character_id and n.kind = 'character' and n.campaign_id = character_sheets.campaign_id and n.owner_id = auth.uid()));
create policy character_sheets_update on public.character_sheets for update to authenticated
  using ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id))
  with check ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id));

revoke all on public.character_sheets from public, anon, authenticated;
