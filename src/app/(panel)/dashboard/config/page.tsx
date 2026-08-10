import { PageHeader } from "@/components/panel/page-header";
import { ConfigTabs } from "@/components/config/config-tabs";
import type { AccountRow } from "@/lib/config/accounts";
import { getProducts, type ProductRow } from "@/lib/config/products";
import { getSource } from "@/lib/dashboard/data";
import * as demo from "@/lib/demo/data";

export const dynamic = "force-dynamic";

interface ConfigData {
  settings: {
    currency: string;
    test_event_code: string;
    webhook_token_mask: string | null;
    webhook_domain: string | null;
  };
  pixels: AccountRow[];
  ga4: AccountRow[];
  adaccounts: AccountRow[];
  products: ProductRow[];
}

async function loadConfig(): Promise<ConfigData> {
  const src = await getSource();
  if (!src.db) return demo.config();
  const supabase = src.db;

  const [settingsRes, ga4Res, pixelRes, adRes, products] = await Promise.all([
    supabase
      .from("settings")
      .select("webhook_token_mask, currency, test_event_code, webhook_domain")
      .eq("id", 1)
      .single(),
    supabase
      .from("ga4_accounts")
      .select("id, label, measurement_id, api_secret_mask, is_active")
      .order("created_at", { ascending: true }),
    supabase
      .from("meta_pixels")
      .select("id, label, pixel_id, capi_token_mask, is_active")
      .order("created_at", { ascending: true }),
    supabase
      .from("meta_ad_accounts")
      .select("id, label, ad_account_id, ads_token_mask, is_active")
      .order("created_at", { ascending: true }),
    getProducts(supabase),
  ]);

  return {
    settings: {
      currency: settingsRes.data?.currency ?? "BRL",
      test_event_code: settingsRes.data?.test_event_code ?? "",
      webhook_token_mask: settingsRes.data?.webhook_token_mask ?? null,
      webhook_domain: settingsRes.data?.webhook_domain ?? null,
    },
    ga4: (ga4Res.data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      publicId: r.measurement_id,
      mask: r.api_secret_mask,
      is_active: r.is_active,
    })),
    pixels: (pixelRes.data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      publicId: r.pixel_id,
      mask: r.capi_token_mask,
      is_active: r.is_active,
    })),
    adaccounts: (adRes.data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      publicId: r.ad_account_id,
      mask: r.ads_token_mask,
      is_active: r.is_active,
    })),
    products,
  };
}

export default async function ConfigPage() {
  const { settings, pixels, ga4, adaccounts, products } = await loadConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Contas de Meta e GA4 (segredos cifrados no servidor) e ajustes gerais."
      />
      <ConfigTabs
        settings={settings}
        pixels={pixels}
        ga4={ga4}
        adaccounts={adaccounts}
        products={products}
      />
    </div>
  );
}
