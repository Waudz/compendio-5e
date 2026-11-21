-- 0008 — PROPOSTA, NÃO APLICADA ao Supabase hospedado (depende da 0007, já aplicada). Só o responsável autoriza aplicar; apresentar este SQL,
-- os resultados de `supabase/character-sheets.test.ts` e a justificativa antes.
--
-- Persistência segura da FICHA PRIVADA do criador guiado. Incremental: NÃO apaga, não recria a tabela e não toca dados existentes (a tabela está
-- vazia, mas a migração também é segura com linhas). Faz seis coisas:
--   1. substitui TODAS as políticas de character_sheets pelas definitivas (por nome dinâmico: não depende dos nomes usados na 0007 remota);
--   2. torna imutáveis character_id, campaign_id, owner_id e created_at e deixa `revision`/`updated_at` SÓ para o servidor (gatilho);
--   3. liga a ficha à linha pública de `notes` por chave composta (mesma campanha, sem exclusão em cascata) e exige draft.id = character_id;
--   4. impede que a linha pública (`notes.meta`) de um personagem guiado carregue qualquer dado além da identidade pública;
--   5. cria duas funções SECURITY INVOKER (a RLS vale para quem chama) que gravam ficha + identidade pública na MESMA transação:
--      create_guided_character e save_guided_character (controle de revisão: 'conflito_de_revisao');
--   6. concede à API (authenticated) só o mínimo: SELECT, INSERT (4 colunas) e UPDATE (draft). Nunca DELETE. anon continua sem nada.
--
-- Quem lê a ficha (draft): o DONO enquanto participa da campanha e o MESTRE da campanha. Outro jogador, ex-participante (que não é dono
-- participante), usuário de outra campanha e anon: nada (nem contagem). O mestre NÃO lê anotações privadas (notes) e NÃO altera a identidade pública.
-- Quem sai da campanha deixa de ler a própria ficha; ela permanece no banco (sem DELETE) e o mestre continua com acesso (decisão de produto:
-- saída da campanha deixa o personagem inativo; ver docs/CRIADOR-FICHA-INVENTARIO.md).
-- Reversão em supabase/rollback/0008_character_sheets_persistencia_down.sql (volta ao estado fechado da 0007; não apaga dados).

-- ------------------------------------------------------------------ 0. pré-condições (compatibilidade com a 0007 REAL)
-- O SQL original da 0007 remota não estava versionado; esta migração não presume nada que possa conferir. Se a estrutura real divergir, ela ABORTA
-- inteira (nada é alterado) com uma mensagem dizendo o quê. Verifica: colunas e tipos, unicidade de character_id, RLS ligada e ausência de gatilhos
-- desconhecidos (um gatilho próprio de revisão/data duplicaria o efeito do nosso). Políticas desconhecidas não bloqueiam: são substituídas (item 1).
do $$
declare
  esperado constant text[][] := array[['character_id', 'uuid'], ['campaign_id', 'uuid'], ['owner_id', 'uuid'], ['draft', 'jsonb'],
                                      ['created_at', 'timestamp with time zone'], ['updated_at', 'timestamp with time zone']];
  i integer; tipo text; trig text;
