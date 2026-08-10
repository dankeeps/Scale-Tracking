import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { DateRange } from "@/lib/dashboard/range";
import { getActiveAdAccounts } from "@/lib/dispatch/accounts";
import { getDailySpend, getInsights } from "@/lib/dispatch/meta-ads";

/**
 * Contas de anúncio ativas, memoizadas por request. Sem isto, cada agregado da
 * Visão geral (gasto, cliques, gasto diário, nomes) releria a tabela e chamaria
 * a RPC `decrypt_secret` uma vez por conta — quatro vezes na mesma página.
 */
export const listAdAccounts = cache((admin: SupabaseClient) =>
  getActiveAdAccounts(admin),
);

/** Datas YYYY-MM-DD do período (mesma regra da aba Campanhas: `to` exclusivo). */
export function rangeToSinceUntil(range: DateRange): {
  since: string;
  until: string;
} {
  const until = new Date(new Date(range.to).getTime() - 1000)
    .toISOString()
    .slice(0, 10);
  const since = (
    range.from ??
    new Date(new Date(range.to).getTime() - 90 * 86400_000).toISOString()
  ).slice(0, 10);
  return { since, until };
}

/**
 * Gasto total do Meta Ads no período (soma de todas as contas ativas). Usa o
 * cache do getInsights (~30 min). `ok=false` se alguma conta falhar — o gasto
 * retorna o que deu certo.
 */
export async function getTotalSpend(
  admin: SupabaseClient,
  range: DateRange,
): Promise<{ spend: number; ok: boolean }> {
  const accounts = await listAdAccounts(admin);
  if (accounts.length === 0) return { spend: 0, ok: true };

  const { since, until } = rangeToSinceUntil(range);
  const results = await Promise.all(
    accounts.map((a) => getInsights(a.ad_account_id, a.token, since, until)),
  );
  const spend = results.reduce(
    (sum, r) => sum + r.rows.reduce((s, row) => s + row.spend, 0),
    0,
  );
  const ok = results.every((r) => r.ok);
  return { spend, ok };
}

/**
 * Cliques totais do Meta Ads no período (todas as contas ativas). Usa cliques em
 * link (`inline_link_clicks`) quando houver — é o que leva à página; senão, o
 * total de cliques. Reusa o cache de getInsights (sem custo extra de API).
 */
export async function getTotalClicks(
  admin: SupabaseClient,
  range: DateRange,
): Promise<{ clicks: number; ok: boolean }> {
  const accounts = await listAdAccounts(admin);
  if (accounts.length === 0) return { clicks: 0, ok: true };

  const { since, until } = rangeToSinceUntil(range);
  const results = await Promise.all(
    accounts.map((a) => getInsights(a.ad_account_id, a.token, since, until)),
  );
  const clicks = results.reduce(
    (sum, r) =>
      sum +
      r.rows.reduce((s, row) => s + (row.linkClicks || row.clicks), 0),
    0,
  );
  const ok = results.every((r) => r.ok);
  return { clicks, ok };
}

/**
 * Mapa ID → nome de campanha/conjunto/anúncio (dos insights do Meta), para
 * traduzir os UTMs que chegam como ID nos eventos. Reusa o cache de insights.
 */
export async function getAdNameMap(
  admin: SupabaseClient,
  range: DateRange,
): Promise<Record<string, string>> {
  const accounts = await listAdAccounts(admin);
  if (accounts.length === 0) return {};

  const { since, until } = rangeToSinceUntil(range);
  const results = await Promise.all(
    accounts.map((a) => getInsights(a.ad_account_id, a.token, since, until)),
  );
  const map: Record<string, string> = {};
  for (const r of results) {
    for (const row of r.rows) {
      if (row.campaign_id) map[row.campaign_id] = row.campaign_name;
      if (row.adset_id) map[row.adset_id] = row.adset_name;
      if (row.ad_id) map[row.ad_id] = row.ad_name;
    }
  }
  return map;
}

/** Gasto por dia (YYYY-MM-DD → total), somando todas as contas ativas. */
export async function getDailySpendMap(
  admin: SupabaseClient,
  range: DateRange,
): Promise<Map<string, number>> {
  const accounts = await listAdAccounts(admin);
  const map = new Map<string, number>();
  if (accounts.length === 0) return map;

  const { since, until } = rangeToSinceUntil(range);
  const results = await Promise.all(
    accounts.map((a) => getDailySpend(a.ad_account_id, a.token, since, until)),
  );
  for (const rows of results) {
    for (const r of rows) map.set(r.day, (map.get(r.day) ?? 0) + r.spend);
  }
  return map;
}
