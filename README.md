# Tracking · Sistema de rastreamento server-side com painel

Rastreamento **server-side** que captura visitantes e eventos, enriquece no
servidor (IP real, user agent, geo) e dispara conversões para **todos** os destinos
ativos — múltiplos **Meta Pixels** (Conversions API) e propriedades **GA4**
(Measurement Protocol) — com deduplicação por `event_id`. Um webhook genérico de
compra (Hotmart/Kiwify/Eduzz) casa a venda ao visitante e dispara `Purchase`.
Painel autenticado com visão geral, eventos, faturamento, campanhas (ROAS/CPA) e geo.

## Stack

- **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4
- **Supabase** (Postgres + Auth) — RLS, pgcrypto + Vault, pg_cron
- UI shadcn/Radix · Recharts · d3-geo · sonner
- **Meta Graph API v25** · **GA4 Measurement Protocol**

## Template para duplicar

O repositório é um **template**: um projeto por especialista/cliente, cada um com
seu Supabase, sua Vercel e suas credenciais. Não há nome, foto, pixel ou domínio
de ninguém no código — a marca vem de variáveis de ambiente.

Guia completo: [`docs/NOVO-CLIENTE.md`](docs/NOVO-CLIENTE.md) e, dentro do
próprio painel, a aba **Instruções** (`/dashboard/instrucoes`).

## Rodar localmente

```bash
npm install
npm run dev     # sobe em MODO DEMONSTRAÇÃO: sem login, com dados fictícios
```

Para ligar de verdade, copie `.env.example` para `.env.local`, preencha as três
chaves do Supabase e aplique as migrations (ver
[`supabase/README.md`](supabase/README.md)). O modo demonstração desliga sozinho
quando as chaves existem: o login volta a ser exigido e nenhum dado fictício
sobra.

Credenciais de Meta/GA4 são cadastradas **pelo painel** (cifradas no banco), não em env.

## Segurança

- RLS em todas as tabelas; leitura só por usuário autenticado, escrita só via
  `service_role` (servidor). Cadastro público desligado.
- Segredos cifrados (pgcrypto + chave no Vault); ciphertext nunca sai pela API.
- Endpoints públicos validados (zod) + rate limiting; webhook exige token.
- Em env, apenas a infra do Supabase. `.env*` fora do git.

## Deploy

GitHub → Vercel. Configure na Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Cadastre a URL do
webhook (`/api/webhook/compra`) na plataforma de venda com o token configurado.

## Documentação

Arquitetura, convenções e decisões: [`CLAUDE.md`](CLAUDE.md).
