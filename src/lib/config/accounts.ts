// Descritores das contas cadastráveis (compartilhado entre client e server).
// Mapeamento para tabelas/colunas do banco fica no server (actions).

export type AccountKind = "ga4" | "pixel" | "adaccount";

export interface AccountKindMeta {
  kind: AccountKind;
  title: string; // título da aba/seção
  singular: string; // "conta GA4", "pixel"...
  idLabel: string; // rótulo do identificador público
  idPlaceholder: string;
  secretLabel: string; // rótulo do segredo
  secretPlaceholder: string;
}

export const ACCOUNT_KINDS: Record<AccountKind, AccountKindMeta> = {
  ga4: {
    kind: "ga4",
    title: "Propriedades GA4",
    singular: "propriedade GA4",
    idLabel: "Measurement ID",
    idPlaceholder: "G-XXXXXXXXXX",
    secretLabel: "API secret (Measurement Protocol)",
    secretPlaceholder: "cole o API secret",
  },
  pixel: {
    kind: "pixel",
    title: "Pixels Meta",
    singular: "pixel",
    idLabel: "Pixel ID",
    idPlaceholder: "123456789012345",
    secretLabel: "Token da Conversions API",
    secretPlaceholder: "cole o token da CAPI",
  },
  adaccount: {
    kind: "adaccount",
    title: "Contas de anúncio Meta",
    singular: "conta de anúncio",
    idLabel: "Ad Account ID",
    idPlaceholder: "act_1234567890 ou 1234567890",
    secretLabel: "Access token (Ads)",
    secretPlaceholder: "cole o access token",
  },
};

export const ACCOUNT_KIND_ORDER: AccountKind[] = ["pixel", "ga4", "adaccount"];

/** Formato normalizado de uma conta para a UI (sem segredos, só a máscara). */
export interface AccountRow {
  id: string;
  label: string;
  publicId: string;
  mask: string | null;
  is_active: boolean;
}
