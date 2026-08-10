import { formatNumber } from "@/lib/format";

/**
 * Funil horizontal de 5 etapas (Cliques → Vis. Página → ICs → Vendas Inic. →
 * Vendas Apr.), desenhado como uma faixa suave e contínua que afunila da
 * esquerda para a direita. A ALTURA das faixas usa uma compressão leve (só para
 * as etapas menores não sumirem em fio de cabelo) — os percentuais e números
 * exibidos são exatos. Percentuais são relativos à 1ª etapa (Cliques = 100%).
 */
export function Funnel({
  clicks,
  pageviews,
  ics,
  salesInit,
  salesApproved,
}: {
  clicks: number;
  pageviews: number;
  ics: number;
  salesInit: number;
  salesApproved: number;
}) {
  const stages = [
    { label: "Cliques", value: clicks },
    { label: "Vis. Página", value: pageviews },
    { label: "ICs", value: ics },
    { label: "Vendas Inic.", value: salesInit },
    { label: "Vendas Apr.", value: salesApproved },
  ];

  // Base do percentual = cliques (fallback p/ quando não há Meta conectado).
  const base = clicks > 0 ? clicks : pageviews > 0 ? pageviews : 1;
  const maxVal = Math.max(...stages.map((s) => s.value), 1);

  // Geometria (viewBox esticado na horizontal; vertical 1:1 em px).
  const W = 1000;
  const H = 220;
  const cy = H / 2;
  const maxBand = 150; // faixa da 1ª etapa (deixa respiro em cima/baixo)
  const minBand = 14; // faixa mínima p/ a menor etapa continuar visível
  const colW = W / stages.length;

  // Compressão suave da altura (visual); não afeta % nem números exibidos.
  const half = (v: number) => {
    const shaped = Math.pow(v / maxVal, 0.72);
    return Math.max(shaped * maxBand, minBand) / 2;
  };

  const xs = [0, ...stages.map((_, i) => (i + 0.5) * colW), W];
  const hs = [
    half(stages[0].value),
    ...stages.map((s) => half(s.value)),
    half(stages[stages.length - 1].value),
  ];
  const topPts = xs.map((x, i) => ({ x, y: cy - hs[i] }));
  const botPts = xs.map((x, i) => ({ x, y: cy + hs[i] }));

  const smooth = (pts: { x: number; y: number }[]) => {
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const botRev = [...botPts].reverse();
  const path =
    `M ${topPts[0].x} ${topPts[0].y}` +
    smooth(topPts) +
    ` L ${botRev[0].x} ${botRev[0].y}` +
    smooth(botRev) +
    " Z";

  const pct = (n: number) => {
    const p = base > 0 ? (n / base) * 100 : 0;
    return `${Number.isInteger(p) ? p.toFixed(0) : p.toFixed(1)}%`;
  };

  return (
    <div className="relative w-full">
      {/* divisórias verticais sutis (atravessam rótulos, faixa e números) */}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-5">
        {stages.map((s, i) => (
          <div
            key={s.label}
            className={i > 0 ? "border-l border-white/[0.06]" : ""}
          />
        ))}
      </div>

      <div className="grid grid-cols-5 pb-2 text-center text-xs font-medium text-muted-foreground">
        {stages.map((s) => (
          <span key={s.label} className="truncate px-1">
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-52 w-full"
          role="img"
          aria-label="Funil de conversão"
        >
          <defs>
            <linearGradient id="funnel-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(222 90% 58%)" />
              <stop offset="40%" stopColor="hsl(196 80% 52%)" />
              <stop offset="72%" stopColor="hsl(168 72% 46%)" />
              <stop offset="100%" stopColor="hsl(142 70% 46%)" />
            </linearGradient>
            {/* brilho vertical p/ dar volume à faixa */}
            <linearGradient id="funnel-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="46%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <path d={path} fill="url(#funnel-grad)" />
          <path d={path} fill="url(#funnel-sheen)" />
        </svg>

        {/* percentuais sobre a faixa (sempre no centro vertical) */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-5 items-center text-center">
          {stages.map((s) => (
            <span
              key={s.label}
              className="text-sm font-semibold text-white"
              style={{ textShadow: "0 1px 4px rgb(0 0 0 / 0.6)" }}
            >
              {pct(s.value)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 pt-2 text-center font-mono text-sm tabular-nums">
        {stages.map((s) => (
          <span key={s.label}>{formatNumber(s.value)}</span>
        ))}
      </div>
    </div>
  );
}
