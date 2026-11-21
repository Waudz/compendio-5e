-- 0008 — PROPOSTA, NÃO APLICADA ao Supabase hospedado (depende da 0007, já aplicada). Só o responsável autoriza aplicar; apresentar este SQL,
-- os resultados de `supabase/character-sheets.test.ts` e a justificativa antes. Revisada após os bloqueios do PR #80 (21/11/2026).
--
-- Persistência segura da FICHA PRIVADA do criador guiado. Incremental: NÃO apaga, não recria a tabela e não toca dados existentes.
--   0. pré-condições: confere a estrutura REAL da 0007 e ABORTA inteira (sem alterar nada) se divergir;
--   1. schema `private` (NÃO exposto pela API) com quatro funções de apoio — duas SECURITY DEFINER mínimas que só respondem "existe?":
--        tem_ficha(id), nota_guiada_ativa(id, campanha, dono); e duas puras: identidade_meta_valida(meta), titulo_publico(meta);
--   2. INVARIANTE PRESA À EXISTÊNCIA DA FICHA (sem CHECK global: notas legadas com `guiado` em formato diferente continuam editáveis) (não a um marcador do cliente): enquanto houver `character_sheets` para uma nota, um gatilho em `notes`
--      impede remover o vínculo/`guiado`, trocar o tipo, excluir (soft-delete) e exige que `meta` seja EXATAMENTE uma identidade pública válida;
--      o título é sempre derivado dessa identidade (o cliente não escolhe título);
--   3. gatilho em `character_sheets` (campos imutáveis; `revision`/`updated_at` só do servidor), chave composta com `notes`, `draft.id = character_id`;
--   4. políticas definitivas — INSERT e UPDATE exigem a nota ativa (`deleted_at IS NULL`), inclusive para o mestre (que não lê a nota privada) por
--      meio de `private.nota_guiada_ativa`, que confere também dono da nota = dono da ficha (invariante da 0007) e meta válido;
--   5. privilégios mínimos (SELECT, INSERT em 4 colunas, UPDATE em `draft`); nunca DELETE; anon nada;
--   6. `create_guided_character` / `save_guided_character` (SECURITY INVOKER; a RLS vale para quem chama): meta validado de forma ESTRITA, título derivado.
--
-- Quem lê a ficha (draft): o DONO enquanto participa da campanha e o MESTRE. Outro jogador, ex-participante, outra campanha e anon: nada.
-- O mestre NÃO lê anotações privadas e NÃO altera a identidade pública. Quem sai da campanha deixa de ler a própria ficha; ela permanece (sem DELETE).
-- Reversão em supabase/rollback/0008_character_sheets_persistencia_down.sql (volta ao estado fechado da 0007; não apaga dados).

-- ------------------------------------------------------------------ 0. pré-condições (compatibilidade com a 0007 REAL)
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
  if to_regclass('public.notes') is null or (select count(*) from pg_attribute where attrelid = 'public.notes'::regclass and attname in ('meta', 'deleted_at', 'kind') and not attisdropped) <> 3 then
    raise exception 'precondicao_0008: public.notes precisa das colunas kind, meta e deleted_at (migracoes de notas e registros)';
  end if;
  -- uma ficha por personagem: character_id precisa ser único (chave primária ou índice único de uma coluna)
  if not exists (select 1 from pg_index x join pg_attribute a on a.attrelid = x.indrelid and a.attnum = x.indkey[0]
                  where x.indrelid = 'public.character_sheets'::regclass and x.indisunique and x.indnatts = 1 and x.indpred is null and a.attname = 'character_id') then
    create unique index character_sheets_character_id_uniq on public.character_sheets (character_id);
  end if;
  select string_agg(tgname, ', ') into trig from pg_trigger
   where tgrelid = 'public.character_sheets'::regclass and not tgisinternal and tgname <> 'character_sheets_guard';
  if trig is not null then raise exception 'precondicao_0008: gatilhos desconhecidos em character_sheets (%); revise antes de aplicar (revisao/datas devem ter um unico dono)', trig; end if;
end $$;

