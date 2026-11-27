-- 0019 — PROPOSTA, NÃO APLICADA. Requer 0014, 0017 e 0018. Catálogo da campanha no inventário e itens não identificados.
-- Um item não identificado entra no inventário com um código opaco (`unid-…`). A identidade verdadeira fica num esquema sem
-- privilégio de API; só quando o mestre identifica, o servidor troca o código pelo ID real nas fichas.
begin;
create table private_ficha.mascaras (
 token text primary key check(token ~ '^unid-[0-9a-f]{32}$'),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 definition_id text not null check(definition_id ~ '^[a-z0-9]+([.-][a-z0-9]+)*$' and length(definition_id)<=200 and definition_id not like 'unid-%'),
 nome text not null check(length(btrim(nome)) between 1 and 120),
 descricao text not null default '' check(length(descricao)<=2000),
 peso numeric check(peso between 0 and 10000),
 created_at timestamptz not null default now(),
 identified_at timestamptz
);
revoke all on private_ficha.mascaras from public,anon,authenticated;

-- Itens que cada personagem já teve (gravações autorizadas pela guarda de entregas). Mantém o nome no histórico após o consumo.
create table private_ficha.itens_vistos (
 character_id uuid not null references public.character_sheets(character_id) on delete cascade,
 item_id text not null check(length(item_id)<=200),
 primary key(character_id,item_id)
);
revoke all on private_ficha.itens_vistos from public,anon,authenticated;
insert into private_ficha.itens_vistos(character_id,item_id)
 select s.character_id,e->>'itemId' from public.character_sheets s, jsonb_array_elements(private_ficha.lista(s.draft->'inventory')) e
 where length(e->>'itemId') between 1 and 200 on conflict do nothing;
create function private_ficha.registrar_vistos() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private_ficha.itens_vistos(character_id,item_id)
  select new.character_id,e->>'itemId' from jsonb_array_elements(private_ficha.lista(new.draft->'inventory')) e
  where length(e->>'itemId') between 1 and 200 on conflict do nothing;
 return null;
end $$;
revoke all on function private_ficha.registrar_vistos() from public,anon,authenticated;
create trigger character_sheets_vistos after insert or update of draft on public.character_sheets
 for each row execute function private_ficha.registrar_vistos();

-- Única leitura das definições da campanha pelo aplicativo. O jogador recebe apenas: o que um personagem dele teve, o que foi
-- revelado com identificação completa e a aparência dos itens não identificados que são dele (sem a identidade verdadeira).
create function public.codex_definitions_for(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare master boolean;
begin
 if auth.uid() is null or not public.is_member(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 master:=public.is_master(p_campaign);
 return coalesce((
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind',d.kind,'definitionId',d.definition_id,
    'baseId',case when master then d.base_id end,'version',d.version,
    'data',jsonb_build_object('definition',d.data->'definition','descricao',d.data->'descricao'))) order by d.updated_at,d.definition_id)
  from public.campaign_definitions d where d.campaign_id=p_campaign and (master
   or (d.kind='item' and exists(select 1 from private_ficha.itens_vistos v join public.character_sheets s on s.character_id=v.character_id
        where s.campaign_id=p_campaign and s.owner_id=auth.uid() and v.item_id=d.definition_id))
   or exists(select 1 from public.campaign_codex c join public.notes n on n.id=c.id
        where c.campaign_id=p_campaign and c.category=d.kind and c.system_id='dnd5e-2014' and c.definition_id=d.definition_id
         and c.visible and c.deleted_at is null and n.deleted_at is null and public.codex_identified(c.revealed,n.meta->'sheet')))
 ),'[]'::jsonb) || coalesce((
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind','item','definitionId',m.token,'version',1,'mask',true,
    'identifiesAs',case when master then m.definition_id end,
    'data',jsonb_build_object('definition',jsonb_strip_nulls(jsonb_build_object('id',m.token,'en','Unidentified','nome',m.nome,'categoria','equipamento','raridade','mundano','peso',m.peso)),
      'descricao',nullif(m.descricao,'')))) order by m.created_at,m.token)
  from private_ficha.mascaras m where m.campaign_id=p_campaign and m.identified_at is null and (master
   or exists(select 1 from private_ficha.itens_vistos v join public.character_sheets s on s.character_id=v.character_id
        where s.campaign_id=p_campaign and s.owner_id=auth.uid() and v.item_id=m.token))
 ),'[]'::jsonb);
end $$;
revoke all on function public.codex_definitions_for(uuid) from public,anon;
grant execute on function public.codex_definitions_for(uuid) to authenticated;

