import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as demo from "@/lib/demo/data";
import { IS_DEMO } from "@/lib/demo/mode";
import * as q from "@/lib/dashboard/queries";
import type { DateRange } from "@/lib/dashboard/range";
import * as spend from "@/lib/dashboard/spend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Fonte de dados do painel — o ÚNICO lugar que sabe se estamos em modo
 * demonstração. As páginas chamam sempre daqui: com Supabase configurado cai em
 * `queries.ts`/`spend.ts` (dados reais, sob RLS); sem Supabase, devolve o
 * conjunto fictício de `@/lib/demo/data`.
 */

export interface Source {
  /** Cliente autenticado (RLS). `null` = modo demonstração. */
  db: SupabaseClient | null;
  /** Cliente service_role (Meta Ads). `null` = modo demonstração. */
  admin: SupabaseClient | null;
  demo: boolean;
}

/** Cria os clientes uma única vez por página. */
export async function getSource(): Promise<Source> {
  if (IS_DEMO) return { db: null, admin: null, demo: true };
  return { db: await createClient(), admin: createAdminClient(), demo: false };
}

// ── agregados do banco ───────────────────────────────────────────────────────
export const getOverview = (s: Source, r: DateRange) =>
  s.db ? q.getOverview(s.db, r) : Promise.resolve(demo.overview(r));

export const getFunnel = (s: Source, r: DateRange) =>
  s.db ? q.getFunnel(s.db, r) : Promise.resolve(demo.funnel(r));

export const getSalesStatusCounts = (s: Source, r: DateRange) =>
  s.db ? q.getSalesStatusCounts(s.db, r) : Promise.resolve(demo.salesStatus(r));

export const getSalesByCountry = (s: Source, r: DateRange) =>
  s.db ? q.getSalesByCountry(s.db, r) : Promise.resolve(demo.salesByCountry(r));

export const getSalesBreakdown = (s: Source, r: DateRange) =>
  s.db ? q.getSalesBreakdown(s.db, r) : Promise.resolve(demo.salesBreakdown(r));

export const getEventsByType = (s: Source, r: DateRange) =>
  s.db ? q.getEventsByType(s.db, r) : Promise.resolve(demo.eventsByType(r));

export const getRevenueDaily = (s: Source, r: DateRange) =>
  s.db ? q.getRevenueDaily(s.db, r) : Promise.resolve(demo.revenueDaily(r));

export const getFaturamento = (s: Source, r: DateRange) =>
  s.db ? q.getFaturamento(s.db, r) : Promise.resolve(demo.faturamento(r));

export const getPurchasesList = (
  s: Source,
  r: DateRange,
  limit = 100,
  product?: string,
) =>
  s.db
    ? q.getPurchasesList(s.db, r, limit, product)
    : Promise.resolve(demo.purchasesList(r, limit, product));

export const getProductOptions = (s: Source, r: DateRange) =>
  s.db ? q.getProductOptions(s.db, r) : Promise.resolve(demo.productOptions(r));

export const getGeo = (s: Source, r: DateRange) =>
  s.db ? q.getGeo(s.db, r) : Promise.resolve(demo.geo(r));

export const getPages = (s: Source, r: DateRange) =>
  s.db ? q.getPages(s.db, r) : Promise.resolve(demo.pages(r));

export const getEvents = (
  s: Source,
  opts: {
    range: DateRange;
    eventName?: string | null;
    page?: number;
    pageSize?: number;
  },
) => (s.db ? q.getEvents(s.db, opts) : Promise.resolve(demo.events(opts.range, opts)));

// ── Meta Ads ─────────────────────────────────────────────────────────────────
export const getTotalSpend = (s: Source, r: DateRange) =>
  s.admin ? spend.getTotalSpend(s.admin, r) : Promise.resolve(demo.totalSpend(r));

export const getTotalClicks = (s: Source, r: DateRange) =>
  s.admin ? spend.getTotalClicks(s.admin, r) : Promise.resolve(demo.totalClicks(r));

export const getDailySpendMap = (s: Source, r: DateRange) =>
  s.admin
    ? spend.getDailySpendMap(s.admin, r)
    : Promise.resolve(demo.dailySpendMap(r));

export const getAdNameMap = (s: Source, r: DateRange) =>
  s.admin ? spend.getAdNameMap(s.admin, r) : Promise.resolve(demo.adNameMap());
