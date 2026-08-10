/**
 * Constantes centralizadas do sistema de tracking.
 * Sempre que uma API tiver versão na URL, mantenha-a AQUI (fonte única).
 */

// ── Meta / Facebook Graph API ────────────────────────────────────────────────
/** Versão da Graph API. Atualize aqui e propaga para CAPI e Ads Insights. */
export const META_GRAPH_VERSION = "v25.0";
export const META_GRAPH_BASE = "https://graph.facebook.com" as const;

/** URL da Conversions API para um pixel. */
export function metaCapiUrl(pixelId: string): string {
  return `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${pixelId}/events`;
}

/** URL de insights de uma conta de anúncios (act_<id>). */
export function metaInsightsUrl(adAccountId: string): string {
  return `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${normalizeAdAccountId(adAccountId)}/insights`;
}

/** URL do nó de uma conta de anúncios (para checar acesso/token). */
export function metaAdAccountUrl(adAccountId: string): string {
  return `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${normalizeAdAccountId(adAccountId)}`;
}

/** URL de uma borda da conta (campaigns/adsets/ads). */
export function metaEdgeUrl(adAccountId: string, edge: string): string {
  return `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${normalizeAdAccountId(adAccountId)}/${edge}`;
}

/** URL de um nó (campanha/conjunto/anúncio) por id cru — para editar/pausar. */
export function metaObjectUrl(objectId: string): string {
  return `${META_GRAPH_BASE}/${META_GRAPH_VERSION}/${objectId}`;
}

/** Garante o prefixo act_ no ad account id. */
export function normalizeAdAccountId(adAccountId: string): string {
  const id = adAccountId.trim();
  return id.startsWith("act_") ? id : `act_${id}`;
}

/** Caminho do webhook de compra (registrar na plataforma de venda). */
export const WEBHOOK_COMPRA_PATH = "/api/webhook/compra";

// ── Google Analytics 4 ───────────────────────────────────────────────────────
/** Measurement Protocol (server-side, evento offline). */
export const GA4_MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";
export const GA4_MP_DEBUG_ENDPOINT =
  "https://www.google-analytics.com/debug/mp/collect";
/** gtag.js (carregada dinamicamente no cliente com o measurement_id da config). */
export const GA4_GTAG_BASE = "https://www.googletagmanager.com/gtag/js";

// ── Rate limiting (endpoints públicos) ───────────────────────────────────────
/** Janela e limites por IP. Conservador de propósito. */
export const RATE_LIMITS = {
  identify: { windowSeconds: 60, max: 60 },
  event: { windowSeconds: 60, max: 120 },
  webhook: { windowSeconds: 60, max: 120 },
} as const;

// ── Cache de insights de campanhas (Meta Ads) ────────────────────────────────
/** TTL do cache de insights e limite conservador de requisições. */
export const META_INSIGHTS_CACHE_TTL_SECONDS = 60 * 30; // 30 min
export const META_INSIGHTS_MIN_REFRESH_SECONDS = 60 * 15; // atualização espaçada

// ── Retenção de logs ─────────────────────────────────────────────────────────
/** Dias após os quais os campos pesados de events_log são zerados (pg_cron). */
export const EVENTS_LOG_HEAVY_RETENTION_DAYS = 14;
