// Formatadores pt-BR para o painel.

const nf = new Intl.NumberFormat("pt-BR");
const pf = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatNumber(n: number | null | undefined): string {
  return nf.format(n ?? 0);
}

export function formatCurrency(
  n: number | null | undefined,
  currency = "BRL",
): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(n ?? 0);
}

/** ratio já em fração (0.23 → "23,0%"). */
export function formatPercent(ratio: number | null | undefined): string {
  if (!ratio || !Number.isFinite(ratio)) return "0,0%";
  return pf.format(ratio);
}

// Fuso do negócio (fixo): horários sempre exibidos no horário de São Paulo,
// independente do fuso do servidor (UTC na Vercel) ou do navegador.
const TZ = "America/Sao_Paulo";

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** País a partir do código ISO alpha-2 (BR → Brasil). */
export function countryName(code: string | null | undefined): string {
  return displayRegion(code, "pt-BR");
}

/** Nome do país em inglês (para casar com o topojson do mapa). */
export function countryNameEn(code: string | null | undefined): string {
  return displayRegion(code, "en");
}

function displayRegion(code: string | null | undefined, locale: string): string {
  if (!code) return "—";
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(
        code.toUpperCase(),
      ) ?? code
    );
  } catch {
    return code;
  }
}

/** Bandeira emoji a partir do código alpha-2. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🏳️";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
