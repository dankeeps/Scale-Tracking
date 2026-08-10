import { PageHeader } from "@/components/panel/page-header";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPages, getSource } from "@/lib/dashboard/data";
import { parseRange } from "@/lib/dashboard/range";
import { formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaginasPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range, sp.from, sp.to);
  const src = await getSource();
  const pages = await getPages(src, range);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Páginas"
        description="Desempenho por página: visualizações, usuários, checkout e conversão."
        action={<PeriodSelector current={range.key} />}
      />

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          Sem dados de página no período. A página de cada evento passou a ser
          capturada nesta versão — só aparecem eventos a partir do deploy.
        </div>
      ) : (
        <div className="rounded-lg border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Página</TableHead>
                <TableHead className="text-right">Visualizações</TableHead>
                <TableHead className="text-right">Usuários únicos</TableHead>
                <TableHead className="text-right">Checkouts</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.page}>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs">
                    {p.page}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatNumber(p.views)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatNumber(p.users)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatNumber(p.checkouts)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-success">
                    {formatNumber(p.purchases)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatPercent(p.conversion)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Conversão = compras ÷ usuários únicos. Compras atribuídas à página onde o
        comprador iniciou o checkout.
      </p>
    </div>
  );
}
