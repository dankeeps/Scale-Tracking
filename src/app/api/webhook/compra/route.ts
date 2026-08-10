import { timingSafeEqual } from "node:crypto";
import { getClientIp } from "@/lib/capture/geo";
import { jsonResponse, notConfiguredResponse } from "@/lib/capture/http";
import { consumeRateLimit } from "@/lib/capture/ratelimit";
import { RATE_LIMITS } from "@/lib/constants";
import { dispatchGa4 } from "@/lib/dispatch/ga4";
import { dispatchMeta, type Conversion } from "@/lib/dispatch/meta";
import {
  hashOrNull,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "@/lib/hash";
import { productKey } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizePurchase,
  shouldDispatchPurchase,
  shouldLogPurchaseEvent,
  splitName,
} from "@/lib/webhook/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COLS =
  "trck_user_id, fbp, fbc, ga_client_id, ga_session_id, ip, user_agent, geo_country, geo_region, geo_city, city_hash, state_hash, country_hash, utm_source, utm_medium, utm_campaign, utm_term, utm_content";

interface Visitor {
  trck_user_id: string | null;
  fbp: string | null;
  fbc: string | null;
  ga_client_id: string | null;
  ga_session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  city_hash: string | null;
  state_hash: string | null;
  country_hash: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

function tokenMatches(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  const notReady = notConfiguredResponse();
  if (notReady) return notReady;

  const ip = getClientIp(req.headers);
  const allowed = await consumeRateLimit(
    "webhook",
    ip ?? "unknown",
    RATE_LIMITS.webhook.max,
    RATE_LIMITS.webhook.windowSeconds,
  );
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const admin = createAdminClient();

  // ── token do webhook (header x-webhook-token ou ?token=) ──
  const url = new URL(req.url);
  const incoming =
    req.headers.get("x-webhook-token") ?? url.searchParams.get("token") ?? "";

  const { data: settings } = await admin
    .from("settings")
    .select("webhook_token_enc, currency")
    .eq("id", 1)
    .single();

  const enc = (settings as { webhook_token_enc: string | null } | null)
    ?.webhook_token_enc;
  if (!enc) {
    return jsonResponse({ error: "webhook_not_configured" }, 503);
  }
  const { data: expected } = await admin.rpc("decrypt_secret", {
    ciphertext: enc,
  });
  if (!expected || !incoming || !tokenMatches(incoming, expected as string)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  // ── corpo ──
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const norm = normalizePurchase(raw);
  if (!norm.transaction_id) {
    return jsonResponse({ error: "missing_transaction_id" }, 400);
  }

  const currency = norm.currency ?? settings?.currency ?? "BRL";
  const metaEventId = `pur_${norm.transaction_id}`;

  // ── matching: trck_user_id → email → telefone ──
  const email = norm.email ? normalizeEmail(norm.email) : null;
  const phone = norm.phone ? normalizePhone(norm.phone) : null;

  let visitor: Visitor | null = null;
  let matchReason: "trck_user_id" | "email" | "phone" | "none" = "none";

  const fetchVisitor = async (col: string, val: string) => {
    const { data } = await admin
      .from("visitors")
      .select(VISITOR_COLS)
      .eq(col, val)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as unknown as Visitor | null) ?? null;
  };

  if (norm.trck_user_id) {
    visitor = await fetchVisitor("trck_user_id", norm.trck_user_id);
    if (visitor) matchReason = "trck_user_id";
  }
  if (!visitor && email) {
    visitor = await fetchVisitor("email", email);
    if (visitor) matchReason = "email";
  }
  if (!visitor && phone) {
    visitor = await fetchVisitor("phone", phone);
    if (visitor) matchReason = "phone";
  }

  const trckUserId = norm.trck_user_id ?? visitor?.trck_user_id ?? null;

  // ── idempotência: já existe e já foi disparada? ──
  const { data: existing } = await admin
    .from("purchases")
    .select("id, response_meta")
    .eq("transaction_id", norm.transaction_id)
    .maybeSingle();
  const alreadyDispatched = Boolean(
    existing && (existing as { response_meta: unknown }).response_meta,
  );

  // ── grava/atualiza purchase (não toca payload/response já existentes) ──
  const purchaseRow = {
    transaction_id: norm.transaction_id,
    // Data da venda vem do payload (aprovação), não da chegada do webhook — assim
    // eventos tardios (ex.: PURCHASE_COMPLETE dias depois) não contam como "hoje".
    // Omitido quando ausente → mantém o default now() no insert.
    created_at: norm.purchased_at ?? undefined,
    trck_user_id: trckUserId,
    email,
    phone,
    email_hash: hashOrNull(norm.email, normalizeEmail),
    phone_hash: hashOrNull(norm.phone, normalizePhone),
    product_id: norm.product_id,
    product_name: norm.product_name,
    value: norm.value,
    currency,
    status: norm.status,
    utm_source: norm.utm_source ?? visitor?.utm_source ?? null,
    utm_medium: norm.utm_medium ?? visitor?.utm_medium ?? null,
    utm_campaign: norm.utm_campaign ?? visitor?.utm_campaign ?? null,
    utm_term: norm.utm_term ?? visitor?.utm_term ?? null,
    utm_content: norm.utm_content ?? visitor?.utm_content ?? null,
    fbp: visitor?.fbp ?? null,
    fbc: visitor?.fbc ?? null,
    ga_client_id: visitor?.ga_client_id ?? null,
    ga_session_id: visitor?.ga_session_id ?? null,
    geo_country: visitor?.geo_country ?? null,
    geo_region: visitor?.geo_region ?? null,
    geo_city: visitor?.geo_city ?? null,
    matched: Boolean(visitor),
    match_reason: matchReason,
    meta_event_id: metaEventId,
    raw_webhook: raw as Record<string, unknown>,
  };

  const { error: upsertErr } = await admin
    .from("purchases")
    .upsert(purchaseRow, { onConflict: "transaction_id" });
  if (upsertErr) {
    console.error("[webhook] upsert error:", upsertErr.message);
    return jsonResponse({ error: "server_error" }, 500);
  }

  // ── registra o Purchase na aba Eventos (events_log), com o mesmo event_id ──
  // (dedup). Pendente entra sem payload; ao ser pago, a mesma linha é atualizada.
  // Sem `payloads` no upsert, as colunas de payload/response não são tocadas
  // (não sobrescreve o que já foi disparado numa chamada anterior).
  const logEvent = shouldLogPurchaseEvent(norm.status);
  const upsertEvent = async (payloads?: {
    payload_meta: unknown;
    response_meta: unknown;
    payload_ga4: unknown;
    response_ga4: unknown;
  }) => {
    if (!logEvent) return;
    const eventRow: Record<string, unknown> = {
      trck_user_id: trckUserId,
      event_name: "Purchase",
      event_id: metaEventId,
      utm_source: purchaseRow.utm_source,
      utm_medium: purchaseRow.utm_medium,
      utm_campaign: purchaseRow.utm_campaign,
      utm_term: purchaseRow.utm_term,
      utm_content: purchaseRow.utm_content,
      ip: visitor?.ip ?? null,
      user_agent: visitor?.user_agent ?? null,
      geo_country: visitor?.geo_country ?? null,
      geo_region: visitor?.geo_region ?? null,
      geo_city: visitor?.geo_city ?? null,
    };
    if (payloads) Object.assign(eventRow, payloads);
    const { error } = await admin
      .from("events_log")
      .upsert(eventRow, { onConflict: "event_id" });
    if (error) console.error("[webhook] events_log upsert:", error.message);
  };

  // ── decisão de disparo ──
  const willDispatch =
    shouldDispatchPurchase(norm.status) && !alreadyDispatched;

  if (!willDispatch) {
    await upsertEvent();
    return jsonResponse({
      ok: true,
      transaction_id: norm.transaction_id,
      matched: Boolean(visitor),
      match_reason: matchReason,
      dispatched: false,
      reason: alreadyDispatched ? "already_dispatched" : "status",
    });
  }

  // ── Purchase para Meta (todos os pixels) e GA4 MP (todas as propriedades) ──
  const { first, last } = splitName(norm.name);
  const contentIds = [norm.product_id ?? norm.product_name].filter(
    Boolean,
  ) as string[];

  const conversion: Conversion = {
    event_name: "Purchase",
    event_id: metaEventId,
    event_time: Math.floor(Date.now() / 1000),
    external_id: trckUserId,
    email_hash: hashOrNull(norm.email, normalizeEmail),
    phone_hash: hashOrNull(norm.phone, normalizePhone),
    first_name_hash: hashOrNull(first, normalizeName),
    last_name_hash: hashOrNull(last, normalizeName),
    city_hash: visitor?.city_hash ?? null,
    state_hash: visitor?.state_hash ?? null,
    country_hash: visitor?.country_hash ?? null,
    fbp: visitor?.fbp ?? null,
    fbc: visitor?.fbc ?? null,
    client_ip_address: visitor?.ip ?? null,
    client_user_agent: visitor?.user_agent ?? null,
    custom_data: {
      value: norm.value,
      currency,
      content_ids: contentIds.length ? contentIds : null,
      content_name: norm.product_name,
      content_type: "product",
    },
  };

  // Envio ao Meta pode ser desligado por produto no painel (ex.: upsells).
  // Sem linha em product_settings → default LIGADO. GA4 não é afetado.
  const prodKey = productKey(norm.product_id, norm.product_name);
  let sendMeta = true;
  if (prodKey) {
    const { data: ps } = await admin
      .from("product_settings")
      .select("send_meta")
      .eq("product_key", prodKey)
      .maybeSingle();
    sendMeta = (ps as { send_meta: boolean } | null)?.send_meta ?? true;
  }

  const meta = sendMeta
    ? await dispatchMeta(admin, conversion)
    : {
        payload: { skipped: "produto desativado no painel" },
        results: [] as Awaited<ReturnType<typeof dispatchMeta>>["results"],
      };

  // GA4 MP só se houver client_id capturado na visita (senão não há como atribuir).
  let ga4Payload: Record<string, unknown> | null = null;
  let ga4Results: unknown[] = [];
  if (visitor?.ga_client_id) {
    const items = [
      {
        item_id: norm.product_id ?? norm.transaction_id,
        item_name: norm.product_name ?? "Produto",
        price: norm.value ?? 0,
        quantity: 1,
      },
    ];
    const ga4 = await dispatchGa4(
      admin,
      visitor.ga_client_id,
      visitor.ga_session_id,
      "purchase",
      {
        transaction_id: norm.transaction_id,
        value: norm.value ?? 0,
        currency,
        items,
      },
    );
    ga4Payload = ga4.payload;
    ga4Results = ga4.results;
  }

  await admin
    .from("purchases")
    .update({
      payload_meta: meta.payload,
      response_meta: meta.results,
      payload_ga4: ga4Payload,
      response_ga4: ga4Results,
    })
    .eq("transaction_id", norm.transaction_id);

  // Mesma auditoria por destino também na aba Eventos.
  await upsertEvent({
    payload_meta: meta.payload,
    response_meta: meta.results,
    payload_ga4: ga4Payload,
    response_ga4: ga4Results,
  });

  return jsonResponse({
    ok: true,
    transaction_id: norm.transaction_id,
    matched: Boolean(visitor),
    match_reason: matchReason,
    dispatched: true,
    meta_skipped: !sendMeta,
    meta_destinos: meta.results.length,
    ga4_destinos: ga4Results.length,
  });
}
