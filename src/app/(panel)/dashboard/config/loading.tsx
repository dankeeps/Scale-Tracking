import { CardSkeleton, PageHeaderSkeleton } from "@/components/panel/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto de Configurações (abas + formulário). */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton action={false} />
      <Skeleton className="h-10 w-full max-w-xl" />
      <CardSkeleton rows={5} />
    </div>
  );
}
