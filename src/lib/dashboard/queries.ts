import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { DateRange } from "@/lib/dashboard/range";

// Agregações do painel. Rodam em Server Components com o cliente AUTENTICADO
// (RLS aplica). Volumes moderados → agregação em JS sobre faixas limitadas.
//
// Deduplicação: a Visão geral precisa das MESMAS linhas de `purchases` em seis
// agregados diferentes. Os carregadores base são embrulhados em `cache()` do
// React, que memoiza por request (a chave é a identidade dos argumentos — daí
// criarmos o client e o `range` uma única vez por página). Resultado: uma
// consulta por tabela em vez de seis.

const CAP = 100_000;
const CHECKOUT_NAMES = ["InitiateCheckout", "begin_checkout", "Checkout"];
const PAGEVIEW_NAMES = ["PageView", "page_view"];

// Agrupamento por dia no fuso de São Paulo (não UTC), pra bater com "Hoje/Ontem".
const SP_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const spDay = (d: string | Date): string =>
  SP_DAY_FMT.format(typeof d === "string" ? new Date(d) : d);

type DB = SupabaseClient;

function isRefund(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return ["refund", "chargeback", "cancel", "dispute", "reembols"].some((d) =>
    s.includes(d),
  );
}

// Aplica os limites do período: created_at >= from (se houver) e < to.
type RangeScopable = {
  gte(column: string, value: string): RangeScopable;
  lt(column: string, value: string): RangeScopable;
};
function scopeRange<T extends RangeScopable>(q: T, range: DateRange): T {
  const withFrom = range.from ? (q.gte("created_at", range.from) as T) : q;
  return withFrom.lt("created_at", range.to) as T;
}

const countRows = cache(
  async (db: DB, table: string, range: DateRange): Promise<number> => {
    const q = scopeRange(
      db.from(table).select("*", { count: "exact", head: true }),
      range,
    );
    const { count } = await q;
    return count ?? 0;
  },
);

// ── carregadores base (uma consulta por request, ver nota no topo) ───────────

/** Colunas de `purchases` usadas por todos os agregados, menos o `raw_webhook`. */
const PURCHASE_COLS =
  "created_at, value, status, geo_country, product_name, product_id, trck_user_id, utm_source, utm_campaign, utm_term, utm_content";

