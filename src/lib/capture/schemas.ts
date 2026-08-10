import { z } from "zod";

// Strings opcionais com teto de tamanho (evita abuso nos endpoints públicos).
const str = (max = 512) => z.string().trim().max(max).optional();

const utms = {
  utm_source: str(256),
  utm_medium: str(256),
  utm_campaign: str(256),
  utm_term: str(256),
  utm_content: str(256),
};

export const identifySchema = z.object({
  trck_user_id: z.string().trim().max(64).optional(),
  email: str(320),
  phone: str(32),
  first_name: str(128),
  last_name: str(128),
  city: str(128),
  state: str(128),
  country: str(64),
  fbp: str(256),
  fbc: str(256),
  ga_client_id: str(128),
  ga_session_id: str(128),
  referrer: str(2048),
  pixel_id: str(64),
  ...utms,
});
export type IdentifyInput = z.infer<typeof identifySchema>;

export const eventSchema = z.object({
  trck_user_id: z.string().trim().max(64).optional(),
  event_name: z.string().trim().min(1).max(64),
  event_id: z.string().trim().max(128).optional(),
  event_source_url: str(2048),
  test_event: z.boolean().optional(), // modo teste (?fbtest=1) → test_event_code na CAPI
  value: z.number().nonnegative().max(1_000_000_000).optional(),
  currency: str(8),
  content_ids: z.array(z.string().max(128)).max(100).optional(),
  content_name: str(256),
  content_type: str(64),
  fbp: str(256), // enviado pelo snippet; usado direto no CAPI (fallback: visitante)
  fbc: str(256),
  ...utms,
});
export type EventInput = z.infer<typeof eventSchema>;
