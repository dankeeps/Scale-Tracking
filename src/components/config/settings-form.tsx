"use client";

import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/(panel)/dashboard/config/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { WEBHOOK_COMPRA_PATH } from "@/lib/constants";
import { useOrigin } from "@/lib/use-origin";

export function SettingsForm({
  settings,
}: {
  settings: {
    currency: string;
    test_event_code: string;
    webhook_token_mask: string | null;
  };
}) {
  const origin = useOrigin();
  const webhookUrl = `${origin}${WEBHOOK_COMPRA_PATH}`;
  const [webhookToken, setWebhookToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveSettings(null, formData);
      if (res?.ok) {
        toast.success("Configurações salvas.");
        setWebhookToken("");
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  }

  function generate() {
    setWebhookToken(crypto.randomUUID().replace(/-/g, ""));
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Geral</CardTitle>
        <CardDescription>
          Moeda padrão, código de teste da Meta e token do webhook de compra.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Moeda</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={settings.currency}
                placeholder="BRL"
                maxLength={3}
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test_event_code">
                Test event code (Meta) — opcional
              </Label>
              <Input
                id="test_event_code"
                name="test_event_code"
                defaultValue={settings.test_event_code}
                placeholder="TEST12345"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_token">Token do webhook</Label>
            <div className="flex gap-2">
              <Input
                id="webhook_token"
                name="webhook_token"
                type="text"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder={
                  settings.webhook_token_mask
                    ? `atual: ${settings.webhook_token_mask} — deixe em branco para manter`
                    : "gere ou cole um token"
                }
                autoComplete="off"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generate}
                className="shrink-0"
              >
                <RefreshCw className="size-4" />
                Gerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A plataforma de venda deve enviar este token no header do webhook.
              Fica cifrado no servidor.
            </p>
          </div>

          <div className="space-y-2">
            <Label>URL do webhook (cadastre na plataforma de venda)</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={copyUrl}
                className="shrink-0"
                aria-label="Copiar URL"
              >
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

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
        </form>
      </CardContent>
    </Card>
  );
}
