-- 0013 — PROPOSTA, NÃO APLICADA ao Supabase hospedado. Só o responsável autoriza aplicar.
-- Ficha de personagem: (A) moedas por campanha; (B) restrição de itens e concessões também na API; (C) apresentação pública
-- AUTOMÁTICA, derivada pelo servidor da ficha e das escolhas do dono (inclusive nível), mesmo quando é o mestre quem salva,
-- e retrato único aceitando arquivo do bucket `campaign-assets` (0006). Depende da 0001, 0006 e 0008.
-- EFEITO sobre dados existentes: nada é apagado. As cinco moedas ficam ativas em todas as campanhas. Um personagem guiado passa
-- a aparecer para a campanha (com os campos que o dono não ocultou) na PRÓXIMA gravação da ficha ou da apresentação.
-- Reversão em supabase/rollback/0013_ficha_moedas_itens_identidade_down.sql.

-- ------------------------------------------------------------------ A. moedas por campanha
alter table public.campaigns add column enabled_coins text[] not null default array['cp','sp','ep','gp','pp'];
alter table public.campaigns add constraint campaigns_enabled_coins_check
  check (cardinality(enabled_coins) between 1 and 5 and enabled_coins <@ array['cp','sp','ep','gp','pp']::text[]);
grant update (enabled_coins) on public.campaigns to authenticated;   -- a RLS de campaigns_update já restringe ao mestre

-- ------------------------------------------------------------------ B. itens e concessões
create schema private_ficha;
revoke all on schema private_ficha from public, anon, authenticated;

