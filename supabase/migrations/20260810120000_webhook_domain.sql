-- Domínio público onde o sistema está publicado (ex.: dados.seudominio.com),
-- digitado pelo painel em Configurações → Geral.
--
-- Existe para montar a URL COMPLETA do webhook (domínio + caminho + token) e a
-- pessoa só copiar e colar na plataforma de venda, sem juntar pedaços na mão.
-- Não é segredo: é o mesmo endereço que já aparece na barra do navegador.

alter table public.settings
  add column if not exists webhook_domain text;

-- O painel (authenticated) precisa ler a coluna; a escrita continua só via
-- service_role, como nas demais colunas de settings.
grant select (webhook_domain) on public.settings to authenticated;
