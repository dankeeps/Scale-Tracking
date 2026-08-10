import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import type { GeoBucket } from "@/lib/dashboard/queries";
import { countryNameEn } from "@/lib/format";

// Mapa-múndi renderizado no SERVIDOR (SVG inline). Sem JS no cliente.

// Alguns nomes do topojson divergem do Intl (en).
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

export function WorldMap({ countries }: { countries: GeoBucket[] }) {
  const counts = new Map<string, number>();
  let max = 0;
  for (const c of countries) {
    const en = countryNameEn(c.key);
    const name = ALIAS[en] ?? en;
    counts.set(name, (counts.get(name) ?? 0) + c.count);
    if (c.count > max) max = c.count;
  }

  const topo = worldData as unknown as Parameters<typeof feature>[0];
  const geo = (worldData as unknown as { objects: { countries: object } })
    .objects.countries as Parameters<typeof feature>[1];
  const fc = feature(topo, geo) as FeatureCollection<Geometry, Props>;

  const projection = geoNaturalEarth1().fitSize([W, H], fc);
  const path = geoPath(projection);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Mapa de visitantes por país"
    >
      {fc.features.map((f: Feature<Geometry, Props>, i) => {
        const name = f.properties?.name ?? "";
        const count = counts.get(name) ?? 0;
        const t = max > 0 ? count / max : 0;
        const fill =
          count > 0
            ? `hsl(217 91% 60% / ${(0.25 + 0.75 * t).toFixed(3)})`
            : "hsl(220 10% 22% / 0.55)";
        const d = path(f);
        if (!d) return null;
        return (
          <path key={i} d={d} fill={fill} stroke="hsl(224 14% 6%)" strokeWidth={0.3}>
            <title>{`${name}: ${count}`}</title>
          </path>
        );
      })}
    </svg>
  );
}
