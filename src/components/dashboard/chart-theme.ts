// Paleta dos gráficos (afinada para o tema escuro, legível também no claro).
export const CHART = {
  blue: "hsl(217 91% 60%)",
  cyan: "hsl(187 92% 55%)",
  amber: "hsl(38 96% 58%)",
  green: "hsl(142 70% 52%)",
  violet: "hsl(263 80% 66%)",
  pink: "hsl(330 80% 62%)",
  grid: "hsl(220 12% 40% / 0.18)",
  axis: "hsl(214 9% 58%)",
};

/** Sequência categórica para séries (eventos por tipo etc.). */
export const CHART_SERIES = [
  CHART.blue,
  CHART.cyan,
  CHART.amber,
  CHART.green,
  CHART.violet,
  CHART.pink,
];

/** Estilo do tooltip (casa com os cartões glass). */
export const TOOLTIP_STYLE = {
  background: "hsl(222 12% 9%)",
  border: "1px solid hsl(220 10% 22%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(210 12% 92%)",
} as const;
