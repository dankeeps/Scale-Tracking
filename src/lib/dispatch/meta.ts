import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { metaCapiUrl } from "@/lib/constants";
import { sha256 } from "@/lib/hash";
import { getActiveMetaPixels } from "@/lib/dispatch/accounts";

// Meta Conversions API (Graph v25.0 — versão em src/lib/constants).
// HASH: em, ph, fn, ln, ct, st, country, external_id. NÃO hashear fbp, fbc,
// client_ip_address, client_user_agent. action_source sempre "website".

export interface CustomData {
  value?: number | null;
  currency?: string | null;
  content_ids?: string[] | null;
  content_name?: string | null;
  content_type?: string | null;
}

export interface Conversion {
  event_name: string;
  event_id: string;
  event_time: number; // unix seconds
  event_source_url?: string | null;
  external_id?: string | null; // trck_user_id (será hasheado)
  // hashes já calculados na captura (visitors.*_hash)
  email_hash?: string | null;
  phone_hash?: string | null;
  first_name_hash?: string | null;
  last_name_hash?: string | null;
  city_hash?: string | null;
  state_hash?: string | null;
  country_hash?: string | null;
  // não-hasheados
  fbp?: string | null;
  fbc?: string | null;
  client_ip_address?: string | null;
  client_user_agent?: string | null;
  custom_data?: CustomData;
}

export interface MetaResult {
  pixel_id: string;
  label: string;
  ok: boolean;
  status: number;
  body: unknown;
}

function buildUserData(c: Conversion): Record<string, unknown> {
  const ud: Record<string, unknown> = {};
  const put = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") ud[k] = v;
  };
  put("em", c.email_hash);
  put("ph", c.phone_hash);
  put("fn", c.first_name_hash);
  put("ln", c.last_name_hash);
  put("ct", c.city_hash);
  put("st", c.state_hash);
  put("country", c.country_hash);
  if (c.external_id) ud.external_id = sha256(c.external_id.trim().toLowerCase());
  put("fbp", c.fbp); // NÃO hashear
  put("fbc", c.fbc); // NÃO hashear
  put("client_ip_address", c.client_ip_address); // NÃO hashear
  put("client_user_agent", c.client_user_agent); // NÃO hashear
  return ud;
}

function buildCustomData(cd?: CustomData): Record<string, unknown> | undefined {
  if (!cd) return undefined;
  const out: Record<string, unknown> = {};
  const hasValue = cd.value !== undefined && cd.value !== null;
  if (hasValue) out.value = cd.value;
  // currency só faz sentido acompanhando um value (evita warning da Meta).
  if (cd.currency && hasValue) out.currency = cd.currency;
  if (cd.content_ids?.length) out.content_ids = cd.content_ids;
  if (cd.content_name) out.content_name = cd.content_name;
  if (cd.content_type) out.content_type = cd.content_type;
  return Object.keys(out).length ? out : undefined;
}

export function buildMetaPayload(
  c: Conversion,
  testEventCode?: string | null,
): Record<string, unknown> {
  const event: Record<string, unknown> = {
    event_name: c.event_name,
    event_time: c.event_time,
    event_id: c.event_id,
    action_source: "website",
    user_data: buildUserData(c),
  };
  if (c.event_source_url) event.event_source_url = c.event_source_url;
  const custom = buildCustomData(c.custom_data);
  if (custom) event.custom_data = custom;
  const payload: Record<string, unknown> = { data: [event] };
  // Modo teste: faz o evento aparecer na aba "Eventos de Teste" do Meta.
  // NÃO conta como conversão — usar só para validação.
  if (testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

/** Dispara a conversão para TODOS os pixels ativos. Retorna payload + resultados. */
export async function dispatchMeta(
  admin: SupabaseClient,
  c: Conversion,
  opts?: { testEventCode?: string | null },
): Promise<{ payload: Record<string, unknown>; results: MetaResult[] }> {
  const pixels = await getActiveMetaPixels(admin);
  const payload = buildMetaPayload(c, opts?.testEventCode);

  const results = await Promise.all(
    pixels.map(async (px): Promise<MetaResult> => {
      try {
        const res = await fetch(
          `${metaCapiUrl(px.pixel_id)}?access_token=${encodeURIComponent(px.token)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const body = await res.json().catch(() => ({}));
        return {
          pixel_id: px.pixel_id,
          label: px.label,
          ok: res.ok,
          status: res.status,
          body,
        };
      } catch (e) {
        return {
          pixel_id: px.pixel_id,
          label: px.label,
          ok: false,
          status: 0,
          body: { error: e instanceof Error ? e.message : String(e) },
        };
      }
    }),
  );

  return { payload, results };
}
