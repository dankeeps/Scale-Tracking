"use client";

import { Check, Copy, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
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
import { useOrigin } from "@/lib/use-origin";
import { buildWebhookUrl, normalizeDomain } from "@/lib/webhook/domain";

export function SettingsForm({
  settings,
}: {
  settings: {
    currency: string;
    test_event_code: string;
    webhook_token_mask: string | null;
    webhook_domain: string | null;
  };
}) {
  const origin = useOrigin();
  const [domain, setDomain] = useState(settings.webhook_domain ?? "");
  const [webhookToken, setWebhookToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // Enquanto o domínio não foi salvo, sugerimos o endereço atual do painel —
  // que é justamente onde o webhook responde.
  const effectiveDomain =
    normalizeDomain(domain) || normalizeDomain(origin) || "";
  const webhookUrl = buildWebhookUrl(effectiveDomain, webhookToken);
  const hasToken = webhookToken.trim().length > 0;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveSettings(null, formData);
      if (res?.ok) {
        toast.success("Configurações salvas.");
        // O token continua na tela de propósito: é a única chance de copiar a
        // URL completa — depois daqui o banco só devolve a máscara.
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  }

  function generate() {
    setWebhookToken(crypto.randomUUID().replace(/-/g, ""));
  }

  async function copyUrl() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Geral</CardTitle>
        <CardDescription>
          Moeda padrão, código de teste da Meta e o webhook de compra.
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
            <Label htmlFor="webhook_domain">Domínio do sistema</Label>
            <Input
              id="webhook_domain"
              name="webhook_domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="dados.seudominio.com"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              O endereço que você ligou na Vercel. Pode colar com{" "}
              <code>https://</code> ou sem — a gente limpa. É com ele que a URL
              do webhook é montada aqui embaixo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_url">
              URL do webhook — copie e cole na plataforma de venda
            </Label>
            {/* O token viaja escondido: na tela só existe a URL pronta. */}
            <input type="hidden" name="webhook_token" value={webhookToken} />
            <div className="flex gap-2">
              <Input
                id="webhook_url"
                readOnly
                value={webhookUrl}
                placeholder="preencha o domínio acima"
                className="font-mono text-xs"
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
              <Button
                type="button"
                variant="outline"
                onClick={copyUrl}
                disabled={!hasToken || !webhookUrl}
                className="shrink-0"
                aria-label="Copiar URL do webhook"
              >
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>

            {hasToken ? (
              <p className="flex items-start gap-2 rounded-md border border-accent-amber/30 bg-accent-amber/10 p-2.5 text-xs text-accent-amber">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Clique em <strong>Salvar</strong> e copie esta URL agora. O
                  token dentro dela é cifrado no banco: ao sair desta tela não é
                  exibido de novo — só dá para gerar outro.
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {settings.webhook_token_mask
                  ? `Já existe um token salvo (${settings.webhook_token_mask}), mas ele não pode ser exibido de novo. Clique em Gerar para criar outro — e atualize a URL na plataforma de venda.`
                  : "Clique em Gerar e a URL completa, já com o token, aparece aqui pronta para copiar."}
              </p>
            )}
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
