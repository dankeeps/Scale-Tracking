import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Consome 1 unidade do rate limit (RPC em Postgres). Retorna true se permitido.
 * Fail-open: em caso de erro do limiter, não bloqueia (mas loga) — prioriza não
 * derrubar tráfego legítimo por uma falha momentânea do banco.
 */
export async function consumeRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_identifier: identifier,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[ratelimit] erro:", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("[ratelimit] exceção:", e);
    return true;
  }
}
