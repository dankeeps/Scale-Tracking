"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  CHART_SERIES,
  TOOLTIP_STYLE,
} from "@/components/dashboard/chart-theme";
import type {
  EventTypeRow,
  RevenueDay,
  SalesSlice,
} from "@/lib/dashboard/queries";
import { formatCurrency, formatNumber } from "@/lib/format";

// Tons de azul (suaves, sem cor gritante) por tipo de pagamento.
const PAY_COLORS: Record<string, string> = {
  pix: "hsl(217 85% 62%)", // azul
  cartao: "hsl(199 80% 58%)", // azul-céu
  boleto: "hsl(226 55% 46%)", // azul-índigo
  outros: "hsl(213 22% 55%)", // azul-acinzentado
};

/** Donut de vendas por pagamento, com total no centro. */
export function PaymentDonut({
  data,
  total,
}: {
  data: SalesSlice[];
  total: number;
}) {
  if (total === 0 || data.length === 0) return <Empty />;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, _n, item) => [
                `${formatNumber(Number(v))} (${pct(Number(v))}%)`,
                item?.payload?.label,
              ]}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((s) => (
                <Cell key={s.key} fill={PAY_COLORS[s.key] ?? CHART.violet} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {formatNumber(total)}
          </span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
        {data.map((s) => (
          <li
            key={s.key}
            className="flex min-w-0 items-center justify-center gap-1.5"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: PAY_COLORS[s.key] ?? CHART.violet }}
            />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="shrink-0 font-mono tabular-nums">
              {pct(s.count)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EventsBarChart({ data }: { data: EventTypeRow[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 40, 120)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="event_name"
          width={120}
          tick={{ fill: CHART.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(220 12% 40% / 0.12)" }}
          formatter={(v) => [formatNumber(Number(v)), "Eventos"]}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_SERIES[i % CHART_SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const REV_LABELS: Record<string, string> = {
  revenue: "Receita",
  spend: "Investimento",
  orders: "Pedidos",
};

export function RevenueChart({ data }: { data: RevenueDay[] }) {
  if (data.length === 0) return <Empty />;
  const hasSpend = data.some((d) => (d.spend ?? 0) > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.5} />
            <stop offset="100%" stopColor={CHART.blue} stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.amber} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.amber} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: CHART.blue, strokeOpacity: 0.3 }}
          formatter={(v, name) => {
            const key = String(name);
            return [
              key === "orders"
                ? formatNumber(Number(v))
                : formatCurrency(Number(v)),
              REV_LABELS[key] ?? key,
            ];
          }}
          labelFormatter={(d) => String(d).split("-").reverse().join("/")}
        />
        {hasSpend ? (
          <Legend
            formatter={(name) => REV_LABELS[String(name)] ?? String(name)}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={CHART.blue}
          strokeWidth={2}
          fill="url(#rev)"
        />
        {hasSpend ? (
          <Area
            type="monotone"
            dataKey="spend"
            stroke={CHART.amber}
            strokeWidth={2}
            fill="url(#spend)"
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      Sem dados no período.
    </div>
  );
}
