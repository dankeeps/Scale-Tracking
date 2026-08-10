import Link from "next/link";
import { PageHeader } from "@/components/panel/page-header";
import { EventsFilters } from "@/components/dashboard/events-filters";
import { EventsTable } from "@/components/dashboard/events-table";
import { Button } from "@/components/ui/button";
import {
  getAdNameMap,
  getEvents,
  getEventsByType,
  getSource,
} from "@/lib/dashboard/data";
import { parseRange } from "@/lib/dashboard/range";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    event?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range, sp.from, sp.to);
  const eventName = sp.event ?? null;
  const page = Math.max(parseInt(sp.page ?? "0", 10) || 0, 0);

  const src = await getSource();
  const [{ rows, total, pageSize }, types, adNames] = await Promise.all([
    getEvents(src, { range, eventName, page }),
    getEventsByType(src, range),
    getAdNameMap(src, range),
  ]);

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const hasPrev = page > 0;
  const hasNext = (page + 1) * pageSize < total;

  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    params.set("range", range.key);
    if (range.key === "custom") {
      if (sp.from) params.set("from", sp.from);
      if (sp.to) params.set("to", sp.to);
    }
    if (eventName) params.set("event", eventName);
    if (p > 0) params.set("page", String(p));
    return `/dashboard/eventos?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Log de eventos com payload e resposta de Meta e GA4."
        action={
          <EventsFilters
            current={range.key}
            eventName={eventName}
            types={types.map((t) => t.event_name)}
          />
        }
      />

      <EventsTable rows={rows} adNames={adNames} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">
          {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
        </span>
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            aria-disabled={!hasPrev}
          >
            <Link href={pageLink(page - 1)} className={!hasPrev ? "pointer-events-none opacity-50" : ""}>
              Anterior
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={!hasNext}
            aria-disabled={!hasNext}
          >
            <Link href={pageLink(page + 1)} className={!hasNext ? "pointer-events-none opacity-50" : ""}>
              Próxima
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
