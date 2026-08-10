// Cor por tipo de evento — para diferenciar rápido no log e na jornada.
// Eventos conhecidos têm cor fixa; os demais recebem uma cor estável por hash.

const KNOWN: Record<string, string> = {
  pageview: "hsl(217 91% 60%)", // azul
  viewcontent: "hsl(187 92% 55%)", // ciano
  initiatecheckout: "hsl(38 96% 58%)", // âmbar
  addtocart: "hsl(330 80% 62%)", // rosa
  addpaymentinfo: "hsl(263 80% 66%)", // violeta
  lead: "hsl(263 80% 66%)", // violeta
  purchase: "hsl(142 70% 52%)", // verde
  subscribe: "hsl(142 70% 52%)",
  contact: "hsl(187 92% 55%)",
  search: "hsl(217 91% 60%)",
};

const PALETTE = [
  "hsl(217 91% 60%)",
  "hsl(187 92% 55%)",
  "hsl(38 96% 58%)",
  "hsl(142 70% 52%)",
  "hsl(263 80% 66%)",
  "hsl(330 80% 62%)",
];

/** Cor HSL estável para um nome de evento. */
export function eventColor(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (KNOWN[key]) return KNOWN[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Estilo inline de "chip" colorido (texto + borda + fundo suave da cor). */
export function eventChipStyle(name: string): React.CSSProperties {
  const c = eventColor(name);
  return {
    color: c,
    borderColor: c.replace(")", " / 0.4)"),
    backgroundColor: c.replace(")", " / 0.12)"),
  };
}
