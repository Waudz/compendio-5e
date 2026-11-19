-- Uma campanha possui exatamente um mestre: o usuário que a criou.
-- A função antiga de promoção deixa de estar acessível pela API.
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon, authenticated;
drop function public.set_member_role(uuid, uuid, text);

-- Proteção adicional contra alterações de papel feitas por funções privilegiadas futuras.
create function public.guard_single_master() returns trigger
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
create trigger campaign_members_single_master
before insert or update on public.campaign_members
for each row execute function public.guard_single_master();

-- A exclusão direta do criador da lista de membros não é permitida.
-- Exclusões da campanha inteira continuam possíveis pela cascata da FK.
drop policy if exists members_delete on public.campaign_members;
create policy members_delete on public.campaign_members for delete to authenticated
using (
  (public.is_master(campaign_id) or user_id = auth.uid())
  and not exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and c.created_by = user_id
  )
);
