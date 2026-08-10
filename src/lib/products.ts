// Chave estável de um produto, consistente entre o webhook e o painel.
// Usa o product_id quando existe; senão, cai no product_name.

export function productKey(
  productId?: string | null,
  productName?: string | null,
): string | null {
  const id = productId?.trim();
  if (id) return id;
  const name = productName?.trim();
  return name || null;
}