-- O que o JOGADOR pode pôr (ou aumentar) no próprio inventário. Mesma política de src/catalogue/disponibilidade.ts:
-- itens mundanos e as poções comuns. O restante só entra pelo mestre.
create table private_ficha.itens_livres (item_id text primary key);
revoke all on private_ficha.itens_livres from public, anon, authenticated;
insert into private_ficha.itens_livres (item_id) values
  ('abacus'), ('acid-vial'), ('alchemists-fire-flask'), ('alchemists-supplies'), ('alms-box'),
  ('amulet'), ('animal-feed-1-day'), ('antitoxin-vial'), ('arrow'), ('background-incense'),
  ('background-prayer-book'), ('background-vestments'), ('backpack'), ('bagpipes'), ('ball-bearings-bag-of-1000'),
  ('barding-breastplate'), ('barding-chain-mail'), ('barding-chain-shirt'), ('barding-half-plate'), ('barding-hide'),
  ('barding-leather'), ('barding-padded'), ('barding-plate'), ('barding-ring-mail'), ('barding-scale-mail'),
  ('barding-splint'), ('barding-studded-leather'), ('barrel'), ('basket'), ('battleaxe'),
  ('bedroll'), ('bell'), ('bit-and-bridle'), ('blanket'), ('block-and-tackle'),
  ('block-of-incense'), ('blowgun'), ('blowgun-needle'), ('book'), ('bottle-glass'),
  ('breastplate'), ('brewers-supplies'), ('bucket'), ('burglars-pack'), ('calligraphers-supplies'),
  ('caltrops'), ('camel'), ('candle'), ('carpenters-tools'), ('carriage'),
  ('cart'), ('cartographers-tools'), ('case-crossbow-bolt'), ('case-map-or-scroll'), ('censer'),
  ('chain-10-feet'), ('chain-mail'), ('chain-shirt'), ('chalk-1-piece'), ('chariot'),
  ('chest'), ('climbers-kit'), ('clothes-common'), ('clothes-costume'), ('clothes-fine'),
  ('clothes-travelers'), ('club'), ('cobblers-tools'), ('component-pouch'), ('cooks-utensils'),
  ('crossbow-bolt'), ('crossbow-hand'), ('crossbow-heavy'), ('crossbow-light'), ('crowbar'),
  ('crystal'), ('dagger'), ('dart'), ('dice-set'), ('diplomats-pack'),
  ('disguise-kit'), ('donkey'), ('drum'), ('dulcimer'), ('dungeoneers-pack'),
  ('elephant'), ('emblem'), ('entertainers-pack'), ('explorers-pack'), ('fishing-tackle'),
  ('flail'), ('flask-or-tankard'), ('flute'), ('forgery-kit'), ('galley'),
  ('glaive'), ('glassblowers-tools'), ('grappling-hook'), ('greataxe'), ('greatclub'),
  ('greatsword'), ('halberd'), ('half-plate-armor'), ('hammer'), ('hammer-sledge'),
  ('handaxe'), ('healers-kit'), ('herbalism-kit'), ('hide-armor'), ('holy-water-flask'),
  ('horn'), ('horse-draft'), ('horse-riding'), ('hourglass'), ('hunting-trap'),
  ('ink-1-ounce-bottle'), ('ink-pen'), ('javelin'), ('jewelers-tools'), ('jug-or-pitcher'),
  ('keelboat'), ('ladder-10-foot'), ('lamp'), ('lance'), ('lantern-bullseye'),
  ('lantern-hooded'), ('leather-armor'), ('leatherworkers-tools'), ('light-hammer'), ('little-bag-of-sand'),
  ('lock'), ('longbow'), ('longship'), ('longsword'), ('lute'),
  ('lyre'), ('mace'), ('magnifying-glass'), ('manacles'), ('masons-tools'),
  ('mastiff'), ('maul'), ('mess-kit'), ('mirror-steel'), ('morningstar'),
  ('mule'), ('navigators-tools'), ('net'), ('oil-flask'), ('orb'),
  ('padded-armor'), ('painters-supplies'), ('pan-flute'), ('paper-one-sheet'), ('parchment-one-sheet'),
  ('perfume-vial'), ('pick-miners'), ('pike'), ('piton'), ('plate-armor'),
  ('playing-card-set'), ('poison-basic-vial'), ('poisoners-kit'), ('pole-10-foot'), ('pony'),
  ('pot-iron'), ('potion-of-climbing'), ('potion-of-healing-common'), ('potters-tools'), ('pouch'),
  ('priests-pack'), ('quarterstaff'), ('quiver'), ('ram-portable'), ('rapier'),
  ('rations-1-day'), ('reliquary'), ('ring-mail'), ('robes'), ('rod'),
  ('rope-hempen-50-feet'), ('rope-silk-50-feet'), ('rowboat'), ('sack'), ('saddle-exotic'),
  ('saddle-military'), ('saddle-pack'), ('saddle-riding'), ('saddlebags'), ('sailing-ship'),
  ('scale-mail'), ('scale-merchants'), ('scholars-pack'), ('scimitar'), ('sealing-wax'),
  ('shawm'), ('shield'), ('shortbow'), ('shortsword'), ('shovel'),
  ('sickle'), ('signal-whistle'), ('signet-ring'), ('sled'), ('sling'),
  ('sling-bullet'), ('small-knife'), ('smiths-tools'), ('soap'), ('spear'),
  ('spellbook'), ('spike-iron'), ('splint-armor'), ('sprig-of-mistletoe'), ('spyglass'),
  ('stabling-1-day'), ('staff'), ('string-10-feet'), ('studded-leather-armor'), ('tent-two-person'),
  ('thieves-tools'), ('tinderbox'), ('tinkers-tools'), ('torch'), ('totem'),
  ('trident'), ('vestments'), ('vial'), ('viol'), ('wagon'),
  ('wand'), ('war-pick'), ('warhammer'), ('warhorse'), ('warship'),
  ('waterskin'), ('weavers-tools'), ('whetstone'), ('whip'), ('woodcarvers-tools'),
  ('wooden-staff'), ('yew-wand');

