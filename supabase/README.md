# Supabase — banco, segurança e migrations

Esquema, RLS, cifra de segredos e retenção. **Modelo single-tenant**: os usuários
autenticados são os operadores do painel (dono + time) e enxergam tudo; não há
`user_id` por linha. Cadastro público fica **desligado** (usuários criados à mão).

## Migrations (ordem)

1. `..._extensions_and_crypto.sql` — extensões (pgcrypto, supabase_vault, pg_cron),
   chave de cifra no Vault e RPCs `encrypt_secret` / `decrypt_secret` (só `service_role`).
2. `..._config_accounts.sql` — `settings` (1 linha) + `ga4_accounts`, `meta_pixels`,
   `meta_ad_accounts`. Segredos em colunas `*_enc` (cifradas) + `*_mask` (exibição).
   RLS + privilégios de coluna: o painel nunca lê o ciphertext.
3. `..._tracking_tables.sql` — `visitors`, `events_log`, `purchases` + índices + RLS.
4. `..._rate_limiting.sql` — `private.rate_limits` + RPC `consume_rate_limit`.
5. `..._retention_cron.sql` — jobs pg_cron: zera campos pesados de `events_log`
   (> 14 dias) em lotes e limpa janelas de rate limit.

## Aplicar

### Opção A — CLI (recomendado)
```bash
# 1. Criar o projeto no supabase.com e pegar o Project Ref.
npx supabase login
npx supabase link --project-ref <SEU_REF>
npx supabase db push        # aplica todas as migrations
```

### Opção B — SQL Editor
Cole o conteúdo de cada arquivo de `migrations/`, **na ordem numérica**, no SQL
Editor do painel do Supabase e execute.

> Se `create extension pg_cron` falhar, habilite **pg_cron** (e confirme
> **pgcrypto** e **supabase_vault**) em *Database → Extensions* e reaplique.

## Verificação pós-apply (smoke test no SQL Editor)

```sql
-- Cifra ida e volta (rode como service_role / no SQL Editor):
select decrypt_secret(encrypt_secret('valor-secreto')) = 'valor-secreto' as ok;

-- RLS ligada em todas as tabelas do schema public:
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

-- Jobs agendados:
select jobname, schedule, active from cron.job;

-- Rate limit (deve retornar true/false conforme o limite):
select consume_rate_limit('smoke', '127.0.0.1', 2, 60);
```

Checagens de segurança esperadas:
- `anon` não lê nada das tabelas (RLS sem policy para anon).
- `authenticated` lê as tabelas, mas **não** as colunas `*_enc` (sem privilégio).
- `encrypt_secret` / `decrypt_secret` / `consume_rate_limit` só executam como `service_role`.

## Produção

No painel do Supabase (*Authentication → Providers/Settings*), confirme que o
**signup está desligado** — o `config.toml` cobre o ambiente local/CLI, mas as
configurações do projeto hospedado são separadas.
