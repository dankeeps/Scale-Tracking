// Helpers de resposta para os endpoints públicos de captura (com CORS, já que o
// snippet roda no domínio do cliente e chama a API cross-origin).

import { IS_DEMO } from "@/lib/demo/mode";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

/**
 * Enquanto o Supabase não estiver configurado não há banco para gravar. Em vez
 * de estourar erro 500 no cliente, os endpoints públicos respondem 503 com uma
 * mensagem clara. Retorna `null` quando o sistema está configurado.
 */
export function notConfiguredResponse(): Response | null {
  if (!IS_DEMO) return null;
  return jsonResponse(
    {
      error: "not_configured",
      message:
        "Sistema em modo demonstração: configure o Supabase para começar a gravar.",
    },
    503,
  );
}

/** Resposta ao preflight OPTIONS. */
export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Gera um id de rastreamento / de evento. */
export function newId(): string {
  return crypto.randomUUID();
}
