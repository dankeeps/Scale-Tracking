import "server-only";
import { unstable_cache } from "next/cache";
import {
  META_INSIGHTS_CACHE_TTL_SECONDS,
  metaEdgeUrl,
  metaInsightsUrl,
} from "@/lib/constants";

// Insights do Meta Ads (nível de anúncio) com CACHE agressivo (unstable_cache):
// as respostas ficam em cache por META_INSIGHTS_CACHE_TTL_SECONDS (30 min), o que
// espaça naturalmente as chamadas e evita abusar da API. Atualização sob demanda
// via revalidateTag("meta-insights").

export const META_INSIGHTS_TAG = "meta-insights";

export interface InsightRow {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  clicks: number;
  linkClicks: number;
}

export interface InsightsResult {
  ok: boolean;
  rows: InsightRow[];
  error?: string;
  fetchedAt: number;
}

async function fetchInsightsRaw(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<InsightsResult> {
  const rows: InsightRow[] = [];
  try {
    const base = new URL(metaInsightsUrl(adAccountId));
    base.searchParams.set("level", "ad");
    base.searchParams.set(
      "fields",
      "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,clicks,inline_link_clicks",
    );
    base.searchParams.set("time_range", JSON.stringify({ since, until }));
    base.searchParams.set("limit", "500");
    base.searchParams.set("access_token", token);

    let next: string | null = base.toString();
    let pages = 0;
    while (next && pages < 5) {
      const res: Response = await fetch(next);
      const json = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          rows,
          error: json?.error?.message ?? `HTTP ${res.status}`,
          fetchedAt: Date.now(),
        };
      }
      for (const d of json.data ?? []) {
        rows.push({
          campaign_id: d.campaign_id ?? "",
          campaign_name: d.campaign_name ?? "(sem nome)",
          adset_id: d.adset_id ?? "",
          adset_name: d.adset_name ?? "(sem nome)",
          ad_id: d.ad_id ?? "",
          ad_name: d.ad_name ?? "(sem nome)",
          spend: parseFloat(d.spend ?? "0") || 0,
          clicks: parseInt(d.clicks ?? "0", 10) || 0,
          linkClicks: parseInt(d.inline_link_clicks ?? "0", 10) || 0,
        });
      }
      next = json.paging?.next ?? null;
      pages++;
    }
    return { ok: true, rows, fetchedAt: Date.now() };
  } catch (e) {
    return {
      ok: false,
      rows,
      error: e instanceof Error ? e.message : String(e),
      fetchedAt: Date.now(),
    };
  }
}

/**
 * Versão com cache. O token NÃO entra na chave (fica no closure). Só respostas
 * de SUCESSO são cacheadas — em erro a função lança, então nada é gravado no
 * cache (evita "grudar" um erro por 30 min quando a causa já foi corrigida).
 */
