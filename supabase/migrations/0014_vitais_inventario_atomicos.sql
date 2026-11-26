-- 0014 — PROPOSTA, NÃO APLICADA ao Supabase hospedado. Só o responsável autoriza aplicar. Depende da 0007, 0008 e 0013.
-- (A) Estado vital com UMA fonte de verdade: PV atuais, PV temporários, condições e salvaguardas contra a morte continuam SÓ na ficha
--     (`character_sheets.draft`) e passam a mudar apenas por OPERAÇÕES no servidor (dano, cura...), aplicadas com a linha travada. A gravação
--     da ficha inteira (dono ou mestre) PRESERVA esses campos: uma cópia antiga nunca sobrescreve o combate, e uma operação vital não
--     avança a revisão (não gera conflito para quem está editando a ficha). `vitals_version` ordena as leituras entre aparelhos.
-- (B) Consumo e transferência de itens atômicos, idempotentes e autorizados no banco.
-- (C) Realtime da ficha (a RLS vale: só dono e mestre recebem).
-- EFEITO sobre dados existentes: nenhum valor muda; só duas colunas novas com valor padrão. A `character_combat_status` (0011) deixa de ser
-- usada pelo aplicativo e permanece intacta. Reversão em supabase/rollback/0014_vitais_inventario_atomicos_down.sql.

alter table public.character_sheets add column vitals_version bigint not null default 1;
alter table public.character_sheets add column operacoes text[] not null default '{}';

-- Marca, por transação, qual função do servidor está gravando. Sem privilégio para a API: o cliente não consegue forjar.
create table private_ficha.operacao (txid bigint not null, character_id uuid not null, tipo text not null check (tipo in ('vitais', 'consumo', 'transferencia')), primary key (txid, character_id));
revoke all on private_ficha.operacao from public, anon, authenticated;

create function private_ficha.tipo_operacao(p_id uuid) returns text language sql stable set search_path = '' as $$
  select o.tipo from private_ficha.operacao o where o.txid = txid_current() and o.character_id = p_id
