-- 0005_notas_conteudo.sql  — PROPOSTA PARA APROVAÇÃO. NÃO APLICADA ao Supabase hospedado.
-- Escopo: PESSOAL + CAMPANHA (estende public.notes; nenhuma tabela nova).
-- Reversão: supabase/rollback/0005_notas_conteudo_down.sql
--
-- O que muda em public.notes (aditivo; nenhuma linha existente é reescrita):
--   kind            tipo da página: 'note' (genérico, padrão das notas atuais), 'page' (genérico da Enciclopédia) e os especializados
--                   'scene', 'npc', 'location', 'faction', 'event', 'diary'. Novos tipos = nova migração que amplia o CHECK.
--   content         conteúdo estruturado (JSONB): array de blocos do editor. Formato canônico; NUNCA HTML. Até 500 000 bytes (não inclui imagens,
--                   que ficam no Storage e entram só como referência).
--   content_schema  versão do formato dos blocos (1..100); o aplicativo migra na leitura.
--   deleted_at / deleted_batch   exclusão lógica; o lote identifica o que foi excluído junto (restaurar devolve o lote).
--   body            continua existindo e COMPATÍVEL: notas antigas só têm body. Quando há content, o servidor deriva o body (texto de busca e
--                   prévia, até 50 000 caracteres) a partir de content: o cliente não decide o que a busca enxerga.
--
-- Segurança (nada disso depende do aplicativo):
--   * Nenhuma função SECURITY DEFINER nova. O gatilho e a função de salvar são SECURITY INVOKER (RLS vale dentro deles).
--   * A regra de leitura (note_readable / can_read_note) e as políticas RLS NÃO mudam: planejamento privado continua só do autor.
--   * Conteúdo: tipo array, tamanho, quantidade de blocos, profundidade; `href` só http(s)/mailto/compendio:; `url` (imagens/arquivos) só
--     referência de Storage da PRÓPRIA campanha (storage:campaign-assets/<campanha>/<uuid>), nunca URL externa nem de outra campanha;
--     chaves de carregamento externo (src, srcset, poster, action, formaction) são recusadas.
--   * Excluir logicamente força visibility='private' e apaga os destinatários; restaurar volta SEMPRE privada. Compartilhar de novo é
--     uma ação explícita e separada (não há como excluir/restaurar e, com isso, contornar a política de compartilhamento).
--   * Nota na lixeira não pode ser editada (só restaurada).
--   * Controle de conflito: version continua só do servidor; public.save_note_content(id, version, ...) responde 'conflito_de_versao'.
--
-- Compatibilidade com a decisão D3 (docs/NOTAS-PERMISSOES.md §4; docs/REGISTRO-OFICIAL-DECISOES.md):
--   * A nota pertence ao AUTOR; esta migração não cria vínculos nem concede acesso a ninguém. Vínculos (0008) nunca transferem propriedade
--     nem compartilham; compartilhar continua sendo ação explícita do autor (visibility / note_shares, e as audiências na futura 0009).
--   * O AUTOR EDITA as próprias notas mesmo depois de sair da campanha (a política notes_update deixa de exigir participação). O que NÃO muda:
--     compartilhar com a campanha continua exigindo participação atual (o gatilho recusa mudar para um nível de compartilhamento fora da
--     campanha) e, fora dela, o compartilhamento existente fica suspenso (note_readable já exige que o autor participe).
--   * NÃO implementa audiências, vínculos nem o relaxamento de campaign_id/note_shares: isso é a 0009 (e a 0008 para vínculos).
--     Dependências da 0009 sobre esta migração: (1) reescrever note_readable/can_read_note mantendo a assinatura; (2) fazer o gatilho
--     notes_content_before_write limpar também as audiências ao excluir (hoje limpa note_shares); (3) manter 'campaign_id' como origem do
--     caminho de Storage (hoje a referência de arquivo vale para a campanha de origem); (4) a coluna visibility passa a ser derivada, e o
--     gatilho continua forçando 'private' na lixeira.
-- Esta migração NÃO cria vínculos, cartões, sessões nem audiências (0006 em diante).

-- ------------------------------------------------------------------ colunas
alter table public.notes
  add column kind           text        not null default 'note',
  add column content        jsonb,
  add column content_schema integer     not null default 1,
  add column deleted_at     timestamptz,
  add column deleted_batch  uuid;

