-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 · Tabelas de configuração (credenciais geridas pelo painel)
--
-- settings (1 linha) + N contas: ga4_accounts, meta_pixels, meta_ad_accounts.
-- Segredos ficam em colunas *_enc (bytea, cifradas) + *_mask (texto p/ exibição).
-- RLS: authenticated LÊ só as colunas não-sensíveis (privilégio de coluna).
--      Escrita só via service_role (servidor). Ciphertext nunca sai pela API.
-- ═══════════════════════════════════════════════════════════════════════════

-- Trigger util para manter updated_at.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── settings (singleton) ─────────────────────────────────────────────────────
create table if not exists public.settings (
  id                 smallint primary key default 1 check (id = 1),
  webhook_token_enc  bytea,
  webhook_token_mask text,
  currency           text not null default 'BRL',
  test_event_code    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ── ga4_accounts ─────────────────────────────────────────────────────────────
create table if not exists public.ga4_accounts (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  measurement_id  text not null unique,
  api_secret_enc  bytea,
  api_secret_mask text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── meta_pixels ──────────────────────────────────────────────────────────────
create table if not exists public.meta_pixels (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  pixel_id        text not null unique,
  capi_token_enc  bytea,
  capi_token_mask text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── meta_ad_accounts ─────────────────────────────────────────────────────────
create table if not exists public.meta_ad_accounts (
  id             uuid primary key default gen_random_uuid(),
  label          text not null,
  ad_account_id  text not null unique,
  ads_token_enc  bytea,
  ads_token_mask text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Triggers updated_at.
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.tg_set_updated_at();
create trigger ga4_accounts_set_updated_at before update on public.ga4_accounts
  for each row execute function public.tg_set_updated_at();
create trigger meta_pixels_set_updated_at before update on public.meta_pixels
  for each row execute function public.tg_set_updated_at();
create trigger meta_ad_accounts_set_updated_at before update on public.meta_ad_accounts
  for each row execute function public.tg_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.settings         enable row level security;
alter table public.ga4_accounts     enable row level security;
alter table public.meta_pixels      enable row level security;
alter table public.meta_ad_accounts enable row level security;

-- Leitura só para autenticados (painel). Sem policies de escrita → INSERT/UPDATE/
-- DELETE ficam negados para anon/authenticated; service_role ignora a RLS.
create policy "settings: authenticated read" on public.settings
  for select to authenticated using (true);
create policy "ga4_accounts: authenticated read" on public.ga4_accounts
  for select to authenticated using (true);
create policy "meta_pixels: authenticated read" on public.meta_pixels
  for select to authenticated using (true);
create policy "meta_ad_accounts: authenticated read" on public.meta_ad_accounts
  for select to authenticated using (true);

-- ── Privilégios de coluna: esconder o ciphertext do painel ───────────────────
-- Revoga tudo de anon/authenticated e devolve SELECT só nas colunas seguras.
-- (service_role mantém acesso total para cifrar/decifrar e disparar eventos.)

revoke all on public.settings         from anon, authenticated;
revoke all on public.ga4_accounts     from anon, authenticated;
revoke all on public.meta_pixels      from anon, authenticated;
revoke all on public.meta_ad_accounts from anon, authenticated;

grant select (id, webhook_token_mask, currency, test_event_code, created_at, updated_at)
  on public.settings to authenticated;
grant select (id, label, measurement_id, api_secret_mask, is_active, created_at, updated_at)
  on public.ga4_accounts to authenticated;
grant select (id, label, pixel_id, capi_token_mask, is_active, created_at, updated_at)
  on public.meta_pixels to authenticated;
grant select (id, label, ad_account_id, ads_token_mask, is_active, created_at, updated_at)
  on public.meta_ad_accounts to authenticated;

grant all on public.settings         to service_role;
grant all on public.ga4_accounts     to service_role;
grant all on public.meta_pixels      to service_role;
grant all on public.meta_ad_accounts to service_role;
