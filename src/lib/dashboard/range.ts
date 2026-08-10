// Intervalo de datas do painel (via ?range= + ?from=&to= no personalizado).

export type RangeKey = "yesterday" | "today" | "7d" | "custom";

export interface DateRange {
  key: RangeKey;
  from: string | null; // ISO
  to: string; // ISO (exclusivo)
  label: string;
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "yesterday", label: "Ontem" },
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "custom", label: "Personalizado" },
];

function parseDay(s?: string): { y: number; m: number; d: number } | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

// Fuso do negócio: São Paulo (UTC-3, sem horário de verão desde 2019). Os
// limites de "Hoje/Ontem/Personalizado" são calculados no dia CIVIL de SP, não
// no fuso do servidor (UTC na Vercel).
const TZ = "America/Sao_Paulo";
const SP_OFFSET = "-03:00";
const spDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** "YYYY-MM-DD" do dia civil de São Paulo para um instante. */
function spDay(date: Date): string {
  return spDayFmt.format(date);
}
/** Instante de 00:00 (SP) de uma data "YYYY-MM-DD". */
function startOfSpDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${SP_OFFSET}`);
}

export function parseRange(
  value?: string,
  fromParam?: string,
  toParam?: string,
): DateRange {
  const key = (["yesterday", "today", "7d", "custom"].includes(value ?? "")
    ? value
    : "today") as RangeKey;
  const now = new Date();
  const to = now.toISOString();
  const startOfToday = startOfSpDay(spDay(now));
  const label = RANGE_OPTIONS.find((o) => o.key === key)!.label;

  if (key === "today") {
    return { key, from: startOfToday.toISOString(), to, label };
  }
  if (key === "yesterday") {
    const startOfYesterday = new Date(startOfToday.getTime() - 86400_000);
    return {
      key,
      from: startOfYesterday.toISOString(),
      to: startOfToday.toISOString(),
      label,
    };
  }
  if (key === "7d") {
    const from = new Date(now.getTime() - 7 * 86400_000).toISOString();
    return { key, from, to, label };
  }

  // Personalizado: from/to (YYYY-MM-DD, dias de SP). `to` é exclusivo → início
  // do dia seguinte ao toParam. Sem datas válidas, cai em "hoje".
  const cf = parseDay(fromParam);
  const ct = parseDay(toParam);
  if (cf && ct) {
    const fromD = startOfSpDay(fromParam!);
    const toD = new Date(startOfSpDay(toParam!).getTime() + 86400_000);
    return {
      key: "custom",
      from: fromD.toISOString(),
      to: toD.toISOString(),
      label: `${ddmm(fromParam!)} – ${ddmm(toParam!)}`,
    };
  }
  return { key: "custom", from: startOfToday.toISOString(), to, label };
}
