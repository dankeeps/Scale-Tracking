"use client";

import { useState } from "react";
import {
  fetchEventDetail,
  fetchSaleDetail,
  type SaleDetail,
} from "@/app/(panel)/dashboard/vendas/actions";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
import type { EventLogRow, PurchaseRow } from "@/lib/dashboard/queries";
import { countryName, formatCurrency, formatDateTime } from "@/lib/format";

function statusVariant(
  status: string | null,
): "success" | "destructive" | "secondary" {
  if (!status) return "secondary";
  const s = status.toLowerCase();
  if (
    ["refund", "chargeback", "cancel", "dispute", "reembols"].some((d) =>
      s.includes(d),
    )
  )
    return "destructive";
  return "success";
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-mono text-xs tabular-nums">
        {value == null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

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

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-border/70 bg-background/60 p-3 font-mono text-xs">
      {value == null ? "— vazio —" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function SalesTable({ rows }: { rows: PurchaseRow[] }) {
  const [selected, setSelected] = useState<PurchaseRow | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Detalhe de um evento da jornada (dialog aninhado)
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDetail, setEventDetail] = useState<EventLogRow | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  async function open(r: PurchaseRow) {
    setSelected(r);
    setDetail(null);
    setLoading(true);
    try {
      setDetail(await fetchSaleDetail(r.id));
    } finally {
      setLoading(false);
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
      <div className="p-10 text-center text-sm text-muted-foreground">
        Nenhuma venda no período.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead className="hidden md:table-cell">Cliente</TableHead>
            <TableHead className="hidden lg:table-cell">Origem</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer"
              onClick={() => open(p)}
            >
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {formatDateTime(p.created_at)}
              </TableCell>
              <TableCell className="max-w-40 truncate">
                {p.product_name ?? "—"}
              </TableCell>
              <TableCell className="hidden max-w-[220px] truncate text-sm text-muted-foreground md:table-cell">
                <span className="flex items-center gap-1">
                  <span className="truncate">{p.email ?? "—"}</span>
                  {p.matched ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {p.match_reason}
                    </Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {p.utm_source ?? "—"}
                {p.utm_campaign ? ` · ${p.utm_campaign}` : ""}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCurrency(p.value, p.currency ?? "BRL")}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(p.status)}>
                  {p.status ?? "—"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side="right"
          className="w-[480px] max-w-[94%] overflow-y-auto"
        >
          {selected ? (
            <div className="space-y-5 pr-6">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <span>Venda</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {formatDateTime(selected.created_at)}
                </span>
              </SheetTitle>

              {/* Cliente */}
              <section className="rounded-lg border border-border/70 p-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cliente
                </h3>
                <Field
                  label="Nome"
                  value={loading ? "…" : detail?.name}
                />
                <Field
                  label="Email"
                  value={detail?.email ?? selected.email}
                />
                <Field label="Telefone" value={loading ? "…" : detail?.phone} />
                <Field label="Visitante" value={detail?.trckUserId} />
              </section>

              {/* Produtos comprados */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Produtos comprados
                  {detail ? (
                    <span className="ml-1 font-normal normal-case">
                      ({detail.products.length})
                    </span>
                  ) : null}
                </h3>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : detail && detail.products.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.products.map((pr) => (
                      <li
                        key={pr.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {pr.product_name ?? "—"}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {formatDateTime(pr.created_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={statusVariant(pr.status)}>
                            {pr.status ?? "—"}
                          </Badge>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(pr.value ?? 0, pr.currency ?? "BRL")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto encontrado.
                  </p>
                )}
              </section>

              {/* Histórico de eventos */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Histórico de eventos
                  {detail?.journey ? (
                    <span className="ml-1 font-normal normal-case">
                      ({detail.journey.length})
                    </span>
                  ) : null}
                </h3>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : !detail?.trckUserId ? (
                  <p className="text-sm text-muted-foreground">
                    Venda sem visitante associado (não casou por ID).
                  </p>
                ) : detail.journey.length > 0 ? (
                  <ol className="relative space-y-3 border-l border-border/70 pl-4">
                    {detail.journey.map((e) => {
                      const local =
                        [
                          e.geo_city,
                          e.geo_region,
                          e.geo_country ? countryName(e.geo_country) : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || null;
                      const utm = [
                        e.utm_source && `origem: ${e.utm_source}`,
                        e.utm_campaign && `camp: ${e.utm_campaign}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li key={e.id} className="relative">
                          <span
                            className="absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-card"
                            style={{
                              backgroundColor: eventChipStyle(e.event_name)
                                .color as string,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => openEvent(e.id)}
                            className="w-full rounded-md border border-border/60 p-2 text-left transition hover:border-primary/50 hover:bg-primary/5"
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
                            {local ? (
                              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {local}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sem eventos registrados deste visitante.
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
                <Field label="Campanha" value={eventDetail.utm_campaign} />
                <Field label="Conjunto" value={eventDetail.utm_term} />
                <Field label="Anúncio" value={eventDetail.utm_content} />
                <Field
                  label="Local"
                  value={
                    [
                      eventDetail.geo_city,
                      eventDetail.geo_region,
                      eventDetail.geo_country
                        ? countryName(eventDetail.geo_country)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || null
                  }
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
