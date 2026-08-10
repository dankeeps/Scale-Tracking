-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 · Rate limiting (endpoints públicos) em Postgres
--
-- Contador de janela fixa por (bucket, identificador). A tabela vive em `private`
-- (não exposta pela API). Os endpoints (service_role) chamam consume_rate_limit,
-- que devolve TRUE se ainda dentro do limite.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists private.rate_limits (
  bucket       text        not null,   -- ex.: 'identify', 'event', 'webhook'
  identifier   text        not null,   -- ex.: IP do cliente
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, identifier, window_start)
);

-- Consome 1 unidade da janela atual e diz se está permitido.
create or replace function public.consume_rate_limit(
  p_bucket         text,
  p_identifier     text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  -- Início da janela fixa (alinhado a múltiplos de p_window_seconds).
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into private.rate_limits as rl (bucket, identifier, window_start, count)
    values (p_bucket, p_identifier, v_window_start, 1)
  on conflict (bucket, identifier, window_start)
    do update set count = rl.count + 1
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

comment on function public.consume_rate_limit(text, text, integer, integer) is
  'Contador de rate limit (janela fixa). Só service_role executa.';

revoke all on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;
