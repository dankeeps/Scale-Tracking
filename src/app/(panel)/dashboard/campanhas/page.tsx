import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { AccountFilter } from "@/components/dashboard/account-filter";
import {
  CampaignsManager,
  type ManagerRow,
} from "@/components/dashboard/campaigns-manager";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type AssistMaps, getAssists } from "@/lib/dashboard/assists";
import { getSource, type Source } from "@/lib/dashboard/data";
import {
  getRevenueUtmMaps,
  type RevenueUtmMaps,
  type UtmAgg,
} from "@/lib/dashboard/queries";
import { parseRange, type DateRange } from "@/lib/dashboard/range";
import { listAdAccounts } from "@/lib/dashboard/spend";
import * as demo from "@/lib/demo/data";
import {
  type AdObject,
  getAds,
  getAdSets,
  getCampaigns,
  getInsights,
} from "@/lib/dispatch/meta-ads";
import { formatCurrency } from "@/lib/format";
import { refreshInsights } from "./actions";

export const dynamic = "force-dynamic";

const ZERO: UtmAgg = { revenue: 0, orders: 0 };
const lookup = (m: Map<string, UtmAgg>, name: string, id: string): UtmAgg =>
  m.get(name.toLowerCase()) ?? m.get(id.toLowerCase()) ?? ZERO;

function budgetOf(o: AdObject): Pick<ManagerRow, "budgetType" | "budgetCents"> {
  if (o.daily_budget != null && o.daily_budget > 0)
    return { budgetType: "daily", budgetCents: o.daily_budget };
  if (o.lifetime_budget != null && o.lifetime_budget > 0)
    return { budgetType: "lifetime", budgetCents: o.lifetime_budget };
  return { budgetType: null, budgetCents: null };
}

const isArchived = (o: AdObject) =>
  /ARCHIVED|DELETED/.test(o.effective_status.toUpperCase());

interface CampaignsData {
  accounts: { id: string; label: string }[];
  campaigns: ManagerRow[];
  adsets: ManagerRow[];
  ads: ManagerRow[];
  currency: string;
  errors: string[];
}

