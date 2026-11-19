-- 0003_mestre_unico.sql
-- Regra: cada campanha tem EXATAMENTE um mestre, e é o criador (campaigns.created_by).
--  * Os demais participantes são sempre jogadores; ninguém é promovido nem rebaixado.
--  * O mestre não sai da campanha (pode excluí-la); jogadores podem sair; o mestre remove jogadores.
--  * Aplicado no banco (restrição única + gatilho), não só na interface.
-- Segura para rodar mais de uma vez. Depende da 0001 (tabelas, função set_member_role, política members_delete).

-- 1) Normaliza dados que já existam (antes de criar as restrições):
--    o criador volta a ser o mestre (inclusive se havia saído) e qualquer outro mestre vira jogador.
insert into public.campaign_members (campaign_id, user_id, role)
select c.id, c.created_by, 'mestre'
from public.campaigns c
where not exists (select 1 from public.campaign_members m where m.campaign_id = c.id and m.user_id = c.created_by)
  and exists (select 1 from public.profiles p where p.id = c.created_by);

update public.campaign_members m set role = 'mestre'
from public.campaigns c where c.id = m.campaign_id and m.user_id = c.created_by and m.role <> 'mestre';

update public.campaign_members m set role = 'jogador'
from public.campaigns c where c.id = m.campaign_id and m.user_id <> c.created_by and m.role <> 'jogador';

-- 2) A promoção/rebaixamento deixa de existir na API.
drop function if exists public.set_member_role(uuid, uuid, text);

-- 3) No máximo um mestre por campanha, garantido por índice único parcial.
create unique index if not exists campaign_members_single_master on public.campaign_members (campaign_id) where role = 'mestre';

-- 4) Papel sempre coerente com o criador: criador = mestre, qualquer outro = jogador.
create or replace function public.guard_single_master() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select c.created_by into owner_id from public.campaigns c where c.id = new.campaign_id;
  if owner_id is null then raise exception 'campanha_inexistente' using errcode = '23503'; end if;
  if (new.user_id = owner_id and new.role <> 'mestre')
     or (new.user_id <> owner_id and new.role <> 'jogador') then
    raise exception 'mestre_unico' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.guard_single_master() from public, anon, authenticated;
drop trigger if exists campaign_members_single_master on public.campaign_members;
create trigger campaign_members_single_master
  before insert or update on public.campaign_members
  for each row execute function public.guard_single_master();

-- 5) O mestre (criador) não sai nem é removido da lista; a campanha inteira pode ser excluída
--    (a cascata da FK não passa por esta política). Mestre remove jogadores; jogador sai sozinho.
drop policy if exists members_delete on public.campaign_members;
create policy members_delete on public.campaign_members for delete to authenticated
  using (
    (public.is_master(campaign_id) or user_id = auth.uid())
    and not exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = user_id)
  );