begin
  if to_regclass('public.character_sheets') is null then raise exception 'precondicao_0008: public.character_sheets nao existe (aplique a 0007 antes)'; end if;
  for i in 1 .. array_length(esperado, 1) loop
    select format_type(a.atttypid, a.atttypmod) into tipo from pg_attribute a
     where a.attrelid = 'public.character_sheets'::regclass and a.attname = esperado[i][1] and not a.attisdropped;
    if tipo is distinct from esperado[i][2] then raise exception 'precondicao_0008: coluna % esperada como %, encontrada: %', esperado[i][1], esperado[i][2], coalesce(tipo, 'ausente'); end if;
  end loop;
  select format_type(a.atttypid, a.atttypmod) into tipo from pg_attribute a where a.attrelid = 'public.character_sheets'::regclass and a.attname = 'revision' and not a.attisdropped;
  if tipo is null or tipo not in ('integer', 'bigint') then raise exception 'precondicao_0008: coluna revision deve ser integer/bigint, encontrada: %', coalesce(tipo, 'ausente'); end if;
  if not (select relrowsecurity from pg_class where oid = 'public.character_sheets'::regclass) then raise exception 'precondicao_0008: RLS desligada em character_sheets'; end if;
  -- uma ficha por personagem: character_id precisa ser único (chave primária ou índice único de uma coluna)
  if not exists (select 1 from pg_index x join pg_attribute a on a.attrelid = x.indrelid and a.attnum = x.indkey[0]
                  where x.indrelid = 'public.character_sheets'::regclass and x.indisunique and x.indnatts = 1 and x.indpred is null and a.attname = 'character_id') then
    create unique index character_sheets_character_id_uniq on public.character_sheets (character_id);
  end if;
  select string_agg(tgname, ', ') into trig from pg_trigger
   where tgrelid = 'public.character_sheets'::regclass and not tgisinternal and tgname <> 'character_sheets_guard';
  if trig is not null then raise exception 'precondicao_0008: gatilhos desconhecidos em character_sheets (%); revise antes de aplicar (revisao/datas devem ter um unico dono)', trig; end if;
end $$;

-- ------------------------------------------------------------------ 3. vínculo com a linha pública
alter table public.notes add constraint notes_id_campaign_uniq unique (id, campaign_id);
alter table public.character_sheets
  add constraint character_sheets_nota_campanha_fk foreign key (character_id, campaign_id) references public.notes (id, campaign_id) on delete restrict,
  add constraint character_sheets_draft_id_check check (draft ->> 'id' = character_id::text);

-- ------------------------------------------------------------------ 4. linha pública guiada: só identidade pública
-- Personagem guiado = notes.kind 'character' com meta.guiado = true. Só `guiado` e `identidadePublica` são permitidos em meta, então atributos,
-- PV, inventário ou escolhas NUNCA vão para um registro que pode ser publicado para a campanha. (Personagens simples antigos não têm `guiado`.)
alter table public.notes add constraint notes_guiado_meta_check
  check (not (meta ? 'guiado') or (meta - array['guiado', 'identidadePublica']) = '{}'::jsonb);

-- ------------------------------------------------------------------ 2. imutabilidade e revisão controlada pelo servidor
create function public.character_sheets_guard() returns trigger
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
create trigger character_sheets_guard before insert or update on public.character_sheets
  for each row execute function public.character_sheets_guard();
revoke all on function public.character_sheets_guard() from public, anon, authenticated;

-- ------------------------------------------------------------------ 1. políticas definitivas
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'character_sheets' loop
    execute format('drop policy %I on public.character_sheets', p.policyname);
  end loop;
end $$;

-- Leitura e escrita: o dono enquanto PARTICIPA da campanha, ou o mestre (is_master/is_member leem o banco, não o cliente).
create policy character_sheets_select on public.character_sheets for select to authenticated
  using ((owner_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_master(campaign_id));
-- Criação: só o dono participante e só ligada a uma nota própria, da mesma campanha, de personagem guiado. O mestre não cria ficha de outro.
create policy character_sheets_insert on public.character_sheets for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id)
    and exists (select 1 from public.notes n where n.id = character_id and n.owner_id = (select auth.uid()) and n.kind = 'character'
                and n.campaign_id = character_sheets.campaign_id and n.meta ? 'guiado'));
