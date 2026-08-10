"use client";

import { Loader2, Plug } from "lucide-react";
import { useTransition } from "react";
import { testConnection } from "@/app/(panel)/dashboard/config/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import type { AccountKind } from "@/lib/config/accounts";

export function TestConnectionButton({
  kind,
  id,
}: {
  kind: AccountKind;
  id: string;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await testConnection(kind, id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={pending}
      aria-label="Testar conexão"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Plug className="size-4" />
      )}
      <span className="hidden sm:inline">Testar</span>
    </Button>
  );
}
