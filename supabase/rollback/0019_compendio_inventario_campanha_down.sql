-- Somente com autorização e backup. As identidades ocultas são arquivadas em esquema privado antes da remoção. Itens ainda não
-- identificados continuam nos inventários como códigos sem definição: identifique-os antes de reverter ou restaure pelo arquivo.
begin;
create schema if not exists private_codex_archive;
revoke all on schema private_codex_archive from public,anon,authenticated;
create table if not exists private_codex_archive.mask_snapshots(created_at timestamptz default now(),data jsonb);
revoke all on private_codex_archive.mask_snapshots from public,anon,authenticated;
insert into private_codex_archive.mask_snapshots(data) select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from private_ficha.mascaras m;
drop trigger character_sheets_vistos on public.character_sheets;
drop function private_ficha.registrar_vistos();
drop function public.codex_identify_item(uuid,text);
drop function public.codex_grant_item(uuid,uuid,text,integer,jsonb,uuid);
drop function public.codex_definitions_for(uuid);
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
 and exists(select 1 from jsonb_array_elements(coalesce(f.draft->'inventory','[]'::jsonb)) i where i->>'itemId'=ref and case when jsonb_typeof(i->'quantity')='number' then (i->>'quantity')::numeric>0 else false end)), '[]'::jsonb);
end $$;
create or replace function public.usar_consumivel(p_character_id uuid, p_instancia text, p_cura integer, p_maximo integer, p_operacao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.character_sheets; d jsonb; item jsonb; qtd integer; pv integer; novo_pv integer;
begin
  if p_operacao is null or p_instancia is null or coalesce(p_cura, 0) < 0 or coalesce(p_cura, 0) > 1000000 or (coalesce(p_cura, 0) > 0 and (p_maximo is null or p_maximo < 1)) then
    raise exception 'operacao_invalida' using errcode = '23514';
  end if;
  s := private_ficha.travar(p_character_id);
  if p_operacao::text = any (s.operacoes) then return private_ficha.resultado_item(s); end if;
  d := s.draft; item := private_ficha.item_de(d, p_instancia);
  if item is null then raise exception 'item_inexistente' using errcode = 'P0002'; end if;
  -- Mesmas categorias e fórmulas do catálogo SRD 2014 e de podeUsar na interface.
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
drop table private_ficha.itens_vistos;
drop table private_ficha.mascaras;
create or replace function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 18 $$;
commit;
