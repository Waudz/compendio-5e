-- SOMENTE LEITURA, para depois de aplicar a 0021 em produção. Não mostra conteúdo de ficha.
-- 1) O agendamento diário precisa existir e estar ativo (uma linha, active = true).
select jobname, schedule, active, command from cron.job where jobname = 'compendio-purgar-copias-de-ficha';
-- 2) Últimas execuções (vazio até a primeira madrugada).
select d.status, d.start_time, d.return_message from cron.job_run_details d join cron.job j using (jobid)
 where j.jobname = 'compendio-purgar-copias-de-ficha' order by d.start_time desc limit 5;
-- 3) Nenhuma cópia vencida há mais de um dia e nenhuma cópia de personagem excluído: as duas contagens devem ser zero.
select count(*) filter (where copia is not null and copia_expira_em < now() - interval '1 day') as copias_vencidas,
       count(*) filter (where copia is not null and exists (select 1 from private_ficha.ciclo c where c.character_id = e.character_id and c.state = 'excluido')) as copias_de_excluidos
  from private_ficha.ciclo_eventos e;
