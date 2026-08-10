/*
 * Semeia dados de DEMONSTRAÇÃO (visitantes/eventos/compras fictícios) para
 * visualizar o painel. Tudo marcado com prefixos seed-/SEED- para remoção fácil.
 *
 *   node --env-file=.env.local scripts/seed-demo.mjs          # insere
 *   node --env-file=.env.local scripts/seed-demo.mjs --clean  # remove
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const sha = (v) => createHash("sha256").update(String(v)).digest("hex");
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (n) => Math.floor(Math.random() * n);
const daysAgo = (d) =>
  new Date(Date.now() - d * 86400_000 - rnd(86400_000)).toISOString();

if (process.argv.includes("--clean")) {
  await admin.from("events_log").delete().like("event_id", "seed-%");
  await admin.from("purchases").delete().like("transaction_id", "SEED-%");
  await admin.from("visitors").delete().like("trck_user_id", "seed-%");
  console.log("Dados de demo removidos.");
  process.exit(0);
}

const GEO = [
  ["BR", "SP", "São Paulo"], ["BR", "SP", "São Paulo"], ["BR", "RJ", "Rio de Janeiro"],
  ["BR", "MG", "Belo Horizonte"], ["BR", "PR", "Curitiba"], ["BR", "RS", "Porto Alegre"],
  ["BR", "BA", "Salvador"], ["BR", "SC", "Florianópolis"], ["BR", "PE", "Recife"],
  ["BR", "CE", "Fortaleza"], ["US", "FL", "Miami"], ["PT", "11", "Lisboa"],
];
const SOURCES = ["instagram", "facebook", "google", "whatsapp", "tiktok"];
const CAMPAIGNS = ["lancamento-julho", "remarketing", "topo-funil", "black-week"];
const PRODUCTS = [
  ["Curso Completo", "curso", 497], ["Mentoria", "mentoria", 1997],
  ["Ebook Tráfego", "ebook", 47], ["Workshop", "workshop", 197],
];
const N = 220;

const visitors = [];
const events = [];
const purchases = [];

for (let i = 0; i < N; i++) {
  const id = `seed-${i}-${Math.random().toString(36).slice(2, 8)}`;
  const [c, r, city] = pick(GEO);
  const src = pick(SOURCES);
  const camp = pick(CAMPAIGNS);
  const created = daysAgo(rnd(30));
  const email = Math.random() < 0.5 ? `cliente${i}@exemplo.com` : null;

  visitors.push({
    trck_user_id: id,
    email,
    email_hash: email ? sha(email) : null,
    ga_client_id: `${rnd(1e9)}.${rnd(1e9)}`,
    fbp: `fb.1.${Date.now()}.${rnd(1e9)}`,
    utm_source: src,
    utm_medium: "cpc",
    utm_campaign: camp,
    geo_country: c,
    geo_region: r,
    geo_city: city,
    ip: `189.${rnd(255)}.${rnd(255)}.${rnd(255)}`,
    user_agent: "Mozilla/5.0 (demo)",
    created_at: created,
  });

  const base = { trck_user_id: id, utm_source: src, utm_campaign: camp, geo_country: c, geo_region: r, geo_city: city, ip: "189.0.0.1" };
  events.push({ ...base, event_name: "PageView", event_id: `seed-${id}-pv`, created_at: created });
  if (Math.random() < 0.45)
    events.push({ ...base, event_name: "Lead", event_id: `seed-${id}-ld`, created_at: created });

  const didCheckout = Math.random() < 0.22;
  if (didCheckout) {
    events.push({ ...base, event_name: "InitiateCheckout", event_id: `seed-${id}-ck`, created_at: created });
    if (Math.random() < 0.5) {
      const [pname, pid, price] = pick(PRODUCTS);
      const refunded = Math.random() < 0.08;
      const tx = `SEED-${i}-${rnd(1e6)}`;
      events.push({ ...base, event_name: "Purchase", event_id: `seed-${id}-pu`, created_at: created });
      purchases.push({
        transaction_id: tx,
        trck_user_id: id,
        email: email ?? `cliente${i}@exemplo.com`,
        email_hash: sha(email ?? `cliente${i}@exemplo.com`),
        product_id: pid,
        product_name: pname,
        value: price,
        currency: "BRL",
        status: refunded ? "refunded" : "approved",
        utm_source: src,
        utm_medium: "cpc",
        utm_campaign: camp,
        geo_country: c,
        geo_region: r,
        geo_city: city,
        ga_client_id: `${rnd(1e9)}.${rnd(1e9)}`,
        matched: true,
        match_reason: "trck_user_id",
        meta_event_id: `pur_${tx}`,
        created_at: created,
      });
    }
  }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
for (const c of chunk(visitors, 500)) await admin.from("visitors").insert(c);
for (const c of chunk(events, 500)) await admin.from("events_log").insert(c);
for (const c of chunk(purchases, 500)) await admin.from("purchases").insert(c);

console.log(`Semeado: ${visitors.length} visitantes, ${events.length} eventos, ${purchases.length} compras.`);
console.log("Para remover: node --env-file=.env.local scripts/seed-demo.mjs --clean");
