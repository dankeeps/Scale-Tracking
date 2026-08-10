"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { metaObjectUrl } from "@/lib/constants";
import { DEMO_WRITE_ERROR, IS_DEMO } from "@/lib/demo/mode";
import { META_INSIGHTS_TAG } from "@/lib/dispatch/meta-ads";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CAMPANHAS_PATH = "/dashboard/campanhas";

async function requireUser() {
  if (IS_DEMO) throw new Error(DEMO_WRITE_ERROR);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
}

/** Força a atualização dos insights (invalida o cache) — sob demanda. */
export async function refreshInsights() {
  await requireUser();
  // "max": marca como stale e revalida em segundo plano (conservador).
  revalidateTag(META_INSIGHTS_TAG, "max");
  revalidatePath(CAMPANHAS_PATH);
}

/** Decifra o token da conta de anúncio (service_role) e devolve token + act_id. */
async function adAccountToken(
  admin: ReturnType<typeof createAdminClient>,
  adAccountDbId: string,
): Promise<{ token: string; adAccountId: string }> {
  const { data } = await admin
    .from("meta_ad_accounts")
    .select("ad_account_id, ads_token_enc")
    .eq("id", adAccountDbId)
    .single();
  const row = data as {
    ad_account_id: string;
    ads_token_enc: string | null;
  } | null;
  if (!row?.ads_token_enc || !row.ad_account_id) {
    throw new Error("Conta de anúncio não encontrada.");
  }
  const { data: token, error } = await admin.rpc("decrypt_secret", {
    ciphertext: row.ads_token_enc,
  });
  if (error || !token) throw new Error("Não foi possível ler o token da conta.");
  return { token: token as string, adAccountId: row.ad_account_id };
}

export type MetaWriteResult = { ok: boolean; message: string };

/** POST genérico a um nó do Meta (edita/pausa). Lê a mensagem de erro amigável. */
async function metaPost(
  objectId: string,
  token: string,
  params: Record<string, string>,
): Promise<MetaWriteResult> {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(metaObjectUrl(objectId), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && !json?.error) return { ok: true, message: "Atualizado." };
  return {
    ok: false,
    message:
      json?.error?.error_user_msg ??
      json?.error?.message ??
      "Falha ao atualizar no Meta.",
  };
}

/** Edita o orçamento (R$) de uma campanha (CBO) ou conjunto (ABO). */
export async function updateBudget(
  adAccountDbId: string,
  objectId: string,
  budgetType: "daily" | "lifetime",
  valueReais: number,
): Promise<MetaWriteResult> {
  await requireUser();
  const admin = createAdminClient();
  try {
    const cents = Math.round(valueReais * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      return { ok: false, message: "Valor inválido." };
    }
    const { token, adAccountId } = await adAccountToken(admin, adAccountDbId);
    const field =
      budgetType === "lifetime" ? "lifetime_budget" : "daily_budget";
    const r = await metaPost(objectId, token, { [field]: String(cents) });
    if (r.ok) {
      revalidateTag(`${META_INSIGHTS_TAG}:${adAccountId}`, "max");
      revalidatePath(CAMPANHAS_PATH);
    }
    return r;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erro." };
  }
}

/** Ativa/pausa uma campanha, conjunto ou anúncio. */
export async function toggleObjectStatus(
  adAccountDbId: string,
  objectId: string,
  next: boolean,
): Promise<MetaWriteResult> {
  await requireUser();
  const admin = createAdminClient();
  try {
    const { token, adAccountId } = await adAccountToken(admin, adAccountDbId);
    const r = await metaPost(objectId, token, {
      status: next ? "ACTIVE" : "PAUSED",
    });
    if (r.ok) {
      revalidateTag(`${META_INSIGHTS_TAG}:${adAccountId}`, "max");
      revalidatePath(CAMPANHAS_PATH);
    }
    return r;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erro." };
  }
}
