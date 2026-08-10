import {
  jsonResponse,
  notConfiguredResponse,
  preflightResponse,
} from "@/lib/capture/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Config pública para o snippet: measurement_ids (GA4) e pixel_ids (Meta) ativos.
 * São identificadores PÚBLICOS (já apareceriam no HTML de qualquer site). Nenhum
 * segredo é exposto aqui.
 */
export async function GET() {
  // Sem Supabase não há contas cadastradas — o snippet só não carrega nada.
  if (notConfiguredResponse()) return jsonResponse({ ga4: [], pixels: [] });

  const admin = createAdminClient();
  const [ga4, pixels] = await Promise.all([
    admin.from("ga4_accounts").select("measurement_id").eq("is_active", true),
    admin.from("meta_pixels").select("pixel_id").eq("is_active", true),
  ]);

  return jsonResponse({
    ga4: (ga4.data ?? []).map((r) => r.measurement_id),
    pixels: (pixels.data ?? []).map((r) => r.pixel_id),
  });
}

export async function OPTIONS() {
  return preflightResponse();
}
