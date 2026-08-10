-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 · Extensões + cifra de segredos
--
-- Segredos das contas (tokens/api_secret) são cifrados com pgcrypto usando uma
-- chave simétrica guardada no Supabase Vault (fora das tabelas, cifrada pela
-- root key do projeto). Decifrar só é possível via RPC SECURITY DEFINER, e a
-- execução dessas RPCs é concedida APENAS ao service_role (servidor).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensões ───────────────────────────────────────────────────────────────
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Vault: gerenciamento de segredos (já vem habilitado em projetos Supabase).
create extension if not exists supabase_vault;
-- pg_cron: agendador (usado na migration de retenção). Se falhar aqui, habilite
-- em Database → Extensions no painel do Supabase e reaplique.
create extension if not exists pg_cron;

-- Schema interno: NÃO exposto pela API (PostgREST só expõe `public`).
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- ── Chave de cifra no Vault ─────────────────────────────────────────────────
-- Gera uma chave aleatória de 32 bytes (hex) e guarda no Vault, uma única vez.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'tracking_pgp_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'tracking_pgp_key',
      'Chave simétrica para cifrar segredos de contas (pgcrypto).'
    );
  end if;
end $$;

-- ── Helpers internos ────────────────────────────────────────────────────────
-- Lê a chave decifrada do Vault. Fica em `private` e nunca é exposta pela API.
create or replace function private.encryption_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'tracking_pgp_key'
  limit 1;
$$;

-- Máscara para exibição no painel: mantém só os últimos 4 caracteres.
create or replace function private.mask_secret(secret text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when secret is null or length(secret) = 0 then null
    when length(secret) <= 4 then repeat('•', length(secret))
    else '••••' || right(secret, 4)
  end;
$$;

-- ── RPCs de cifra (expostas via PostgREST, mas só para service_role) ─────────
create or replace function public.encrypt_secret(plaintext text)
returns bytea
language sql
volatile
security definer
set search_path = ''
as $$
  select case
    when plaintext is null then null
    else extensions.pgp_sym_encrypt(plaintext, private.encryption_key())
  end;
$$;

create or replace function public.decrypt_secret(ciphertext bytea)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when ciphertext is null then null
    else extensions.pgp_sym_decrypt(ciphertext, private.encryption_key())
  end;
$$;

comment on function public.encrypt_secret(text) is
  'Cifra um segredo com a chave do Vault. Execução restrita ao service_role.';
comment on function public.decrypt_secret(bytea) is
  'Decifra um segredo. Execução restrita ao service_role (só servidor).';

-- Trava de execução: ninguém além do service_role chama estas funções.
revoke all on function public.encrypt_secret(text) from public, anon, authenticated;
revoke all on function public.decrypt_secret(bytea) from public, anon, authenticated;
grant execute on function public.encrypt_secret(text) to service_role;
grant execute on function public.decrypt_secret(bytea) to service_role;