-- Entrega atômica do mestre. p_mask {nome, descricao?, peso?} entrega sem identificar. Não cria nem revela descoberta.
create function public.codex_grant_item(p_campaign uuid,p_character uuid,p_definition_id text,p_quantity integer,p_mask jsonb,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.character_sheets; d jsonb; item_id text;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 if p_operation is null or p_quantity is null or p_quantity not between 1 and 1000
   or coalesce(p_definition_id,'') !~ '^[a-z0-9]+([.-][a-z0-9]+)*$' or length(p_definition_id)>200 or p_definition_id like 'unid-%' then
  raise exception 'operacao_invalida' using errcode='23514'; end if;
 if p_definition_id like 'custom-%' and not exists(select 1 from public.campaign_definitions x where x.campaign_id=p_campaign and x.kind='item' and x.definition_id=p_definition_id) then
  raise exception 'definicao_inexistente' using errcode='P0002'; end if;
 select * into s from public.character_sheets c where c.character_id=p_character and c.campaign_id=p_campaign for update;
 if not found then raise exception 'destino_invalido' using errcode='P0002'; end if;
 if p_operation::text=any(s.operacoes) then return; end if;
 item_id:=p_definition_id;
 if p_mask is not null then
  if jsonb_typeof(p_mask)<>'object' then raise exception 'operacao_invalida' using errcode='23514'; end if;
  item_id:='unid-'||replace(gen_random_uuid()::text,'-','');
  insert into private_ficha.mascaras(token,campaign_id,definition_id,nome,descricao,peso)
   values(item_id,p_campaign,p_definition_id,btrim(p_mask->>'nome'),coalesce(p_mask->>'descricao',''),case when jsonb_typeof(p_mask->'peso')='number' then (p_mask->>'peso')::numeric end);
 end if;
 d:=jsonb_set(s.draft,'{inventory}',private_ficha.lista(s.draft->'inventory')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'itemId',item_id,'quantity',p_quantity,'equipped',false,'origin','acquired')));
 d:=private_ficha.com_movimento(d,'Recebeu '||p_quantity||'× {item} do mestre',item_id);
 perform private_ficha.gravar(p_character,d,p_operation,'transferencia');
end $$;
revoke all on function public.codex_grant_item(uuid,uuid,text,integer,jsonb,uuid) from public,anon;
grant execute on function public.codex_grant_item(uuid,uuid,text,integer,jsonb,uuid) to authenticated;

