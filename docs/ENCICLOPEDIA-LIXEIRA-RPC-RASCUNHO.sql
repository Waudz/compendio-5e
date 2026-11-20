-- RASCUNHO: NAO EXECUTAR. Depende de ENCICLOPEDIA-SQL-RASCUNHO.sql.
-- Transicoes de lixeira sao exclusivas do mestre autenticado.
-- Nunca aceitar user_id, papel, deleted_at ou campaign_id como autoridade do cliente.
-- SECURITY DEFINER: revisar owner, EXECUTE, RLS e grants antes de promover a migration.

create or replace function public.encyclopedia_trash_entry(p_entry_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if auth.uid() is null or p_entry_id is null then
    return false;
  end if;

  -- Lock serializa transicoes concorrentes; consulta so retorna para mestre.
  select e.campaign_id into v_campaign_id
  from public.encyclopedia_entries e
  where e.id = p_entry_id and public.is_master(e.campaign_id)
  for update;
  if not found then return false; end if;

  update public.encyclopedia_entries e
  set deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
  where e.id = p_entry_id and e.deleted_at is null;
  return found;
end $$;

create or replace function public.encyclopedia_restore_entry(p_entry_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if auth.uid() is null or p_entry_id is null then
    return false;
  end if;

  select e.campaign_id into v_campaign_id
  from public.encyclopedia_entries e
  where e.id = p_entry_id and public.is_master(e.campaign_id)
  for update;
  if not found then return false; end if;

  update public.encyclopedia_entries e
  set deleted_at = null, deleted_by = null, updated_at = now()
  where e.id = p_entry_id and e.deleted_at is not null;
  return found;
end $$;

revoke all on function public.encyclopedia_trash_entry(uuid) from public,anon,authenticated;
revoke all on function public.encyclopedia_restore_entry(uuid) from public,anon,authenticated;
grant execute on function public.encyclopedia_trash_entry(uuid) to authenticated;
grant execute on function public.encyclopedia_restore_entry(uuid) to authenticated;

-- CONTRATOS A TESTAR EM AMBIENTE ISOLADO:
-- 1. Anon, jogador, membro de outra campanha e ID inexistente: false, sem mutacao.
-- 2. Mestre da campanha: primeira transicao true, repeticao false; restore idem.
-- 3. Timestamp e autor derivados exclusivamente do servidor.
-- 4. Dois mestres concorrentes nao devem causar duas transicoes.
-- 5. Registro em lixeira nao aparece na RPC publica, busca, contagem ou Realtime.
-- 6. Validar owner SECURITY DEFINER, search_path e permissao de escrita.
-- 7. Sem exclusao permanente: historico permanece intacto e restauravel sem prazo.
