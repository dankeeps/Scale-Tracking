import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// Next.js 16: "Proxy" é o antigo Middleware (mesma função, nome novo).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Roda em tudo, menos assets estáticos e imagens.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
