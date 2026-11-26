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

drop function if exists private_ficha.preservar_vitais();
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
