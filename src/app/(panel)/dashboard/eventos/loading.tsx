import { PageHeaderSkeleton, TableSkeleton } from "@/components/panel/skeletons";

/** Esqueleto de Eventos (filtro + tabela paginada). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} />
    </div>
  );
}
