-- RASCUNHO DE LEITURA PUBLICA: NAO EXECUTAR. Depende de ENCICLOPEDIA-SQL-RASCUNHO.sql.
-- Leitura de jogadores por RPC com colunas explicitamente permitidas.
-- SECURITY DEFINER e necessario para consultar a tabela sem conceder SELECT
-- diretamente ao jogador. Revisar dono, search_path, grants e teste de RLS.
-- Funcao em schema nao exposto, acessivel por um wrapper no schema public.
-- O wrapper so retorna colunas publicas e verifica a participacao no servidor.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.encyclopedia_public_entries(
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
      e.name ilike '%'||p_query||'%' or
      e.summary ilike '%'||p_query||'%' or
      (e.visibility='full' and e.public_description ilike '%'||p_query||'%'))
  order by e.name,e.id
  limit p_limit offset p_offset;
end $$;

-- SECURITY INVOKER wrapper: the inner definer function owns its authorization.
-- Granting EXECUTE to authenticated on a definer function must be reviewed.
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
language sql stable security invoker set search_path = ''
as $$
  select * from private.encyclopedia_public_entries(p_campaign_id,p_limit,p_offset,p_query,p_kind)
$$;

revoke all on function private.encyclopedia_public_entries(uuid,integer,integer,text,text)
 from public,anon,authenticated;
revoke all on function public.encyclopedia_public_entries(uuid,integer,integer,text,text)
 from public,anon,authenticated;
-- Wrapper requires invoker permission to execute private function and USAGE
-- on private schema, which exposes an additional direct callable function.
-- BLOCKER: do NOT grant until wrapper architecture is changed to avoid
-- granting authenticated access to the private function.
