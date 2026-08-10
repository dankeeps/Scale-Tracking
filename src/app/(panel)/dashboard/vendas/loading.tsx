import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/panel/skeletons";

/** Esqueleto de Vendas (KPIs de receita/ticket/reembolso + tabela de compras). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <TableSkeleton />
    </div>
  );
}
