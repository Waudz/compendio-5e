-- Reverte 0007_character_sheets_foundation.sql (JÁ APLICADA no Supabase hospedado). Reverter a 0008 ANTES (supabase/rollback/0008_...).
-- ATENÇÃO — DESTRUTIVO: apaga a tabela public.character_sheets e TODAS as fichas privadas guardadas nela.
-- TRAVA: se houver linhas, só roda após backup e confirmação NA MESMA SESSÃO:
--     set compendio.confirmar_rollback_0007 = 'sim';
do $$
begin
  if current_setting('compendio.confirmar_rollback_0007', true) is distinct from 'sim'
     and exists (select 1 from public.character_sheets) then
    raise exception 'rollback_0007_destrutivo: faca backup e confirme com: set compendio.confirmar_rollback_0007 = ''sim'';' using errcode = '55000';
  end if;
end $$;
drop table if exists public.character_sheets;
