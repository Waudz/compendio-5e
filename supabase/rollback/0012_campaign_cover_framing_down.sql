-- Reverte a 0012. Perde apenas o enquadramento salvo; imagens e demais dados das campanhas ficam intactos.
alter table public.campaigns drop constraint if exists campaigns_cover_framing_check;
alter table public.campaigns drop column if exists cover_framing;
