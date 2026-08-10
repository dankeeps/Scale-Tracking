"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { saveAccount } from "@/app/(panel)/dashboard/config/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { AccountKindMeta, AccountRow } from "@/lib/config/accounts";

export function AccountDialog({
  meta,
  item,
}: {
  meta: AccountKindMeta;
  item?: AccountRow;
}) {
  const isEdit = Boolean(item);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(item?.is_active ?? true);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setActive(item?.is_active ?? true); // reset ao abrir
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveAccount(null, formData);
      if (res?.ok) {
        toast.success(isEdit ? "Conta atualizada." : "Conta adicionada.");
        setOpen(false);
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            Adicionar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar" : "Adicionar"} {meta.singular}
          </DialogTitle>
          <DialogDescription>
            O segredo é cifrado no servidor e nunca volta para o navegador.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="kind" value={meta.kind} />
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <input type="hidden" name="is_active" value={active ? "1" : "0"} />

          <div className="space-y-2">
            <Label htmlFor="label">Rótulo</Label>
            <Input
              id="label"
              name="label"
              defaultValue={item?.label}
              placeholder="ex.: Conta principal"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicId">{meta.idLabel}</Label>
            <Input
              id="publicId"
              name="publicId"
              defaultValue={item?.publicId}
              placeholder={meta.idPlaceholder}
              className="font-mono"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret">{meta.secretLabel}</Label>
            <Input
              id="secret"
              name="secret"
              type="password"
              autoComplete="off"
              placeholder={
                isEdit
                  ? item?.mask
                    ? `atual: ${item.mask} — deixe em branco para manter`
                    : "deixe em branco para manter"
                  : meta.secretPlaceholder
              }
              className="font-mono"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Ativa</p>
              <p className="text-xs text-muted-foreground">
                Recebe os eventos disparados pelo servidor.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