export async function getInsights(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<InsightsResult> {
  const cached = unstable_cache(
    async () => {
      const r = await fetchInsightsRaw(adAccountId, token, since, until);
      if (!r.ok) throw new Error(r.error ?? "insights_error");
      return r;
    },
    [META_INSIGHTS_TAG, adAccountId, since, until],
    {
      revalidate: META_INSIGHTS_CACHE_TTL_SECONDS,
      tags: [META_INSIGHTS_TAG, `${META_INSIGHTS_TAG}:${adAccountId}`],
    },
  );
  try {
    return await cached();
  } catch (e) {
    return {
      ok: false,
      rows: [],
      error: e instanceof Error ? e.message : String(e),
      fetchedAt: Date.now(),
    };
  }
}

// ── gasto diário (para o gráfico de receita × investimento) ─────────────────

export interface DailySpend {
  day: string; // YYYY-MM-DD
  spend: number;
}

async function fetchDailySpendRaw(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<{ ok: boolean; rows: DailySpend[]; error?: string }> {
  const rows: DailySpend[] = [];
  try {
    const base = new URL(metaInsightsUrl(adAccountId));
    base.searchParams.set("level", "account");
    base.searchParams.set("fields", "spend");
    base.searchParams.set("time_range", JSON.stringify({ since, until }));
    base.searchParams.set("time_increment", "1"); // um registro por dia
    base.searchParams.set("limit", "500");
    base.searchParams.set("access_token", token);

    let next: string | null = base.toString();
    let pages = 0;
    while (next && pages < 5) {
      const res: Response = await fetch(next);
      const json = await res.json();
      if (!res.ok) {
        return { ok: false, rows, error: json?.error?.message ?? `HTTP ${res.status}` };
      }
      for (const d of json.data ?? []) {
        rows.push({ day: d.date_start, spend: parseFloat(d.spend ?? "0") || 0 });
      }
      next = json.paging?.next ?? null;
      pages++;
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, rows, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Gasto por dia (nível de conta), com o mesmo cache dos insights. */
export async function getDailySpend(
  adAccountId: string,
  token: string,
  since: string,
  until: string,
): Promise<DailySpend[]> {
  const cached = unstable_cache(
    async () => {
      const r = await fetchDailySpendRaw(adAccountId, token, since, until);
      if (!r.ok) throw new Error(r.error ?? "insights_error");
      return r.rows;
    },
    [META_INSIGHTS_TAG, "daily", adAccountId, since, until],
    {
      revalidate: META_INSIGHTS_CACHE_TTL_SECONDS,
      tags: [META_INSIGHTS_TAG, `${META_INSIGHTS_TAG}:${adAccountId}`],
    },
  );
  try {
    return await cached();
  } catch {
    return [];
  }
}

// ── objetos (campanha/conjunto/anúncio) com status e orçamento ──────────────

export interface AdObject {
  id: string;
  name: string;
  status: string; // ACTIVE / PAUSED / ARCHIVED ...
  effective_status: string;
  daily_budget: number | null; // centavos
  lifetime_budget: number | null; // centavos
  campaign_id: string | null; // conjuntos e anúncios
  adset_id: string | null; // anúncios
}

async function fetchEdgeRaw(
  adAccountId: string,
  token: string,
  edge: string,
  fields: string,
): Promise<{ ok: boolean; rows: AdObject[]; error?: string }> {
  const rows: AdObject[] = [];
  try {
    const base = new URL(metaEdgeUrl(adAccountId, edge));
    base.searchParams.set("fields", fields);
    base.searchParams.set("limit", "500");
    base.searchParams.set("access_token", token);

    let next: string | null = base.toString();
    let pages = 0;
    while (next && pages < 8) {
      const res: Response = await fetch(next);
      const json = await res.json();
      if (!res.ok) {
        return { ok: false, rows, error: json?.error?.message ?? `HTTP ${res.status}` };
      }
      for (const d of json.data ?? []) {
        rows.push({
          id: d.id,
          name: d.name ?? "(sem nome)",
          status: d.status ?? "",
          effective_status: d.effective_status ?? "",
          daily_budget: d.daily_budget != null ? Number(d.daily_budget) : null,
          lifetime_budget:
            d.lifetime_budget != null ? Number(d.lifetime_budget) : null,
          campaign_id: d.campaign_id ?? null,
          adset_id: d.adset_id ?? null,
        });
      }
      next = json.paging?.next ?? null;
      pages++;
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, rows, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lista objetos de uma borda (campaigns/adsets/ads), com o cache dos insights. */
async function getEdge(
  adAccountId: string,
  token: string,
  edge: string,
  fields: string,
): Promise<AdObject[]> {
  const cached = unstable_cache(
    async () => {
      const r = await fetchEdgeRaw(adAccountId, token, edge, fields);
      if (!r.ok) throw new Error(r.error ?? "meta_error");
      return r.rows;
    },
    [META_INSIGHTS_TAG, "edge", edge, adAccountId],
    {
      revalidate: META_INSIGHTS_CACHE_TTL_SECONDS,
      tags: [META_INSIGHTS_TAG, `${META_INSIGHTS_TAG}:${adAccountId}`],
    },
  );
  try {
    return await cached();
  } catch {
    return [];
  }
}

const CAMPAIGN_FIELDS =
  "id,name,status,effective_status,daily_budget,lifetime_budget";
const ADSET_FIELDS =
  "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget";
const AD_FIELDS = "id,name,adset_id,campaign_id,status,effective_status";

export const getCampaigns = (id: string, token: string) =>
  getEdge(id, token, "campaigns", CAMPAIGN_FIELDS);
export const getAdSets = (id: string, token: string) =>
  getEdge(id, token, "adsets", ADSET_FIELDS);
export const getAds = (id: string, token: string) =>
  getEdge(id, token, "ads", AD_FIELDS);