$$;
revoke all on function private_ficha.tipo_operacao(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ A. estado vital
-- Copia os campos vitais de `de` para `para` (ausente em `de` = ausente em `para`).
create function private_ficha.com_vitais(para jsonb, de jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb := para; chave text; jogo jsonb;
begin
  foreach chave in array array['currentHp', 'temporaryHp'] loop
    if de ? chave then r := jsonb_set(r, array[chave], de -> chave); else r := r - chave; end if;
  end loop;
  jogo := case when jsonb_typeof(r -> 'play') = 'object' then r -> 'play' else '{}'::jsonb end;
  foreach chave in array array['condicoes', 'morte'] loop
    if (de -> 'play') ? chave then jogo := jsonb_set(jogo, array[chave], de -> 'play' -> chave); else jogo := jogo - chave; end if;
  end loop;
  if jogo = '{}'::jsonb and not (para ? 'play') then return r - 'play'; end if;
  return jsonb_set(r, '{play}', jogo);
end $$;
revoke all on function private_ficha.com_vitais(jsonb, jsonb) from public, anon, authenticated;

-- O banco não conhece as regras de PV máximo (classe, Constituição, talentos...): o aplicativo informa o máximo, e o servidor o limita a um
-- teto que nenhum personagem 2014 legítimo ultrapassa (d12 + 10 de Constituição 30 + bônus por nível < 30). Impede valores absurdos; não
-- prova o máximo exato. Quem pode editar a própria ficha já controla a construção (atributos, classe, nível).
create function private_ficha.teto_pv(d jsonb) returns integer language sql immutable set search_path = '' as $$
  select 30 * case when jsonb_typeof(d -> 'level') = 'number' then least(20, greatest(1, trunc((d ->> 'level')::numeric)))::integer else 1 end
$$;
revoke all on function private_ficha.teto_pv(jsonb) from public, anon, authenticated;

-- Compara o estado vital pelo SIGNIFICADO (chave ausente = valor vazio): acrescentar `condicoes: []` não é mudança.
create function private_ficha.resumo_vital(d jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('pv', coalesce(d -> 'currentHp', '0'), 'temp', coalesce(d -> 'temporaryHp', '0'),
    'condicoes', case when jsonb_typeof(d #> '{play,condicoes}') = 'array' then d #> '{play,condicoes}' else '[]'::jsonb end,
    'sucessos', coalesce(d #> '{play,morte,sucessos}', '0'), 'falhas', coalesce(d #> '{play,morte,falhas}', '0'))
$$;
revoke all on function private_ficha.resumo_vital(jsonb) from public, anon, authenticated;

-- Roda depois de `character_sheets_entregas` e `character_sheets_guard` (ordem alfabética dos gatilhos BEFORE).
-- `_protocolo` é só um sinal de transporte do aplicativo que conhece esta migração; nunca fica gravado.
create function private_ficha.preservar_vitais() returns trigger
language plpgsql security definer set search_path = '' as $$
declare op text; atual boolean := coalesce(new.draft -> '_protocolo' = '2'::jsonb, false);
begin
  new.draft := new.draft - '_protocolo';
  if tg_op = 'INSERT' then
    if jsonb_typeof(new.draft -> 'currentHp') = 'number' and (new.draft ->> 'currentHp')::numeric > private_ficha.teto_pv(new.draft) then
      new.draft := jsonb_set(new.draft, '{currentHp}', to_jsonb(private_ficha.teto_pv(new.draft)));
    end if;
    return new;
  end if;
  op := private_ficha.tipo_operacao(new.character_id);
  if op is null then
    -- Aplicativo anterior à 0014 tentando mudar PV, temporários, condições ou morte ao salvar a ficha (ex.: fim de combate numa aba
    -- antiga): recusa com erro visível, para a mudança não sumir em silêncio.
    if not atual and private_ficha.resumo_vital(new.draft) is distinct from private_ficha.resumo_vital(old.draft) then
      raise exception 'aplicativo_desatualizado' using errcode = '55000';
    end if;
    new.draft := private_ficha.com_vitais(new.draft, old.draft);   -- gravação comum: o estado vital é o do servidor
    new.vitals_version := old.vitals_version; new.operacoes := old.operacoes;
  else
    new.vitals_version := old.vitals_version + 1;
    if op = 'vitais' then new.revision := old.revision; end if;    -- não conflita com quem edita o restante da ficha
  end if;
  return new;
end $$;
revoke all on function private_ficha.preservar_vitais() from public, anon, authenticated;
create trigger character_sheets_vitais before insert or update on public.character_sheets
  for each row execute function private_ficha.preservar_vitais();

-- Mudança só vital não refaz a apresentação pública (que não mostra PV nem condições).
create or replace function private_ficha.atualizar_apresentacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private_ficha.tipo_operacao(new.character_id) = 'vitais' then return null; end if;
  update public.notes n set meta = n.meta where n.id = new.character_id and n.campaign_id = new.campaign_id and n.kind = 'character';
  return null;
end $$;

create function private_ficha.inteiro(v jsonb, padrao integer, minimo integer, maximo integer) returns integer language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number' then least(maximo, greatest(minimo, trunc((v #>> '{}')::numeric)))::integer else padrao end
$$;
-- O que o cliente precisa para mostrar o estado vital (a ficha em si continua protegida pela RLS).
create function private_ficha.estado_vital(s public.character_sheets) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', s.character_id, 'revision', s.revision, 'versao', s.vitals_version,
    'pv', private_ficha.inteiro(s.draft -> 'currentHp', 0, 0, 1000000), 'temp', private_ficha.inteiro(s.draft -> 'temporaryHp', 0, 0, 999),
    'condicoes', private_ficha.lista(s.draft #> '{play,condicoes}'),
    'morte', jsonb_build_object('sucessos', private_ficha.inteiro(s.draft #> '{play,morte,sucessos}', 0, 0, 3), 'falhas', private_ficha.inteiro(s.draft #> '{play,morte,falhas}', 0, 0, 3)))
$$;
revoke all on function private_ficha.inteiro(jsonb, integer, integer, integer), private_ficha.estado_vital(public.character_sheets) from public, anon, authenticated;

-- Trava a ficha e confere quem pode agir: o dono enquanto participa da campanha, ou o mestre. Erro idêntico para inexistente e sem acesso.
create function private_ficha.travar(p_id uuid) returns public.character_sheets
language plpgsql security definer set search_path = '' as $$
declare s public.character_sheets;
begin
  if (select auth.uid()) is null then raise exception 'nao_autenticado' using errcode = '42501'; end if;
  select * into s from public.character_sheets c where c.character_id = p_id for update;
  if not found or not (public.is_master(s.campaign_id) or (s.owner_id = (select auth.uid()) and public.is_member(s.campaign_id))) then
    raise exception 'ficha_nao_encontrada' using errcode = 'P0002';
  end if;
  return s;
end $$;
revoke all on function private_ficha.travar(uuid) from public, anon, authenticated;

create function private_ficha.gravar(p_id uuid, p_draft jsonb, p_operacao uuid, p_tipo text) returns public.character_sheets
language plpgsql security definer set search_path = '' as $$
declare s public.character_sheets;
begin
  insert into private_ficha.operacao (txid, character_id, tipo) values (txid_current(), p_id, p_tipo);
  update public.character_sheets c set draft = p_draft,
         operacoes = (array_prepend(p_operacao::text, c.operacoes))[1:40]
   where c.character_id = p_id returning * into s;
  delete from private_ficha.operacao o where o.txid = txid_current() and o.character_id = p_id;
  return s;
end $$;
revoke all on function private_ficha.gravar(uuid, jsonb, uuid, text) from public, anon, authenticated;

-- Aplica UMA operação ao estado vital. `p_operacao` torna a repetição (rede instável) inofensiva.
-- Ações: {"tipo":"dano"|"cura"|"temporarios"|"definir"|"ajustar","valor":n,"maximo":m} · {"tipo":"condicao","nome":t,"ativa":b}
--        · {"tipo":"morte","sucessos":n,"falhas":n} · {"tipo":"descanso","maximo":m}
create function public.alterar_vitais(p_character_id uuid, p_acao jsonb, p_operacao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.character_sheets; d jsonb; jogo jsonb; tipo text := p_acao ->> 'tipo';
  pv integer; temp integer; sucessos integer; falhas integer; antes integer; v integer; maximo integer; usado integer; nome text; cond jsonb;
begin
  if p_operacao is null or p_acao is null or jsonb_typeof(p_acao) <> 'object' then raise exception 'operacao_invalida' using errcode = '23514'; end if;
  s := private_ficha.travar(p_character_id);
  if p_operacao::text = any (s.operacoes) then return private_ficha.estado_vital(s); end if;
  d := s.draft;
  jogo := case when jsonb_typeof(d -> 'play') = 'object' then d -> 'play' else '{}'::jsonb end;
  pv := private_ficha.inteiro(d -> 'currentHp', 0, 0, 1000000); temp := private_ficha.inteiro(d -> 'temporaryHp', 0, 0, 999); antes := pv;
  sucessos := private_ficha.inteiro(jogo #> '{morte,sucessos}', 0, 0, 3); falhas := private_ficha.inteiro(jogo #> '{morte,falhas}', 0, 0, 3);
  cond := private_ficha.lista(jogo -> 'condicoes');

  if tipo in ('dano', 'cura', 'temporarios', 'definir', 'ajustar') then
    if jsonb_typeof(p_acao -> 'valor') is distinct from 'number' then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    v := private_ficha.inteiro(p_acao -> 'valor', 0, -1000000, 1000000);
    if tipo <> 'ajustar' and v < 0 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
  end if;
  if tipo in ('cura', 'definir', 'ajustar', 'descanso') then
    if jsonb_typeof(p_acao -> 'maximo') is distinct from 'number' then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    maximo := least(private_ficha.inteiro(p_acao -> 'maximo', 1, 1, 1000000), private_ficha.teto_pv(s.draft));
  end if;

  if tipo = 'dano' then
    usado := least(temp, v); temp := temp - usado; pv := greatest(0, pv - (v - usado));
  elsif tipo = 'cura' then
    if v > 0 and pv < maximo then pv := least(maximo, pv + v); end if;
  elsif tipo = 'temporarios' then
    if v > 999 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    temp := v;
  elsif tipo = 'definir' then
    pv := least(maximo, v);
  elsif tipo = 'ajustar' then
    pv := least(maximo, greatest(0, pv + v));
  elsif tipo = 'descanso' then
    pv := maximo; temp := 0; sucessos := 0; falhas := 0;
  elsif tipo = 'morte' then
    sucessos := private_ficha.inteiro(p_acao -> 'sucessos', sucessos, 0, 3); falhas := private_ficha.inteiro(p_acao -> 'falhas', falhas, 0, 3);
  elsif tipo = 'condicao' then
    nome := btrim(coalesce(p_acao ->> 'nome', ''));
    if char_length(nome) not between 1 and 40 or jsonb_typeof(p_acao -> 'ativa') is distinct from 'boolean' then raise exception 'operacao_invalida' using errcode = '23514'; end if;
    select coalesce(jsonb_agg(e order by n), '[]'::jsonb) into cond from jsonb_array_elements(cond) with ordinality t(e, n) where e #>> '{}' <> nome;
    if (p_acao -> 'ativa') = 'true'::jsonb then
      if jsonb_array_length(cond) >= 16 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
      cond := cond || to_jsonb(nome);
    end if;
  else
    raise exception 'operacao_invalida' using errcode = '23514';
  end if;
  if antes = 0 and pv > 0 then sucessos := 0; falhas := 0; end if;   -- voltar de 0 PV zera as salvaguardas contra a morte

  jogo := jogo || jsonb_build_object('condicoes', cond, 'morte', jsonb_build_object('sucessos', sucessos, 'falhas', falhas));
  d := d || jsonb_build_object('currentHp', pv, 'temporaryHp', temp, 'play', jogo);
  s := private_ficha.gravar(p_character_id, d, p_operacao, 'vitais');
  return private_ficha.estado_vital(s);
end $$;

-- ------------------------------------------------------------------ B. inventário atômico
-- Prepara um registro no histórico da ficha (mais recente primeiro, no máximo 40). O texto é montado AQUI; `{item}` é trocado pelo nome na tela.
create function private_ficha.com_movimento(d jsonb, texto text, item text) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_set(case when jsonb_typeof(d -> 'play') = 'object' then d else jsonb_set(d, '{play}', '{}'::jsonb) end, '{play,historico}',
    (select coalesce(jsonb_agg(e order by n), '[]'::jsonb) from (
       select e, n from jsonb_array_elements(
         jsonb_build_array(jsonb_build_object('em', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'texto', left(texto, 160), 'itemId', item))
         || private_ficha.lista(d #> '{play,historico}')) with ordinality t(e, n) order by n limit 40) x))
$$;
create function private_ficha.item_de(d jsonb, instancia text) returns jsonb language sql immutable set search_path = '' as $$
  select e from jsonb_array_elements(private_ficha.lista(d -> 'inventory')) e where e ->> 'id' = instancia limit 1
$$;
-- Inventário com a instância trocada por `novo` (null = removida).
create function private_ficha.trocar_item(d jsonb, instancia text, novo jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_set(d, '{inventory}', coalesce((select jsonb_agg(case when e ->> 'id' = instancia then novo else e end order by n)
    from jsonb_array_elements(private_ficha.lista(d -> 'inventory')) with ordinality t(e, n) where not (e ->> 'id' = instancia and novo is null)), '[]'::jsonb))
$$;
create function private_ficha.resultado_item(s public.character_sheets) returns jsonb language sql stable set search_path = '' as $$
  select private_ficha.estado_vital(s) || jsonb_build_object('draft', s.draft, 'updatedAt', s.updated_at)
$$;
revoke all on function private_ficha.com_movimento(jsonb, text, text), private_ficha.item_de(jsonb, text), private_ficha.trocar_item(jsonb, text, jsonb), private_ficha.resultado_item(public.character_sheets) from public, anon, authenticated;

-- Usa uma unidade: baixa a quantidade, aplica a cura informada (até o máximo) e registra, tudo ou nada. Repetir a mesma operação não consome de novo.
create function public.usar_consumivel(p_character_id uuid, p_instancia text, p_cura integer, p_maximo integer, p_operacao uuid) returns jsonb
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

-- A guarda da 0013 continua valendo para toda gravação; só a transferência feita pela função abaixo (que confere tudo) pode entregar um item
-- restrito a quem não o tinha.
create or replace function private_ficha.guarda_entregas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare anterior jsonb := case when tg_op = 'UPDATE' then old.draft else '{}'::jsonb end;
begin
  if not private_ficha.formato_valido(new.draft) then raise exception 'ficha_invalida' using errcode = '23514'; end if;
  if public.is_master(new.campaign_id) or private_ficha.tipo_operacao(new.character_id) = 'transferencia' then return new; end if;
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

-- Move `p_quantidade` unidades de uma instância para outro personagem guiado da MESMA campanha. A instância viaja com todos os seus dados
-- (nome próprio, identificação etc.), chega desequipada e, quando vai inteira, leva as concessões presas a ela. O resultado devolve SÓ a ficha de origem.
create function public.transferir_item(p_origem uuid, p_destino uuid, p_instancia text, p_quantidade integer, p_operacao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.character_sheets; t public.character_sheets; de jsonb; para jsonb; item jsonb; qtd integer; novo_id text; viaja jsonb := '[]'::jsonb; nome_origem text; nome_destino text;
begin
  if p_operacao is null or p_instancia is null or p_destino is null or p_origem = p_destino or p_quantidade is null or p_quantidade < 1 then raise exception 'operacao_invalida' using errcode = '23514'; end if;
  -- trava sempre na mesma ordem (evita impasse entre duas transferências cruzadas)
  perform 1 from public.character_sheets c where c.character_id in (p_origem, p_destino) order by c.character_id for update;
  o := private_ficha.travar(p_origem);
  if p_operacao::text = any (o.operacoes) then return private_ficha.resultado_item(o); end if;
  select * into t from public.character_sheets c where c.character_id = p_destino and c.campaign_id = o.campaign_id;
  if not found then raise exception 'destino_invalido' using errcode = 'P0002'; end if;
  de := o.draft; para := t.draft; item := private_ficha.item_de(de, p_instancia);
  if item is null then raise exception 'item_inexistente' using errcode = 'P0002'; end if;
  qtd := (item ->> 'quantity')::integer;
  if p_quantidade > qtd then raise exception 'quantidade_invalida' using errcode = '23514'; end if;
  novo_id := p_instancia;
  if p_quantidade < qtd or private_ficha.item_de(para, p_instancia) is not null then novo_id := gen_random_uuid()::text; end if;

  if p_quantidade = qtd then
    select coalesce(jsonb_agg(c || jsonb_build_object('itemInstancia', novo_id)), '[]'::jsonb) into viaja
      from jsonb_array_elements(private_ficha.lista(de #> '{play,concedidos}')) c where c ->> 'itemInstancia' = p_instancia;
    de := private_ficha.trocar_item(de, p_instancia, null);
    if jsonb_array_length(viaja) > 0 then
      de := jsonb_set(de, '{play,concedidos}', coalesce((select jsonb_agg(c) from jsonb_array_elements(private_ficha.lista(de #> '{play,concedidos}')) c where c ->> 'itemInstancia' is distinct from p_instancia), '[]'::jsonb));
    end if;
  else
    de := private_ficha.trocar_item(de, p_instancia, item || jsonb_build_object('quantity', qtd - p_quantidade));
  end if;
  item := item || jsonb_build_object('id', novo_id, 'quantity', p_quantidade, 'equipped', false, 'origin', 'acquired');
  para := jsonb_set(para, '{inventory}', private_ficha.lista(para -> 'inventory') || jsonb_build_array(item));
  nome_origem := left(coalesce(nullif(btrim(o.draft ->> 'name'), ''), 'outro personagem'), 60);
  -- o nome do destinatário mostrado ao remetente é o PÚBLICO (a ficha dele é privada)
  select left(coalesce(nullif(btrim(n.title), ''), 'outro personagem'), 60) into nome_destino from public.notes n where n.id = p_destino;
  de := private_ficha.com_movimento(de, 'Enviou ' || p_quantidade || '× {item} para ' || coalesce(nome_destino, 'outro personagem'), item ->> 'itemId');
  para := private_ficha.com_movimento(para, 'Recebeu ' || p_quantidade || '× {item} de ' || nome_origem, item ->> 'itemId');
  if jsonb_array_length(viaja) > 0 then
    if jsonb_array_length(private_ficha.lista(para #> '{play,concedidos}')) + jsonb_array_length(viaja) > 40 then raise exception 'destino_cheio' using errcode = '23514'; end if;
    para := jsonb_set(para, '{play,concedidos}', private_ficha.lista(para #> '{play,concedidos}') || viaja);
  end if;
  perform private_ficha.gravar(p_destino, para, p_operacao, 'transferencia');
  o := private_ficha.gravar(p_origem, de, p_operacao, 'transferencia');
  return private_ficha.resultado_item(o);
end $$;

revoke all on function public.alterar_vitais(uuid, jsonb, uuid), public.usar_consumivel(uuid, text, integer, integer, uuid), public.transferir_item(uuid, uuid, text, integer, uuid) from public, anon;
grant execute on function public.alterar_vitais(uuid, jsonb, uuid), public.usar_consumivel(uuid, text, integer, integer, uuid), public.transferir_item(uuid, uuid, text, integer, uuid) to authenticated;

-- ------------------------------------------------------------------ C. retrato com enquadramento não destrutivo
-- O retrato enviado passa a aceitar, no fim da referência, o enquadramento (`#enq=zoom,x,y`); a imagem original não é alterada.
create or replace function private_ficha.retrato(v text, campanha uuid) returns text language sql immutable set search_path = '' as $$
  select case
    when v ~ '^https://[^[:space:]]+$' and length(v) <= 2000 then v
    when v ~ ('^storage:' || campanha::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(#enq=[0-9]{1,3}([.][0-9]{1,4})?,[0-9]{1,3}([.][0-9]{1,4})?,[0-9]{1,3}([.][0-9]{1,4})?)?$') then v
  end
$$;
-- A validação da linha pública é a da 0013, mudando apenas a expressão do retrato.
create or replace function private.identidade_meta_valida(m jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  k text; f text; v jsonb; x jsonb; ident jsonb; card jsonb; st jsonb;
  campos constant text[] := array['imageUrl', 'title', 'name', 'surname', 'race', 'characterClass', 'description'];
  partes constant text[] := array['name', 'surname', 'race', 'characterClass'];
  retrato constant text := '^(https://[^[:space:]]+|storage:[0-9a-f-]{36}/[0-9a-f-]{36}(#enq=[0-9.,]{5,26})?)$';
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

-- ------------------------------------------------------------------ D. objetos de origem
-- Cartas, troféus e lembranças das origens (sem linha própria no catálogo) entram com o nome informado; o jogador pode tê-los.
insert into private_ficha.itens_livres (item_id) values ('background-trinket') on conflict do nothing;

-- ------------------------------------------------------------------ E. tempo real (só quando a publicação existir, como no Supabase)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'character_sheets') then
    alter publication supabase_realtime add table public.character_sheets;
  end if;
end $$;
