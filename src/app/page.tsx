import { redirect } from "next/navigation";
import { IS_DEMO } from "@/lib/demo/mode";

// Decidido a cada request: a chave service_role só existe em runtime, então o
// destino não pode ficar congelado no build.
export const dynamic = "force-dynamic";

// A raiz vai direto para o login — ou, enquanto o Supabase não estiver
// configurado, direto para o painel de demonstração (que não pede senha).
export default function Home() {
  redirect(IS_DEMO ? "/dashboard" : "/login");
}
