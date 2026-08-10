import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IS_DEMO } from "@/lib/demo/mode";

/** Prefixos de rota que exigem sessão (o painel). */
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Renova a sessão do Supabase (cookies) a cada request e faz o redirecionamento
 * "otimista" de rotas protegidas. A proteção REAL (autorização) é reforçada no
 * layout do painel via getUser() — como recomenda a doc do Next 16 (Proxy não é
 * solução completa de sessão/autorização).
 */
export async function updateSession(request: NextRequest) {
  // Modo demonstração: sem Supabase não há sessão para renovar nem rota para
  // proteger — o painel abre livre com dados fictícios.
  if (IS_DEMO) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não rode código entre criar o client e getUser() — pode causar
  // logout aleatório (a sessão precisa ser lida/renovada aqui).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isLogin = path === "/login";

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
