"use client";

import { Package } from "lucide-react";
import { useTransition } from "react";
import { toggleProductMeta } from "@/app/(panel)/dashboard/config/actions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { ProductRow } from "@/lib/config/products";
import { formatCurrency, formatNumber } from "@/lib/format";

function MetaToggle({ product }: { product: ProductRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={product.send_meta}
      disabled={pending}
      aria-label={product.send_meta ? "Não enviar ao Meta" : "Enviar ao Meta"}
      onCheckedChange={(next) =>
        startTransition(async () => {
          try {
            await toggleProductMeta(product.key, product.name, next);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
          }
        })
      }
    />
  );
}

export function ProductsSection({ products }: { products: ProductRow[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold">Produtos</h2>
        <p className="text-sm text-muted-foreground">
          Produtos que já geraram venda. Desligue o envio ao Meta para os que não
          quer marcar no Gerenciador (ex.: upsells). Não afeta GA4 nem as
          Vendas. Produto novo entra ligado por padrão.
        </p>
      </div>

      {products.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Package className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum produto vendido ainda.
          </p>
        </Card>
      ) : (
        <Card variant="solid" className="divide-y divide-border/70">
          {products.map((p) => (
            <div
              key={p.key}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <span className="block truncate font-medium">{p.name}</span>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {p.key}
                </p>
                <p className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatNumber(p.sales)} vendas · {formatCurrency(p.revenue)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Enviar ao Meta
                </span>
                <MetaToggle product={p} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
