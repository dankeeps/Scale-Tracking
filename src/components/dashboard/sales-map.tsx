import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import type { SalesGeo } from "@/lib/dashboard/queries";
import { countryNameEn } from "@/lib/format";
import { SalesGeoCard, type SalesMarker } from "./sales-geo-card";

// Mapa de VENDAS por país. A projeção d3 + world-atlas rodam no SERVIDOR (fora
// do bundle do cliente); passamos o SVG pronto + os centroides dos marcadores
// para o card interativo (client).

const ALIAS: Record<string, string> = {
  "United States": "United States of America",
  Tanzania: "United Republic of Tanzania",
  "Congo - Kinshasa": "Democratic Republic of the Congo",
  "Congo - Brazzaville": "Republic of the Congo",
  Czechia: "Czech Republic",
};

const W = 880;
const H = 440;

type Props = { name?: string };

export function SalesMap({ data }: { data: SalesGeo }) {
  const topo = worldData as unknown as Parameters<typeof feature>[0];
  const geo = (worldData as unknown as { objects: { countries: object } })
    .objects.countries as Parameters<typeof feature>[1];
  const fc = feature(topo, geo) as FeatureCollection<Geometry, Props>;

  const projection = geoNaturalEarth1().fitSize([W, H], fc);
  const path = geoPath(projection);

  // nome (topojson) → venda daquele país
  const salesByName = new Map<string, { key: string; count: number }>();
  for (const c of data.countries) {
    const en = countryNameEn(c.key);
    salesByName.set(ALIAS[en] ?? en, c);
  }

  const markers: SalesMarker[] = [];
  for (const f of fc.features) {
    const name = f.properties?.name ?? "";
    const s = salesByName.get(name);
    if (!s) continue;
    const [x, y] = path.centroid(f);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    markers.push({ key: s.key, name, count: s.count, x, y });
  }

  const map = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Mapa de vendas por país"
    >
      {fc.features.map((f: Feature<Geometry, Props>, i) => {
        const name = f.properties?.name ?? "";
        const active = salesByName.has(name);
        const d = path(f);
        if (!d) return null;
        return (
          <path
            key={i}
            d={d}
            fill={
              active ? "hsl(217 91% 60% / 0.32)" : "hsl(220 14% 24% / 0.5)"
            }
            stroke="hsl(224 14% 6%)"
            strokeWidth={0.3}
          />
        );
      })}
    </svg>
  );

  return (
    <SalesGeoCard
      markers={markers}
      width={W}
      height={H}
      total={data.total}
      noCountry={data.noCountry}
    >
      {map}
    </SalesGeoCard>
  );
}
