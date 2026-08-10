-- Página (pathname) de cada evento, para a aba "Páginas" do painel.
-- Preenchida na captura a partir de event_source_url (só pathname, sem query).
-- RLS herda de events_log (leitura só autenticada; escrita só service_role).

alter table public.events_log
  add column if not exists page_path text;

create index if not exists events_log_page_path_idx
  on public.events_log (page_path);
