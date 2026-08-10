"use server";

import {
  type BuyerPurchase,
  type EventLogRow,
  getBuyerPurchases,
  getEventById,
  getVisitorJourney,
  type JourneyEvent,
} from "@/lib/dashboard/queries";
import * as demo from "@/lib/demo/data";
import { IS_DEMO } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/server";
import { normalizePurchase } from "@/lib/webhook/parse";

export interface SaleDetail {
  name: string | null;
  email: string | null;
  phone: string | null;
  trckUserId: string | null;
  products: BuyerPurchase[];
  journey: JourneyEvent[];
}

/**
 * Detalhe de uma venda: cliente (nome/email/telefone), todos os produtos que
 * essa pessoa comprou e o histórico de eventos dela. Roda sob RLS com o cliente
 * autenticado — só responde a usuários logados do painel.
 */
export async function fetchSaleDetail(
  purchaseId: string,
): Promise<SaleDetail | null> {
  if (!purchaseId) return null;
  if (IS_DEMO) return demo.saleDetail(purchaseId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: p } = await supabase
    .from("purchases")
    .select("trck_user_id, email, phone, raw_webhook")
    .eq("id", purchaseId)
    .single();
  if (!p) return null;

  const norm = normalizePurchase(p.raw_webhook);
  const [products, journey] = await Promise.all([
    getBuyerPurchases(supabase, {
      trckUserId: p.trck_user_id,
      email: p.email,
    }),
    p.trck_user_id
      ? getVisitorJourney(supabase, p.trck_user_id)
      : Promise.resolve([] as JourneyEvent[]),
  ]);

  return {
    name: norm.name,
    email: p.email,
    phone: p.phone,
    trckUserId: p.trck_user_id,
    products,
    journey,
  };
}

/** Detalhe completo de um evento (payloads/respostas) pelo id, sob RLS. */
export async function fetchEventDetail(
  eventId: string,
): Promise<EventLogRow | null> {
  if (!eventId) return null;
  if (IS_DEMO) return demo.eventDetail(eventId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getEventById(supabase, eventId);
}
