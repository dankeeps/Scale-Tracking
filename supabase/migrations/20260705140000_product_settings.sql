-- Controle por produto: enviar (ou não) o Purchase daquele produto ao Meta.
-- A lista de produtos é derivada de public.purchases; aqui mora só o flag.
-- Chave = product_id (ou product_name se não houver id). Default: enviar.
-- RLS: leitura autenticada (painel); escrita só service_role (webhook/action).

create table if not exists public.product_settings (
  product_key  text primary key,
  product_name text,
  send_meta    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.product_settings enable row level security;

create policy "product_settings: authenticated read" on public.product_settings
  for select to authenticated using (true);

revoke all on public.product_settings from anon, authenticated;
grant select on public.product_settings to authenticated;
grant all on public.product_settings to service_role;

create trigger product_settings_set_updated_at before update on public.product_settings
  for each row execute function public.tg_set_updated_at();
