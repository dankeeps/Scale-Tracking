import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Cabeçalho padrão das páginas do painel. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Aviso de seção ainda não construída (páginas de fases futuras). */
export function ComingSoon({ phase }: { phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 p-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-md bg-accent-amber/15 text-accent-amber">
        <Construction className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Em construção</p>
        <p className="text-sm text-muted-foreground">
          Esta seção será implementada na {phase}.
        </p>
      </div>
      <Badge variant="warning">{phase}</Badge>
    </div>
  );
}
