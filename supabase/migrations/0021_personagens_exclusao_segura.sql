-- PROPOSTA: não aplicar em produção sem autorização específica.
-- Gerada com CLI 3.2.0 (20261127143013), renumerada conforme o ledger sequencial.
-- Arquivo privado: não exclui fichas fisicamente nem apaga histórico de itens/vitais.
begin;
create table private_ficha.personagens_excluidos(
 character_id uuid primary key references public.notes(id) on delete cascade,
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 owner_id uuid not null, actor_id uuid not null, operation_id uuid not null,
 deleted_at timestamptz not null default now(),
 note_before jsonb not null, sheet_before jsonb,
 combat_refs jsonb not null default '[]'::jsonb,
 encounter_refs jsonb not null default '[]'::jsonb
);
alter table private_ficha.personagens_excluidos enable row level security;
revoke all on private_ficha.personagens_excluidos from public,anon,authenticated;
create index personagens_excluidos_campaign on private_ficha.personagens_excluidos(campaign_id);

create or replace function private.notes_ficha_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ficha jsonb;
begin
  if exists(select 1 from private_ficha.personagens_excluidos a where a.character_id=old.id) then
    if old.deleted_at is null and new.deleted_at is not null
       and (new.title,new.body,new.meta,new.kind,new.owner_id,new.campaign_id) is not distinct from
           (old.title,old.body,old.meta,old.kind,old.owner_id,old.campaign_id) then return new; end if;
    raise exception 'personagem_excluido' using errcode='42501';
  end if;
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

-- A nota ativa é verificada por helper DEFINER existente: mestre não precisa ler notas privadas.
create policy character_sheets_active on public.character_sheets as restrictive for all to authenticated
 using(private.nota_guiada_ativa(character_id,campaign_id,owner_id))
 with check(private.nota_guiada_ativa(character_id,campaign_id,owner_id));
create policy character_status_active on public.character_combat_status as restrictive for all to authenticated
 using(exists(select 1 from public.character_sheets s where s.character_id=character_combat_status.character_id))
 with check(exists(select 1 from public.character_sheets s where s.character_id=character_combat_status.character_id));

create function private_ficha.bloquear_personagem_excluido() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private_ficha.personagens_excluidos a where a.character_id=new.character_id) then
  raise exception 'personagem_excluido' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private_ficha.bloquear_personagem_excluido() from public,anon,authenticated;
create trigger personagem_arquivado before update on public.character_sheets
 for each row execute function private_ficha.bloquear_personagem_excluido();
create trigger personagem_arquivado before insert or update on public.character_combat_status
 for each row execute function private_ficha.bloquear_personagem_excluido();

create or replace function private_ficha.travar(p_id uuid) returns public.character_sheets
language plpgsql security definer set search_path='' as $$
declare s public.character_sheets;
begin
 if (select auth.uid()) is null then raise exception 'nao_autenticado' using errcode='42501'; end if;
 select * into s from public.character_sheets c where c.character_id=p_id for update;
 if not found or not(public.is_master(s.campaign_id) or (s.owner_id=(select auth.uid()) and public.is_member(s.campaign_id)))
    or not private.nota_guiada_ativa(s.character_id,s.campaign_id,s.owner_id) then
  raise exception 'ficha_nao_encontrada' using errcode='P0002';
 end if;
 return s;
end $$;