create function private_ficha.lista(v jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end
$$;

-- Formato exigido de TODOS (inclusive do mestre): sem isto, somas podem ser enganadas (quantidades negativas que se anulam).
create function private_ficha.formato_valido(ficha jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare e jsonb; inv jsonb := ficha -> 'inventory'; con jsonb := ficha #> '{play,concedidos}'; ids text[] := '{}';
begin
  if inv is not null then
    if jsonb_typeof(inv) <> 'array' then return false; end if;
    for e in select jsonb_array_elements(inv) loop
      if jsonb_typeof(e) <> 'object' then return false; end if;
      if jsonb_typeof(e -> 'id') is distinct from 'string' or jsonb_typeof(e -> 'itemId') is distinct from 'string' or jsonb_typeof(e -> 'quantity') is distinct from 'number' then return false; end if;
      if length(e ->> 'id') = 0 or length(e ->> 'itemId') = 0 then return false; end if;
      if (e ->> 'quantity')::numeric <> trunc((e ->> 'quantity')::numeric) or (e ->> 'quantity')::numeric not between 1 and 1000000 then return false; end if;
      if (e ->> 'id') = any (ids) then return false; end if;
      ids := ids || (e ->> 'id');
    end loop;
  end if;
  if con is not null then
    if jsonb_typeof(con) <> 'array' then return false; end if;
    if exists (select 1 from jsonb_array_elements(con) c where jsonb_typeof(c) <> 'object') then return false; end if;
  end if;
  return true;
end $$;

-- SECURITY DEFINER: lê a lista (sem privilégio de API) e, na atualização, a versão anterior da própria linha. `is_master` continua
-- usando a sessão de quem chamou (auth.uid()).
create function private_ficha.guarda_entregas() returns trigger
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
revoke all on function private_ficha.guarda_entregas(), private_ficha.formato_valido(jsonb), private_ficha.lista(jsonb) from public, anon, authenticated;
create trigger character_sheets_entregas before insert or update of draft on public.character_sheets
  for each row execute function private_ficha.guarda_entregas();

-- ------------------------------------------------------------------ C. apresentação pública automática
-- Um campo: 'real' segue a ficha, 'custom' usa o texto do dono (vazio nunca revela o da ficha), 'hidden' não aparece.
create function private_ficha.campo(cfg jsonb, da_ficha text) returns text language sql immutable set search_path = '' as $$
  select case coalesce(cfg ->> 'mode', 'real')
           when 'real' then nullif(btrim(left(coalesce(da_ficha, ''), 120)), '')
           when 'custom' then nullif(btrim(left(coalesce(cfg ->> 'customValue', ''), 120)), '')
         end
$$;
-- Retrato: endereço https, ou arquivo enviado para a PRÓPRIA campanha.
create function private_ficha.retrato(v text, campanha uuid) returns text language sql immutable set search_path = '' as $$
  select case
    when v ~ '^https://[^[:space:]]+$' and length(v) <= 2000 then v
    when v ~ ('^storage:' || campanha::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then v
  end
$$;
-- A linha pública é lida pela campanha inteira. As escolhas são RECONSTRUÍDAS aqui: texto só em campo personalizado; nada de campo
-- oculto, de campo que segue a ficha, nem de título ou imagem digitados em formatos antigos.
create function private_ficha.escolha(cfg jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case coalesce(cfg ->> 'mode', 'real')
           when 'custom' then jsonb_build_object('mode', 'custom', 'customValue', left(coalesce(cfg ->> 'customValue', ''), 120))
           when 'hidden' then jsonb_build_object('mode', 'hidden')
           else jsonb_build_object('mode', 'real')
         end
$$;
create function private_ficha.projetar(meta jsonb, ficha jsonb, campanha uuid) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  real_ constant jsonb := '{"mode":"real"}'::jsonb;
  antigo jsonb := coalesce(meta #> '{identidadePublica,card}', '{}'::jsonb);
  st jsonb := coalesce(meta #> '{identidadePublica,settings}', jsonb_build_object('imageUrl', null, 'title', '', 'name', real_, 'surname', real_, 'race', real_, 'characterClass', real_, 'description', ''));
  raca text; classe text;
begin
  st := st || jsonb_build_object('level', coalesce(st -> 'level', real_));
  -- os nomes em português de raça e classe vêm da ficha (`publicLabels`); sem eles, mantém o que já estava publicado
  raca := private_ficha.campo(st -> 'race', coalesce(ficha #>> '{publicLabels,race}', antigo ->> 'race'));
  classe := private_ficha.campo(st -> 'characterClass', coalesce(ficha #>> '{publicLabels,characterClass}', antigo ->> 'characterClass'));
  return jsonb_build_object('settings', jsonb_build_object(
      'imageUrl', null, 'title', '', 'name', private_ficha.escolha(st -> 'name'), 'surname', private_ficha.escolha(st -> 'surname'),
      'race', private_ficha.escolha(st -> 'race'), 'characterClass', private_ficha.escolha(st -> 'characterClass'),
      'level', private_ficha.escolha(st -> 'level'), 'description', coalesce(st ->> 'description', '')),
    'card', jsonb_build_object(
    'imageUrl', private_ficha.retrato(ficha ->> 'portrait', campanha),
    'title', coalesce(private_ficha.campo(st -> 'surname', ficha ->> 'nickname'), ''),
    'name', private_ficha.campo(st -> 'name', ficha ->> 'name'),
    'surname', null, 'race', raca, 'characterClass', classe,
    'level', private_ficha.campo(st -> 'level', ficha ->> 'level'),
    'description', coalesce(st ->> 'description', '')));
end $$;
-- usadas apenas pelo gatilho SECURITY DEFINER: nenhum papel da API precisa chamá-las
revoke all on function private_ficha.campo(jsonb, text), private_ficha.retrato(text, uuid), private_ficha.escolha(jsonb), private_ficha.projetar(jsonb, jsonb, uuid) from public, anon, authenticated;

-- Validação da linha pública: igual à 0008, aceitando também `level` e o retrato enviado (`storage:<campanha>/<uuid>`).
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

-- Enquanto houver ficha, o cartão é SEMPRE calculado aqui (o que o cliente enviar no cartão é ignorado) e visível para a campanha.
create or replace function private.notes_ficha_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ficha jsonb;
begin
  select s.draft into ficha from public.character_sheets s where s.character_id = new.id;
  if found then
    if new.kind <> 'character' or new.campaign_id is distinct from old.campaign_id or new.owner_id is distinct from old.owner_id then
      raise exception 'personagem_guiado_imutavel' using errcode = '42501';
    end if;
    if new.deleted_at is not null then raise exception 'personagem_guiado_nao_exclui' using errcode = '42501'; end if;
    if not private.identidade_meta_valida(new.meta) then raise exception 'identidade_invalida' using errcode = '23514'; end if;
    new.meta := jsonb_build_object('guiado', true, 'identidadePublica', private_ficha.projetar(new.meta, ficha, new.campaign_id));
    new.title := private.titulo_publico(new.meta);
    new.visibility := 'campaign';
  end if;
  return new;
end $$;
revoke all on function private.notes_ficha_guard() from public, anon, authenticated;

-- Toda gravação da ficha (dono ou mestre) refaz a apresentação. SECURITY DEFINER só para "tocar" a nota do próprio personagem:
-- o mestre continua sem política de escrita em `notes`.
create function private_ficha.atualizar_apresentacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.notes n set meta = n.meta where n.id = new.character_id and n.campaign_id = new.campaign_id and n.kind = 'character';
  return null;
end $$;
revoke all on function private_ficha.atualizar_apresentacao() from public, anon, authenticated;
create trigger character_sheets_apresentacao after insert or update of draft on public.character_sheets
  for each row execute function private_ficha.atualizar_apresentacao();
