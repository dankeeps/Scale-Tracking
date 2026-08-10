import { WEBHOOK_COMPRA_PATH } from "@/lib/constants";

// Montagem da URL do webhook. Compartilhado entre o formulário (pré-visualização
// ao vivo) e a action que grava — para os dois normalizarem igual.

/** Placeholder mostrado enquanto não há token novo na tela. */
export const TOKEN_PLACEHOLDER = "SEU-TOKEN";

/**
 * Limpa o que a pessoa digitar no campo de domínio: aceita `https://x.com/`,
 * `x.com`, com espaços ou barra no fim, e devolve só o host (`x.com`).
 */
export function normalizeDomain(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "") // tira o protocolo
    .replace(/\/.*$/, "") // tira caminho, query e âncora
    .replace(/^\.+|\.+$/g, "") // tira pontos soltos nas pontas
    .slice(0, 253); // limite de um hostname
}

const isLocal = (domain: string): boolean =>
  /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(domain);

/**
 * URL completa para cadastrar na plataforma de venda. Sem token à vista, entra
 * o placeholder — a pessoa vê o formato mesmo antes de gerar.
 */
export function buildWebhookUrl(
  domain: string,
  token: string | null | undefined,
): string {
  const host = normalizeDomain(domain);
  if (!host) return "";
  const scheme = isLocal(host) ? "http" : "https";
  const t = token?.trim() || TOKEN_PLACEHOLDER;
  return `${scheme}://${host}${WEBHOOK_COMPRA_PATH}?token=${encodeURIComponent(t)}`;
}
