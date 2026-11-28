-- 0023: edição atômica de conteúdo, vínculos, referências e estado vital.
-- PROPOSTA, NÃO APLICADA. Depende da 0022 (já aplicada: não reaplicar). Aplicar só com autorização expressa do responsável.
-- Adição somente de funções: não altera linhas, políticas, imagens ou funções existentes.
begin;
create function public.codex_edit_capability() returns boolean
language sql stable security invoker set search_path='' as $$ select true $$;
revoke all on function public.codex_edit_capability() from public,anon;
grant execute on function public.codex_edit_capability() to authenticated;

create function public.codex_save_edit(p_campaign uuid,p_entry uuid,p_version int,p_data jsonb,p_links jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare nid uuid; op jsonb; lid uuid; source_id uuid; target_id uuid; estado_atual text; referencia jsonb; referencias jsonb:='{}'::jsonb; rid uuid; token text;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if p_links is null or jsonb_typeof(p_links) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(p_links) k where k not in ('remover','adicionar','estado','referencias'))
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
 if p_links ? 'referencias' then
   if jsonb_typeof(p_links->'referencias') is distinct from 'array' then raise exception 'referencias_invalidas'; end if;
   if jsonb_array_length(p_links->'referencias')>50 then raise exception 'referencias_invalidas'; end if;
   for referencia in select value from jsonb_array_elements(p_links->'referencias') loop
     token:=referencia->>'token';
     if jsonb_typeof(referencia) is distinct from 'object' or (select count(*) from jsonb_object_keys(referencia))<>2
       or token is null or length(token)>200 or token not like 'catalog:%'
       or jsonb_typeof(referencia->'data') is distinct from 'object'
       or referencia#>>'{data,category}' is distinct from 'item'
       or referencia#>>'{data,systemId}' is distinct from 'dnd5e-2014'
       or token is distinct from 'catalog:'||(referencia#>>'{data,definitionId}')
       or coalesce(referencia#>>'{data,imagePath}','')<>'' or coalesce(referencia#>>'{data,instanceId}','')<>''
       or not exists(select 1 from jsonb_array_elements(p_links->'adicionar') a where a->>'source'=token or a->>'target'=token)
       then raise exception 'referencia_invalida'; end if;
     select c.id into rid from public.campaign_codex c where c.campaign_id=p_campaign and c.deleted_at is null and c.category='item' and c.system_id='dnd5e-2014' and c.definition_id=referencia#>>'{data,definitionId}' limit 1;
     if rid is null then rid:=public.codex_save(p_campaign,null,0,(referencia->'data')||jsonb_build_object('registered',false)); end if;
     referencias:=referencias||jsonb_build_object(token,rid::text);
   end loop;
 end if;
 for op in select value from jsonb_array_elements(p_links->'adicionar') loop
   if jsonb_typeof(op) is distinct from 'object' or (select count(*) from jsonb_object_keys(op))<>3
     or not (op ?& array['source','target','relation']) or jsonb_typeof(op->'relation') is distinct from 'object'
     or exists(select 1 from jsonb_each(op->'relation') x where x.key not in ('kind','label','inverse','revealed'))
     or jsonb_typeof(op#>'{relation,kind}') is distinct from 'string'
     or jsonb_typeof(op#>'{relation,label}') is distinct from 'string'
     or jsonb_typeof(op#>'{relation,inverse}') is distinct from 'string'
     or (op->'relation' ? 'revealed' and jsonb_typeof(op#>'{relation,revealed}') is distinct from 'boolean')
     then raise exception 'vinculo_invalido'; end if;
   source_id:=coalesce(coalesce(referencias->>(op->>'source'),op->>'source')::uuid,nid); target_id:=coalesce(coalesce(referencias->>(op->>'target'),op->>'target')::uuid,nid);
   if source_id<>nid and target_id<>nid then raise exception 'vinculo_invalido'; end if;
   perform public.codex_link(p_campaign,source_id,target_id,op#>>'{relation,kind}',op#>>'{relation,label}',op#>>'{relation,inverse}',coalesce((op#>>'{relation,revealed}')::boolean,false));
 end loop;
 if p_links ? 'estado' then
   if jsonb_typeof(p_links->'estado') is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_links->'estado'))<>2
     or not coalesce(p_links#>>'{estado,anterior}' in ('vivo','morto','desconhecido'),false)
     or not coalesce(p_links#>>'{estado,valor}' in ('vivo','morto','desconhecido'),false)
     then raise exception 'estado_invalido'; end if;
   select v.estado into estado_atual from public.character_life v where v.note_id=nid for update;
   if coalesce(estado_atual,'vivo') is distinct from p_links#>>'{estado,anterior}' then raise exception 'conflito_de_versao'; end if;
   perform public.character_life_set(p_campaign,nid,jsonb_build_object('estado',p_links#>>'{estado,valor}'),gen_random_uuid(),null);
 end if;
 return nid;
end $$;
revoke all on function public.codex_save_edit(uuid,uuid,int,jsonb,jsonb) from public,anon;
grant execute on function public.codex_save_edit(uuid,uuid,int,jsonb,jsonb) to authenticated;
commit;

-- Reversão: supabase/rollback/0023_edicao_codex_atomica_down.sql
