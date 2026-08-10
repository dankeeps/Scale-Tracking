"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/dashboard/range";
import { cn } from "@/lib/utils";

/** Período: Ontem / Hoje / 7 dias / Personalizado (com datas via ?from=&to=). */
export function PeriodSelector({ current }: { current: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function push(mut: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    mut(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function select(key: RangeKey) {
    if (key === "custom") {
      // Default do personalizado: últimos 7 dias (new Date só no handler, não no render).
      const now = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const from = iso(new Date(now.getTime() - 6 * 86400_000));
      const to = iso(now);
      push((p) => {
        p.set("range", "custom");
        if (!p.get("from")) p.set("from", from);
        if (!p.get("to")) p.set("to", to);
      });
      return;
    }
    push((p) => {
      p.set("range", key);
      p.delete("from");
      p.delete("to");
    });
  }

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const inputCls =
    "rounded border border-border/70 bg-card/40 px-2 py-1 text-xs text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-border/70 bg-card/40 p-0.5">
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => select(o.key)}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              current === o.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {current === "custom" ? (
        <div className="inline-flex items-center gap-1">
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) =>
              push((p) => {
                p.set("range", "custom");
                p.set("from", e.target.value);
              })
            }
            className={inputCls}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) =>
              push((p) => {
                p.set("range", "custom");
                p.set("to", e.target.value);
              })
            }
            className={inputCls}
          />
        </div>
      ) : null}
    </div>
  );
}
