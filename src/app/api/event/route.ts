import { after } from "next/server";
import { getClientIp, getGeo, getUserAgent } from "@/lib/capture/geo";
import {
  jsonResponse,
  newId,
  notConfiguredResponse,
  preflightResponse,
} from "@/lib/capture/http";
import { consumeRateLimit } from "@/lib/capture/ratelimit";
import { eventSchema } from "@/lib/capture/schemas";
import { RATE_LIMITS } from "@/lib/constants";
import { dispatchMeta, type Conversion } from "@/lib/dispatch/meta";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Extrai o pathname (sem query) da URL do evento, para agregação por página. */
function pagePathFrom(url?: string | null): string | null {
  if (!url) return null;
  try {
    let p = new URL(url).pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p.slice(0, 512);
  } catch {
    return null;
  }
}

// Colunas do visitante usadas para enriquecer o evento e montar o CAPI user_data.
const VISITOR_COLS =
  "utm_source, utm_medium, utm_campaign, utm_term, utm_content, geo_country, geo_region, geo_city, email_hash, phone_hash, first_name_hash, last_name_hash, city_hash, state_hash, country_hash, fbp, fbc";

interface VisitorRow {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  email_hash: string | null;
  phone_hash: string | null;
  first_name_hash: string | null;
  last_name_hash: string | null;
  city_hash: string | null;
  state_hash: string | null;
  country_hash: string | null;
  fbp: string | null;
  fbc: string | null;
}

export async function POST(req: Request) {
  const notReady = notConfiguredResponse();
  if (notReady) return notReady;

  const ip = getClientIp(req.headers);

  const allowed = await consumeRateLimit(
    "event",
    ip ?? "unknown",
    RATE_LIMITS.event.max,
    RATE_LIMITS.event.windowSeconds,
  );
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ error: "invalid_input" }, 400);
  const input = parsed.data;

  const geo = getGeo(req.headers);
  const ua = getUserAgent(req.headers);
  const trckUserId = input.trck_user_id || null;
  const eventId = input.event_id || newId();

  const admin = createAdminClient();

  let visitor: VisitorRow | null = null;
  if (trckUserId) {
    const { data } = await admin
      .from("visitors")
      .select(VISITOR_COLS)
      .eq("trck_user_id", trckUserId)
      .maybeSingle();
    visitor = (data as unknown as VisitorRow | null) ?? null;
  }

  const row = {
    trck_user_id: trckUserId,
    event_name: input.event_name,
    event_id: eventId,
    page_path: pagePathFrom(input.event_source_url),
    utm_source: input.utm_source ?? visitor?.utm_source ?? null,
    utm_medium: input.utm_medium ?? visitor?.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? visitor?.utm_campaign ?? null,
    utm_term: input.utm_term ?? visitor?.utm_term ?? null,
    utm_content: input.utm_content ?? visitor?.utm_content ?? null,
    ip,
    user_agent: ua,
    geo_country: geo.country ?? visitor?.geo_country ?? null,
    geo_region: geo.region ?? visitor?.geo_region ?? null,
    geo_city: geo.city ?? visitor?.geo_city ?? null,
  };

  let { error } = await admin.from("events_log").insert(row);

  // Resiliência: se a coluna page_path ainda não foi migrada, grava sem ela.
  if (error && /page_path/.test(error.message ?? "")) {
    const { page_path: _omit, ...rest } = row;
    void _omit;
    ({ error } = await admin.from("events_log").insert(rest));
  }

  if (error) {
    // event_id único → dedup idempotente (não re-dispara).
    if (error.code === "23505") {
      return jsonResponse({ ok: true, event_id: eventId, deduped: true });
    }
    console.error("[event] db error:", error.message);
    return jsonResponse({ error: "server_error" }, 500);
  }

  // Disparo server-side para a Meta CAPI (todos os pixels ativos), após a
  // resposta — não bloqueia o cliente. GA4 NÃO entra aqui (já foi pela gtag).
  after(async () => {
    try {
      // Modo teste (?fbtest=1 no site): anexa o test_event_code do settings para
      // o evento aparecer em "Eventos de Teste" do Meta. Só quando explicitamente
      // pedido — o tráfego real nunca vira teste.
      let testEventCode: string | null = null;
      if (input.test_event) {
        const { data: s } = await admin
          .from("settings")
          .select("test_event_code")
          .eq("id", 1)
          .maybeSingle();
        testEventCode =
          (s as { test_event_code: string | null } | null)?.test_event_code ??
          null;
      }

      const conversion: Conversion = {
        event_name: input.event_name,
        event_id: eventId,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: input.event_source_url ?? null,
        external_id: trckUserId,
        email_hash: visitor?.email_hash ?? null,
        phone_hash: visitor?.phone_hash ?? null,
        first_name_hash: visitor?.first_name_hash ?? null,
        last_name_hash: visitor?.last_name_hash ?? null,
        city_hash: visitor?.city_hash ?? null,
        state_hash: visitor?.state_hash ?? null,
        country_hash: visitor?.country_hash ?? null,
        fbp: input.fbp ?? visitor?.fbp ?? null,
        fbc: input.fbc ?? visitor?.fbc ?? null,
        client_ip_address: ip,
        client_user_agent: ua,
        custom_data: {
          value: input.value ?? null,
          currency: input.currency ?? "BRL",
          content_ids: input.content_ids ?? null,
          content_name: input.content_name ?? null,
          content_type: input.content_type ?? null,
        },
      };

      const { payload, results } = await dispatchMeta(admin, conversion, {
        testEventCode,
      });
      if (results.length > 0) {
        await admin
          .from("events_log")
          .update({ payload_meta: payload, response_meta: results })
          .eq("event_id", eventId);
      }
    } catch (e) {
      console.error("[event] dispatch error:", e);
    }
  });

  return jsonResponse({ ok: true, event_id: eventId });
}

export async function OPTIONS() {
  return preflightResponse();
}
