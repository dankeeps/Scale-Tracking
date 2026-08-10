# Guia — duplicar o sistema para um novo especialista

Este repositório é um **template**. O código você reaproveita 100%; o que muda de
um especialista para o outro é a **infraestrutura** (Supabase + Vercel) e as
**credenciais** digitadas no painel.

> O passo a passo completo, com links e telas, vive **dentro do próprio painel**
> em `/dashboard/instrucoes` — e abre sem login enquanto o Supabase não estiver
> configurado. Este arquivo é só o resumo para quem prefere o terminal.

---

## Modo demonstração

Sem as variáveis do Supabase no ambiente, o sistema sobe em **modo
demonstração**: painel aberto sem login, com dados **fictícios** em todas as
abas. É o que você mostra para o cliente antes de provisionar qualquer coisa.

```bash
npm install
npm run dev      # abre em http://localhost:3000 → /dashboard
```

Assim que as três chaves do Supabase existirem, o modo demonstração **desliga
sozinho**: o login volta a ser obrigatório e os dados passam a vir do banco.
Nenhum dado fictício sobra.

---

## 0) Contas necessárias

GitHub (repo privado) · Supabase (1 projeto por cliente) · Vercel (1 projeto por
cliente) · Meta Business (Pixel, token da CAPI, conta de anúncio) · GA4
(Measurement ID + API secret) · plataforma de venda (Hotmart/Kiwify/Eduzz).

---

## 1) Duplicar o código

```bash
git clone <URL-DO-REPO-TEMPLATE> cliente-novo
cd cliente-novo
git remote remove origin
gh repo create <sua-org>/cliente-novo-tracking --private --source=. --push
```

---

## 2) Supabase novo

1. Novo projeto em supabase.com. Guarde a senha do banco.
2. **Database → Extensions**: `pgcrypto`, `supabase_vault`, `pg_cron`.
3. Migrations:
   ```bash
   npx supabase link --project-ref <REF>
   npx supabase db push
   ```
   Sem CLI: execute os arquivos de `supabase/migrations/` no SQL Editor, em ordem
   alfabética.
4. Smoke test (deve retornar `ok = true`):
   ```sql
   select decrypt_secret(encrypt_secret('teste')) = 'teste' as ok;
   ```
5. **Authentication**: cadastro público **off**.
6. **Authentication → Users → Add user**: cria o login do painel.
7. **Project Settings → API**: copie URL, `anon` e `service_role`.

---

## 3) Vercel novo

1. Import do repositório.
2. Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL        = https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon public key>
   SUPABASE_SERVICE_ROLE_KEY       = <service_role secret key>
   ```
   > `service_role` é secreta — **nunca** com prefixo `NEXT_PUBLIC_`.
3. Deploy e, em **Settings → Domains**, ligue um subdomínio do cliente
   (ex.: `dados.dominiodocliente.com`).

---

## 4) Marca (opcional, sem tocar em código)

```
NEXT_PUBLIC_BRAND_NAME = Nome do Especialista
NEXT_PUBLIC_BRAND_LOGO = /logo.png        # arquivo em public/, ou uma URL
```

Sem essas variáveis o painel mostra **"Seu Projeto"** e desenha as iniciais. O
repositório não carrega foto nem nome de ninguém.

---

## 5) Credenciais no painel (`/dashboard/config`)

Tudo cifrado no banco: **Pixels Meta** (ID + token da CAPI) · **GA4**
(Measurement ID + API secret) · **Contas de anúncio** (token com `ads_read` e,
para editar orçamento/pausar, `ads_management`) · **Produtos** (liga/desliga o
envio ao Meta por produto) · **token do webhook** (aba Geral).

---

## 6) Snippet e webhook

- `<script async src="https://<dominio-do-projeto>/t.js"></script>` em **todas**
  as páginas do funil; links de checkout passando por `window.trck.decorate`.
- Webhook na plataforma: `https://<dominio-do-projeto>/api/webhook/compra` com o
  token em `x-webhook-token` (ou `?token=`).

---

## Checklist

- [ ] Repo novo (clone + `gh repo create`)
- [ ] Supabase: extensions → migrations → smoke test → signup off → usuário
- [ ] Vercel: 3 envs → deploy → domínio
- [ ] Marca (variáveis opcionais)
- [ ] Painel: pixels / GA4 / contas / produtos / token do webhook
- [ ] `t.js` nas páginas + checkout decorado
- [ ] Webhook cadastrado na plataforma
- [ ] Testes (`?fbtest=1` + compra de teste)
