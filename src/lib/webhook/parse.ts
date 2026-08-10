// Normalizador GENÉRICO de webhooks de compra (Hotmart / Kiwify / Eduzz e outros).
// Estratégia: tenta uma lista de caminhos candidatos por campo e, se falhar, faz
// uma busca recursiva por nome de chave. Fácil de estender com novos caminhos.

type Json = Record<string, unknown>;

/** Resolve um caminho "a.b.0.c" dentro do objeto. */
function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Json)[p];
  }
  return cur;
}

/** Primeiro valor não-vazio entre os caminhos candidatos. */
function pick(obj: unknown, paths: string[]): unknown {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Busca recursiva pelo primeiro valor primitivo cuja chave casa (case-insensitive). */
function deepFind(obj: unknown, keys: string[], depth = 6): unknown {
  if (depth < 0 || obj == null || typeof obj !== "object") return undefined;
  const wanted = keys.map((k) => k.toLowerCase());
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v] as const)
    : Object.entries(obj as Json);
  // 1) chaves diretas
  for (const [k, v] of entries) {
    if (
      wanted.includes(k.toLowerCase()) &&
      (typeof v === "string" || typeof v === "number")
    ) {
      return v;
    }
  }
  // 2) desce um nível
  for (const [, v] of entries) {
    if (v && typeof v === "object") {
      const found = deepFind(v, keys, depth - 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function firstDefined(...vals: unknown[]): unknown {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

function toStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return String(v).trim() || null;
}

/** Converte a data da venda (epoch ms/seg ou ISO) do webhook em ISO string. */
export function parseWebhookDate(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    let n = Number(v);
    if (n < 1e12) n *= 1000; // segundos → ms
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Converte valores monetários variados ("197,00", "1.234,56", 19700, "197.0") em number. */
export function parseMoney(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (s === "") return null;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // O separador decimal é o último que aparece.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export interface NormalizedPurchase {
  transaction_id: string | null;
  value: number | null;
  currency: string | null;
  status: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  product_id: string | null;
  product_name: string | null;
  purchased_at: string | null; // data REAL da venda (aprovação), não a de chegada
  trck_user_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

export function normalizePurchase(raw: unknown): NormalizedPurchase {
  const transaction_id = toStr(
    firstDefined(
      pick(raw, [
        "data.purchase.transaction",
        "order_id",
        "trans_cod",
        "transaction_id",
        "transaction",
        "order.id",
        "sale.id",
        "id",
      ]),
      deepFind(raw, ["transaction_id", "transaction", "order_id", "trans_cod"]),
    ),
  );

  const value = parseMoney(
    firstDefined(
      pick(raw, [
        "data.purchase.price.value",
        "data.purchase.full_price.value",
        "Commissions.charge_amount",
        "trans_value",
        "order.amount",
        "value",
        "amount",
        "price",
        "total",
      ]),
      deepFind(raw, ["value", "amount", "price", "charge_amount", "trans_value"]),
    ),
  );

  const currency = toStr(
    pick(raw, [
      "data.purchase.price.currency_value",
      "currency",
      "trans_currency",
      "order.currency",
    ]),
  );

  const status = toStr(
    firstDefined(
      pick(raw, [
        "data.purchase.status",
        "order_status",
        "trans_status",
        "status",
        "webhook_event_type",
        "event",
      ]),
      deepFind(raw, ["status", "order_status", "trans_status"]),
    ),
  );

  const email = toStr(
    firstDefined(
      pick(raw, [
        "data.buyer.email",
        "Customer.email",
        "client_email",
        "buyer.email",
        "customer.email",
        "email",
      ]),
      deepFind(raw, ["email", "client_email"]),
    ),
  );

  const phone = toStr(
    firstDefined(
      pick(raw, [
        "data.buyer.phone",
        "data.buyer.checkout_phone",
        "Customer.mobile",
        "Customer.phone",
        "client_cel",
        "buyer.phone",
        "phone",
      ]),
      deepFind(raw, ["phone", "mobile", "cellphone", "client_cel", "celular"]),
    ),
  );

  const name = toStr(
    firstDefined(
      pick(raw, [
        "data.buyer.name",
        "Customer.full_name",
        "client_name",
        "buyer.name",
        "customer.name",
        "name",
      ]),
      deepFind(raw, ["full_name", "name", "client_name"]),
    ),
  );

  const product_name = toStr(
    firstDefined(
      pick(raw, [
        "data.product.name",
        "Product.product_name",
        "product_name",
        "product.name",
      ]),
      deepFind(raw, ["product_name"]),
    ),
  );

  const product_id = toStr(
    pick(raw, [
      "data.product.id",
      "Product.product_id",
      "product_id",
      "product.id",
    ]),
  );

  // Data REAL da venda (aprovação). Para eventos tardios (ex.: PURCHASE_COMPLETE
  // da Hotmart, dias após a compra), isso mantém a venda no dia CERTO.
  const purchased_at = parseWebhookDate(
    pick(raw, [
      "data.purchase.approved_date",
      "data.purchase.order_date",
      "approved_date",
      "paid_at",
      "order_date",
      "trans_paiddate",
      "trans_createdate",
      "created_at",
    ]),
  );

  // trck_user_id chega via parâmetro decorado na URL de checkout (?trck=…),
  // que as plataformas costumam expor como src/sck/UTM/campo custom.
  const trck_user_id = toStr(
    firstDefined(
      pick(raw, [
        "data.purchase.tracking.source_sck",
        "data.purchase.origin.sck",
        "data.purchase.sck",
        "trck",
        "trck_user_id",
        "src",
        "sck",
        "s",
      ]),
      deepFind(raw, ["trck", "trck_user_id"]),
    ),
  );

  const utm = (names: string[]) =>
    toStr(firstDefined(pick(raw, names), deepFind(raw, [names[names.length - 1]])));

  return {
    transaction_id,
    value,
    currency,
    status,
    email,
    phone,
    name,
    product_id,
    product_name,
    purchased_at,
    trck_user_id,
    utm_source: utm(["utm_source", "src"]),
    utm_medium: utm(["utm_medium"]),
    utm_campaign: utm(["utm_campaign"]),
    utm_term: utm(["utm_term"]),
    utm_content: utm(["utm_content"]),
  };
}

/** Só NÃO dispara Purchase em status claramente negativos; caso contrário, dispara. */
export function shouldDispatchPurchase(status: string | null): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  const deny = [
    "refund",
    "chargeback",
    "cancel",
    "dispute",
    "pending",
    "waiting",
    "expired",
    "abandon",
    "reject",
    "billet_printed",
    "printed_billet",
    "delayed",
  ];
  return !deny.some((d) => s.includes(d));
}

/**
 * Se o Purchase deve virar uma linha na aba Eventos (events_log). Mais liberal
 * que o disparo: mantém pendentes/aguardando (viram venda ao serem pagos, com o
 * MESMO event_id), mas exclui reversões/não-vendas claras — pra uma reversão não
 * sobrescrever/apagar a linha de uma venda real.
 */
export function shouldLogPurchaseEvent(status: string | null): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  const deny = [
    "refund",
    "chargeback",
    "cancel",
    "dispute",
    "reject",
    "expired",
    "abandon",
    "delayed",
    "billet_printed",
    "printed_billet",
  ];
  return !deny.some((d) => s.includes(d));
}

/** Divide "João da Silva" em first/last. */
export function splitName(name: string | null): {
  first: string | null;
  last: string | null;
} {
  if (!name) return { first: null, last: null };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
