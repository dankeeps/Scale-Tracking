"use client";

import { KeyRound } from "lucide-react";
import { useTransition } from "react";
import { toggleActive } from "@/app/(panel)/dashboard/config/actions";
import { AccountDialog } from "@/components/config/account-dialog";
import { DeleteAccountButton } from "@/components/config/delete-account-button";
import { TestConnectionButton } from "@/components/config/test-connection-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { AccountKindMeta, AccountRow } from "@/lib/config/accounts";

function ActiveToggle({
  kind,
  id,
  active,
}: {
  kind: AccountKindMeta["kind"];
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={active}
      disabled={pending}
      aria-label={active ? "Desativar" : "Ativar"}
      onCheckedChange={(next) =>
        startTransition(async () => {
          try {
            await toggleActive(kind, id, next);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
          }
        })
      }
    />
  );
}

export function AccountSection({
  meta,
  items,
}: {
  meta: AccountKindMeta;
  items: AccountRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{meta.title}</h2>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <AccountDialog meta={meta} />
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <KeyRound className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma {meta.singular} cadastrada ainda.
          </p>
        </Card>
      ) : (
        <Card variant="solid" className="divide-y divide-border/70">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{item.label}</span>
                  {!item.is_active ? (
                    <Badge variant="secondary">inativa</Badge>
                  ) : null}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {item.publicId}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  segredo: {item.mask ?? "— não definido —"}
                </p>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <ActiveToggle
                  kind={meta.kind}
                  id={item.id}
                  active={item.is_active}
                />
                <TestConnectionButton kind={meta.kind} id={item.id} />
                <AccountDialog meta={meta} item={item} />
                <DeleteAccountButton
                  kind={meta.kind}
                  id={item.id}
                  label={item.label}
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
