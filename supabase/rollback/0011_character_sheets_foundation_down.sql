-- Reverte 0011_character_sheets_foundation.sql (JÁ APLICADA no Supabase hospedado). Reverter a 0012 ANTES (supabase/rollback/0012_...).
-- ATENÇÃO — DESTRUTIVO: apaga a tabela public.character_sheets e TODAS as fichas privadas guardadas nela.
-- TRAVA: se houver linhas, só roda após backup e confirmação NA MESMA SESSÃO:
--     set compendio.confirmar_rollback_0011 = 'sim';
do $$
begin
  if current_setting('compendio.confirmar_rollback_0011', true) is distinct from 'sim'
     and exists (select 1 from public.character_sheets) then
    raise exception 'rollback_0011_destrutivo: faca backup e confirme com: set compendio.confirmar_rollback_0011 = ''sim'';' using errcode = '55000';
  end if;
end $$;
drop table if exists public.character_sheets;
