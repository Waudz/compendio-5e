-- Reverte a 0013. Perde a escolha de moedas por campanha e o nível publicado; retratos enviados deixam de aparecer na apresentação
-- (o arquivo e o valor na ficha permanecem). Fichas, itens, personagens e campanhas não são apagados. A visibilidade das notas
-- permanece como está. Depois da reversão o aplicativo novo não consegue gravar a apresentação: volte também o aplicativo.
drop trigger if exists character_sheets_apresentacao on public.character_sheets;
drop trigger if exists character_sheets_entregas on public.character_sheets;

-- remove o que a validação antiga recusaria, ANTES de restaurá-la
alter table public.notes disable trigger notes_zz_ficha_guard;
update public.notes set meta = (meta #- '{identidadePublica,card,level}') #- '{identidadePublica,settings,level}'
 where kind = 'character' and meta ? 'identidadePublica';
update public.notes set meta = jsonb_set(meta, '{identidadePublica,card,imageUrl}', 'null'::jsonb)
 where kind = 'character' and meta #>> '{identidadePublica,card,imageUrl}' like 'storage:%';
alter table public.notes enable trigger notes_zz_ficha_guard;

create or replace function private.identidade_meta_valida(m jsonb) returns boolean
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

create or replace function private.notes_ficha_guard() returns trigger
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

drop schema private_ficha cascade;
alter table public.campaigns drop constraint if exists campaigns_enabled_coins_check;
alter table public.campaigns drop column if exists enabled_coins;
