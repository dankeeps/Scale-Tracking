/**
 * Modo demonstração.
 *
 * O sistema é um TEMPLATE: você duplica para cada especialista/cliente. Enquanto
 * a pilha do Supabase não estiver configurada (env vazio), o painel abre SEM
 * login e mostra dados fictícios, só para a pessoa ver como o sistema funciona.
 * No instante em que as 3 variáveis do Supabase existirem, o modo demo desliga
 * sozinho: volta o login e todos os dados passam a vir do banco real.
 *
 * Não importe este módulo em Client Components — o flag chega por props.
 */

function has(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** true quando as 3 chaves do Supabase estão presentes. */
export const SUPABASE_CONFIGURED: boolean =
  has(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  has(process.env.SUPABASE_SERVICE_ROLE_KEY);

/** true quando o painel deve rodar em vitrine (sem login, dados fictícios). */
export const IS_DEMO: boolean = !SUPABASE_CONFIGURED;

/** Mensagem padrão para ações de escrita bloqueadas na demonstração. */
export const DEMO_WRITE_ERROR =
  "Modo demonstração: conecte o Supabase para salvar dados de verdade.";
