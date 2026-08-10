"use server";

import {
  type EventLogRow,
  getEventById,
  getVisitorJourney,
  type JourneyEvent,
} from "@/lib/dashboard/queries";
import * as demo from "@/lib/demo/data";
import { IS_DEMO } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/server";

/** Busca a jornada (histórico de eventos) de um visitante. Roda sob RLS com o
 *  cliente autenticado — só responde a usuários logados do painel. */
export async function fetchJourney(
  trckUserId: string,
): Promise<JourneyEvent[]> {
  if (!trckUserId) return [];
  if (IS_DEMO) return demo.journey(trckUserId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getVisitorJourney(supabase, trckUserId);
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
