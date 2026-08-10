import type { GeoBucket } from "@/lib/dashboard/queries";
import { formatNumber } from "@/lib/format";

/** Lista de barras horizontais para país/estado/cidade. */
export function GeoBars({
  items,
  renderLabel,
}: {
  items: GeoBucket[];
  renderLabel?: (b: GeoBucket) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem dados.
      </p>
    );
  }
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div key={b.key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">
              {renderLabel ? renderLabel(b) : b.label}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatNumber(b.count)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((b.count / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
