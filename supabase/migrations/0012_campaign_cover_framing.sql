-- 0012 — PROPOSTA, NÃO APLICADA ao Supabase hospedado. Só o responsável autoriza aplicar.
-- Enquadramento NÃO destrutivo da capa: a imagem original fica intacta e só o ponto de foco e o zoom são guardados.
--   campaigns.cover_framing = {"zoom": 1..3, "x": 0..100, "y": 0..100} ou null (centralizado, sem zoom).
-- Aditiva e retrocompatível: não altera nem apaga dados; capas existentes continuam como estão (null).
-- Quem lê a campanha lê o enquadramento (RLS de campaigns_select); só o mestre grava (RLS de campaigns_update).
-- Ao trocar ou remover a imagem, o aplicativo zera o enquadramento no MESMO update (sem gatilho, para não prender a coluna cover_path da 0006). Reversão em supabase/rollback/0012_campaign_cover_framing_down.sql.

alter table public.campaigns add column cover_framing jsonb;

-- CASE: o Postgres não garante a ordem do AND; os casts só rodam depois de o tipo ser conferido. coalesce: chave ausente reprova (não vira NULL).
alter table public.campaigns add constraint campaigns_cover_framing_check check (
  cover_framing is null or case
    when jsonb_typeof(cover_framing) <> 'object' then false
    when coalesce(jsonb_typeof(cover_framing -> 'zoom'), '') <> 'number' or coalesce(jsonb_typeof(cover_framing -> 'x'), '') <> 'number' or coalesce(jsonb_typeof(cover_framing -> 'y'), '') <> 'number' then false
    else cover_framing - array['zoom', 'x', 'y'] = '{}'::jsonb
      and (cover_framing ->> 'zoom')::numeric between 1 and 3
      and (cover_framing ->> 'x')::numeric between 0 and 100
      and (cover_framing ->> 'y')::numeric between 0 and 100
  end);

grant update (cover_framing) on public.campaigns to authenticated;   -- a RLS de campaigns_update já restringe ao mestre