-- ------------------------------------------------------------------ 1. schema privado e funções de apoio
-- `private` NÃO deve estar na lista de schemas expostos da Data API (conferir em Settings → API). Nada aqui é chamável por anon.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- SECURITY DEFINER mínimas (só devolvem booleano; search_path vazio; usadas por políticas e gatilhos). Necessárias porque o mestre e quem saiu da
-- campanha não leem a nota privada nem (no caso de quem saiu) a própria ficha, mas as invariantes precisam valer para todos.
create function private.tem_ficha(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.character_sheets s where s.character_id = p_id)
$$;
-- Validação ESTRITA da linha pública de um personagem guiado: `meta` = { guiado: true, identidadePublica?: { settings, card } } e nada mais.
-- Qualquer chave extra (inventario, draft, nivel...), tipo errado, texto grande demais ou imagem que não seja https é recusada.
create function private.identidade_meta_valida(m jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  k text; f text; v jsonb; x jsonb; ident jsonb; card jsonb; st jsonb;
  campos constant text[] := array['imageUrl', 'title', 'name', 'surname', 'race', 'characterClass', 'description'];
  partes constant text[] := array['name', 'surname', 'race', 'characterClass'];
begin
  if m is null or jsonb_typeof(m) <> 'object' then return false; end if;
  if (m -> 'guiado') is distinct from 'true'::jsonb then return false; end if;
  for k in select jsonb_object_keys(m) loop if k not in ('guiado', 'identidadePublica') then return false; end if; end loop;
  ident := m -> 'identidadePublica';
  if ident is null then return true; end if;
  if jsonb_typeof(ident) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(ident) loop if k not in ('settings', 'card') then return false; end if; end loop;
  card := ident -> 'card'; st := ident -> 'settings';
  if jsonb_typeof(card) is distinct from 'object' or jsonb_typeof(st) is distinct from 'object' then return false; end if;
  for k in select jsonb_object_keys(card) loop if k <> all (campos) then return false; end if; end loop;
  for k in select jsonb_object_keys(st) loop if k <> all (campos) then return false; end if; end loop;
  foreach f in array campos loop
    v := card -> f;                                                                   -- cartão resolvido: texto ou null, todos os campos presentes
    if v is null or jsonb_typeof(v) not in ('string', 'null') then return false; end if;
    if jsonb_typeof(v) = 'string' and length(v #>> '{}') > (case f when 'description' then 4000 when 'imageUrl' then 2000 else 120 end) then return false; end if;
    v := st -> f;                                                                      -- configurações: modos por campo, título/descrição texto
    if v is null then return false; end if;
    if f = any (partes) then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for k in select jsonb_object_keys(v) loop if k not in ('mode', 'customValue') then return false; end if; end loop;
      if jsonb_typeof(v -> 'mode') is distinct from 'string' or (v ->> 'mode') not in ('real', 'custom', 'hidden') then return false; end if;
      x := v -> 'customValue';
      if x is not null and (jsonb_typeof(x) <> 'string' or length(x #>> '{}') > 120) then return false; end if;
    elsif f = 'imageUrl' then
      if jsonb_typeof(v) not in ('string', 'null') then return false; end if;
    else
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > (case f when 'description' then 4000 else 120 end) then return false; end if;
    end if;
  end loop;
  foreach x in array array[card -> 'imageUrl', st -> 'imageUrl'] loop
    if jsonb_typeof(x) = 'string' and ((x #>> '{}') !~ '^https://[^[:space:]]+$' or length(x #>> '{}') > 2000) then return false; end if;
  end loop;
  return true;
end $$;

-- Título público derivado do cartão (título → nome + sobrenome → 'Personagem'). O servidor, não o cliente, decide o título da nota.
create function private.titulo_publico(m jsonb) returns text
language sql immutable set search_path = '' as $$
  select left(coalesce(nullif(btrim(m #>> '{identidadePublica,card,title}'), ''),
                       nullif(btrim(concat_ws(' ', m #>> '{identidadePublica,card,name}', m #>> '{identidadePublica,card,surname}')), ''),
                       'Personagem'), 120)
$$;

-- Nota "viva" da ficha: existe, é de personagem, da MESMA campanha, PERTENCE ao dono da ficha (invariante da 0007), está ativa (deleted_at IS NULL) e a
-- linha pública está no formato estrito. Definida depois de identidade_meta_valida (usada abaixo); as funções são resolvidas na execução.
create function private.nota_guiada_ativa(p_id uuid, p_campaign uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n
                  where n.id = p_id and n.campaign_id = p_campaign and n.owner_id = p_owner and n.kind = 'character'
                    and n.deleted_at is null and private.identidade_meta_valida(n.meta))
$$;

revoke all on function private.tem_ficha(uuid), private.nota_guiada_ativa(uuid, uuid, uuid), private.identidade_meta_valida(jsonb), private.titulo_publico(jsonb) from public, anon;
grant execute on function private.tem_ficha(uuid), private.nota_guiada_ativa(uuid, uuid, uuid), private.identidade_meta_valida(jsonb), private.titulo_publico(jsonb) to authenticated;

-- ------------------------------------------------------------------ 2. invariante da linha pública, presa à existência da ficha
alter table public.notes add constraint notes_id_campaign_uniq unique (id, campaign_id);
-- NÃO há CHECK global sobre `meta` (a versão anterior desta proposta tinha `notes_guiado_meta_check`): ela impediria atualizar notas LEGADAS que tenham a chave
-- `guiado` mas fora do formato estrito, e não era a fronteira de segurança. A proteção vale onde importa: (a) a ficha só nasce para uma nota com meta válido
-- (política de INSERT); (b) depois, o gatilho abaixo mantém o meta válido enquanto a ficha existir; (c) a RPC de criação valida antes de gravar.
create function private.notes_ficha_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if private.tem_ficha(new.id) then
    if new.kind <> 'character' or new.campaign_id is distinct from old.campaign_id or new.owner_id is distinct from old.owner_id then
      raise exception 'personagem_guiado_imutavel' using errcode = '42501';
    end if;
    if new.deleted_at is not null then raise exception 'personagem_guiado_nao_exclui' using errcode = '42501'; end if;
    if not private.identidade_meta_valida(new.meta) then raise exception 'identidade_invalida' using errcode = '23514'; end if;
    new.title := private.titulo_publico(new.meta);
  end if;
  return new;
end $$;
revoke all on function private.notes_ficha_guard() from public, anon, authenticated;
-- Nome com `zz` para disparar DEPOIS dos demais gatilhos BEFORE de `notes` (vê o NEW final).
create trigger notes_zz_ficha_guard before update on public.notes for each row execute function private.notes_ficha_guard();

-- ------------------------------------------------------------------ 3. ficha: vínculo, imutabilidade e revisão controlada pelo servidor
alter table public.character_sheets
  add constraint character_sheets_nota_campanha_fk foreign key (character_id, campaign_id) references public.notes (id, campaign_id) on delete restrict,
  add constraint character_sheets_draft_id_check check (draft ->> 'id' = character_id::text);

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

-- ------------------------------------------------------------------ 4. políticas definitivas
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'character_sheets' loop
    execute format('drop policy %I on public.character_sheets', p.policyname);
  end loop;
end $$;

-- Leitura: o dono enquanto PARTICIPA da campanha, ou o mestre (is_master/is_member leem o banco, não o cliente).
create policy character_sheets_select on public.character_sheets for select to authenticated
  using ((owner_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_master(campaign_id));
-- Criação: só o dono participante, ligada a uma nota PRÓPRIA, ativa (deleted_at IS NULL), de personagem, da mesma campanha e com meta VÁLIDO
-- (guiado + identidade pública estrita). O mestre não cria ficha em nome de outro.
create policy character_sheets_insert on public.character_sheets for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_member(campaign_id)
    and exists (select 1 from public.notes n where n.id = character_id and n.owner_id = (select auth.uid()) and n.kind = 'character'
                and n.campaign_id = character_sheets.campaign_id and n.deleted_at is null and private.identidade_meta_valida(n.meta)));
-- Atualização: dono participante ou mestre, e a nota continua VIVA: do mesmo dono da ficha, da mesma campanha, ativa e com meta válido. A checagem usa a
-- função DEFINER porque o mestre não lê a nota privada.
create policy character_sheets_update on public.character_sheets for update to authenticated
  using ((owner_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_master(campaign_id))
  with check (((owner_id = (select auth.uid()) and public.is_member(campaign_id)) or public.is_master(campaign_id))
              and private.nota_guiada_ativa(character_id, campaign_id, owner_id));
-- Sem política (e sem privilégio) de DELETE: a exclusão/transferência segue os contratos narrativos, não um atalho de API.

-- ------------------------------------------------------------------ 5. privilégios mínimos
revoke all on public.character_sheets from public, anon, authenticated;
grant select on public.character_sheets to authenticated;
grant insert (character_id, campaign_id, owner_id, draft) on public.character_sheets to authenticated;   -- revision/datas: só o gatilho
grant update (draft) on public.character_sheets to authenticated;                                          -- dono/campanha/revisão: imutáveis

-- ------------------------------------------------------------------ 6. gravação atômica (SECURITY INVOKER)
-- `p_title` é IGNORADO (mantido só por compatibilidade de assinatura): o título vem de private.titulo_publico(meta). `p_meta` passa por
-- private.identidade_meta_valida; o marcador `guiado = true` é imposto pelo servidor (o cliente não consegue sobrescrevê-lo).
create function public.create_guided_character(p_campaign_id uuid, p_title text, p_meta jsonb, p_publish boolean, p_draft jsonb)
returns table (character_id uuid, revision integer, updated_at timestamptz)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare v_id uuid; v_rev integer; v_upd timestamptz; v_meta jsonb;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then raise exception 'ficha_invalida' using errcode = '23514'; end if;
  if p_meta is not null and jsonb_typeof(p_meta) <> 'object' then raise exception 'identidade_invalida' using errcode = '23514'; end if;
  v_meta := coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('guiado', true);
  if not private.identidade_meta_valida(v_meta) then raise exception 'identidade_invalida' using errcode = '23514'; end if;
  insert into public.notes (campaign_id, kind, title, visibility, meta)
  values (p_campaign_id, 'character', private.titulo_publico(v_meta), case when coalesce(p_publish, false) then 'campaign' else 'private' end, v_meta)
  returning id into v_id;
  insert into public.character_sheets (character_id, campaign_id, owner_id, draft)
  values (v_id, p_campaign_id, auth.uid(), jsonb_set(p_draft, '{id}', to_jsonb(v_id::text)))
  returning revision, updated_at into v_rev, v_upd;
  return query select v_id, v_rev, v_upd;
end $$;

-- Atualiza a ficha com controle de revisão: 0 linhas = 'conflito_de_revisao' (nada é sobrescrito em silêncio). A identidade pública (meta e publicação)
-- só pode ser alterada pelo DONO; o mestre edita a ficha, mas pedir mudança de identidade é erro ('identidade_so_do_dono'). 'conflito_de_revisao' só é
-- dito a quem já lê a ficha (a RLS esconde a existência dos demais: erro igual ao de inexistente).
create function public.save_guided_character(p_id uuid, p_expected_revision integer, p_draft jsonb,
                                             p_title text default null, p_meta jsonb default null, p_publish boolean default null)
returns table (revision integer, updated_at timestamptz)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare v_rev integer; v_upd timestamptz; v_owner uuid; v_meta jsonb;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then raise exception 'ficha_invalida' using errcode = '23514'; end if;
  if p_meta is not null then
    if jsonb_typeof(p_meta) <> 'object' then raise exception 'identidade_invalida' using errcode = '23514'; end if;
    v_meta := p_meta || jsonb_build_object('guiado', true);
    if not private.identidade_meta_valida(v_meta) then raise exception 'identidade_invalida' using errcode = '23514'; end if;
  end if;
  update public.character_sheets s set draft = jsonb_set(p_draft, '{id}', to_jsonb(p_id::text))
   where s.character_id = p_id and s.revision = p_expected_revision
  returning s.revision, s.updated_at, s.owner_id into v_rev, v_upd, v_owner;
  if not found then
    if exists (select 1 from public.character_sheets s where s.character_id = p_id) then raise exception 'conflito_de_revisao' using errcode = '40001'; end if;
    raise exception 'ficha_nao_encontrada' using errcode = 'P0002';
  end if;
  if p_meta is not null or p_publish is not null then
    if v_owner <> auth.uid() then raise exception 'identidade_so_do_dono' using errcode = '42501'; end if;
    update public.notes n
       set title = case when v_meta is null then n.title else private.titulo_publico(v_meta) end,
           meta = coalesce(v_meta, n.meta),
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
