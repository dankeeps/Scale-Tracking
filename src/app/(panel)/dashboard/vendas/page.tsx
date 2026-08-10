import {
  BadgeDollarSign,
  Receipt,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { ProductFilter } from "@/components/dashboard/product-filter";
import { SalesTable } from "@/components/dashboard/sales-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import {
  getFaturamento,
  getProductOptions,
  getPurchasesList,
  getSource,
} from "@/lib/dashboard/data";
import { parseRange } from "@/lib/dashboard/range";
import { formatCurrency, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    product?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range, sp.from, sp.to);
  const product = sp.product && sp.product !== "all" ? sp.product : undefined;
  const src = await getSource();
  const [fat, purchases, products] = await Promise.all([
    getFaturamento(src, range),
    getPurchasesList(src, range, 100, product),
    getProductOptions(src, range),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Receita, ticket médio, reembolsos e compras."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ProductFilter current={product ?? "all"} products={products} />
            <PeriodSelector current={range.key} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita"
          value={formatCurrency(fat.revenue)}
          hint={`${formatNumber(fat.orders)} pedidos`}
          icon={BadgeDollarSign}
          accent="text-success"
        />
        <StatCard
          label="Ticket médio"
          value={formatCurrency(fat.avgTicket)}
          icon={Receipt}
        />
        <StatCard
          label="Pedidos"
          value={formatNumber(fat.orders)}
          icon={ShoppingBag}
          accent="text-accent-cyan"
        />
        <StatCard
          label="Reembolsos"
          value={formatNumber(fat.refunds)}
          hint={formatCurrency(fat.refundValue)}
          icon={RotateCcw}
          accent="text-accent-amber"
        />
      </div>

      <Card variant="solid">
        <SalesTable rows={purchases} />
      </Card>
    </div>
  );
}
