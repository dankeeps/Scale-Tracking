import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/panel-shell";
import { IS_DEMO } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout do painel. Proteção REAL da sessão: valida getUser() no servidor.
 * (O proxy.ts só faz o redirecionamento otimista + renovação de cookies.)
 *
 * Em modo demonstração (Supabase ainda não configurado) não há sessão nem banco:
 * o painel abre livre, só com dados fictícios. Assim que as chaves do Supabase
 * entram no ambiente, o login volta a ser obrigatório automaticamente.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (IS_DEMO) {
    return (
      <PanelShell email={null} demo>
        {children}
      </PanelShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <PanelShell email={user.email ?? null}>{children}</PanelShell>;
}
