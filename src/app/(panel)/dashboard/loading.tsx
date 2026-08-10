import {
  CardSkeleton,
  ChartSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/panel/skeletons";

/** Esqueleto da Visão geral (KPIs + grid de cartões + gráficos). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-4 lg:grid-cols-4">
        <CardSkeleton className="lg:col-start-1 lg:row-start-1 lg:row-span-2" rows={5} />
        <CardSkeleton className="lg:col-span-2" rows={3} />
        <CardSkeleton rows={3} />
        <CardSkeleton className="lg:col-span-2" rows={3} />
        <CardSkeleton rows={3} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
