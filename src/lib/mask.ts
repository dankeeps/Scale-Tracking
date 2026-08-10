/**
 * Higieniza valores colados (tokens/ids): remove controles e caracteres
 * invisíveis/zero-width (ex.: U+200B que a Meta rejeita com "Cannot parse
 * access token") e apara as pontas. Nossos segredos/ids são ASCII.
 */
export function sanitizeSecret(v: string | null | undefined): string {
  if (!v) return "";
  return [...v]
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return false; // controles C0/C1, DEL
      if (c === 0xa0) return false; // NBSP
      if (c >= 0x200b && c <= 0x200f) return false; // zero-width + marcas LRM/RLM
      if (c >= 0x2028 && c <= 0x202e) return false; // separadores/override bidi
      if (c === 0x2060 || c === 0xfeff) return false; // word joiner / BOM
      return true;
    })
    .join("")
    .trim();
}

/** Máscara de exibição de segredos: mantém só os últimos 4 caracteres. */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length === 0) return null;
  if (v.length <= 4) return "•".repeat(v.length);
  return `••••${v.slice(-4)}`;
}
