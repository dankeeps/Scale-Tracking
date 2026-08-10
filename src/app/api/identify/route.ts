import { getClientIp, getGeo, getUserAgent } from "@/lib/capture/geo";
import {
  jsonResponse,
  newId,
  notConfiguredResponse,
  preflightResponse,
} from "@/lib/capture/http";
import { consumeRateLimit } from "@/lib/capture/ratelimit";
import { identifySchema } from "@/lib/capture/schemas";
import { RATE_LIMITS } from "@/lib/constants";
import {
  hashOrNull,
  normalizeCity,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeRegion,
} from "@/lib/hash";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const notReady = notConfiguredResponse();
  if (notReady) return notReady;

  const ip = getClientIp(req.headers);

  const allowed = await consumeRateLimit(
    "identify",
    ip ?? "unknown",
    RATE_LIMITS.identify.max,
    RATE_LIMITS.identify.windowSeconds,
  );
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const parsed = identifySchema.safeParse(body);
  if (!parsed.success) return jsonResponse({ error: "invalid_input" }, 400);
  const input = parsed.data;

  const geo = getGeo(req.headers);
  const ua = getUserAgent(req.headers);
  const trckUserId = input.trck_user_id || newId();

  // Monta a linha só com valores presentes (upsert não sobrescreve o que falta).
  const row: Record<string, unknown> = { trck_user_id: trckUserId };
  const set = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") row[k] = v;
  };

  set("email", input.email ? normalizeEmail(input.email) : undefined);
  set("phone", input.phone ? normalizePhone(input.phone) : undefined);
  set("email_hash", hashOrNull(input.email, normalizeEmail));
  set("phone_hash", hashOrNull(input.phone, normalizePhone));
  set("first_name_hash", hashOrNull(input.first_name, normalizeName));
  set("last_name_hash", hashOrNull(input.last_name, normalizeName));
  // ct/st/country: usa o que o cliente enviar; senão, deriva do geo do IP.
  set(
    "city_hash",
    hashOrNull(input.city, normalizeCity) ??
      hashOrNull(geo.city, normalizeCity),
  );
  set(
    "state_hash",
    hashOrNull(input.state, normalizeRegion) ??
      hashOrNull(geo.region, normalizeRegion),
  );
  set(
    "country_hash",
    hashOrNull(input.country, normalizeRegion) ??
      hashOrNull(geo.country, normalizeRegion),
  );
  set("fbp", input.fbp);
  set("fbc", input.fbc);
  set("ga_client_id", input.ga_client_id);
  set("ga_session_id", input.ga_session_id);
  set("utm_source", input.utm_source);
  set("utm_medium", input.utm_medium);
  set("utm_campaign", input.utm_campaign);
  set("utm_term", input.utm_term);
  set("utm_content", input.utm_content);
  set("referrer", input.referrer);
  set("pixel_id", input.pixel_id);
  set("ip", ip);
  set("user_agent", ua);
  set("geo_country", geo.country);
  set("geo_region", geo.region);
  set("geo_city", geo.city);

  const admin = createAdminClient();
  const { error } = await admin
    .from("visitors")
    .upsert(row, { onConflict: "trck_user_id" });

  if (error) {
    console.error("[identify] db error:", error.message);
    return jsonResponse({ error: "server_error" }, 500);
  }

  return jsonResponse({ trck_user_id: trckUserId });
}

export async function OPTIONS() {
  return preflightResponse();
}
