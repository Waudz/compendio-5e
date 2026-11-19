-- 0002_backfill_perfis.sql
-- Contas criadas ANTES da migração 0001 não têm perfil (o gatilho só vale para contas novas), e
-- campaign_members referencia profiles(id): sem perfil, criar/entrar em campanha falharia para elas.
-- Idempotente: pode rodar mais de uma vez.
insert into public.profiles (id, display_name)
select u.id, left(coalesce(split_part(u.email, '@', 1), ''), 60)
from auth.users u
on conflict (id) do nothing;
