import {
  CardSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/panel/skeletons";

/** Esqueleto de Campanhas (KPIs + árvore campanha → conjunto → anúncio). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <CardSkeleton rows={8} />
    </div>
  );
}
