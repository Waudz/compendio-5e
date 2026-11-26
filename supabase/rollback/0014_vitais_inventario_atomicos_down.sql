-- Reverte a 0014. Fichas, itens, históricos e personagens NÃO são apagados: PV, condições e inventário continuam na ficha como estão.
-- Perde apenas o contador de versão vital e a lista de operações já aplicadas. Volte também o aplicativo: sem as funções, o novo
-- aplicativo não consegue alterar PV, usar nem transferir itens.
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'character_sheets') then
    alter publication supabase_realtime drop table public.character_sheets;
  end if;
end $$;

drop function if exists public.transferir_item(uuid, uuid, text, integer, uuid);
drop function if exists public.usar_consumivel(uuid, text, integer, integer, uuid);
drop function if exists public.alterar_vitais(uuid, jsonb, uuid);
drop trigger if exists character_sheets_vitais on public.character_sheets;
delete from private_ficha.itens_livres where item_id = 'background-trinket';

-- as duas funções da 0013 voltam ao texto original
create or replace function private_ficha.guarda_entregas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare anterior jsonb := case when tg_op = 'UPDATE' then old.draft else '{}'::jsonb end;
begin
  if not private_ficha.formato_valido(new.draft) then raise exception 'ficha_invalida' using errcode = '23514'; end if;
  if public.is_master(new.campaign_id) then return new; end if;
  -- Instâncias restritas conservam a identidade e os dados da entrega.
  -- O jogador pode equipar, consumir ou remover o item.
  if exists (
    select 1 from jsonb_array_elements(private_ficha.lista(new.draft -> 'inventory')) n
     where not exists (select 1 from private_ficha.itens_livres l where l.item_id = n ->> 'itemId')
       and not exists (
         select 1 from jsonb_array_elements(private_ficha.lista(anterior -> 'inventory')) a
          where (a - 'quantity' - 'equipped') = (n - 'quantity' - 'equipped')
            and case when jsonb_typeof(a -> 'quantity') = 'number'
                     then (n ->> 'quantity')::numeric <= (a ->> 'quantity')::numeric
                     else false end
       )
  ) then
    raise exception 'item_nao_autorizado' using errcode = '42501';
  end if;
  -- talentos, magias e habilidades concedidos: o jogador pode retirar, nunca criar, alterar nem repetir
  if exists (select 1 from (select c, count(*) as n from jsonb_array_elements(private_ficha.lista(new.draft #> '{play,concedidos}')) c group by c) novo
              where novo.n > (select count(*) from jsonb_array_elements(private_ficha.lista(anterior #> '{play,concedidos}')) o where o = novo.c)) then
    raise exception 'concessao_so_do_mestre' using errcode = '42501';
  end if;
  -- concessão presa a um item: o identificador daquela instância não pode passar para outro item, nem ser recriado pelo jogador
  if exists (
    select 1 from jsonb_array_elements(private_ficha.lista(new.draft #> '{play,concedidos}')) c
      join jsonb_array_elements(private_ficha.lista(new.draft -> 'inventory')) n on n ->> 'id' = c ->> 'itemInstancia'
     where not exists (select 1 from jsonb_array_elements(private_ficha.lista(anterior -> 'inventory')) a
                        where a ->> 'id' = n ->> 'id' and a ->> 'itemId' = n ->> 'itemId')) then
    raise exception 'concessao_so_do_mestre' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function private_ficha.atualizar_apresentacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.notes n set meta = n.meta where n.id = new.character_id and n.campaign_id = new.campaign_id and n.kind = 'character';
  return null;
end $$;

-- retratos com enquadramento voltam a ser só a referência (o arquivo original sempre esteve intacto)
alter table public.notes disable trigger notes_zz_ficha_guard;
update public.notes set meta = jsonb_set(meta, '{identidadePublica,card,imageUrl}', to_jsonb(regexp_replace(meta #>> '{identidadePublica,card,imageUrl}', '#enq=.*$', '')))
 where kind = 'character' and meta #>> '{identidadePublica,card,imageUrl}' like 'storage:%#enq=%';
alter table public.notes enable trigger notes_zz_ficha_guard;
create or replace function private_ficha.retrato(v text, campanha uuid) returns text language sql immutable set search_path = '' as $$
  select case
    when v ~ '^https://[^[:space:]]+$' and length(v) <= 2000 then v
    when v ~ ('^storage:' || campanha::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then v
  end
$$;

create or replace function private.identidade_meta_valida(m jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  k text; f text; v jsonb; x jsonb; ident jsonb; card jsonb; st jsonb;
  campos constant text[] := array['imageUrl', 'title', 'name', 'surname', 'race', 'characterClass', 'description'];
  partes constant text[] := array['name', 'surname', 'race', 'characterClass'];
  retrato constant text := '^(https://[^[:space:]]+|storage:[0-9a-f-]{36}/[0-9a-f-]{36})$';
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
  for k in select jsonb_object_keys(card) loop if k <> all (campos) and k <> 'level' then return false; end if; end loop;
  for k in select jsonb_object_keys(st) loop if k <> all (campos) and k <> 'level' then return false; end if; end loop;
  v := card -> 'level';
  if v is not null and (jsonb_typeof(v) not in ('string', 'null') or (jsonb_typeof(v) = 'string' and length(v #>> '{}') > 120)) then return false; end if;
  foreach f in array campos loop
    v := card -> f;
    if v is null or jsonb_typeof(v) not in ('string', 'null') then return false; end if;
    if jsonb_typeof(v) = 'string' and length(v #>> '{}') > (case f when 'description' then 4000 when 'imageUrl' then 2000 else 120 end) then return false; end if;
  end loop;
  foreach f in array campos || array['level'] loop
    v := st -> f;
    if v is null then if f = 'level' then continue; end if; return false; end if;
    if f = any (partes) or f = 'level' then
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
    if jsonb_typeof(x) = 'string' and ((x #>> '{}') !~ retrato or length(x #>> '{}') > 2000) then return false; end if;
  end loop;
  return true;
end $$;

drop function if exists private_ficha.preservar_vitais();
drop function if exists private_ficha.teto_pv(jsonb);
drop function if exists private_ficha.resumo_vital(jsonb);
drop function if exists private_ficha.gravar(uuid, jsonb, uuid, text);
drop function if exists private_ficha.travar(uuid);
drop function if exists private_ficha.resultado_item(public.character_sheets);
drop function if exists private_ficha.estado_vital(public.character_sheets);
drop function if exists private_ficha.com_movimento(jsonb, text, text);
drop function if exists private_ficha.item_de(jsonb, text);
drop function if exists private_ficha.trocar_item(jsonb, text, jsonb);
drop function if exists private_ficha.com_vitais(jsonb, jsonb);
drop function if exists private_ficha.inteiro(jsonb, integer, integer, integer);
drop function if exists private_ficha.tipo_operacao(uuid);
drop table if exists private_ficha.operacao;
alter table public.character_sheets drop column if exists vitals_version;
alter table public.character_sheets drop column if exists operacoes;