alter table public.notes
  add constraint notes_kind_check           check (kind in ('note', 'page', 'scene', 'npc', 'location', 'faction', 'event', 'diary')),
  add constraint notes_content_schema_check check (content_schema between 1 and 100),
  add constraint notes_content_check        check (content is null or (jsonb_typeof(content) = 'array' and jsonb_array_length(content) <= 5000 and octet_length(content::text) <= 500000)),
  add constraint notes_deleted_check        check ((deleted_at is null) = (deleted_batch is null));

create index notes_deleted_idx on public.notes (owner_id, deleted_at desc) where deleted_at is not null;
create index notes_kind_idx    on public.notes (campaign_id, kind) where deleted_at is null and campaign_id is not null;

-- ------------------------------------------------------------------ gatilho: lixeira, validação do conteúdo e body derivado
-- SECURITY INVOKER: roda com os privilégios de quem escreve; a RLS vale também dentro dele.
create function public.notes_content_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  v text; derived text; client_body text;
  uuid_re constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  -- Compartilhar exige participação ATUAL na campanha (o autor fora dela continua editando, mas não amplia o compartilhamento) ----
  if tg_op = 'UPDATE' and new.campaign_id is not null and new.visibility <> 'private' and new.visibility is distinct from old.visibility
     and not public.is_member(new.campaign_id) then
    raise exception 'compartilhar_exige_participacao' using errcode = '42501';
  end if;
  -- O conteúdo estruturado nunca é apagado por engano: para esvaziar, grave '[]' (ou use a lixeira) ------------------------------
  if tg_op = 'UPDATE' and old.content is not null and new.content is null then
    raise exception 'conteudo_nao_pode_ser_apagado' using errcode = '23514';
  end if;

  -- Lixeira ------------------------------------------------------------------------------------------------------------------
  if tg_op = 'INSERT' then
    new.deleted_at := null; new.deleted_batch := null;                     -- nasce viva
  else
    if old.deleted_at is not null and new.deleted_at is not null then      -- na lixeira: só restaurar
      if (new.title, new.body, new.content, new.content_schema, new.kind, new.visibility)
         is distinct from (old.title, old.body, old.content, old.content_schema, old.kind, old.visibility) then
        raise exception 'nota_na_lixeira' using errcode = '23514';
      end if;
      new.deleted_at := old.deleted_at; new.deleted_batch := old.deleted_batch;
    elsif old.deleted_at is null and new.deleted_at is not null then       -- excluir: sai de todo compartilhamento
      new.visibility := 'private';
      delete from public.note_shares where note_id = old.id;
      new.deleted_batch := coalesce(new.deleted_batch, gen_random_uuid());
    elsif old.deleted_at is not null and new.deleted_at is null then       -- restaurar: volta SEMPRE privada
      new.visibility := 'private'; new.deleted_batch := null;
    else
      new.deleted_batch := null;                                           -- viva: não existe lote
    end if;
  end if;

  -- Conteúdo estruturado ------------------------------------------------------------------------------------------------------
  client_body := new.body;
  if new.content is not null then
    if jsonb_typeof(new.content) <> 'array' then raise exception 'conteudo_invalido' using errcode = '23514'; end if;
    if exists (select 1 from jsonb_array_elements(new.content) b
               where jsonb_typeof(b) <> 'object' or coalesce(jsonb_typeof(b -> 'type'), '') <> 'string' or length(b ->> 'type') > 64) then
      raise exception 'conteudo_invalido' using errcode = '23514';          -- todo bloco é um objeto com "type" curto
    end if;
    if jsonb_path_exists(new.content, ('lax $[*]' || repeat('.children[*]', 20))::jsonpath) then
      raise exception 'conteudo_muito_profundo' using errcode = '23514';    -- mais de 20 níveis de blocos aninhados
    end if;
    -- chaves que carregariam recurso externo automaticamente
    if jsonb_path_exists(new.content, 'lax $.** ? (exists(@.src) || exists(@.srcset) || exists(@.poster) || exists(@.action) || exists(@.formaction))') then
      raise exception 'conteudo_referencia_externa' using errcode = '23514';
    end if;
    -- links: só http(s), mailto e referência interna (nunca javascript:, data:, file:, ...)
    for v in select jsonb_path_query(new.content, 'lax $.**.href') #>> '{}' loop
      if v is null or length(v) > 2048 or v !~ '^(https?://|mailto:|compendio:)[^[:space:][:cntrl:]]*$' then
        raise exception 'conteudo_link_invalido' using errcode = '23514';
      end if;
    end loop;
    -- arquivos/imagens: só referência de Storage da PRÓPRIA campanha; vazio = bloco ainda sem arquivo
    for v in select jsonb_path_query(new.content, 'lax $.**.url') #>> '{}' loop
      if v is null then raise exception 'conteudo_referencia_externa' using errcode = '23514'; end if;
      if v <> '' and (new.campaign_id is null or v !~ ('^storage:campaign-assets/' || new.campaign_id::text || '/' || uuid_re || '$')) then
        raise exception 'conteudo_referencia_externa' using errcode = '23514';
      end if;
    end loop;
    -- body derivado do conteúdo (busca/prévia). Mandar um body diferente é um ERRO (nada é descartado em silêncio): body só muda
    -- quando o content muda, e então é recalculado pelo servidor.
    -- (modo strict: o modo lax visita cada valor duas vezes e duplicaria o texto)
    select left(coalesce(string_agg(t, ' '), ''), 50000) into derived
      from (select jsonb_path_query(new.content, 'strict $.** ? (@.type() == "object" && exists(@.text)).text') #>> '{}' as t
            union all
            select jsonb_path_query(new.content, 'strict $.** ? (@.type() == "object" && exists(@.label)).label') #>> '{}'
            union all
            select jsonb_path_query(new.content, 'strict $.** ? (@.type() == "object" && exists(@.caption)).caption') #>> '{}') s
     where t is not null and t <> '';
    if client_body is distinct from derived and ((tg_op = 'INSERT' and coalesce(client_body, '') <> '') or (tg_op = 'UPDATE' and client_body is distinct from old.body)) then
      raise exception 'body_e_derivado_do_conteudo' using errcode = '23514';
    end if;
    new.body := derived;
  end if;
  return new;
end $$;
-- Chamado antes de notes_before_update? Ordem alfabética dos gatilhos BEFORE: notes_before_update (versão) roda primeiro; este depois.
create trigger notes_content_before_write before insert or update on public.notes
  for each row execute function public.notes_content_before_write();

-- ------------------------------------------------------------------ salvar com conflito explícito
-- SECURITY INVOKER: só o autor consegue atualizar (RLS). 'conflito_de_versao' só é dito a quem é o autor; para os demais o erro é idêntico
-- ao de nota inexistente (sem oráculo).
create function public.save_note_content(p_id uuid, p_version integer, p_content jsonb, p_schema integer default 1, p_title text default null)
returns table (version integer, updated_at timestamptz)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare r record;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'array' then raise exception 'conteudo_invalido' using errcode = '23514'; end if;   -- nunca apaga o conteúdo por engano
  update public.notes n
     set content = p_content, content_schema = p_schema, title = coalesce(p_title, n.title)
   where n.id = p_id and n.version = p_version
  returning n.version, n.updated_at into r;
  if found then return query select r.version, r.updated_at; return; end if;
  if exists (select 1 from public.notes n where n.id = p_id and n.owner_id = auth.uid()) then
    raise exception 'conflito_de_versao' using errcode = '40001';
  end if;
  raise exception 'nota_nao_encontrada' using errcode = 'P0002';
end $$;

-- ------------------------------------------------------------------ privilégios (por coluna; o que 0004 concedeu continua)
revoke all on function public.notes_content_before_write() from public, anon, authenticated;
revoke all on function public.save_note_content(uuid, integer, jsonb, integer, text) from public, anon;
grant execute on function public.save_note_content(uuid, integer, jsonb, integer, text) to authenticated;
grant insert (kind, content, content_schema) on public.notes to authenticated;
grant update (kind, content, content_schema, deleted_at, deleted_batch) on public.notes to authenticated;
-- Políticas RLS de notes e note_shares: SEM alteração (autor escreve; leitura por note_readable).

-- ------------------------------------------------------------------ D3: o autor edita as próprias notas mesmo fora da campanha
-- Na 0004 a política exigia participação atual também para EDITAR. Agora basta ser o autor; ampliar o compartilhamento continua exigindo
-- participação (gatilho acima), e a leitura por outros segue suspensa enquanto o autor está fora (note_readable, inalterada).
alter policy notes_update on public.notes using (owner_id = auth.uid()) with check (owner_id = auth.uid());
