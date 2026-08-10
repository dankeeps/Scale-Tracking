import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IS_DEMO } from "@/lib/demo/mode";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // Sem Supabase não existe usuário para autenticar: manda direto ao painel de
  // demonstração em vez de mostrar um formulário que nunca vai funcionar.
  if (IS_DEMO) redirect("/dashboard");

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
