-- PROPOSTA: NÃO APLICADA. Depende de 0022; revisar/autorização antes de produção.
-- Adição somente de funções: não altera linhas, políticas, imagens ou funções existentes.
begin;
create function public.codex_edit_capability() returns boolean
language sql stable security invoker set search_path='' as $$ select true $$;
revoke all on function public.codex_edit_capability() from public,anon;
grant execute on function public.codex_edit_capability() to authenticated;

create function public.codex_save_edit(p_campaign uuid,p_entry uuid,p_version int,p_data jsonb,p_links jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare nid uuid; op jsonb; lid uuid; source_id uuid; target_id uuid;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if p_links is null or jsonb_typeof(p_links) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_links))<>2
   or jsonb_typeof(p_links->'remover') is distinct from 'array'
   or jsonb_typeof(p_links->'adicionar') is distinct from 'array' then raise exception 'vinculos_invalidos'; end if;
 if jsonb_array_length(p_links->'remover')>50 or jsonb_array_length(p_links->'adicionar')>50 or octet_length(p_links::text)>48000 then raise exception 'vinculos_invalidos'; end if;
 -- A função existente valida conteúdo, enquadramento, Storage, campanha e versão;
 -- a linha permanece bloqueada até o fim da mesma transação.
 nid:=public.codex_save(p_campaign,p_entry,p_version,p_data);
 for op in select value from jsonb_array_elements(p_links->'remover') loop
   if jsonb_typeof(op) is distinct from 'string' then raise exception 'vinculo_invalido'; end if;
   lid:=(op#>>'{}')::uuid;
   perform 1 from public.codex_links l where l.id=lid and l.campaign_id=p_campaign and nid in (l.source_id,l.target_id) for update;
   if not found then raise exception 'vinculo_invalido'; end if;
   perform public.codex_unlink(p_campaign,lid);
 end loop;
 for op in select value from jsonb_array_elements(p_links->'adicionar') loop
   if jsonb_typeof(op) is distinct from 'object' or (select count(*) from jsonb_object_keys(op))<>3
     or not (op ?& array['source','target','relation']) or jsonb_typeof(op->'relation') is distinct from 'object'
     or exists(select 1 from jsonb_each(op->'relation') x where x.key not in ('kind','label','inverse','revealed'))
     or jsonb_typeof(op#>'{relation,kind}') is distinct from 'string'
     or jsonb_typeof(op#>'{relation,label}') is distinct from 'string'
     or jsonb_typeof(op#>'{relation,inverse}') is distinct from 'string'
     or (op->'relation' ? 'revealed' and jsonb_typeof(op#>'{relation,revealed}') is distinct from 'boolean')
     then raise exception 'vinculo_invalido'; end if;
   source_id:=coalesce((op->>'source')::uuid,nid); target_id:=coalesce((op->>'target')::uuid,nid);
   if source_id<>nid and target_id<>nid then raise exception 'vinculo_invalido'; end if;
   perform public.codex_link(p_campaign,source_id,target_id,op#>>'{relation,kind}',op#>>'{relation,label}',op#>>'{relation,inverse}',coalesce((op#>>'{relation,revealed}')::boolean,false));
 end loop;
 return nid;
end $$;
revoke all on function public.codex_save_edit(uuid,uuid,int,jsonb,jsonb) from public,anon;
grant execute on function public.codex_save_edit(uuid,uuid,int,jsonb,jsonb) to authenticated;
commit;

-- ROLLBACK (executar separadamente, não remove nenhum registro ou vínculo):
-- begin;
-- drop function public.codex_save_edit(uuid,uuid,int,jsonb,jsonb);
-- drop function public.codex_edit_capability();
-- commit;