create function public.delete_campaign_character(p_id uuid,p_expected_revision bigint,p_name text,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.notes; s public.character_sheets; a private_ficha.personagens_excluidos; label text; combat jsonb; encounters jsonb;
begin
 if (select auth.uid()) is null or p_operation is null then raise exception 'nao_autorizado' using errcode='42501'; end if;
 -- Ordem igual à gravação guiada: ficha, depois nota. Toda a operação é transacional.
 select * into s from public.character_sheets where character_id=p_id for update;
 select * into n from public.notes where id=p_id for update;
 if not found or n.kind<>'character' or not public.is_member(n.campaign_id)
    or not(n.owner_id=(select auth.uid()) or public.is_master(n.campaign_id)) then
  raise exception 'personagem_indisponivel' using errcode='42501';
 end if;
 select * into a from private_ficha.personagens_excluidos where character_id=p_id;
 if found then
  if a.operation_id=p_operation and a.actor_id=(select auth.uid()) then return jsonb_build_object('id',p_id,'deleted',true); end if;
  raise exception 'personagem_excluido' using errcode='42501';
 end if;
 if n.deleted_at is not null then raise exception 'personagem_indisponivel' using errcode='42501'; end if;
 if s.character_id is not null and s.revision is distinct from p_expected_revision then
  raise exception 'conflito_de_revisao' using errcode='40001';
 end if;
 label:=coalesce(nullif(s.draft->>'name',''),n.title);
 if p_name is distinct from label then raise exception 'confirmacao_invalida' using errcode='22023'; end if;
 select coalesce(jsonb_agg(c),'[]'::jsonb) into combat from public.campaign_combats b,
 lateral jsonb_array_elements(b.state->'combatentes') c
 where b.campaign_id=n.campaign_id and c#>>'{ref,tipo}'='personagem' and c#>>'{ref,id}'=p_id::text;
 select coalesce(jsonb_agg(jsonb_build_object('encounter',x->>'id','participant',p)),'[]'::jsonb) into encounters
 from public.campaign_encounters b,lateral jsonb_array_elements(b.state->'encontros') x,
 lateral jsonb_array_elements(x->'participantes') p
 where b.campaign_id=n.campaign_id and p#>>'{ref,tipo}'='personagem' and p#>>'{ref,id}'=p_id::text;
 insert into private_ficha.personagens_excluidos(character_id,campaign_id,owner_id,actor_id,operation_id,note_before,sheet_before,combat_refs,encounter_refs)
 values(p_id,n.campaign_id,n.owner_id,(select auth.uid()),p_operation,to_jsonb(n),case when s.character_id is not null then to_jsonb(s) end,combat,encounters);
 update public.notes set deleted_at=now() where id=p_id;
 -- Desvincular só a referência viva. Nome, PV, iniciativa, condições e IDs do combate permanecem.
 update public.campaign_combats b set state=jsonb_set(b.state,'{combatentes}',
  (select coalesce(jsonb_agg(case when c#>>'{ref,tipo}'='personagem' and c#>>'{ref,id}'=p_id::text then c-'ref' else c end order by ord),'[]'::jsonb)
   from jsonb_array_elements(b.state->'combatentes') with ordinality e(c,ord))),version=b.version+1
 where b.campaign_id=n.campaign_id and exists(select 1 from jsonb_array_elements(b.state->'combatentes') c where c#>>'{ref,tipo}'='personagem' and c#>>'{ref,id}'=p_id::text);
 -- Configuração de encontros: mesma regra; estado atual e histórico permanecem intactos.
 update public.campaign_encounters b set state=jsonb_set(b.state,'{encontros}',
  (select coalesce(jsonb_agg(jsonb_set(x,'{participantes}',
   (select coalesce(jsonb_agg(case when p#>>'{ref,tipo}'='personagem' and p#>>'{ref,id}'=p_id::text then p-'ref' else p end order by po),'[]'::jsonb)
    from jsonb_array_elements(x->'participantes') with ordinality pp(p,po))) order by eo),'[]'::jsonb)
   from jsonb_array_elements(b.state->'encontros') with ordinality ee(x,eo))),version=b.version+1
 where b.campaign_id=n.campaign_id and exists(select 1 from jsonb_array_elements(b.state->'encontros') x,
 lateral jsonb_array_elements(x->'participantes') p where p#>>'{ref,tipo}'='personagem' and p#>>'{ref,id}'=p_id::text);
 return jsonb_build_object('id',p_id,'deleted',true);
end $$;
revoke all on function public.delete_campaign_character(uuid,bigint,text,uuid) from public,anon;
grant execute on function public.delete_campaign_character(uuid,bigint,text,uuid) to authenticated;
commit;
