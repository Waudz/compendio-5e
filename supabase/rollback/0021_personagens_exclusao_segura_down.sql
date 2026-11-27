-- Reversão sem perda: só antes de utilizar a exclusão. Depois, exige recuperação seletiva autorizada.
begin;
do $$ begin
 if exists(select 1 from private_ficha.personagens_excluidos) then
  raise exception 'rollback_exige_recuperacao_seletiva: existem personagens arquivados';
 end if;
end $$;
drop function public.delete_campaign_character(uuid,bigint,text,uuid);
drop trigger personagem_arquivado on public.character_sheets;
drop trigger personagem_arquivado on public.character_combat_status;
drop function private_ficha.bloquear_personagem_excluido();
drop policy character_sheets_active on public.character_sheets;
drop policy character_status_active on public.character_combat_status;
create or replace function private.notes_ficha_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ficha jsonb;
begin
  select s.draft into ficha from public.character_sheets s where s.character_id = new.id;
  if found then
    if new.kind <> 'character' or new.campaign_id is distinct from old.campaign_id or new.owner_id is distinct from old.owner_id then
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
drop table private_ficha.personagens_excluidos;
commit;
