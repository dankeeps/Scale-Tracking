"use client";

import { useState } from "react";
import {
  fetchEventDetail,
  fetchJourney,
} from "@/app/(panel)/dashboard/eventos/actions";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eventChipStyle } from "@/lib/dashboard/event-style";
import type { EventLogRow, JourneyEvent } from "@/lib/dashboard/queries";
import { countryName, formatDateTime } from "@/lib/format";

function destStatus(response: unknown): "ok" | "fail" | null {
  if (!Array.isArray(response) || response.length === 0) return null;
  return response.every((r) => r?.ok) ? "ok" : "fail";
}

function DestBadge({ label, response }: { label: string; response: unknown }) {
  const s = destStatus(response);
  if (s === null) return null;
  return (
    <Badge variant={s === "ok" ? "success" : "destructive"}>
      {label} {s === "ok" ? "✓" : "✗"}
    </Badge>
  );
}

/** Chip colorido por tipo de evento. */
function EventChip({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
      style={eventChipStyle(name)}
    >
      {name}
    </span>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-border/70 bg-background/60 p-3 font-mono text-xs">
      {value == null ? "— vazio —" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Linha rótulo → valor no painel de detalhe. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-mono text-xs tabular-nums">
        {value == null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

function localLabel(country: string | null, region: string | null, city: string | null) {
  return (
    [city, region, country ? countryName(country) : null]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

export function EventsTable({
  rows,
  adNames = {},
}: {
  rows: EventLogRow[];
  adNames?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<EventLogRow | null>(null);
  const [journey, setJourney] = useState<JourneyEvent[] | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);

  // Detalhe de um evento da jornada (dialog aninhado)
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDetail, setEventDetail] = useState<EventLogRow | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  // Traduz o UTM (que pode vir como ID do Meta) para o nome, quando conhecido.
  const adName = (v: string | null | undefined): string | null =>
    v ? (adNames[v] ?? v) : null;

  async function openRow(r: EventLogRow) {
    setSelected(r);
    setJourney(null);
    if (r.trck_user_id) {
      setLoadingJourney(true);
      try {
        setJourney(await fetchJourney(r.trck_user_id));
      } finally {
        setLoadingJourney(false);
      }
    }
  }

  async function openEvent(id: string) {
    setEventOpen(true);
    setEventDetail(null);
    setEventLoading(true);
    try {
      setEventDetail(await fetchEventDetail(id));
    } finally {
      setEventLoading(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
        Nenhum evento no período/filtro.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead className="hidden md:table-cell">Campanha</TableHead>
              <TableHead className="hidden xl:table-cell">Conjunto</TableHead>
              <TableHead className="hidden xl:table-cell">Anúncio</TableHead>
              <TableHead className="hidden lg:table-cell">Local</TableHead>
              <TableHead>Destinos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => openRow(r)}
              >
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {formatDateTime(r.created_at)}
                </TableCell>
                <TableCell>
                  <EventChip name={r.event_name} />
                </TableCell>
                <TableCell className="hidden md:table-cell max-w-[180px] truncate text-sm text-muted-foreground">
                  {adName(r.utm_campaign) ?? "—"}
                  {r.utm_source ? (
                    <span className="block text-xs opacity-70">
                      {r.utm_source}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="hidden xl:table-cell max-w-[180px] truncate text-sm text-muted-foreground">
                  {adName(r.utm_term) ?? "—"}
                </TableCell>
                <TableCell className="hidden xl:table-cell max-w-[180px] truncate text-sm text-muted-foreground">
                  {adName(r.utm_content) ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {localLabel(r.geo_country, r.geo_region, r.geo_city)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <DestBadge label="Meta" response={r.response_meta} />
                    <DestBadge label="GA4" response={r.response_ga4} />
                    {destStatus(r.response_meta) === null &&
                    destStatus(r.response_ga4) === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-[480px] max-w-[94%] overflow-y-auto"
        >
          {selected ? (
            <div className="space-y-5 pr-6">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <EventChip name={selected.event_name} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(selected.created_at)}
                  </span>
                </SheetTitle>
              </div>

              {/* Dados do evento */}
              <section className="rounded-lg border border-border/70 p-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados do evento
                </h3>
                <Field label="Visitante" value={selected.trck_user_id} />
                <Field label="event_id" value={selected.event_id} />
                <Field label="Origem" value={selected.utm_source} />
                <Field label="Meio" value={selected.utm_medium} />
                <Field label="Campanha" value={adName(selected.utm_campaign)} />
                <Field label="Conjunto" value={adName(selected.utm_term)} />
                <Field label="Anúncio" value={adName(selected.utm_content)} />
                <Field label="País" value={selected.geo_country ? countryName(selected.geo_country) : null} />
                <Field label="Estado" value={selected.geo_region} />
                <Field label="Cidade" value={selected.geo_city} />
              </section>

              {/* Payloads / respostas */}
              <Tabs defaultValue="meta-resp" className="min-w-0">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="meta-resp">Meta · resposta</TabsTrigger>
                  <TabsTrigger value="meta-payload">Meta · payload</TabsTrigger>
                  <TabsTrigger value="ga4-resp">GA4 · resposta</TabsTrigger>
                  <TabsTrigger value="ga4-payload">GA4 · payload</TabsTrigger>
                </TabsList>
                <TabsContent value="meta-resp">
                  <Json value={selected.response_meta} />
                </TabsContent>
                <TabsContent value="meta-payload">
                  <Json value={selected.payload_meta} />
                </TabsContent>
                <TabsContent value="ga4-resp">
                  <Json value={selected.response_ga4} />
                </TabsContent>
                <TabsContent value="ga4-payload">
                  <Json value={selected.payload_ga4} />
                </TabsContent>
              </Tabs>

              {/* Jornada do visitante */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Jornada do visitante
                  {journey ? (
                    <span className="ml-1 font-normal normal-case">
                      ({journey.length} eventos)
                    </span>
                  ) : null}
                </h3>
                {!selected.trck_user_id ? (
                  <p className="text-sm text-muted-foreground">
                    Evento sem visitante associado.
                  </p>
                ) : loadingJourney ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : journey && journey.length > 0 ? (
                  <ol className="relative space-y-3 border-l border-border/70 pl-4">
                    {journey.map((e) => {
                      const isCurrent = e.id === selected.id;
                      const utm = [
                        e.utm_source && `origem: ${e.utm_source}`,
                        e.utm_campaign && `camp: ${adName(e.utm_campaign)}`,
                        e.utm_term && `conj: ${adName(e.utm_term)}`,
                        e.utm_content && `anún: ${adName(e.utm_content)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={e.id} className="relative">
                          <span
                            className="absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-card"
                            style={{ backgroundColor: eventChipStyle(e.event_name).color as string }}
                          />
                          <button
                            type="button"
                            onClick={() => openEvent(e.id)}
                            className={`w-full rounded-md border p-2 text-left transition hover:border-primary/50 hover:bg-primary/5 ${isCurrent ? "border-primary/50 bg-primary/5" : "border-border/60"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <EventChip name={e.event_name} />
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {formatDateTime(e.created_at)}
                              </span>
                            </div>
                            {utm ? (
                              <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">
                                {utm}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum outro evento deste visitante.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Detalhe de um evento da jornada */}
      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {eventDetail ? (
                <>
                  <EventChip name={eventDetail.event_name} />
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {formatDateTime(eventDetail.created_at)}
                  </span>
                </>
              ) : (
                "Evento"
              )}
            </DialogTitle>
          </DialogHeader>

          {eventLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : eventDetail ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-border/70 p-3">
                <div className="mb-2 flex flex-wrap gap-1">
                  <DestBadge label="Meta" response={eventDetail.response_meta} />
                  <DestBadge label="GA4" response={eventDetail.response_ga4} />
                </div>
                <Field label="event_id" value={eventDetail.event_id} />
                <Field label="Visitante" value={eventDetail.trck_user_id} />
                <Field label="Origem" value={eventDetail.utm_source} />
                <Field label="Meio" value={eventDetail.utm_medium} />
                <Field label="Campanha" value={adName(eventDetail.utm_campaign)} />
                <Field label="Conjunto" value={adName(eventDetail.utm_term)} />
                <Field label="Anúncio" value={adName(eventDetail.utm_content)} />
                <Field
                  label="Local"
                  value={localLabel(
                    eventDetail.geo_country,
                    eventDetail.geo_region,
                    eventDetail.geo_city,
                  )}
                />
              </section>

              <Tabs defaultValue="meta-resp" className="min-w-0">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="meta-resp">Meta · resposta</TabsTrigger>
                  <TabsTrigger value="meta-payload">Meta · payload</TabsTrigger>
                  <TabsTrigger value="ga4-resp">GA4 · resposta</TabsTrigger>
                  <TabsTrigger value="ga4-payload">GA4 · payload</TabsTrigger>
                </TabsList>
                <TabsContent value="meta-resp">
                  <Json value={eventDetail.response_meta} />
                </TabsContent>
                <TabsContent value="meta-payload">
                  <Json value={eventDetail.payload_meta} />
                </TabsContent>
                <TabsContent value="ga4-resp">
                  <Json value={eventDetail.response_ga4} />
                </TabsContent>
                <TabsContent value="ga4-payload">
                  <Json value={eventDetail.payload_ga4} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Evento não encontrado.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
