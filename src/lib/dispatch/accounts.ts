import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Lê as contas ATIVAS e decifra os segredos (via RPC decrypt_secret, só
// service_role). Usado pelos dispatchers no servidor. Nunca exposto ao cliente.

type Admin = SupabaseClient;

export interface MetaPixelAccount {
  id: string;
  pixel_id: string;
  label: string;
  token: string;
}

export interface Ga4Account {
  id: string;
  measurement_id: string;
  label: string;
  apiSecret: string;
}

async function decrypt(admin: Admin, ciphertext: string): Promise<string | null> {
  const { data, error } = await admin.rpc("decrypt_secret", { ciphertext });
  if (error) {
    console.error("[dispatch] decrypt error:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function getActiveMetaPixels(admin: Admin): Promise<MetaPixelAccount[]> {
  const { data, error } = await admin
    .from("meta_pixels")
    .select("id, pixel_id, label, capi_token_enc")
    .eq("is_active", true);
  if (error) {
    console.error("[dispatch] load pixels error:", error.message);
    return [];
  }

  const out: MetaPixelAccount[] = [];
  for (const r of data ?? []) {
    const enc = (r as { capi_token_enc: string | null }).capi_token_enc;
    if (!enc) continue;
    const token = await decrypt(admin, enc);
    if (token) {
      out.push({ id: r.id, pixel_id: r.pixel_id, label: r.label, token });
    }
  }
  return out;
}

export interface AdAccount {
  id: string;
  ad_account_id: string;
  label: string;
  token: string;
}

export async function getActiveAdAccounts(admin: Admin): Promise<AdAccount[]> {
  const { data, error } = await admin
    .from("meta_ad_accounts")
    .select("id, ad_account_id, label, ads_token_enc")
    .eq("is_active", true);
  if (error) {
    console.error("[dispatch] load ad accounts error:", error.message);
    return [];
  }
  const out: AdAccount[] = [];
  for (const r of data ?? []) {
    const enc = (r as { ads_token_enc: string | null }).ads_token_enc;
    if (!enc) continue;
    const token = await decrypt(admin, enc);
    if (token) {
      out.push({
        id: r.id,
        ad_account_id: r.ad_account_id,
        label: r.label,
        token,
      });
    }
  }
  return out;
}

export async function getActiveGa4Accounts(admin: Admin): Promise<Ga4Account[]> {
  const { data, error } = await admin
    .from("ga4_accounts")
    .select("id, measurement_id, label, api_secret_enc")
    .eq("is_active", true);
  if (error) {
    console.error("[dispatch] load ga4 error:", error.message);
    return [];
  }

  const out: Ga4Account[] = [];
  for (const r of data ?? []) {
    const enc = (r as { api_secret_enc: string | null }).api_secret_enc;
    if (!enc) continue;
    const apiSecret = await decrypt(admin, enc);
    if (apiSecret) {
      out.push({
        id: r.id,
        measurement_id: r.measurement_id,
        label: r.label,
        apiSecret,
      });
    }
  }
  return out;
}
