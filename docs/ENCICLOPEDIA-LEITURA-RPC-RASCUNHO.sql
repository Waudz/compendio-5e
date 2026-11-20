-- RASCUNHO DE LEITURA PUBLICA: NAO EXECUTAR. Depende de ENCICLOPEDIA-SQL-RASCUNHO.sql.
-- Leitura de jogadores por RPC com colunas explicitamente permitidas.
-- SECURITY DEFINER em schema exposto exige auditoria: EXECUTE explicitamente
-- concedido somente a authenticated, auth.uid() e campanha verificados na função.
-- Nunca interpolar SQL dinâmico nem aceitar IDs/roles de usuário como autoridade.
create or replace function public.encyclopedia_public_entries(
  p_campaign_id uuid,
  p_limit integer default 25,
  p_offset integer default 0,
  p_query text default null,
  p_kind text default null
) returns table (
  id uuid, campaign_id uuid, kind text, name text,
  summary text, public_description text, visibility text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_member(p_campaign_id) then
    return;
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or
     p_offset is null or p_offset < 0 or
     (p_query is not null and char_length(p_query)>200) or
     (p_kind is not null and p_kind not in ('creature','character','place','organization','knowledge')) then
    raise exception 'invalid_encyclopedia_query' using errcode='22023';
  end if;
  return query
  select e.id,e.campaign_id,e.kind,e.name,e.summary,
    case when e.visibility='full' then e.public_description else ''::text end,
    e.visibility
  from public.encyclopedia_entries e
  where e.campaign_id=p_campaign_id
    and e.deleted_at is null
    and e.visibility in ('summary','full')
    and (p_kind is null or e.kind=p_kind)
    and (nullif(btrim(p_query),'') is null or
      strpos(lower(e.name),lower(p_query))>0 or
      strpos(lower(e.summary),lower(p_query))>0 or
      (e.visibility='full' and strpos(lower(e.public_description),lower(p_query))>0))
  order by e.name,e.id
  limit p_limit offset p_offset;
end $$;

revoke all on function public.encyclopedia_public_entries(uuid,integer,integer,text,text)
 from public,anon,authenticated;
grant execute on function public.encyclopedia_public_entries(uuid,integer,integer,text,text)
 to authenticated;

-- Revisar antes de executar:
-- 1. SECURITY DEFINER só deve ser usado após auditoria do proprietário e das
--    funções is_member; a função valida auth.uid() e nunca retorna notas/mecânicas.
-- 2. Busca usa strpos(lower(...)) para não interpretar %/_ como curingas; não remove acentos. Avaliar extensão unaccent
--    somente após aprovação e testes de performance.
-- 3. A resposta não inclui contagem total; eventual RPC de count deve aplicar
--    os MESMOS filtros e permissões.
-- 4. Realtime da tabela base não deve ser exposto aos jogadores.
-- 5. Não executar até haver testes reais com identidades de mestre/jogador.
