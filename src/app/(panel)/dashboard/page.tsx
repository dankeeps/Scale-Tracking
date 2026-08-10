import { PageHeader } from "@/components/panel/page-header";
import { PaymentDonut, RevenueChart } from "@/components/dashboard/charts";
import { Funnel } from "@/components/dashboard/funnel";
import { SalesMap } from "@/components/dashboard/sales-map";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDailySpendMap,
  getFunnel,
  getOverview,
  getRevenueDaily,
  getSalesBreakdown,
  getSalesByCountry,
  getSalesStatusCounts,
  getSource,
  getTotalClicks,
  getTotalSpend,
} from "@/lib/dashboard/data";
import { parseRange } from "@/lib/dashboard/range";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Linha de métrica (rótulo + subtexto + valor) do cartão combinado. */
function MetricRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <span className="shrink-0 font-mono text-xl font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range, sp.from, sp.to);
  const src = await getSource();

  const [
    overview,
    revenue,
    salesGeo,
    spend,
    spendByDay,
    sales,
    salesStatus,
    funnel,
    clicks,
  ] = await Promise.all([
    getOverview(src, range),
    getRevenueDaily(src, range),
    getSalesByCountry(src, range),
    getTotalSpend(src, range),
    getDailySpendMap(src, range),
    getSalesBreakdown(src, range),
    getSalesStatusCounts(src, range),
    getFunnel(src, range),
    getTotalClicks(src, range),
  ]);

  const revenueData = revenue.map((r) => ({
    ...r,
    spend: spendByDay.get(r.day) ?? 0,
  }));

  const roas = spend.spend > 0 ? overview.revenue / spend.spend : null;
  const lucro = overview.revenue - spend.spend;
  const checkouts = overview.funnel.checkout;
  const custoCheckout =
    spend.spend > 0 && checkouts > 0 ? spend.spend / checkouts : null;
  const custoUsuario =
    spend.spend > 0 && overview.visitors > 0
      ? spend.spend / overview.visitors
      : null;
  const custoClique =
    spend.spend > 0 && clicks.clicks > 0 ? spend.spend / clicks.clicks : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Resumo de receita, investimento, lucro e conversão."
        action={<PeriodSelector current={range.key} />}
      />

      {/* Linha 1 — KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita total"
          value={formatCurrency(overview.revenue)}
        />
        <StatCard
          label="Investimento (Meta)"
          value={formatCurrency(spend.spend)}
          hint={spend.ok ? undefined : "parcial (erro em conta)"}
        />
        <StatCard
          label="ROAS"
          value={roas !== null ? `${roas.toFixed(2)}x` : "—"}
          labelClassName="text-success"
          valueClassName="text-success"
        />
        <StatCard
          label="Lucro"
          value={formatCurrency(lucro)}
          labelClassName="text-success"
          valueClassName={lucro >= 0 ? "text-success" : "text-destructive"}
        />
      </div>

      {/* Linha 2 — produto | pendentes/reembolsadas | métricas | pagamento */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <CardHeader>
            <CardTitle className="text-base">Vendas por produto</CardTitle>
          </CardHeader>
          <CardContent>
            {sales.byProduct.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem vendas no período.
              </p>
            ) : (
              <ul className="space-y-3">
                {sales.byProduct.map((p, i) => {
                  const pct =
                    sales.total > 0 ? (p.count / sales.total) * 100 : 0;
                  return (
                    <li key={p.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium">
                          {p.label}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono tabular-nums",
                            i === 0 ? "text-success" : "text-foreground",
                          )}
                        >
                          {formatCurrency(p.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatNumber(p.count)} · {pct.toFixed(1)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-start-2 lg:row-start-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendas pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {formatNumber(salesStatus.pending)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(salesStatus.pendingValue)} aguardando
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-start-2 lg:row-start-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendas reembolsadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {formatNumber(salesStatus.refunded)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(salesStatus.refundedValue)} devolvidos
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <CardHeader>
            <CardTitle className="text-base">Métricas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <MetricRow
              label="Usuários únicos"
              value={formatNumber(overview.visitors)}
              sub={
                custoUsuario
                  ? `${formatCurrency(custoUsuario)}/usuário`
                  : "visitantes"
              }
            />
            <MetricRow
              label="Checkouts"
              value={formatNumber(checkouts)}
              sub={
                custoCheckout
                  ? `${formatCurrency(custoCheckout)}/checkout`
                  : "iniciaram checkout"
              }
            />
            <MetricRow
              label="Cliques"
              value={formatNumber(clicks.clicks)}
              sub={
                custoClique
                  ? `${formatCurrency(custoClique)}/clique`
                  : "cliques no anúncio"
              }
            />
            <MetricRow
              label="Conversão"
              value={formatPercent(overview.conversion)}
              sub="visita → compra"
            />
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-start-4 lg:row-start-1 lg:row-span-2">
          <CardHeader>
            <CardTitle className="text-base">Vendas por pagamento</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <PaymentDonut data={sales.byPayment} total={sales.total} />
          </CardContent>
        </Card>
      </div>

      {/* Linha 3 — funil + geolocalização */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <Funnel
              clicks={clicks.clicks}
              pageviews={funnel.pageviews}
              ics={funnel.ics}
              salesInit={funnel.salesInit}
              salesApproved={funnel.salesApproved}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <SalesMap data={salesGeo} />
          </CardContent>
        </Card>
      </div>

      {/* Receita por período — abaixo de tudo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Receita × investimento no período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={revenueData} />
        </CardContent>
      </Card>
    </div>
  );
}
