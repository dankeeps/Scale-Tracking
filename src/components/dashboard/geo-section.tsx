import { GeoBars } from "@/components/dashboard/geo-bars";
import { WorldMap } from "@/components/dashboard/world-map";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GeoBreakdown } from "@/lib/dashboard/queries";
import { countryName, flagEmoji } from "@/lib/format";

/** Geolocalização: mapa à esquerda; país/estado/cidade em linha à direita. */
export function GeoSection({ geo }: { geo: GeoBreakdown }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapa por país</CardTitle>
        </CardHeader>
        <CardContent>
          {geo.total === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sem dados de geolocalização no período. (O geo é preenchido no
              deploy da Vercel; no dev local fica vazio.)
            </p>
          ) : (
            <WorldMap countries={geo.countries} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Países</h3>
            <GeoBars
              items={geo.countries}
              renderLabel={(b) => (
                <span className="flex items-center gap-1.5">
                  <span>{flagEmoji(b.key)}</span>
                  <span className="truncate">{countryName(b.key)}</span>
                </span>
              )}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Estados
            </h3>
            <GeoBars items={geo.regions} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Cidades
            </h3>
            <GeoBars items={geo.cities} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