-- Identifica todas as unidades daquele código, onde estiverem na campanha. Repetir é inofensivo.
create function public.codex_identify_item(p_campaign uuid,p_token text) returns void language plpgsql security definer set search_path='' as $$
declare m private_ficha.mascaras; s public.character_sheets; d jsonb;
begin
 if auth.uid() is null or not public.is_master(p_campaign) then raise exception 'sem_permissao' using errcode='42501'; end if;
 select * into m from private_ficha.mascaras x where x.token=p_token and x.campaign_id=p_campaign for update;
 if not found then raise exception 'item_inexistente' using errcode='P0002'; end if;
 if m.identified_at is not null then return; end if;
 for s in select * from public.character_sheets c where c.campaign_id=p_campaign
   and (exists(select 1 from jsonb_array_elements(private_ficha.lista(c.draft->'inventory')) e where e->>'itemId'=p_token)
     or exists(select 1 from jsonb_array_elements(private_ficha.lista(c.draft#>'{play,historico}')) h where h->>'itemId'=p_token))
   order by c.character_id for update loop
  d:=s.draft;
  if jsonb_typeof(d->'inventory')='array' then
   d:=jsonb_set(d,'{inventory}',coalesce((select jsonb_agg(case when e->>'itemId'=p_token then e||jsonb_build_object('itemId',m.definition_id) else e end order by n) from jsonb_array_elements(d->'inventory') with ordinality t(e,n)),'[]'::jsonb));
  end if;
  if jsonb_typeof(d#>'{play,historico}')='array' then
   d:=jsonb_set(d,'{play,historico}',coalesce((select jsonb_agg(case when h->>'itemId'=p_token then h||jsonb_build_object('itemId',m.definition_id) else h end order by n) from jsonb_array_elements(d#>'{play,historico}') with ordinality t(h,n)),'[]'::jsonb));
  end if;
  perform private_ficha.gravar(s.character_id,d,gen_random_uuid(),'transferencia');
 end loop;
 update private_ficha.mascaras set identified_at=now() where token=p_token;
end $$;
revoke all on function public.codex_identify_item(uuid,text) from public,anon;
grant execute on function public.codex_identify_item(uuid,text) to authenticated;

-- Posse também considera o item entregue sem identificação; o jogador só a vê se o mestre revelou `holders`.
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

create or replace function public.usar_consumivel(p_character_id uuid, p_instancia text, p_cura integer, p_maximo integer, p_operacao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.character_sheets; d jsonb; item jsonb; qtd integer; pv integer; novo_pv integer; def jsonb; formula text[];
begin
  if p_operacao is null or p_instancia is null or coalesce(p_cura, 0) < 0 or coalesce(p_cura, 0) > 1000000 or (coalesce(p_cura, 0) > 0 and (p_maximo is null or p_maximo < 1)) then
    raise exception 'operacao_invalida' using errcode = '23514';
  end if;
  s := private_ficha.travar(p_character_id);
  if p_operacao::text = any (s.operacoes) then return private_ficha.resultado_item(s); end if;
  d := s.draft; item := private_ficha.item_de(d, p_instancia);
  if item is null then raise exception 'item_inexistente' using errcode = 'P0002'; end if;
  -- Definição da campanha (criação ou substituição) manda; sem fórmula nem categoria de consumo, valem as regras do catálogo.
  -- Item não identificado não tem definição nem entra na lista: o mestre precisa identificá-lo antes do uso.
  select x.data -> 'definition' into def from public.campaign_definitions x where x.campaign_id = s.campaign_id and x.kind = 'item' and x.definition_id = item ->> 'itemId';
  formula := regexp_match(def ->> 'cura', '^([0-9]{1,3})d([0-9]{1,3})([+]([0-9]{1,4}))?$');
  if formula is not null then
    if p_cura is null or p_cura not between formula[1]::integer + coalesce(formula[4], '0')::integer and formula[1]::integer * formula[2]::integer + coalesce(formula[4], '0')::integer then raise exception 'operacao_invalida' using errcode = '23514'; end if;
  elsif coalesce(def ->> 'categoria', '') in ('pocao', 'pergaminho') then
    if p_cura is distinct from 0 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
  else
  case item ->> 'itemId'
    when 'potion-of-healing-common' then if p_cura is null or p_cura not between 4 and 10 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    when 'potion-of-healing-greater' then if p_cura is null or p_cura not between 8 and 20 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    when 'potion-of-healing-superior' then if p_cura is null or p_cura not between 16 and 40 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    when 'potion-of-healing-supreme' then if p_cura is null or p_cura not between 30 and 60 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    else
      if (item ->> 'itemId') is null or (item ->> 'itemId') not in ('acid-vial', 'alchemists-fire-flask', 'antitoxin-vial', 'block-of-incense', 'candle', 'chalk-1-piece', 'holy-water-flask', 'oil-flask', 'oil-of-etherealness', 'oil-of-sharpness', 'oil-of-slipperiness', 'paper-one-sheet', 'parchment-one-sheet', 'perfume-vial', 'philter-of-love', 'poison-basic-vial', 'potion-of-animal-friendship', 'potion-of-clairvoyance', 'potion-of-climbing', 'potion-of-diminution', 'potion-of-flying', 'potion-of-gaseous-form', 'potion-of-giant-strength-cloud', 'potion-of-giant-strength-fire', 'potion-of-giant-strength-frost', 'potion-of-giant-strength-hill', 'potion-of-giant-strength-stone', 'potion-of-giant-strength-storm', 'potion-of-growth', 'potion-of-heroism', 'potion-of-invisibility', 'potion-of-mind-reading', 'potion-of-poison', 'potion-of-resistance-acid', 'potion-of-resistance-cold', 'potion-of-resistance-fire', 'potion-of-resistance-force', 'potion-of-resistance-lightning', 'potion-of-resistance-necrotic', 'potion-of-resistance-poison', 'potion-of-resistance-psychic', 'potion-of-resistance-radiant', 'potion-of-resistance-thunder', 'potion-of-speed', 'potion-of-water-breathing', 'rations-1-day', 'sealing-wax', 'soap', 'spell-scroll-1st', 'spell-scroll-2nd', 'spell-scroll-3rd', 'spell-scroll-4th', 'spell-scroll-5th', 'spell-scroll-6th', 'spell-scroll-7th', 'spell-scroll-8th', 'spell-scroll-9th', 'spell-scroll-cantrip', 'torch') or p_cura is distinct from 0 then
        raise exception 'operacao_invalida' using errcode = '23514';
      end if;
  end case;
  end if;
  qtd := (item ->> 'quantity')::integer;
  p_maximo := least(p_maximo, private_ficha.teto_pv(s.draft));
  d := private_ficha.trocar_item(d, p_instancia, case when qtd > 1 then item || jsonb_build_object('quantity', qtd - 1) end);
  pv := private_ficha.inteiro(d -> 'currentHp', 0, 0, 1000000); novo_pv := pv;
  if coalesce(p_cura, 0) > 0 and pv < p_maximo then novo_pv := least(p_maximo, pv + p_cura); end if;
  d := d || jsonb_build_object('currentHp', novo_pv);
  d := private_ficha.com_movimento(d, case when novo_pv > pv then 'Usou {item}: +' || (novo_pv - pv) || ' PV' else 'Usou {item}' end, item ->> 'itemId');
  if pv = 0 and novo_pv > 0 then d := jsonb_set(d, '{play,morte}', '{"sucessos":0,"falhas":0}'::jsonb); end if;
  s := private_ficha.gravar(p_character_id, d, p_operacao, 'consumo');
  return private_ficha.resultado_item(s);
end $$;

create or replace function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 19 $$;
commit;
