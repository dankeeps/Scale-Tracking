import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GA4_MP_DEBUG_ENDPOINT, GA4_MP_ENDPOINT } from "@/lib/constants";
import { getActiveGa4Accounts } from "@/lib/dispatch/accounts";

// GA4 Measurement Protocol — usado SÓ para o evento offline (compra do webhook),
// reusando o MESMO client_id (cookie _ga) e o session_id capturados na visita.
// NÃO duplicar aqui os eventos que já foram pela gtag no navegador.

export type Ga4Params = Record<string, unknown>;

export interface Ga4Result {
  measurement_id: string;
  label: string;
  ok: boolean;
  status: number;
  body?: unknown;
}

export function buildGa4Payload(
  clientId: string,
  sessionId: string | null | undefined,
  name: string,
  params: Ga4Params,
): Record<string, unknown> {
  // engagement_time_msec ajuda o evento a aparecer nos relatórios/realtime.
  const p: Ga4Params = { engagement_time_msec: 100, ...params };
  if (sessionId) p.session_id = sessionId;
  return { client_id: clientId, events: [{ name, params: p }] };
}

/** Dispara para TODAS as propriedades GA4 ativas via Measurement Protocol. */
export async function dispatchGa4(
  admin: SupabaseClient,
  clientId: string,
  sessionId: string | null | undefined,
  name: string,
  params: Ga4Params,
  debug = false,
): Promise<{ payload: Record<string, unknown>; results: Ga4Result[] }> {
  const accounts = await getActiveGa4Accounts(admin);
  const payload = buildGa4Payload(clientId, sessionId, name, params);
  const endpoint = debug ? GA4_MP_DEBUG_ENDPOINT : GA4_MP_ENDPOINT;

  const results = await Promise.all(
    accounts.map(async (acc): Promise<Ga4Result> => {
      try {
        const url = `${endpoint}?measurement_id=${encodeURIComponent(
          acc.measurement_id,
        )}&api_secret=${encodeURIComponent(acc.apiSecret)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        // Produção responde 204 sem corpo; debug retorna validationMessages.
        const body = debug ? await res.json().catch(() => ({})) : undefined;
        return {
          measurement_id: acc.measurement_id,
          label: acc.label,
          ok: res.ok,
          status: res.status,
          ...(body !== undefined ? { body } : {}),
        };
      } catch (e) {
        return {
          measurement_id: acc.measurement_id,
          label: acc.label,
          ok: false,
          status: 0,
          body: { error: e instanceof Error ? e.message : String(e) },
        };
      }
    }),
  );

  return { payload, results };
}
