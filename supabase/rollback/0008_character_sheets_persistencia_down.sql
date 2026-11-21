-- Reversão da 0008: volta ao estado FECHADO da 0007 (sem privilégio de API, políticas iniciais). NÃO apaga nenhuma linha de character_sheets nem de notes.
-- Seguro para rodar com dados: só remove funções, gatilhos, restrições, schema `private` e privilégios adicionados pela 0008.

drop function if exists public.create_guided_character(uuid, text, jsonb, boolean, jsonb);
drop function if exists public.save_guided_character(uuid, integer, jsonb, text, jsonb, boolean);
drop trigger if exists character_sheets_guard on public.character_sheets;
drop function if exists public.character_sheets_guard();
drop trigger if exists notes_zz_ficha_guard on public.notes;

alter table public.character_sheets drop constraint if exists character_sheets_draft_id_check;
alter table public.character_sheets drop constraint if exists character_sheets_nota_campanha_fk;
alter table public.notes drop constraint if exists notes_guiado_meta_check;
alter table public.notes drop constraint if exists notes_id_campaign_uniq;

-- as políticas dependem das funções de private: removê-las antes
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'character_sheets' loop
    execute format('drop policy %I on public.character_sheets', p.policyname);
  end loop;
end $$;
drop function if exists private.notes_ficha_guard();
drop function if exists private.tem_ficha(uuid);
drop function if exists private.nota_guiada_ativa(uuid, uuid);
drop function if exists private.identidade_meta_valida(jsonb);
drop function if exists private.titulo_publico(jsonb);
drop schema if exists private;

-- políticas iniciais (as da 0007)
create policy character_sheets_select on public.character_sheets for select to authenticated
  using ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id));
create policy character_sheets_insert on public.character_sheets for insert to authenticated
  with check (owner_id = auth.uid() and public.is_member(campaign_id)
    and exists (select 1 from public.notes n where n.id = character_id and n.kind = 'character' and n.campaign_id = character_sheets.campaign_id
                and n.owner_id = auth.uid() and n.deleted_at is null));
create policy character_sheets_update on public.character_sheets for update to authenticated
  using ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id))
  with check (((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id))
    and exists (select 1 from public.notes n where n.id = character_id and n.kind = 'character' and n.campaign_id = character_sheets.campaign_id and n.deleted_at is null));

revoke all on public.character_sheets from public, anon, authenticated;
