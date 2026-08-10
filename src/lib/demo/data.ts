import "server-only";
import type { ManagerRow } from "@/components/dashboard/campaigns-manager";
import type { AccountRow } from "@/lib/config/accounts";
import type { ProductRow } from "@/lib/config/products";
import type {
  BuyerPurchase,
  EventLogRow,
  EventTypeRow,
  Faturamento,
  FunnelCounts,
  GeoBreakdown,
  JourneyEvent,
  Overview,
  PageRow,
  PurchaseRow,
  RevenueDay,
  SalesBreakdown,
  SalesGeo,
  SalesSlice,
  SalesStatus,
} from "@/lib/dashboard/queries";
import type { DateRange } from "@/lib/dashboard/range";

/**
 * Dados FICTÍCIOS do modo demonstração (ver `@/lib/demo/mode`).
 *
 * Regras que este módulo segue:
 *  - determinístico: o mesmo período gera sempre os mesmos números (PRNG com
 *    semente derivada do dia), então a tela não "pisca" a cada refresh;
 *  - coerente: as compras são geradas como linhas e TODOS os agregados
 *    (receita, ticket, funil, ROAS, mapa) saem delas — nada se contradiz;
 *  - barato: visitas/eventos são contagens agregadas + uma amostra de linhas
 *    para as tabelas (não geramos 30 mil eventos por request).
 */

// ── datas ────────────────────────────────────────────────────────────────────
const TZ = "America/Sao_Paulo";
const SP_OFFSET = "-03:00";
const DAY_MS = 86_400_000;
const spDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const spDay = (d: Date | string): string =>
  spDayFmt.format(typeof d === "string" ? new Date(d) : d);
const startOfSpDay = (ymd: string): Date =>
  new Date(`${ymd}T00:00:00${SP_OFFSET}`);

/** Dias do período, com o "peso" de cada um (1 = dia inteiro). */
interface DemoDay {
  day: string;
  weight: number;
  start: number;
  end: number;
}

const DEFAULT_SPAN_DAYS = 30; // usado quando o período não tem início

function demoDays(range: DateRange): DemoDay[] {
  const toMs = new Date(range.to).getTime();
  const fromMs = range.from
    ? new Date(range.from).getTime()
    : toMs - DEFAULT_SPAN_DAYS * DAY_MS;

  const days: DemoDay[] = [];
  const lastYmd = spDay(new Date(toMs - 1));
  let ymd = spDay(new Date(fromMs));
  // âncora ao meio-dia para somar 24h sem risco de borda de fuso
  let cursor = new Date(`${ymd}T12:00:00${SP_OFFSET}`);

  while (ymd <= lastYmd && days.length <= 400) {
    const start = startOfSpDay(ymd).getTime();
    const end = start + DAY_MS;
    const covered =
      Math.min(end, toMs) - Math.max(start, fromMs); // interseção com o período
    days.push({
      day: ymd,
      weight: Math.max(0, Math.min(1, covered / DAY_MS)),
      start,
      end,
    });
    cursor = new Date(cursor.getTime() + DAY_MS);
    ymd = spDay(cursor);
  }
  return days;
}

// ── PRNG determinístico ──────────────────────────────────────────────────────
function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Sorteio determinístico entre min e max para um dia. */
const between = (rnd: () => number, min: number, max: number): number =>
  min + rnd() * (max - min);