interface PurchaseLite {
  created_at: string;
  value: number | null;
  status: string | null;
  geo_country: string | null;
  product_name: string | null;
  product_id: string | null;
  trck_user_id: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

const loadPurchases = cache(
  async (db: DB, range: DateRange): Promise<PurchaseLite[]> => {
    const q = scopeRange(
      db.from("purchases").select(PURCHASE_COLS).limit(CAP),
      range,
    );
    const { data } = await q;
    return (data as unknown as PurchaseLite[]) ?? [];
  },
);

/**
 * Visitantes distintos com algum dos eventos informados. `namesKey` (string) é a
 * chave do cache — objetos/arrays novos a cada chamada furariam a memoização.
 */
const loadDistinctUsers = cache(
  async (db: DB, range: DateRange, namesKey: string): Promise<number> => {
    const q = scopeRange(
      db
        .from("events_log")
        .select("trck_user_id")
        .in("event_name", namesKey.split(","))
        .limit(CAP),
      range,
    );
    const { data } = await q;
    return new Set((data ?? []).map((r) => r.trck_user_id).filter(Boolean)).size;
  },
);
const CHECKOUT_KEY = CHECKOUT_NAMES.join(",");
const PAGEVIEW_KEY = PAGEVIEW_NAMES.join(",");

export interface Overview {
  visitors: number;
  events: number;
  purchases: number;
  revenue: number;
  avgTicket: number;
  conversion: number; // compras / visitantes
  funnel: { visited: number; checkout: number; purchased: number };
}

export async function getOverview(db: DB, range: DateRange): Promise<Overview> {
  const [visitors, events, checkout, purchasesAll] = await Promise.all([
    countRows(db, "visitors", range),
    countRows(db, "events_log", range),
    loadDistinctUsers(db, range, CHECKOUT_KEY),
    loadPurchases(db, range),
  ]);

  const paid = purchasesAll.filter(
    (p) => !isRefund(p.status) && p.value != null,
  );
  const revenue = paid.reduce((s, p) => s + Number(p.value ?? 0), 0);
  const purchases = paid.length;
  const avgTicket = purchases > 0 ? revenue / purchases : 0;
  const conversion = visitors > 0 ? purchases / visitors : 0;

  return {
    visitors,
    events,
    purchases,
    revenue,
    avgTicket,
    conversion,
    funnel: { visited: visitors, checkout, purchased: purchases },
  };
}

// ── Funil de conversão (5 etapas) ────────────────────────────────────────────
// Cliques vêm do Meta (montados na página). Aqui o que é NOSSO: visitas na
// página (PageView), ICs (InitiateCheckout), vendas iniciadas (linhas de
// purchases) e vendas aprovadas (pagas).
export interface FunnelCounts {
  pageviews: number; // visitantes distintos com PageView
  ics: number; // visitantes distintos com InitiateCheckout
  salesInit: number; // vendas iniciadas (qualquer status do webhook)
  salesApproved: number; // vendas aprovadas (pagas)
}

export async function getFunnel(
  db: DB,
  range: DateRange,
): Promise<FunnelCounts> {
  const [pageviews, ics, rows] = await Promise.all([
    loadDistinctUsers(db, range, PAGEVIEW_KEY),
    loadDistinctUsers(db, range, CHECKOUT_KEY),
    loadPurchases(db, range),
  ]);

  const salesApproved = rows.filter(
    (p) => !isRefund(p.status) && p.value != null,
  ).length;

  return { pageviews, ics, salesInit: rows.length, salesApproved };
}

// ── Vendas por status (pendentes / reembolsadas) ─────────────────────────────
function isPendingStatus(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return [
    "pending",
    "waiting",
    "aguard",
    "pendente",
    "billet",
    "printed_billet",
    "open",
    "created",
    "initiat",
    "processing",
    "analysis",
    "analise",
    "started",
  ].some((d) => s.includes(d));
}

export interface SalesStatus {
  pending: number;
  pendingValue: number;
  refunded: number;
  refundedValue: number;
}

export async function getSalesStatusCounts(
  db: DB,
  range: DateRange,
): Promise<SalesStatus> {
  const data = await loadPurchases(db, range);
  let pending = 0;
  let pendingValue = 0;
  let refunded = 0;
  let refundedValue = 0;
  for (const p of data) {
    const v = Number(p.value ?? 0);
    if (isRefund(p.status)) {
      refunded++;
      refundedValue += v;
    } else if (isPendingStatus(p.status)) {
      pending++;
      pendingValue += v;
    }
  }
  return { pending, pendingValue, refunded, refundedValue };
}

// ── Vendas por país (mapa da Visão geral) ────────────────────────────────────
export interface CountrySales {
  key: string; // código do país (ex.: "BR")
  count: number;
}
export interface SalesGeo {
  countries: CountrySales[];
  total: number; // total de vendas pagas (base do % de participação)
  noCountry: number; // vendas pagas sem país identificado
}

export async function getSalesByCountry(
  db: DB,
  range: DateRange,
): Promise<SalesGeo> {
  const data = await loadPurchases(db, range);
  const paid = data.filter((p) => !isRefund(p.status) && p.value != null);

  const m = new Map<string, number>();
  let noCountry = 0;
  for (const p of paid) {
    const c = (p.geo_country ?? "").trim().toUpperCase();
    if (!c) {
      noCountry++;
      continue;
    }
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  const countries = [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  return { countries, total: paid.length, noCountry };
}

// ── Vendas por pagamento / produto ──────────────────────────────────────────
// O tipo de pagamento não é coluna — vive no raw_webhook. Extraímos na leitura
// (funciona retroativo). Cada plataforma nomeia diferente; buscamos as chaves
// mais comuns e classificamos em Pix / Cartão / Boleto / Outros.
const PAY_KEYS = [
  "payment_type",
  "payment_method",
  "paymentmethod",
  "paymenttype",
  "pag_type",
  "forma_pagamento",
  "tipo_pagamento",
  "payment_engine",
];
function rawPaymentValue(raw: unknown, depth = 6): string | null {
  if (depth < 0 || raw == null || typeof raw !== "object") return null;
  const entries = Array.isArray(raw)
    ? raw.map((v, i) => [String(i), v] as const)
    : Object.entries(raw as Record<string, unknown>);
  for (const [k, v] of entries) {
    const kl = k.toLowerCase();
    if (PAY_KEYS.includes(kl) && (typeof v === "string" || typeof v === "number"))
      return String(v);
    // Hotmart: payment: { type: "PIX" | "CREDIT_CARD" | "BILLET" | ... }
    if (kl === "payment" && v && typeof v === "object" && !Array.isArray(v)) {
      const t = (v as Record<string, unknown>).type;
      if (typeof t === "string") return t;
    }
  }
  for (const [, v] of entries) {
    if (v && typeof v === "object") {
      const found = rawPaymentValue(v, depth - 1);
      if (found) return found;
    }
  }
  return null;
}
function paymentLabel(raw: unknown): { key: string; label: string } {
  const v = (rawPaymentValue(raw) ?? "").toLowerCase();
  if (!v) return { key: "outros", label: "Outros" };
  if (v.includes("pix")) return { key: "pix", label: "Pix" };
  if (/(billet|boleto|bank_slip|bankslip)/.test(v))
    return { key: "boleto", label: "Boleto" };
  if (/(credit|card|cart|debit|cc)/.test(v))
    return { key: "cartao", label: "Cartão" };
  return { key: "outros", label: "Outros" };
}

export interface SalesSlice {
  key: string;
  label: string;
  count: number;
  revenue: number;
}
export interface SalesBreakdown {
  total: number;
  totalRevenue: number;
  byPayment: SalesSlice[];
  byProduct: SalesSlice[];
}

export async function getSalesBreakdown(
  db: DB,
  range: DateRange,
): Promise<SalesBreakdown> {
  const q = scopeRange(
    db
      .from("purchases")
      .select("value, status, product_name, product_id, raw_webhook")
      .limit(CAP),
    range,
  );
  const { data } = await q;
  const paid = (data ?? []).filter((p) => !isRefund(p.status) && p.value != null);

  const PAY_ORDER = ["pix", "cartao", "boleto", "outros"];
  const payMap = new Map<string, SalesSlice>();
  const prodMap = new Map<string, SalesSlice>();
  let totalRevenue = 0;

  for (const p of paid) {
    const val = Number(p.value ?? 0);
    totalRevenue += val;

    const pay = paymentLabel(p.raw_webhook);
    const ps = payMap.get(pay.key) ?? { ...pay, count: 0, revenue: 0 };
    ps.count++;
    ps.revenue += val;
    payMap.set(pay.key, ps);

    const name = (p.product_name ?? p.product_id ?? "Sem nome").trim() || "Sem nome";
    const key = name.toLowerCase();
    const prs = prodMap.get(key) ?? { key, label: name, count: 0, revenue: 0 };
    prs.count++;
    prs.revenue += val;
    prodMap.set(key, prs);
  }

  const byPayment = PAY_ORDER.map((k) => payMap.get(k)).filter(
    Boolean,
  ) as SalesSlice[];
  const byProduct = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue);
  return { total: paid.length, totalRevenue, byPayment, byProduct };
}

export interface EventTypeRow {
  event_name: string;
  total: number;
}

export async function getEventsByType(
  db: DB,
  range: DateRange,
): Promise<EventTypeRow[]> {
  const q = scopeRange(
    db.from("events_log").select("event_name").limit(CAP),
    range,
  );
  const { data } = await q;
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    map.set(r.event_name, (map.get(r.event_name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([event_name, total]) => ({ event_name, total }))
    .sort((a, b) => b.total - a.total);
}

export interface RevenueDay {
  day: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
  spend?: number; // investimento do Meta (preenchido na Visão geral)
}

export async function getRevenueDaily(
  db: DB,
  range: DateRange,
): Promise<RevenueDay[]> {
  const data = await loadPurchases(db, range);

  const map = new Map<string, { revenue: number; orders: number }>();
  for (const p of data) {
    if (isRefund(p.status)) continue;
    const day = spDay(p.created_at);
    const cur = map.get(day) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(p.value ?? 0);
    cur.orders += 1;
    map.set(day, cur);
  }

  // Preenche dias contínuos (por dia de SP) quando há faixa definida.
  const days: RevenueDay[] = [];
  if (range.from) {
    const startYmd = spDay(range.from);
    const endYmd = spDay(new Date(new Date(range.to).getTime() - 1)); // to exclusivo
    // âncora ao meio-dia SP para somar 24h sem risco de borda de dia
    let cursor = new Date(`${startYmd}T12:00:00-03:00`);
    let key = startYmd;
    while (key <= endYmd) {
      const v = map.get(key) ?? { revenue: 0, orders: 0 };
      days.push({ day: key, revenue: v.revenue, orders: v.orders });
      cursor = new Date(cursor.getTime() + 86400_000);
      key = spDay(cursor);
    }
  } else {
    for (const [day, v] of [...map.entries()].sort()) {
      days.push({ day, revenue: v.revenue, orders: v.orders });
    }
  }
  return days;
}

export interface Faturamento {
  revenue: number;
  orders: number;
  avgTicket: number;
  refunds: number;
  refundValue: number;
}

export async function getFaturamento(
  db: DB,
  range: DateRange,
): Promise<Faturamento> {
  const rows = await loadPurchases(db, range);
  const paid = rows.filter((p) => !isRefund(p.status) && p.value != null);
  const refunded = rows.filter((p) => isRefund(p.status));
  const revenue = paid.reduce((s, p) => s + Number(p.value ?? 0), 0);
  const refundValue = refunded.reduce((s, p) => s + Number(p.value ?? 0), 0);
  return {
    revenue,
    orders: paid.length,
    avgTicket: paid.length ? revenue / paid.length : 0,
    refunds: refunded.length,
    refundValue,
  };
}

export interface PurchaseRow {
  id: string;
  transaction_id: string;
  created_at: string;
  email: string | null;
  product_name: string | null;
  value: number | null;
  currency: string | null;
  status: string | null;
  matched: boolean;
  match_reason: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
}

export async function getPurchasesList(
  db: DB,
  range: DateRange,
  limit = 100,
  product?: string,
): Promise<PurchaseRow[]> {
  let q = db
    .from("purchases")
    .select(
      "id, transaction_id, created_at, email, product_name, value, currency, status, matched, match_reason, utm_source, utm_campaign",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  q = scopeRange(q, range);
  if (product) q = q.eq("product_name", product);
  const { data } = await q;
  return (data as PurchaseRow[]) ?? [];
}

export interface BuyerPurchase {
  id: string;
  created_at: string;
  product_name: string | null;
  value: number | null;
  currency: string | null;
  status: string | null;
}

/** Todas as compras de um comprador (casadas por trck_user_id e/ou email). */
export async function getBuyerPurchases(
  db: DB,
  keys: { trckUserId?: string | null; email?: string | null },
): Promise<BuyerPurchase[]> {
  const sel = "id, created_at, product_name, value, currency, status";
  const merged = new Map<string, BuyerPurchase>();
  const add = (rows: BuyerPurchase[] | null) => {
    for (const r of rows ?? []) merged.set(r.id, r);
  };
  if (keys.trckUserId) {
    const { data } = await db
      .from("purchases")
      .select(sel)
      .eq("trck_user_id", keys.trckUserId)
      .limit(200);
    add(data as BuyerPurchase[] | null);
  }
  if (keys.email) {
    const { data } = await db
      .from("purchases")
      .select(sel)
      .eq("email", keys.email)
      .limit(200);
    add(data as BuyerPurchase[] | null);
  }
  return [...merged.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

/** Nomes de produto distintos no período (para o filtro da aba Vendas). */
export async function getProductOptions(
  db: DB,
  range: DateRange,
): Promise<string[]> {
  const data = await loadPurchases(db, range);
  const set = new Set<string>();
  for (const r of data) {
    const n = (r.product_name ?? "").trim();
    if (n) set.add(n);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface GeoBucket {
  key: string;
  label: string;
  count: number;
}

export interface GeoBreakdown {
  countries: GeoBucket[];
  regions: GeoBucket[];
  cities: GeoBucket[];
  total: number;
}

export async function getGeo(db: DB, range: DateRange): Promise<GeoBreakdown> {
  let q = db
    .from("visitors")
    .select("geo_country, geo_region, geo_city")
    .limit(CAP);
  q = scopeRange(q, range);
  const { data } = await q;

  const countries = new Map<string, number>();
  const regions = new Map<string, number>();
  const cities = new Map<string, number>();
  let total = 0;
  for (const r of data ?? []) {
    total++;
    if (r.geo_country) countries.set(r.geo_country, (countries.get(r.geo_country) ?? 0) + 1);
    if (r.geo_region) regions.set(r.geo_region, (regions.get(r.geo_region) ?? 0) + 1);
    if (r.geo_city) cities.set(r.geo_city, (cities.get(r.geo_city) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n = 12): GeoBucket[] =>
    [...m.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);

  return {
    countries: top(countries),
    regions: top(regions),
    cities: top(cities),
    total,
  };
}

export interface EventLogRow {
  id: string;
  created_at: string;
  event_name: string;
  event_id: string | null;
  trck_user_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  payload_meta: unknown;
  response_meta: unknown;
  payload_ga4: unknown;
  response_ga4: unknown;
}

const EVENT_COLS =
  "id, created_at, event_name, event_id, trck_user_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, geo_country, geo_region, geo_city, payload_meta, response_meta, payload_ga4, response_ga4";

/** Um evento completo (com payloads/respostas) pelo id. */
export async function getEventById(
  db: DB,
  id: string,
): Promise<EventLogRow | null> {
  const { data } = await db
    .from("events_log")
    .select(EVENT_COLS)
    .eq("id", id)
    .single();
  return (data as unknown as EventLogRow) ?? null;
}

export async function getEvents(
  db: DB,
  opts: {
    range: DateRange;
    eventName?: string | null;
    page?: number;
    pageSize?: number;
  },
): Promise<{ rows: EventLogRow[]; total: number; pageSize: number; page: number }> {
  const page = Math.max(opts.page ?? 0, 0);
  const pageSize = opts.pageSize ?? 50;

  let q = db
    .from("events_log")
    .select(EVENT_COLS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  q = scopeRange(q, opts.range);
  if (opts.eventName) q = q.eq("event_name", opts.eventName);

  const { data, count } = await q;
  return {
    rows: (data as unknown as EventLogRow[]) ?? [],
    total: count ?? 0,
    pageSize,
    page,
  };
}

export interface UtmRevenue {
  utm_campaign: string;
  utm_source: string | null;
  revenue: number;
  orders: number;
}

/** Receita agregada por utm_campaign (para cruzar com o gasto do Meta Ads). */
export async function getRevenueByUtm(
  db: DB,
  range: DateRange,
): Promise<UtmRevenue[]> {
  const data = await loadPurchases(db, range);
  const map = new Map<string, UtmRevenue>();
  for (const p of data) {
    if (isRefund(p.status) || p.value == null) continue;
    const key = (p.utm_campaign ?? "(sem campanha)").toLowerCase();
    const cur =
      map.get(key) ??
      ({
        utm_campaign: p.utm_campaign ?? "(sem campanha)",
        utm_source: p.utm_source ?? null,
        revenue: 0,
        orders: 0,
      } as UtmRevenue);
    cur.revenue += Number(p.value ?? 0);
    cur.orders += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface UtmAgg {
  revenue: number;
  orders: number;
}
export interface RevenueUtmMaps {
  campaigns: Map<string, UtmAgg>; // key = utm_campaign (lower)
  adsets: Map<string, UtmAgg>; // key = utm_term (lower)
  ads: Map<string, UtmAgg>; // key = utm_content (lower)
}

/**
 * Chave de casamento de um UTM. Os templates de URL do Meta gravam
 * `{{campaign.name}}|{{campaign.id}}` (idem anúncio), então o UTM chega como
 * `nome|id`. O consumidor casa por nome OU por id do objeto — nenhum é igual à
 * string composta. Aqui extraímos o id numérico após o último `|` (quando houver)
 * para casar por id; sem `|`, mantemos o valor cru (casa por nome/id puro).
 */
function utmMatchKey(value: string | null): string | null {
  if (!value) return null;
  const i = value.lastIndexOf("|");
  if (i >= 0) {
    const tail = value.slice(i + 1).trim();
    if (/^\d+$/.test(tail)) return tail;
  }
  return value;
}

/**
 * Receita/compras agregadas por UTM em 3 níveis (campanha/conjunto/anúncio),
 * para cruzar com os objetos do Meta. As chaves são o valor do UTM em minúsculo
 * — o consumidor casa por nome OU por id do objeto.
 */
export async function getRevenueUtmMaps(
  db: DB,
  range: DateRange,
): Promise<RevenueUtmMaps> {
  const data = await loadPurchases(db, range);

  const maps: RevenueUtmMaps = {
    campaigns: new Map(),
    adsets: new Map(),
    ads: new Map(),
  };
  const add = (m: Map<string, UtmAgg>, key: string | null, value: number) => {
    const mk = utmMatchKey(key);
    if (!mk) return;
    const k = mk.toLowerCase();
    const cur = m.get(k) ?? { revenue: 0, orders: 0 };
    cur.revenue += value;
    cur.orders += 1;
    m.set(k, cur);
  };

  for (const p of data) {
    if (isRefund(p.status) || p.value == null) continue;
    const v = Number(p.value);
    add(maps.campaigns, p.utm_campaign, v);
    add(maps.adsets, p.utm_term, v);
    add(maps.ads, p.utm_content, v);
  }
  return maps;
}

export interface JourneyEvent {
  id: string;
  created_at: string;
  event_name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
}

export interface PageRow {
  page: string;
  views: number; // PageView na página
  users: number; // visitantes distintos com PageView na página
  checkouts: number; // visitantes distintos que iniciaram checkout na página
  purchases: number; // compradores pagos que iniciaram checkout na página
  conversion: number; // compras ÷ usuários únicos
}

/**
 * Métricas por página (pathname). Visualizações e usuários vêm dos PageView;
 * checkouts dos eventos de InitiateCheckout na página; compras são atribuídas à
 * página onde o comprador iniciou o checkout. Só conta eventos com page_path
 * (capturado a partir do deploy desta versão).
 */
export async function getPages(db: DB, range: DateRange): Promise<PageRow[]> {
  const evQ = scopeRange(
    db
      .from("events_log")
      .select("page_path, event_name, trck_user_id")
      .not("page_path", "is", null)
      .limit(CAP),
    range,
  );
  const [{ data: events }, purchases] = await Promise.all([
    evQ,
    loadPurchases(db, range),
  ]);

  const paidBuyers = new Set(
    purchases
      .filter((p) => !isRefund(p.status) && p.value != null && p.trck_user_id)
      .map((p) => p.trck_user_id as string),
  );

  type Acc = {
    views: number;
    users: Set<string>;
    checkoutUsers: Set<string>;
  };
  const map = new Map<string, Acc>();
  const get = (page: string): Acc => {
    let a = map.get(page);
    if (!a) {
      a = { views: 0, users: new Set(), checkoutUsers: new Set() };
      map.set(page, a);
    }
    return a;
  };

  for (const e of events ?? []) {
    const page = e.page_path as string;
    const acc = get(page);
    if (e.event_name === "PageView" || e.event_name === "page_view") {
      acc.views++;
      if (e.trck_user_id) acc.users.add(e.trck_user_id);
    }
    if (CHECKOUT_NAMES.includes(e.event_name) && e.trck_user_id) {
      acc.checkoutUsers.add(e.trck_user_id);
    }
  }

  return [...map.entries()]
    .map(([page, a]) => {
      const purchases = [...a.checkoutUsers].filter((u) =>
        paidBuyers.has(u),
      ).length;
      return {
        page,
        views: a.views,
        users: a.users.size,
        checkouts: a.checkoutUsers.size,
        purchases,
        conversion: a.users.size > 0 ? purchases / a.users.size : 0,
      };
    })
    .sort((x, y) => y.views - x.views);
}

/** Histórico completo de eventos de um visitante (cronológico). */
export async function getVisitorJourney(
  db: DB,
  trckUserId: string,
  limit = 200,
): Promise<JourneyEvent[]> {
  const { data } = await db
    .from("events_log")
    .select(
      "id, created_at, event_name, utm_source, utm_medium, utm_campaign, utm_term, utm_content, geo_country, geo_region, geo_city",
    )
    .eq("trck_user_id", trckUserId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data as JourneyEvent[]) ?? [];
}
