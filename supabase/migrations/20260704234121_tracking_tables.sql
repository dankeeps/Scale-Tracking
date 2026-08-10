-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 · Tabelas de tracking
--
-- visitors, events_log, purchases. Escritas SÓ pelo servidor (service_role);
-- o painel (authenticated) apenas LÊ via RLS. Índices por trck_user_id,
-- event_name e created_at para o dashboard.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── visitors ─────────────────────────────────────────────────────────────────
create table if not exists public.visitors (
  id               uuid primary key default gen_random_uuid(),
  trck_user_id     text not null unique,
  -- Dados pessoais (raw para matching/exibição) + hashes SHA-256 p/ Meta CAPI.
  email            text,
  phone            text,
  email_hash       text,
  phone_hash       text,
  first_name_hash  text,
  last_name_hash   text,
  city_hash        text,
  state_hash       text,
  country_hash     text,
  -- Identificadores de plataforma.
  fbp              text,
  fbc              text,
  ga_client_id     text,
  ga_session_id    text,
  -- Origem.
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_term         text,
  utm_content      text,
  referrer         text,
  -- Rede / dispositivo (derivados no servidor).
  ip               text,
  user_agent       text,
  geo_country      text,
  geo_region       text,
  geo_city         text,
  pixel_id         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists visitors_email_idx      on public.visitors (email);
create index if not exists visitors_phone_idx      on public.visitors (phone);
create index if not exists visitors_ga_client_idx  on public.visitors (ga_client_id);
create index if not exists visitors_created_at_idx on public.visitors (created_at desc);

-- ── events_log ───────────────────────────────────────────────────────────────
create table if not exists public.events_log (
  id            uuid primary key default gen_random_uuid(),
  trck_user_id  text,
  event_name    text not null,
  event_id      text not null unique,       -- dedup (mesmo id do Pixel)
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_term      text,
  utm_content   text,
  -- Auditoria por destino (zerados pela retenção após 14 dias).
  payload_meta  jsonb,
  response_meta jsonb,
  payload_ga4   jsonb,
  response_ga4  jsonb,
  ip            text,
  user_agent    text,
  geo_country   text,
  geo_region    text,
  geo_city      text,
  created_at    timestamptz not null default now()
);

create index if not exists events_log_trck_idx       on public.events_log (trck_user_id);
create index if not exists events_log_event_name_idx on public.events_log (event_name);
create index if not exists events_log_created_at_idx on public.events_log (created_at desc);
create index if not exists events_log_name_created_idx
  on public.events_log (event_name, created_at desc);

-- ── purchases ────────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,       -- idempotência
  trck_user_id   text,
  email          text,
  phone          text,
  email_hash     text,
  phone_hash     text,
  product_id     text,
  product_name   text,
  value          numeric(14, 2),
  currency       text,
  status         text,                        -- approved / refunded / ...
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_term       text,
  utm_content    text,
  fbp            text,
  fbc            text,
  ga_client_id   text,
  ga_session_id  text,
  geo_country    text,
  geo_region     text,
  geo_city       text,
  matched        boolean not null default false,
  match_reason   text,                        -- como casou (trck_user_id/email/telefone)
  meta_event_id  text,                        -- event_id do Purchase (derivado do transaction_id)
  payload_meta   jsonb,
  response_meta  jsonb,
  payload_ga4    jsonb,
  response_ga4   jsonb,
  raw_webhook    jsonb,                        -- webhook bruto (auditoria)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists purchases_trck_idx       on public.purchases (trck_user_id);
create index if not exists purchases_status_idx     on public.purchases (status);
create index if not exists purchases_created_at_idx on public.purchases (created_at desc);
create index if not exists purchases_email_idx      on public.purchases (email);

-- Triggers updated_at (visitors e purchases têm upsert que atualiza).
create trigger visitors_set_updated_at before update on public.visitors
  for each row execute function public.tg_set_updated_at();
create trigger purchases_set_updated_at before update on public.purchases
  for each row execute function public.tg_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.visitors   enable row level security;
alter table public.events_log enable row level security;
alter table public.purchases  enable row level security;

-- Painel lê tudo (dados de negócio, não segredos). Escrita só via service_role.
create policy "visitors: authenticated read" on public.visitors
  for select to authenticated using (true);
create policy "events_log: authenticated read" on public.events_log
  for select to authenticated using (true);
create policy "purchases: authenticated read" on public.purchases
  for select to authenticated using (true);

-- Defesa em profundidade: anon não acessa; service_role tem acesso total.
revoke all on public.visitors   from anon;
revoke all on public.events_log from anon;
revoke all on public.purchases  from anon;

grant select on public.visitors   to authenticated;
grant select on public.events_log to authenticated;
grant select on public.purchases  to authenticated;

grant all on public.visitors   to service_role;
grant all on public.events_log to service_role;
grant all on public.purchases  to service_role;
