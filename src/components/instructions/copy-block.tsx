"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { WEBHOOK_COMPRA_PATH } from "@/lib/constants";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";

/** Bloco de código com botão de copiar. */
export function CopyBlock({
  code,
  caption,
  className,
}: {
  code: string;
  caption?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bloqueado (http/permissão) — o texto continua selecionável
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      {caption ? (
        <p className="text-xs text-muted-foreground">{caption}</p>
      ) : null}
      <div className="group relative">
        <pre className="overflow-x-auto rounded-md border border-border/70 bg-background/60 p-3 pr-12 font-mono text-xs leading-relaxed">
          {code}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar"
          className="absolute right-2 top-2 rounded-md border border-border/70 bg-card/80 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-success" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Blocos que dependem do domínio onde o painel está rodando. No servidor o
 * origin é desconhecido, então mostramos um placeholder até a hidratação.
 */
export function SnippetBlock() {
  const origin = useOrigin() || "https://SEU-DOMINIO.com";
  return (
    <CopyBlock
      caption="Cole antes do </head> de TODAS as páginas do funil:"
      code={`<script async src="${origin}/t.js"></script>`}
    />
  );
}

export function WebhookUrlBlock() {
  const origin = useOrigin() || "https://SEU-DOMINIO.com";
  return (
    <CopyBlock
      caption="Formato da URL — o painel já monta ela pronta, com o token, para você copiar:"
      code={`${origin}${WEBHOOK_COMPRA_PATH}?token=<TOKEN>`}
    />
  );
}
