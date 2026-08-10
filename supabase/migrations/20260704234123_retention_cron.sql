-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 · Retenção de logs (pg_cron)
--
-- Diariamente, em lotes, ZERA os campos pesados (payload/response de Meta e GA4)
-- dos events_log com mais de 14 dias — SEM apagar a linha (mantém data, evento,
-- UTMs e geo para o dashboard). Mantém `EVENTS_LOG_HEAVY_RETENTION_DAYS` (14) em
-- sincronia com src/lib/constants.ts.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function private.purge_events_log_heavy(
  p_days  integer default 14,
  p_batch integer default 5000
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_rows  integer;
begin
  loop
    with cte as (
      select id
      from public.events_log
      where created_at < now() - make_interval(days => p_days)
        and (payload_meta is not null or response_meta is not null
             or payload_ga4 is not null or response_ga4 is not null)
      limit p_batch
      for update skip locked
    )
    update public.events_log e
      set payload_meta  = null,
          response_meta = null,
          payload_ga4   = null,
          response_ga4  = null
      from cte
      where e.id = cte.id;

    get diagnostics v_rows = row_count;
    v_total := v_total + v_rows;
    exit when v_rows = 0;
  end loop;

  return v_total;
end;
$$;

comment on function private.purge_events_log_heavy(integer, integer) is
  'Zera campos pesados de events_log > N dias, em lotes. Mantém a linha.';

-- Limpeza das janelas antigas de rate limit.
create or replace function private.purge_rate_limits(p_keep_hours integer default 24)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from private.rate_limits
  where window_start < now() - make_interval(hours => p_keep_hours);
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ── Agendamento (idempotente) ────────────────────────────────────────────────
-- Reaplica sem duplicar: desagenda (se existir) e reagenda.
do $$
begin
  perform cron.unschedule('purge-events-log-heavy');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('purge-rate-limits');
exception when others then null;
end $$;

-- Todo dia às 04:00 (UTC): zera campos pesados antigos.
select cron.schedule(
  'purge-events-log-heavy',
  '0 4 * * *',
  $$ select private.purge_events_log_heavy(); $$
);

-- De hora em hora: limpa janelas de rate limit vencidas.
select cron.schedule(
  'purge-rate-limits',
  '30 * * * *',
  $$ select private.purge_rate_limits(); $$
);
