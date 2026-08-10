import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Cartão de KPI (número tabular grande + rótulo; ícone opcional). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-primary",
  labelClassName,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium text-muted-foreground",
            labelClassName,
          )}
        >
          {label}
        </CardTitle>
        {Icon ? <Icon className={`size-4 ${accent}`} /> : null}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums",
            valueClassName,
          )}
        >
          {value}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
