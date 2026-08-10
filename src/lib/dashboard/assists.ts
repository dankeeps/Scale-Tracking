import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateRange } from "@/lib/dashboard/range";

// Atribuição multi-touch (NOSSA, same-device via trck_user_id). Reconstrói a
// jornada de cada comprador a partir do events_log e marca como "assistência"
// toda campanha/conjunto/anúncio que participou do caminho mas NÃO foi o último
// clique (o que levou a venda). Depende dos UTMs em cada toque.

const CAP = 50_000;
const PATHS_PER_OBJ = 40;
const CHUNK = 300;

function isRefund(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return ["refund", "chargeback", "cancel", "dispute", "reembols"].some((d) =>
    s.includes(d),
  );
}

export interface PathStep {
  campaign: string;
  adset: string | null;
  ad: string | null;
  events: string[];
  at: string;
}
export interface ConversionPath {
  value: number;
  convertedAt: string;
  converting: { campaign: string; adset: string | null; ad: string | null };
  steps: PathStep[];
}
export interface AssistAgg {
  count: number;
  paths: ConversionPath[];
}
export interface AssistMaps {
  campaigns: Map<string, AssistAgg>; // key = utm_campaign (lower)
  adsets: Map<string, AssistAgg>; // key = utm_term (lower)
  ads: Map<string, AssistAgg>; // key = utm_content (lower)
}

interface Ev {
  name: string;
  camp: string | null;
  term: string | null;
  content: string | null;
  at: string;
}
interface Step {
  campRaw: string;
  termRaw: string | null;
  adRaw: string | null;
  events: Set<string>;
  at: string;
}

export async function getAssists(
  db: SupabaseClient,
  range: DateRange,
  nameMap: Record<string, string>,
): Promise<AssistMaps> {
  const maps: AssistMaps = {
    campaigns: new Map(),
    adsets: new Map(),
    ads: new Map(),
  };
  const resolve = (v: string | null): string | null =>
    v ? (nameMap[v] ?? v) : null;

  // 1) compras pagas do período
  let pq = db
    .from("purchases")
    .select("trck_user_id, utm_campaign, utm_term, utm_content, value, status, created_at")
    .limit(CAP);
  if (range.from) pq = pq.gte("created_at", range.from);
  pq = pq.lt("created_at", range.to);
  const { data: purchases } = await pq;
  const paid = (purchases ?? []).filter(
    (p) => !isRefund(p.status) && p.value != null && p.trck_user_id,
  );
  if (paid.length === 0) return maps;

  // 2) eventos (toques com utm_campaign) dos compradores. Os compradores são
  // fatiados em blocos de CHUNK ids porque o `in(...)` tem limite prático de
  // tamanho de URL — e os blocos vão em PARALELO: em série, uma base com muitos
  // compradores empilhava dezenas de idas ao banco uma após a outra.
  const buyers = [...new Set(paid.map((p) => p.trck_user_id as string))];
  const chunks: string[][] = [];
  for (let i = 0; i < buyers.length; i += CHUNK) {
    chunks.push(buyers.slice(i, i + CHUNK));
  }

  const evByBuyer = new Map<string, Ev[]>();
  const results = await Promise.all(
    chunks.map((chunk) =>
      db
        .from("events_log")
        .select(
          "trck_user_id, event_name, utm_campaign, utm_term, utm_content, created_at",
        )
        .in("trck_user_id", chunk)
        .not("utm_campaign", "is", null)
        .order("created_at", { ascending: true })
        .limit(CAP),
    ),
  );
  for (const { data: evs } of results) {
    for (const e of evs ?? []) {
      const arr = evByBuyer.get(e.trck_user_id) ?? [];
      arr.push({
        name: e.event_name,
        camp: e.utm_campaign,
        term: e.utm_term,
        content: e.utm_content,
        at: e.created_at,
      });
      evByBuyer.set(e.trck_user_id, arr);
    }
  }

  const addAssist = (
    m: Map<string, AssistAgg>,
    keyRaw: string | null,
    path: ConversionPath,
  ) => {
    if (!keyRaw) return;
    const k = keyRaw.toLowerCase();
    const cur = m.get(k) ?? { count: 0, paths: [] };
    cur.count++;
    if (cur.paths.length < PATHS_PER_OBJ) cur.paths.push(path);
    m.set(k, cur);
  };

  for (const p of paid) {
    const evs = (evByBuyer.get(p.trck_user_id as string) ?? []).filter(
      (e) => e.camp && e.at <= p.created_at,
    );
    if (evs.length === 0) continue;

    // agrupa toques consecutivos da mesma campanha em um "passo"
    const steps: Step[] = [];
    for (const e of evs) {
      const camp = e.camp as string;
      const last = steps[steps.length - 1];
      if (last && last.campRaw === camp) {
        last.events.add(e.name);
        if (!last.termRaw && e.term) last.termRaw = e.term;
        if (!last.adRaw && e.content) last.adRaw = e.content;
      } else {
        steps.push({
          campRaw: camp,
          termRaw: e.term ?? null,
          adRaw: e.content ?? null,
          events: new Set([e.name]),
          at: e.at,
        });
      }
    }
    if (steps.length === 0) continue;

    const convCamp = (
      p.utm_campaign ?? steps[steps.length - 1].campRaw
    ).toLowerCase();
    const convTerm = (p.utm_term ?? "").toLowerCase();
    const convAd = (p.utm_content ?? "").toLowerCase();

    const path: ConversionPath = {
      value: Number(p.value),
      convertedAt: p.created_at,
      converting: {
        campaign: resolve(p.utm_campaign ?? steps[steps.length - 1].campRaw) ?? "—",
        adset: resolve(p.utm_term),
        ad: resolve(p.utm_content),
      },
      steps: steps.map((s) => ({
        campaign: resolve(s.campRaw) ?? "—",
        adset: resolve(s.termRaw),
        ad: resolve(s.adRaw),
        events: [...s.events],
        at: s.at,
      })),
    };

    // assistência = objeto no caminho que NÃO é o convertedor (dedupe por objeto)
    const seenC = new Set<string>();
    const seenA = new Set<string>();
    const seenD = new Set<string>();
    for (const s of steps) {
      const cl = s.campRaw.toLowerCase();
      if (cl !== convCamp && !seenC.has(cl)) {
        seenC.add(cl);
        addAssist(maps.campaigns, s.campRaw, path);
      }
      if (s.termRaw) {
        const tl = s.termRaw.toLowerCase();
        if (tl !== convTerm && !seenA.has(tl)) {
          seenA.add(tl);
          addAssist(maps.adsets, s.termRaw, path);
        }
      }
      if (s.adRaw) {
        const al = s.adRaw.toLowerCase();
        if (al !== convAd && !seenD.has(al)) {
          seenD.add(al);
          addAssist(maps.ads, s.adRaw, path);
        }
      }
    }
  }

  return maps;
}
