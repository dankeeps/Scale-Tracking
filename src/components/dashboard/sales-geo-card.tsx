"use client";

import { Info, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { countryName, flagEmoji } from "@/lib/format";

export interface SalesMarker {
  key: string; // código do país (ex.: "BR")
  name: string; // nome topojson (en)
  count: number;
  x: number; // centroide no viewBox
  y: number;
}

/**
 * Mapa de VENDAS por país. Marcadores com a quantidade de vendas; clicar mostra
 * total e participação. Alterna entre Mapa e Ranking. O SVG do mapa vem do
 * servidor (children) — aqui só a interatividade (marcadores/popup/toggle).
 */
export function SalesGeoCard({
  children,
  markers,
  width,
  height,
  total,
  noCountry,
}: {
  children: ReactNode;
  markers: SalesMarker[];
  width: number;
  height: number;
  total: number;
  noCountry: number;
}) {
  const [view, setView] = useState<"map" | "ranking">("map");
  const [sel, setSel] = useState<string | null>(null);
  const selected = markers.find((m) => m.key === sel) ?? null;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const ranked = [...markers].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Vendas por País</h3>
        <div className="inline-flex rounded-md border border-border/60 p-0.5 text-xs">
          {(["ranking", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 font-medium transition ${
                view === v
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "ranking" ? "Ranking" : "Mapa"}
            </button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <div className="relative overflow-hidden rounded-lg">
          {children}

          {/* marcadores */}
          <div className="pointer-events-none absolute inset-0">
            {markers.map((m) => {
              const on = m.key === sel;
              return (
                <button
                  key={m.key}
                  onClick={() => setSel(on ? null : m.key)}
                  style={{
                    left: `${(m.x / width) * 100}%`,
                    top: `${(m.y / height) * 100}%`,
                  }}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                  aria-label={`${countryName(m.key)}: ${m.count} vendas`}
                >
                  <span
                    className={`flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary-foreground shadow-md ring-2 transition ${
                      on
                        ? "bg-primary ring-primary/60"
                        : "bg-primary/90 ring-white/30 hover:bg-primary"
                    }`}
                  >
                    {m.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* popup do país selecionado */}
          {selected ? (
            <div className="absolute left-3 top-3 w-48 rounded-lg border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                  <span>{flagEmoji(selected.key)}</span>
                  <span className="truncate">{countryName(selected.key)}</span>
                </span>
                <button
                  onClick={() => setSel(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex items-center justify-between py-0.5 text-sm">
                <span className="text-muted-foreground">Total de vendas</span>
                <span className="font-mono font-semibold tabular-nums text-primary">
                  {selected.count}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5 text-sm">
                <span className="text-muted-foreground">Participação</span>
                <span className="font-mono font-semibold tabular-nums text-success">
                  {pct(selected.count).toFixed(1)}%
                </span>
              </div>
            </div>
          ) : null}

          {/* vendas sem país */}
          <div className="absolute bottom-3 right-3 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-right backdrop-blur">
            <p className="text-[11px] text-muted-foreground">Vendas sem país</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              N/A = {noCountry}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {pct(noCountry).toFixed(1)}%
              </span>
            </p>
          </div>

          {/* dica */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
            <Info className="size-3.5" />
            Clique nos marcadores para ver as métricas
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
          {ranked.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">
              Sem vendas no período.
            </li>
          ) : (
            ranked.map((m, i) => (
              <li key={m.key} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-center font-mono text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span>{flagEmoji(m.key)}</span>
                  <span className="truncate text-sm font-medium">
                    {countryName(m.key)}
                  </span>
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {m.count}
                </span>
                <span className="w-14 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {pct(m.count).toFixed(1)}%
                </span>
              </li>
            ))
          )}
          {noCountry > 0 ? (
            <li className="flex items-center gap-3 px-3 py-2 text-muted-foreground">
              <span className="w-5" />
              <span className="min-w-0 flex-1 truncate text-sm">Sem país</span>
              <span className="font-mono text-sm tabular-nums">{noCountry}</span>
              <span className="w-14 text-right font-mono text-xs tabular-nums">
                {pct(noCountry).toFixed(1)}%
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