/** Monta o gerenciador: objetos do Meta × receita atribuída por UTM. */
async function loadCampaigns(
  src: Source,
  range: DateRange,
  accountParam: string,
): Promise<CampaignsData | null> {
  if (src.demo || !src.db || !src.admin) {
    const d = demo.campaigns(range);
    return { ...d, errors: [] };
  }

  const all = await listAdAccounts(src.admin);
  if (all.length === 0) return null;

  const selected =
    accountParam === "all" ? all : all.filter((a) => a.id === accountParam);

  const until = new Date(new Date(range.to).getTime() - 1000)
    .toISOString()
    .slice(0, 10);
  const since = (
    range.from ??
    new Date(new Date(range.to).getTime() - 90 * 86400_000).toISOString()
  ).slice(0, 10);

  const [perAccount, rev, settingsRes] = await Promise.all([
    Promise.all(
      selected.map(async (a) => {
        const [campaigns, adsets, ads, insights] = await Promise.all([
          getCampaigns(a.ad_account_id, a.token),
          getAdSets(a.ad_account_id, a.token),
          getAds(a.ad_account_id, a.token),
          getInsights(a.ad_account_id, a.token, since, until),
        ]);
        return { account: a, campaigns, adsets, ads, insights };
      }),
    ),
    getRevenueUtmMaps(src.db, range) as Promise<RevenueUtmMaps>,
    src.db.from("settings").select("currency").eq("id", 1).single(),
  ]);

  const currency = settingsRes.data?.currency ?? "BRL";
  const errors = perAccount
    .map((p) => (p.insights.ok ? null : `${p.account.label}: ${p.insights.error}`))
    .filter(Boolean) as string[];

  // Gasto agregado por id (campanha/conjunto/anúncio) a partir dos insights.
  const campSpend = new Map<string, number>();
  const adsetSpend = new Map<string, number>();
  const adSpend = new Map<string, number>();
  for (const p of perAccount) {
    for (const r of p.insights.rows) {
      campSpend.set(r.campaign_id, (campSpend.get(r.campaign_id) ?? 0) + r.spend);
      adsetSpend.set(r.adset_id, (adsetSpend.get(r.adset_id) ?? 0) + r.spend);
      adSpend.set(r.ad_id, (adSpend.get(r.ad_id) ?? 0) + r.spend);
    }
  }

  // Nomes (id → nome) de TODOS os objetos, para resolver os toques da jornada.
  const nameMap: Record<string, string> = {};
  for (const p of perAccount) {
    for (const o of [...p.campaigns, ...p.adsets, ...p.ads]) {
      nameMap[o.id] = o.name;
    }
  }
  const assists = await getAssists(src.db, range, nameMap);
  const EMPTY_A = { assists: 0, assistPaths: [] as ManagerRow["assistPaths"] };
  const assistOf = (m: AssistMaps[keyof AssistMaps], name: string, id: string) => {
    const a = m.get(name.toLowerCase()) ?? m.get(id.toLowerCase());
    return a ? { assists: a.count, assistPaths: a.paths } : EMPTY_A;
  };

  const campaigns: ManagerRow[] = [];
  const adsets: ManagerRow[] = [];
  const ads: ManagerRow[] = [];

  // Só entram objetos que TIVERAM investimento no período (spend > 0).
  for (const p of perAccount) {
    const acc = p.account.id;
    for (const o of p.campaigns) {
      if (isArchived(o)) continue;
      const spend = campSpend.get(o.id) ?? 0;
      if (spend <= 0) continue;
      const agg = lookup(rev.campaigns, o.name, o.id);
      campaigns.push({
        id: o.id,
        name: o.name,
        status: o.status,
        effectiveStatus: o.effective_status,
        adAccountDbId: acc,
        campaignId: null,
        adsetId: null,
        ...budgetOf(o),
        spend,
        revenue: agg.revenue,
        orders: agg.orders,
        ...assistOf(assists.campaigns, o.name, o.id),
      });
    }
    for (const o of p.adsets) {
      if (isArchived(o)) continue;
      const spend = adsetSpend.get(o.id) ?? 0;
      if (spend <= 0) continue;
      const agg = lookup(rev.adsets, o.name, o.id);
      adsets.push({
        id: o.id,
        name: o.name,
        status: o.status,
        effectiveStatus: o.effective_status,
        adAccountDbId: acc,
        campaignId: o.campaign_id,
        adsetId: null,
        ...budgetOf(o),
        spend,
        revenue: agg.revenue,
        orders: agg.orders,
        ...assistOf(assists.adsets, o.name, o.id),
      });
    }
    for (const o of p.ads) {
      if (isArchived(o)) continue;
      const spend = adSpend.get(o.id) ?? 0;
      if (spend <= 0) continue;
      const agg = lookup(rev.ads, o.name, o.id);
      ads.push({
        id: o.id,
        name: o.name,
        status: o.status,
        effectiveStatus: o.effective_status,
        adAccountDbId: acc,
        campaignId: o.campaign_id,
        adsetId: o.adset_id,
        budgetType: null,
        budgetCents: null,
        spend,
        revenue: agg.revenue,
        orders: agg.orders,
        ...assistOf(assists.ads, o.name, o.id),
      });
    }
  }

  const bySpend = (a: ManagerRow, b: ManagerRow) => b.spend - a.spend;
  campaigns.sort(bySpend);
  adsets.sort(bySpend);
  ads.sort(bySpend);

  return {
    accounts: all.map((a) => ({ id: a.id, label: a.label })),
    campaigns,
    adsets,
    ads,
    currency,
    errors,
  };
}

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    account?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range, sp.from, sp.to);
  const accountParam = sp.account ?? "all";

  const src = await getSource();
  const data = await loadCampaigns(src, range, accountParam);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Campanhas"
          description="Gerenciador de anúncios — Meta × receita do webhook."
        />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma conta de anúncio ativa. Cadastre em Configurações.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/config">Ir para Configurações</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const { accounts, campaigns, adsets, ads, currency, errors } = data;
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Gerenciador de anúncios — investido (Meta) × compras/ROAS (webhook)."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {accounts.length > 1 ? (
              <AccountFilter current={accountParam} accounts={accounts} />
            ) : null}
            <PeriodSelector current={range.key} />
            <form action={refreshInsights}>
              <Button variant="outline" size="sm" type="submit">
                <RefreshCw className="size-4" />
                Atualizar
              </Button>
            </form>
          </div>
        }
      />

      {errors.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>{errors.map((e) => <p key={e}>{e}</p>)}</div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Investido</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formatCurrency(totalSpend, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Receita atribuída</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formatCurrency(totalRevenue, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">ROAS geral</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {totalSpend > 0
                ? `${(totalRevenue / totalSpend).toFixed(2)}x`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <CampaignsManager
        campaigns={campaigns}
        adsets={adsets}
        ads={ads}
        currency={currency}
      />

      <p className="text-xs text-muted-foreground">
        Editar orçamento e ativar/pausar escrevem no Meta (exige token com
        <code> ads_management</code>). Compras/ROAS vêm do webhook, vinculados por
        UTM (nome ou id).
      </p>
    </div>
  );
}
