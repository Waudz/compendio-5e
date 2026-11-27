-- Somente com autorização e backup. Recusa quando o ciclo de vida já foi usado: donos já trocados e fichas removidas exigem
-- recuperação seletiva pelo responsável (as cópias estão em private_ficha.ciclo_eventos). Nada é apagado nesse caso.
begin;
do $$ begin
 if exists (select 1 from private_ficha.ciclo_eventos) or exists (select 1 from private_ficha.ciclo) or exists (select 1 from private_ficha.transferencias) then
  raise exception 'reversao_0021_recusada: o ciclo de vida ja foi usado; recupere os personagens antes (private_ficha.ciclo_eventos)';
 end if;
end $$;
drop function public.character_offer_answer(uuid, boolean);
drop function public.character_offers(uuid);
drop function public.character_states(uuid);
drop function public.character_lifecycle(uuid, uuid[], text, uuid, jsonb, uuid, text);
do $$ begin
 if to_regclass('cron.job') is not null then
  perform cron.unschedule(jobid) from cron.job where jobname = 'compendio-purgar-copias-de-ficha';
 end if;
end $$;
drop function private_ficha.aplicar_ciclo(uuid, text, uuid, uuid);
drop function private_ficha.definir_situacao(uuid, uuid, text, uuid);
drop function private_ficha.mestre_de(uuid);
drop function private_ficha.avisar(uuid, uuid, uuid, text, text);
drop function private_ficha.desligar_referencias(uuid, uuid);
drop function private_ficha.trocar_dono(uuid, uuid);
drop trigger character_sheets_zz_destino on public.character_sheets;
drop function private_ficha.recusar_destino_inativo();
drop policy notes_ciclo_delete on public.notes;

-- funções substituídas voltam ao texto anterior
create or replace function public.notes_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.campaign_id is distinct from old.campaign_id or new.id <> old.id then
    raise exception 'campo_imutavel' using errcode = '23514';
  end if;
  new.version := old.version + 1;          -- só o servidor decide a versão
  new.created_at := old.created_at;
  new.updated_at := now();
  if old.visibility = 'selected' and new.visibility <> 'selected' then
    delete from public.note_shares where note_id = old.id;   -- lista de selecionados não sobrevive a mudança de visibilidade
  end if;
  return new;
end $$;

create or replace function public.character_sheets_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.character_id is distinct from old.character_id or new.campaign_id is distinct from old.campaign_id
       or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
      raise exception 'campos_imutaveis' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  else
    new.revision := 1; new.created_at := now(); new.updated_at := now();
  end if;
  return new;
end $$;

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

create or replace function public.codex_holders(p_campaign uuid,p_entry uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ref text;
begin
 if not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select definition_id into ref from public.campaign_codex where id=p_entry and campaign_id=p_campaign and category='item' and deleted_at is null
  and public.codex_visible(id) and (public.is_master(p_campaign) or 'holders'=any(revealed));
 if ref is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'title',n.title))
 from public.character_sheets f join public.notes n on n.id=f.character_id
 where f.campaign_id=p_campaign and n.campaign_id=p_campaign and n.kind='character' and n.visibility='campaign' and n.deleted_at is null
 and exists(select 1 from jsonb_array_elements(private_ficha.lista(f.draft->'inventory')) i
  where (i->>'itemId'=ref or exists(select 1 from private_ficha.mascaras m where m.campaign_id=p_campaign and m.token=i->>'itemId' and m.definition_id=ref))
   and case when jsonb_typeof(i->'quantity')='number' then (i->>'quantity')::numeric>0 else false end)), '[]'::jsonb);
end $$;

drop function private.situacao_personagem(uuid);
drop function private.mudanca_de_ciclo(uuid);
drop table public.character_notices;
drop table private_ficha.mudanca_ciclo;
drop table private_ficha.transferencias;
drop function private_ficha.purgar_copias();
drop table private_ficha.ciclo_eventos;
drop table private_ficha.ciclo;
create or replace function public.codex_capabilities() returns integer language sql stable set search_path = '' as $$ select 20 $$;
commit;