const pick = <T>(rnd: () => number, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

// ── catálogo fictício ────────────────────────────────────────────────────────
const PRODUCTS = [
  { name: "Curso Completo (demonstração)", price: 497, share: 0.5 },
  { name: "Order bump — Pack de Templates", price: 47, share: 0.22 },
  { name: "Upsell — Comunidade VIP", price: 197, share: 0.2 },
  { name: "Mentoria Individual", price: 1997, share: 0.08 },
] as const;

const CAMPAIGNS = [
  { id: "1000000000001", name: "[AQUISIÇÃO] VSL — Público frio", share: 0.52 },
  { id: "1000000000002", name: "[REMARKETING] 7 dias", share: 0.3 },
  { id: "1000000000003", name: "[ESCALA] Lookalike 1%", share: 0.18 },
] as const;

const ADSETS = [
  { id: "2000000000001", campaign: 0, name: "Interesses amplos 25-45", share: 0.3 },
  { id: "2000000000002", campaign: 0, name: "Aberto — sem segmentação", share: 0.22 },
  { id: "2000000000003", campaign: 1, name: "Visitou checkout 7d", share: 0.18 },
  { id: "2000000000004", campaign: 1, name: "Assistiu 50% do vídeo", share: 0.12 },
  { id: "2000000000005", campaign: 2, name: "LAL 1% compradores", share: 0.18 },
] as const;

const ADS = [
  { id: "3000000000001", adset: 0, name: "Criativo A — Depoimento", share: 0.2 },
  { id: "3000000000002", adset: 0, name: "Criativo B — VSL curta", share: 0.14 },
  { id: "3000000000003", adset: 1, name: "Criativo C — Carrossel", share: 0.13 },
  { id: "3000000000004", adset: 1, name: "Criativo D — Estático", share: 0.09 },
  { id: "3000000000005", adset: 2, name: "Criativo E — Prova social", share: 0.12 },
  { id: "3000000000006", adset: 3, name: "Criativo F — Oferta", share: 0.12 },
  { id: "3000000000007", adset: 4, name: "Criativo G — UGC", share: 0.11 },
  { id: "3000000000008", adset: 4, name: "Criativo H — Reels", share: 0.09 },
] as const;

const GEO = [
  { country: "BR", region: "SP", city: "São Paulo", share: 0.34 },
  { country: "BR", region: "RJ", city: "Rio de Janeiro", share: 0.16 },
  { country: "BR", region: "MG", city: "Belo Horizonte", share: 0.11 },
  { country: "BR", region: "PR", city: "Curitiba", share: 0.09 },
  { country: "BR", region: "RS", city: "Porto Alegre", share: 0.07 },
  { country: "BR", region: "BA", city: "Salvador", share: 0.06 },
  { country: "BR", region: "DF", city: "Brasília", share: 0.05 },
  { country: "BR", region: "CE", city: "Fortaleza", share: 0.04 },
  { country: "PT", region: "Lisboa", city: "Lisboa", share: 0.04 },
  { country: "US", region: "FL", city: "Orlando", share: 0.02 },
  { country: "AO", region: "Luanda", city: "Luanda", share: 0.02 },
] as const;

const PAYMENTS = [
  { key: "pix", label: "Pix", share: 0.48 },
  { key: "cartao", label: "Cartão", share: 0.4 },
  { key: "boleto", label: "Boleto", share: 0.09 },
  { key: "outros", label: "Outros", share: 0.03 },
] as const;

const PAGES = [
  { path: "/", share: 0.34 },
  { path: "/vsl", share: 0.27 },
  { path: "/aula-1", share: 0.14 },
  { path: "/checkout", share: 0.13 },
  { path: "/obrigado", share: 0.07 },
  { path: "/politica-de-privacidade", share: 0.05 },
] as const;

/** Escolhe um item de uma lista de shares a partir de um número em [0,1). */
function weighted<T extends { share: number }>(items: readonly T[], r: number): T {
  let acc = 0;
  for (const it of items) {
    acc += it.share;
    if (r < acc) return it;
  }
  return items[items.length - 1];
}

/** Anúncio que realmente pertence ao conjunto — a árvore precisa fechar. */
function adOf(adset: (typeof ADSETS)[number], rnd: () => number) {
  const own = ADS.filter((a) => a.adset === ADSETS.indexOf(adset));
  return own.length > 0 ? pick(rnd, own) : pick(rnd, ADS);
}

// ── métricas base por dia ────────────────────────────────────────────────────
interface DayBase {
  day: string;
  weight: number;
  start: number;
  visitors: number;
  pageviews: number;
  checkouts: number;
  orders: number;
  spend: number;
  clicks: number;
  rnd: () => number;
}

function dayBase(d: DemoDay): DayBase {
  const rnd = mulberry32(seedFrom(`demo:${d.day}`));
  const visitors = Math.round(between(rnd, 620, 1480) * d.weight);
  const pageviews = Math.round(visitors * between(rnd, 1.5, 2.1));
  const checkouts = Math.round(visitors * between(rnd, 0.07, 0.12));
  const orders = Math.max(0, Math.round(checkouts * between(rnd, 0.16, 0.3)));
  const clicks = Math.round(visitors * between(rnd, 1.05, 1.35));
  // CPC entre R$ 2,20 e R$ 4,20 mantém o ROAS da demonstração no terreno
  // realista (algo entre 1,8x e 3,5x) em vez de números de vitrine.
  const spend = Math.round(clicks * between(rnd, 2.2, 4.2) * 100) / 100;
  return {
    day: d.day,
    weight: d.weight,
    start: d.start,
    visitors,
    pageviews,
    checkouts,
    orders,
    spend,
    clicks,
    rnd,
  };
}

// ── compras fictícias (fonte de verdade dos agregados de receita) ────────────
export interface DemoPurchase {
  id: string;
  transaction_id: string;
  created_at: string;
  day: string;
  email: string;
  product: string;
  value: number;
  status: string;
  payment: (typeof PAYMENTS)[number];
  geo: (typeof GEO)[number];
  campaign: (typeof CAMPAIGNS)[number];
  adset: (typeof ADSETS)[number];
  ad: (typeof ADS)[number];
  trck_user_id: string;
  matched: boolean;
  match_reason: string;
}

const STATUSES = [
  { value: "approved", share: 0.82 },
  { value: "waiting_payment", share: 0.11 },
  { value: "refunded", share: 0.07 },
] as const;

const isRefund = (s: string) => /refund|chargeback|cancel|dispute|reembols/i.test(s);
const isPending = (s: string) => /pending|waiting|aguard|billet|open|created/i.test(s);

function buildPurchases(days: DemoDay[]): DemoPurchase[] {
  const out: DemoPurchase[] = [];
  for (const d of days) {
    const base = dayBase(d);
    const rnd = mulberry32(seedFrom(`demo:purchases:${d.day}`));
    for (let i = 0; i < base.orders; i++) {
      const product = weighted(PRODUCTS, rnd());
      const status = weighted(STATUSES, rnd()).value;
      const geo = weighted(GEO, rnd());
      const payment = weighted(PAYMENTS, rnd());
      const adset = weighted(ADSETS, rnd());
      const ad = adOf(adset, rnd);
      const campaign = CAMPAIGNS[adset.campaign];
      // hora do dia dentro da fatia coberta (deixa a ordenação plausível)
      const at = new Date(
        d.start + Math.floor(between(rnd, 0.28, 0.99) * DAY_MS * d.weight),
      );
      const n = out.length + 1;
      out.push({
        id: `demo-${d.day}-${i}`,
        transaction_id: `DEMO-${d.day.replace(/-/g, "")}-${String(i).padStart(3, "0")}`,
        created_at: at.toISOString(),
        day: d.day,
        email: `comprador${String(n).padStart(3, "0")}@exemplo.com`,
        product: product.name,
        value: product.price,
        status,
        payment,
        geo,
        campaign,
        adset,
        ad,
        trck_user_id: `demo-visitor-${String(n).padStart(4, "0")}`,
        matched: rnd() > 0.08,
        match_reason: pick(rnd, ["trck_user_id", "email", "telefone"]),
      });
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

interface DemoSet {
  days: DayBase[];
  purchases: DemoPurchase[];
  paid: DemoPurchase[];
  visitors: number;
  pageviews: number;
  checkouts: number;
  clicks: number;
  spend: number;
  revenue: number;
}

/** Monta (e memoiza por período) todo o conjunto fictício. */
const cache = new Map<string, DemoSet>();
function demoSet(range: DateRange): DemoSet {
  const key = `${range.key}|${range.from ?? ""}|${range.to}`.slice(0, 80);
  const hit = cache.get(key);
  if (hit) return hit;

  const days = demoDays(range).map(dayBase);
  const purchases = buildPurchases(demoDays(range));
  const paid = purchases.filter((p) => !isRefund(p.status));
  const set: DemoSet = {
    days,
    purchases,
    paid,
    visitors: days.reduce((s, d) => s + d.visitors, 0),
    pageviews: days.reduce((s, d) => s + d.pageviews, 0),
    checkouts: days.reduce((s, d) => s + d.checkouts, 0),
    clicks: days.reduce((s, d) => s + d.clicks, 0),
    spend: days.reduce((s, d) => s + d.spend, 0),
    revenue: paid.reduce((s, p) => s + p.value, 0),
  };
  if (cache.size > 24) cache.clear(); // memória previsível entre requests
  cache.set(key, set);
  return set;
}

// ── contagens de eventos ─────────────────────────────────────────────────────
function eventCounts(s: DemoSet): { name: string; total: number }[] {
  const rnd = mulberry32(seedFrom(`demo:events:${s.visitors}`));
  const lead = Math.round(s.visitors * between(rnd, 0.08, 0.16));
  const viewContent = Math.round(s.visitors * between(rnd, 0.42, 0.62));
  return [
    { name: "PageView", total: s.pageviews },
    { name: "ViewContent", total: viewContent },
    { name: "Lead", total: lead },
    { name: "InitiateCheckout", total: s.checkouts },
    { name: "Purchase", total: s.paid.length },
  ].sort((a, b) => b.total - a.total);
}

// ── agregados expostos ao painel ─────────────────────────────────────────────
export function overview(range: DateRange): Overview {
  const s = demoSet(range);
  const events = eventCounts(s).reduce((sum, e) => sum + e.total, 0);
  const purchases = s.paid.length;
  const revenue = s.revenue;
  return {
    visitors: s.visitors,
    events,
    purchases,
    revenue,
    avgTicket: purchases > 0 ? revenue / purchases : 0,
    conversion: s.visitors > 0 ? purchases / s.visitors : 0,
    funnel: {
      visited: s.visitors,
      checkout: s.checkouts,
      purchased: purchases,
    },
  };
}

export function funnel(range: DateRange): FunnelCounts {
  const s = demoSet(range);
  return {
    pageviews: Math.round(s.visitors * 0.94),
    ics: s.checkouts,
    salesInit: s.purchases.length,
    salesApproved: s.paid.filter((p) => !isPending(p.status)).length,
  };
}

export function salesStatus(range: DateRange): SalesStatus {
  const s = demoSet(range);
  let pending = 0;
  let pendingValue = 0;
  let refunded = 0;
  let refundedValue = 0;
  for (const p of s.purchases) {
    if (isRefund(p.status)) {
      refunded++;
      refundedValue += p.value;
    } else if (isPending(p.status)) {
      pending++;
      pendingValue += p.value;
    }
  }
  return { pending, pendingValue, refunded, refundedValue };
}

export function salesByCountry(range: DateRange): SalesGeo {
  const s = demoSet(range);
  const m = new Map<string, number>();
  for (const p of s.paid) {
    m.set(p.geo.country, (m.get(p.geo.country) ?? 0) + 1);
  }
  return {
    countries: [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    total: s.paid.length,
    noCountry: 0,
  };
}

export function salesBreakdown(range: DateRange): SalesBreakdown {
  const s = demoSet(range);
  const payMap = new Map<string, SalesSlice>();
  const prodMap = new Map<string, SalesSlice>();
  let totalRevenue = 0;

  for (const p of s.paid) {
    totalRevenue += p.value;
    const pay = payMap.get(p.payment.key) ?? {
      key: p.payment.key,
      label: p.payment.label,
      count: 0,
      revenue: 0,
    };
    pay.count++;
    pay.revenue += p.value;
    payMap.set(p.payment.key, pay);

    const pk = p.product.toLowerCase();
    const prod = prodMap.get(pk) ?? {
      key: pk,
      label: p.product,
      count: 0,
      revenue: 0,
    };
    prod.count++;
    prod.revenue += p.value;
    prodMap.set(pk, prod);
  }

  return {
    total: s.paid.length,
    totalRevenue,
    byPayment: PAYMENTS.map((p) => payMap.get(p.key)).filter(
      Boolean,
    ) as SalesSlice[],
    byProduct: [...prodMap.values()].sort((a, b) => b.revenue - a.revenue),
  };
}

export function eventsByType(range: DateRange): EventTypeRow[] {
  return eventCounts(demoSet(range)).map((e) => ({
    event_name: e.name,
    total: e.total,
  }));
}

export function revenueDaily(range: DateRange): RevenueDay[] {
  const s = demoSet(range);
  const map = new Map<string, { revenue: number; orders: number }>();
  for (const p of s.paid) {
    const cur = map.get(p.day) ?? { revenue: 0, orders: 0 };
    cur.revenue += p.value;
    cur.orders += 1;
    map.set(p.day, cur);
  }
  return s.days.map((d) => ({
    day: d.day,
    revenue: map.get(d.day)?.revenue ?? 0,
    orders: map.get(d.day)?.orders ?? 0,
  }));
}

export function faturamento(range: DateRange): Faturamento {
  const s = demoSet(range);
  const refunded = s.purchases.filter((p) => isRefund(p.status));
  const revenue = s.revenue;
  return {
    revenue,
    orders: s.paid.length,
    avgTicket: s.paid.length ? revenue / s.paid.length : 0,
    refunds: refunded.length,
    refundValue: refunded.reduce((sum, p) => sum + p.value, 0),
  };
}

export function purchasesList(
  range: DateRange,
  limit = 100,
  product?: string,
): PurchaseRow[] {
  const s = demoSet(range);
  return s.purchases
    .filter((p) => !product || p.product === product)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      transaction_id: p.transaction_id,
      created_at: p.created_at,
      email: p.email,
      product_name: p.product,
      value: p.value,
      currency: "BRL",
      status: p.status,
      matched: p.matched,
      match_reason: p.matched ? p.match_reason : null,
      utm_source: "facebook",
      utm_campaign: p.campaign.name,
    }));
}

export function productOptions(range: DateRange): string[] {
  const s = demoSet(range);
  return [...new Set(s.purchases.map((p) => p.product))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function geo(range: DateRange): GeoBreakdown {
  const s = demoSet(range);
  const bucket = (getKey: (g: (typeof GEO)[number]) => string) => {
    const m = new Map<string, number>();
    for (const g of GEO) {
      const k = getKey(g);
      m.set(k, (m.get(k) ?? 0) + Math.round(s.visitors * g.share));
    }
    return [...m.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  };
  return {
    countries: bucket((g) => g.country),
    regions: bucket((g) => g.region),
    cities: bucket((g) => g.city),
    total: s.visitors,
  };
}

export function pages(range: DateRange): PageRow[] {
  const s = demoSet(range);
  return PAGES.map((pg) => {
    const views = Math.round(s.pageviews * pg.share);
    const users = Math.round(views / 1.7);
    const isCheckout = pg.path === "/checkout" || pg.path === "/vsl";
    const checkouts = isCheckout
      ? Math.round(s.checkouts * (pg.path === "/checkout" ? 0.72 : 0.28))
      : 0;
    const purchases = isCheckout
      ? Math.round(s.paid.length * (pg.path === "/checkout" ? 0.72 : 0.28))
      : 0;
    return {
      page: pg.path,
      views,
      users,
      checkouts,
      purchases,
      conversion: users > 0 ? purchases / users : 0,
    };
  }).sort((a, b) => b.views - a.views);
}

/** Amostra de eventos para a tabela (o total vem das contagens agregadas). */
export function events(
  range: DateRange,
  opts: { eventName?: string | null; page?: number; pageSize?: number },
): { rows: EventLogRow[]; total: number; pageSize: number; page: number } {
  const s = demoSet(range);
  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(opts.page ?? 0, 0);
  const counts = eventCounts(s);
  const total = opts.eventName
    ? (counts.find((c) => c.name === opts.eventName)?.total ?? 0)
    : counts.reduce((sum, c) => sum + c.total, 0);

  const names = opts.eventName ? [opts.eventName] : counts.map((c) => c.name);
  const spanMs = Math.max(1, new Date(range.to).getTime() - (s.days[0]?.start ?? 0));
  const rows: EventLogRow[] = [];
  const start = page * pageSize;
  for (let i = 0; i < Math.min(pageSize, Math.max(0, total - start)); i++) {
    const idx = start + i;
    const rnd = mulberry32(seedFrom(`demo:event:${range.to.slice(0, 13)}:${idx}`));
    const name = names[idx % names.length];
    const g = weighted(GEO, rnd());
    const adset = weighted(ADSETS, rnd());
    const at = new Date(new Date(range.to).getTime() - (idx + 1) * (spanMs / (total || 1)));
    rows.push({
      id: `demo-event-${idx}`,
      created_at: at.toISOString(),
      event_name: name,
      event_id: `demo-${idx.toString(36)}-${Math.floor(rnd() * 1e6).toString(36)}`,
      trck_user_id: `demo-visitor-${String((idx % 400) + 1).padStart(4, "0")}`,
      utm_source: "facebook",
      utm_medium: "cpc",
      utm_campaign: CAMPAIGNS[adset.campaign].name,
      utm_term: adset.name,
      utm_content: adOf(adset, rnd).name,
      geo_country: g.country,
      geo_region: g.region,
      geo_city: g.city,
      payload_meta: [
        {
          pixel: "123456789012345",
          event_name: name,
          action_source: "website",
          user_data: { em: "<sha256>", client_ip_address: "203.0.113.10" },
        },
      ],
      response_meta: [
        { pixel: "123456789012345", ok: true, events_received: 1, fbtrace_id: "DEMO" },
      ],
      payload_ga4: null,
      response_ga4: null,
    });
  }
  return { rows, total, pageSize, page };
}

// ── detalhes abertos pelos modais (evento, jornada, venda) ──────────────────
const JOURNEY_SCRIPT = [
  { event: "PageView", page: "/" },
  { event: "ViewContent", page: "/vsl" },
  { event: "Lead", page: "/vsl" },
  { event: "PageView", page: "/checkout" },
  { event: "InitiateCheckout", page: "/checkout" },
  { event: "Purchase", page: "/obrigado" },
] as const;

/** Jornada fictícia de um visitante (cronológica, ~2 dias antes de agora). */
export function journey(trckUserId: string): JourneyEvent[] {
  const rnd = mulberry32(seedFrom(`demo:journey:${trckUserId}`));
  const adset = weighted(ADSETS, rnd());
  const campaign = CAMPAIGNS[adset.campaign];
  const g = weighted(GEO, rnd());
  const base = Date.now() - 2 * DAY_MS;
  return JOURNEY_SCRIPT.map((step, i) => ({
    id: `${trckUserId}-j${i}`,
    created_at: new Date(base + i * 7 * 60_000).toISOString(),
    event_name: step.event,
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: campaign.name,
    utm_term: adset.name,
    utm_content: pick(rnd, ADS).name,
    geo_country: g.country,
    geo_region: g.region,
    geo_city: g.city,
  }));
}

/** Um evento fictício completo (payload/resposta) para o modal de detalhe. */
export function eventDetail(id: string): EventLogRow {
  const rnd = mulberry32(seedFrom(`demo:detail:${id}`));
  const adset = weighted(ADSETS, rnd());
  const g = weighted(GEO, rnd());
  const name = pick(rnd, [
    "PageView",
    "ViewContent",
    "Lead",
    "InitiateCheckout",
    "Purchase",
  ]);
  return {
    id,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    event_name: name,
    event_id: `demo-${id}`,
    trck_user_id: `demo-visitor-0001`,
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: CAMPAIGNS[adset.campaign].name,
    utm_term: adset.name,
    utm_content: adOf(adset, rnd).name,
    geo_country: g.country,
    geo_region: g.region,
    geo_city: g.city,
    payload_meta: [
      {
        pixel: "123456789012345",
        data: [
          {
            event_name: name,
            event_id: `demo-${id}`,
            action_source: "website",
            event_source_url: "https://exemplo.com/checkout",
            user_data: {
              em: ["<sha256 do email>"],
              ph: ["<sha256 do telefone>"],
              client_ip_address: "203.0.113.10",
              client_user_agent: "Mozilla/5.0 (demonstração)",
              fbp: "fb.1.0000000000000.0000000000",
            },
          },
        ],
      },
    ],
    response_meta: [
      {
        pixel: "123456789012345",
        ok: true,
        events_received: 1,
        fbtrace_id: "DEMO-TRACE",
      },
    ],
    payload_ga4: null,
    response_ga4: null,
  };
}

export interface DemoSaleDetail {
  name: string | null;
  email: string | null;
  phone: string | null;
  trckUserId: string | null;
  products: BuyerPurchase[];
  journey: JourneyEvent[];
}

/** Detalhe fictício de uma venda (cliente + produtos + jornada). */
export function saleDetail(purchaseId: string): DemoSaleDetail {
  const rnd = mulberry32(seedFrom(`demo:sale:${purchaseId}`));
  const main = weighted(PRODUCTS, rnd());
  const bump = PRODUCTS[1];
  const trckUserId = `demo-visitor-${String(Math.floor(rnd() * 400) + 1).padStart(4, "0")}`;
  const at = new Date(Date.now() - 3600_000).toISOString();
  return {
    name: "Cliente de Demonstração",
    email: "cliente@exemplo.com",
    phone: "+55 11 90000-0000",
    trckUserId,
    products: [
      {
        id: `${purchaseId}-1`,
        created_at: at,
        product_name: main.name,
        value: main.price,
        currency: "BRL",
        status: "approved",
      },
      {
        id: `${purchaseId}-2`,
        created_at: at,
        product_name: bump.name,
        value: bump.price,
        currency: "BRL",
        status: "approved",
      },
    ],
    journey: journey(trckUserId),
  };
}

// ── Meta Ads (gasto/cliques/campanhas) ───────────────────────────────────────
export function totalSpend(range: DateRange): { spend: number; ok: boolean } {
  return { spend: demoSet(range).spend, ok: true };
}

export function totalClicks(range: DateRange): { clicks: number; ok: boolean } {
  return { clicks: demoSet(range).clicks, ok: true };
}

export function dailySpendMap(range: DateRange): Map<string, number> {
  const s = demoSet(range);
  return new Map(s.days.map((d) => [d.day, d.spend]));
}

export function adNameMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of CAMPAIGNS) map[c.id] = c.name;
  for (const a of ADSETS) map[a.id] = a.name;
  for (const a of ADS) map[a.id] = a.name;
  return map;
}

export interface DemoCampaigns {
  campaigns: ManagerRow[];
  adsets: ManagerRow[];
  ads: ManagerRow[];
  accounts: { id: string; label: string }[];
  currency: string;
}

export function campaigns(range: DateRange): DemoCampaigns {
  const s = demoSet(range);
  const revByCampaign = new Map<string, { revenue: number; orders: number }>();
  const revByAdset = new Map<string, { revenue: number; orders: number }>();
  const revByAd = new Map<string, { revenue: number; orders: number }>();
  const bump = (
    m: Map<string, { revenue: number; orders: number }>,
    k: string,
    v: number,
  ) => {
    const cur = m.get(k) ?? { revenue: 0, orders: 0 };
    cur.revenue += v;
    cur.orders += 1;
    m.set(k, cur);
  };
  for (const p of s.paid) {
    bump(revByCampaign, p.campaign.id, p.value);
    bump(revByAdset, p.adset.id, p.value);
    bump(revByAd, p.ad.id, p.value);
  }

  const row = (
    id: string,
    name: string,
    share: number,
    rev: Map<string, { revenue: number; orders: number }>,
    extra: Partial<ManagerRow>,
  ): ManagerRow => {
    const agg = rev.get(id) ?? { revenue: 0, orders: 0 };
    const rnd = mulberry32(seedFrom(`demo:ad:${id}`));
    return {
      id,
      name,
      status: rnd() > 0.25 ? "ACTIVE" : "PAUSED",
      effectiveStatus: "ACTIVE",
      adAccountDbId: "demo-ad-account",
      campaignId: null,
      adsetId: null,
      budgetType: null,
      budgetCents: null,
      spend: Math.round(s.spend * share * 100) / 100,
      revenue: agg.revenue,
      orders: agg.orders,
      assists: Math.round(agg.orders * between(rnd, 0.2, 0.8)),
      assistPaths: [],
      ...extra,
    };
  };

  return {
    campaigns: CAMPAIGNS.map((c) =>
      row(c.id, c.name, c.share, revByCampaign, {
        budgetType: "daily",
        budgetCents: Math.round(s.spend * c.share * 100) / Math.max(1, s.days.length),
      }),
    ).sort((a, b) => b.spend - a.spend),
    adsets: ADSETS.map((a) =>
      row(a.id, a.name, a.share, revByAdset, {
        campaignId: CAMPAIGNS[a.campaign].id,
        budgetType: "daily",
        budgetCents: Math.round(s.spend * a.share * 100) / Math.max(1, s.days.length),
      }),
    ).sort((a, b) => b.spend - a.spend),
    ads: ADS.map((a) =>
      row(a.id, a.name, a.share, revByAd, {
        campaignId: CAMPAIGNS[ADSETS[a.adset].campaign].id,
        adsetId: ADSETS[a.adset].id,
      }),
    ).sort((a, b) => b.spend - a.spend),
    accounts: [{ id: "demo-ad-account", label: "Conta de anúncio (exemplo)" }],
    currency: "BRL",
  };
}

// ── Configurações (contas de exemplo, sem segredo nenhum) ────────────────────
export interface DemoConfig {
  settings: {
    currency: string;
    test_event_code: string;
    webhook_token_mask: string | null;
    webhook_domain: string | null;
  };
  pixels: AccountRow[];
  ga4: AccountRow[];
  adaccounts: AccountRow[];
  products: ProductRow[];
}

export function config(): DemoConfig {
  const acc = (
    id: string,
    label: string,
    publicId: string,
    mask: string,
  ): AccountRow => ({ id, label, publicId, mask, is_active: true });

  return {
    settings: {
      currency: "BRL",
      test_event_code: "TEST00000",
      webhook_token_mask: "demo…0000",
      webhook_domain: "dados.seudominio.com",
    },
    pixels: [acc("demo-pixel", "Pixel principal (exemplo)", "123456789012345", "EAAG…demo")],
    ga4: [acc("demo-ga4", "Propriedade GA4 (exemplo)", "G-XXXXXXXXXX", "abcd…demo")],
    adaccounts: [
      acc("demo-ad-account", "Conta de anúncio (exemplo)", "act_1234567890", "EAAG…demo"),
    ],
    products: PRODUCTS.map((p, i) => ({
      key: `demo-produto-${i + 1}`,
      name: p.name,
      sales: Math.round(120 * p.share),
      revenue: Math.round(120 * p.share) * p.price,
      send_meta: p.name.includes("Upsell") ? false : true,
    })),
  };
}
