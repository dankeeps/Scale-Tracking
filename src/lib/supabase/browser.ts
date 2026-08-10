import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para o browser (Client Components).
 * Usa a anon key — sujeito à RLS (só leitura do painel para autenticados).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
