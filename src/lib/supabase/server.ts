import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para o servidor (Server Components, Route Handlers, Actions).
 * Usa a anon key + sessão do usuário via cookies — sujeito à RLS.
 * A escrita de dados de tracking NÃO usa este cliente; use o admin (service_role).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component sem resposta mutável.
            // O middleware cuida de renovar a sessão nesses casos.
          }
        },
      },
    },
  );
}