create policy character_sheets_update on public.character_sheets for update to authenticated
  using ((owner_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_master(campaign_id))
  with check ((owner_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_master(campaign_id));
-- Sem política (e sem privilégio) de DELETE: a exclusão/transferência segue os contratos narrativos, não um atalho de API.

-- ------------------------------------------------------------------ 6. privilégios mínimos
revoke all on public.character_sheets from public, anon, authenticated;
grant select on public.character_sheets to authenticated;
grant insert (character_id, campaign_id, owner_id, draft) on public.character_sheets to authenticated;   -- revision/datas: só o gatilho
grant update (draft) on public.character_sheets to authenticated;                                          -- dono/campanha/revisão: imutáveis

-- ------------------------------------------------------------------ 5. gravação atômica (SECURITY INVOKER)
-- Cria a linha pública (notes) e a ficha privada juntas: se a segunda falhar, a primeira é desfeita. O id do personagem é do servidor; o
-- draft.id é sobrescrito com ele. p_title/p_meta devem vir SÓ da identidade pública (o cliente decide o que compartilhar; a CHECK barra o resto).
create function public.create_guided_character(p_campaign_id uuid, p_title text, p_meta jsonb, p_publish boolean, p_draft jsonb)
returns table (character_id uuid, revision integer, updated_at timestamptz)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare v_id uuid; v_rev integer; v_upd timestamptz;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then raise exception 'ficha_invalida' using errcode = '23514'; end if;
  insert into public.notes (campaign_id, kind, title, visibility, meta)
  values (p_campaign_id, 'character', coalesce(nullif(btrim(p_title), ''), 'Personagem'),
          case when coalesce(p_publish, false) then 'campaign' else 'private' end,
          jsonb_build_object('guiado', true) || coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;
  insert into public.character_sheets (character_id, campaign_id, owner_id, draft)
  values (v_id, p_campaign_id, auth.uid(), jsonb_set(p_draft, '{id}', to_jsonb(v_id::text)))
  returning revision, updated_at into v_rev, v_upd;
  return query select v_id, v_rev, v_upd;
end $$;

-- Atualiza a ficha com controle de revisão: 0 linhas = 'conflito_de_revisao' (nada é sobrescrito em silêncio). A identidade pública (título,
-- meta, publicação) só pode ser alterada pelo DONO; o mestre edita a ficha, mas pedir mudança de identidade é erro ('identidade_so_do_dono').
-- 'conflito_de_revisao' só é dito a quem já lê a ficha (a RLS esconde a existência dos demais: erro igual ao de inexistente).
create function public.save_guided_character(p_id uuid, p_expected_revision integer, p_draft jsonb,
                                             p_title text default null, p_meta jsonb default null, p_publish boolean default null)
returns table (revision integer, updated_at timestamptz)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare v_rev integer; v_upd timestamptz; v_owner uuid;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then raise exception 'ficha_invalida' using errcode = '23514'; end if;
  update public.character_sheets s set draft = jsonb_set(p_draft, '{id}', to_jsonb(p_id::text))
   where s.character_id = p_id and s.revision = p_expected_revision
  returning s.revision, s.updated_at, s.owner_id into v_rev, v_upd, v_owner;
  if not found then
    if exists (select 1 from public.character_sheets s where s.character_id = p_id) then raise exception 'conflito_de_revisao' using errcode = '40001'; end if;
    raise exception 'ficha_nao_encontrada' using errcode = 'P0002';
  end if;
  if p_title is not null or p_meta is not null or p_publish is not null then
    if v_owner <> auth.uid() then raise exception 'identidade_so_do_dono' using errcode = '42501'; end if;
    update public.notes n
       set title = coalesce(nullif(btrim(p_title), ''), n.title),
           meta = case when p_meta is null then n.meta else jsonb_build_object('guiado', true) || p_meta end,
           visibility = case when p_publish is null then n.visibility when p_publish then 'campaign' else 'private' end
     where n.id = p_id and n.owner_id = auth.uid();
    if not found then raise exception 'nota_nao_encontrada' using errcode = 'P0002'; end if;
  end if;
  return query select v_rev, v_upd;
end $$;

revoke all on function public.create_guided_character(uuid, text, jsonb, boolean, jsonb) from public, anon;
revoke all on function public.save_guided_character(uuid, integer, jsonb, text, jsonb, boolean) from public, anon;
grant execute on function public.create_guided_character(uuid, text, jsonb, boolean, jsonb) to authenticated;
grant execute on function public.save_guided_character(uuid, integer, jsonb, text, jsonb, boolean) to authenticated;
